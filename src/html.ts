import { Doc, Reference, Footnote, Link, HasChildren,
         HasAttributes, AstNode, Visitor } from "./ast";
import { getStringContent } from "./parse";
import { Options, Warning } from "./options";

interface HTMLRenderOptions extends Options {
  overrides?: Visitor<HTMLRenderer, string>;
}

const reNeedsEscape = /[&<>]/;
const reNeedsEscapeAttr = /[&<>"]/;

class HTMLRenderer {
  warn: (warning : Warning) => void;
  options: HTMLRenderOptions;
  private tight: boolean;
  footnoteIndex: Record<string, number>;
  nextFootnoteIndex: number;
  references: Record<string, Reference>;
  autoReferences: Record<string, Reference>;

  constructor(options : HTMLRenderOptions) {
    this.warn = options.warn || (() => {});
    this.options = options || {};
    this.tight = false;
    this.footnoteIndex = {};
    this.nextFootnoteIndex = 1;
    this.references = {};
    this.autoReferences = {};
  }

  escape(s: string): string {
    if (reNeedsEscape.test(s)) {
      return s
       .replace(/&/g, "&amp;")
       .replace(/</g, "&lt;")
       .replace(/>/g, "&gt;");
    } else {
      return s;
    }
  }

  escapeAttribute(s: string): string {
    if (reNeedsEscapeAttr.test(s)) {
      return s
       .replace(/&/g, "&amp;")
       .replace(/</g, "&lt;")
       .replace(/>/g, "&gt;")
       .replace(/"/g, "&quot;");
    } else {
      return s;
    }
  }

  smartPunctuationMap : Record<string, string> = {
    right_single_quote: "’",
    left_single_quote: "‘",
    right_double_quote: "”",
    left_double_quote: "“",
    ellipses: "…",
    em_dash: "—",
    en_dash: "–"
  }

  renderAttributes(node: HasAttributes, extraAttrs?: Record<string, string>)
    : string {
    let result  = "";
    if (extraAttrs) {
      for (const k in extraAttrs) {
        if (k === "class") {
          let v = extraAttrs[k];
          if (node.attributes && node.attributes.class) {
            v = `${v} ${node.attributes.class}`;
          }
          result += ` ${k}="${this.escapeAttribute(v)}"`;
        } else {
          result += ` ${k}="${this.escapeAttribute(extraAttrs[k])}"`;
        }
      }
    }
    const attributes = {
      ...node.autoAttributes,
      ...node.attributes,
    }
    if (attributes) {
      for (const k in attributes) {
        const v = attributes[k];
        if (!(k === "class" && extraAttrs && extraAttrs.class)) {
          result += ` ${k}="${this.escapeAttribute(v)}"`;
        }
      }
    }
    if (node.pos) {
      const sp = node.pos.start;
      const ep = node.pos.end;
      result += ` data-startpos="${sp.line}:${sp.col}:${sp.offset}" data-endpos="${ep.line}:${ep.col}:${ep.offset}"`;
    }
    return result;
  }

  renderTag(tag: string, node: AstNode, extraAttrs?: Record<string, string>)
    : string {
    let attributes = "";
    if (node.attributes || node.autoAttributes || extraAttrs || node.pos) {
      attributes = this.renderAttributes(node, extraAttrs);
    }
    return `<${tag}${attributes}>`;
  }

  renderCloseTag(tag: string): string {
    return `</${tag}>`
  }

  inTags(tag: string, node: HasChildren<AstNode>, newlines: number,
    extraAttrs?: Record<string, string>): string {
    const afterOpenSpace = newlines >= 2 ? "\n" : "";
    const afterCloseSpace = newlines >= 1 ? "\n" : "";
    return `${this.renderTag(tag, node as AstNode, extraAttrs)}${afterOpenSpace}${this.renderChildren(node)}</${tag}>${afterCloseSpace}`;
  }

  addBacklink(note : string, ident: number): string {
    const backlink  = `<a href="#fnref${ident}" role="doc-backlink">\u21A9\uFE0E</a>`;
    if (/\<\/p\>[\r\n]*$/.test(note)) {
      return note.replace(/\<\/p\>([\r\n]*)$/, backlink + "</p>$1");
    } else {
      return note + `<p>${backlink}</p>\n`;
    }
  }

  renderChildren(node: HasChildren<AstNode>): string {
    let result = ""
    const oldtight = this.tight;
    if ("tight" in node) {
      this.tight = !!node.tight;
    }
    for (const child of node.children) {
      result += this.renderAstNode(child);
    }
    if ("tight" in node) {
      this.tight = oldtight;
    }
    return result
  }

  renderAstNode(node: AstNode): string {
    const override = this.options.overrides?.[node.tag];
    if (override) {
      return (override as (node: AstNode, context: HTMLRenderer) => string)(node, this);
    }
    return this.renderAstNodeDefault(node);
  }

  renderNotes(notes: Record<string, Footnote>): string {
    let result  = "";
    const orderedFootnotes = [];
    const renderedNotes : Record<string, string> = {};
    for (const k in notes) {
      renderedNotes[k] = this.renderChildren(notes[k]);
    }
    // now this.footnoteIndex includes notes only indexed in other notes (#37)
    for (const k in this.footnoteIndex) {
      const index = this.footnoteIndex[k];
      if (index) {
        orderedFootnotes[index] = renderedNotes[k];
      }
    }
    result += `<section role="doc-endnotes">\n<hr>\n<ol>\n`;
    for (let i = 1; i < orderedFootnotes.length; i++) {
      // note: there can be gaps in the sequence, so we
      // want to insert a dummy note in that case
      const note = orderedFootnotes[i] || "";
      result += `<li id="fn${i}">\n`;
      result += this.addBacklink(note, i);
      result += `</li>\n`;
    }
    result += `</ol>\n</section>\n`;
    return result;
  }

  renderAstNodeDefault(node: AstNode): string {
    switch (node.tag) {
      case "doc": {
        let result  = "";
        result += this.renderChildren(node);
        if (this.nextFootnoteIndex > 1) {
          // render notes
          result += this.renderNotes(node.footnotes);
        }
        return result;
      }


      case "para": {
        if (this.tight) {
          return `${this.renderChildren(node)}\n`;
        } else {
          return this.inTags("p", node, 1);
        }
      }

      case "block_quote":
        return this.inTags("blockquote", node, 2);

      case "div":
        return this.inTags("div", node, 2);

      case "section":
        return this.inTags("section", node, 2);

      case "list_item":
        return this.inTags("li", node, 2);

      case "task_list_item":
        return this.inTags("li", node, 2,
                           { class: node.checkbox === "checked"
                               ? "checked" : "unchecked" });

      case "definition_list_item":
        return this.renderChildren(node);

      case "definition":
        return this.inTags("dd", node, 2);

      case "term":
        return this.inTags("dt", node, 1);

      case "definition_list":
        return this.inTags("dl", node, 2);

      case "bullet_list":
        return this.inTags("ul", node, 2);

      case "task_list":
        return this.inTags("ul", node, 2, { class: "task-list" });

      case "ordered_list": {
        const extraAttr : Record<string,string> = {};
        if (node.start && node.start !== 1) {
          extraAttr.start = node.start.toString();
        }
        if (node.style && !/1/.test(node.style)) {
          extraAttr.type = node.style.replace(/[().]/g, "");
        }
        return this.inTags("ol", node, 2, extraAttr);
      }

      case "heading":
        return this.inTags(`h${node.level}`, node, 1);

      case "footnote_reference": {
        let result = "";
        const label = node.text;
        let index = this.footnoteIndex[label];
        if (!index) {
          index = this.nextFootnoteIndex;
          this.footnoteIndex[label] = index;
          this.nextFootnoteIndex++;
        }
        result += this.renderTag("a", node, {
          id: "fnref" + index,
          href: "#fn" + index,
          role: "doc-noteref"
        });
        result += "<sup>";
        result += this.escape(index.toString());
        result += "</sup></a>";
        return result;
      }

      case "table":
        return this.inTags("table", node, 2);

      case "caption": {
        let result = "";
        // AST always has at least a dummy caption, no
        // need to render that.
        if (node.children.length > 0) {
          result += this.inTags("caption", node, 1);
        }
        return result;
      }

      case "row":
        return this.inTags("tr", node, 2);

      case "cell": {
        const cellAttr: Record<string, string> = {};
        if (node.align && node.align !== "default") {
          cellAttr.style = `text-align: ${node.align};`;
        }
        return this.inTags(node.head ? "th" : "td", node, 1, cellAttr);
      }

      case "thematic_break": {
        let result = "";
        result += this.renderTag("hr", node);
        result += "\n";
        return result;
      }

      case "code_block": {
        let result = "";
        result += this.renderTag("pre", node);
        result += "<code";
        if (node.lang) {
          result += ` class="language-${this.escapeAttribute(node.lang)}"`;
        }
        result += ">";
        result += this.escape(node.text);
        result += this.renderCloseTag("code");
        result += this.renderCloseTag("pre");
        result += "\n";
        return result;
      }

      case "raw_block": {
        let result = "";
        if (node.format === "html") {
          result += node.text;
        }
        return result;
      }

      case "str": {
        if (node.attributes || node.autoAttributes) {
          return `${this.renderTag("span", node)}${this.escape(node.text)}</span>`;
        } else {
          return this.escape(node.text);
        }
      }

      case "smart_punctuation":
        return this.smartPunctuationMap[node.type] || node.text;

      case "double_quoted": {
        let result = "";
        result += this.smartPunctuationMap.left_double_quote || '"';
        result += this.renderChildren(node);
        result += this.smartPunctuationMap.right_double_quote || '"';
        return result;
      }

      case "single_quoted": {
        let result = "";
        result += this.smartPunctuationMap.left_single_quote || "'";
        result += this.renderChildren(node);
        result += this.smartPunctuationMap.right_single_quote || "'";
        return result;
      }

      case "symb":
        return this.escape(`:${node.alias}:`);

      case "inline_math": {
        let result = "";
        result += this.renderTag("span", node, { class: "math inline" });
        result += `\\(${this.escape(node.text)}\\)`;
        result += this.renderCloseTag("span");
        return result;
      }

      case "display_math": {
        let result = "";
        result += this.renderTag("span", node, { class: "math display" });
        result += `\\[${this.escape(node.text)}\\]`;
        result += this.renderCloseTag("span");
        return result;
      }

      case "verbatim": {
        let result = "";
        result += this.renderTag("code", node);
        result += this.escape(node.text);
        result += this.renderCloseTag("code");
        return result;
      }

      case "raw_inline": {
        let result = "";
        if (node.format === "html") {
          result += node.text;
        }
        return result;
      }

      case "soft_break":
        return "\n";

      case "hard_break":
        return "<br>\n";

      case "non_breaking_space":
        return "&nbsp;";

      case "link":
      case "image": {
        const extraAttr : Record<string,string> = {};
        let dest: string | undefined = node.destination;
        if (node.reference) {
          const ref = this.references[node.reference] ||this.autoReferences[node.reference];
          if (ref) {
            dest = ref.destination;
            if (node.tag === "image") {
              extraAttr.alt = getStringContent(node);
              extraAttr.src = dest;
            } else {
              extraAttr.href = dest;
            }
            if (ref.attributes) {
              for (const k in ref.attributes) {
                if (!node.attributes || !node.attributes[k]) {
                  // attribs on link take priority over attribs on reference
                  extraAttr[k] = ref.attributes[k];
                }
              }
            }
            if (ref.autoAttributes) {
              for (const k in ref.autoAttributes) {
                if (!node.autoAttributes || !node.autoAttributes[k]) {
                  // attribs on link take priority over attribs on reference
                  extraAttr[k] = ref.autoAttributes[k];
                }
              }
            }
          } else {
            this.warn(new Warning(`Reference ${JSON.stringify(node.reference)} not found`, node?.pos?.end));
          }
        }
        else {
          if (node.tag === "image") {
            extraAttr.alt = getStringContent(node);
            if (dest !== undefined) {
              extraAttr.src = dest;
            }
          } else {
            if (dest !== undefined) {
              extraAttr.href = dest;
            }
          }
        }
        if (node.tag === "image") {
          return this.renderTag("img", node, extraAttr);
        } else {
          return this.inTags("a", node, 0, extraAttr);
        }
      }

      case "url":
      case "email": {
        let result = "";
        const extraAttr : Record<string,string> = {};
        if (node.tag === "email") {
          extraAttr.href = "mailto:" + node.text;
        } else {
          extraAttr.href = node.text;
        }
        result += this.renderTag("a", node, extraAttr);
        result += this.escape(node.text);
        result += this.renderCloseTag("a");
        return result;
      }

      case "strong":
        return  this.inTags("strong", node, 0);

      case "emph":
        return  this.inTags("em", node, 0);

      case "span":
        return  this.inTags("span", node, 0);

      case "mark":
        return  this.inTags("mark", node, 0);

      case "insert":
        return  this.inTags("ins", node, 0);

      case "delete":
        return  this.inTags("del", node, 0);

      case "superscript":
        return  this.inTags("sup", node, 0);

      case "subscript":
        return  this.inTags("sub", node, 0);

      default:
        return "";
    }
  }

  render(doc: Doc): string {
    this.references = doc.references;
    this.autoReferences = doc.autoReferences;
    return this.renderAstNode(doc);
  }
}

const renderHTML = function(ast: Doc, options: HTMLRenderOptions = {}): string {
  const renderer = new HTMLRenderer(options);
  return renderer.render(ast);
}

export type {
  HTMLRenderOptions
}
export {
  renderHTML,
  HTMLRenderer
}
