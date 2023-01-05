import { Doc, Reference, Footnote, Link, HasChildren,
         HasAttributes, AstNode, Visitor } from "./ast";
import { getStringContent } from "./parse";
import { Options, Warning } from "./options";

interface HTMLRenderOptions extends Options {
  overrides?: Visitor<HTMLRenderer, string>;
}

class HTMLRenderer {
  warn: (warning : Warning) => void;
  options: HTMLRenderOptions;
  tight: boolean;
  footnoteIndex: Record<string, number>;
  nextFootnoteIndex: number;
  references: Record<string, Reference>;
  footnotes: Record<string, Footnote>;

  constructor(options : HTMLRenderOptions) {
    this.warn = options.warn || (() => {});
    this.options = options || {};
    this.tight = false;
    this.footnoteIndex = {};
    this.nextFootnoteIndex = 1;
    this.references = {};
    this.footnotes = {};
  }

  escape(s: string): string {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  escapeAttribute(s: string): string {
    return this.escape(s)
      .replace(/"/g, "&quot;");
  }

  smartPunctuationMap : Record<string, string> = {
    right_single_quote: "&rsquo;",
    left_single_quote: "&lsquo;",
    right_double_quote: "&rdquo;",
    left_double_quote: "&ldquo;",
    ellipses: "&hellip;",
    em_dash: "&mdash;",
    en_dash: "&ndash;"
  }

  renderAttributes(node: HasAttributes, extraAttrs?: Record<string, string>)
    : string {
    let result = ""
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
    if (node.attributes) {
      for (const k in node.attributes) {
        const v = node.attributes[k];
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
    let result = `<${tag}`;
    if ("attributes" in node || extraAttrs || node.pos) {
      result += this.renderAttributes(node, extraAttrs);
    }
    result += ">";
    return result;
  }

  renderCloseTag(tag: string): string {
    return `</${tag}>`
  }

  inTags(tag: string, node: AstNode, newlines: number,
    extraAttrs?: Record<string, string>): string {
    let result = this.renderTag(tag, node, extraAttrs);
    if (newlines >= 2) { result += "\n"; }
    if ("children" in node) {
      result += this.renderChildren(node);
    }
    result += this.renderCloseTag(tag);
    if (newlines >= 1) { result += "\n";  }
    return result;
  }

  addBacklink(orignote: Footnote, ident: number): Footnote {
    const note = structuredClone(orignote); // we modify a deep copy
    const backlink: Link = {
      tag: "link",
      destination: `#fnref${ident}`,
      attributes: { role: "doc-backlink" },
      children: [{ tag: "str", text: "↩︎︎" }]
    };
    if (note.children.length >= 1) {
      const lastblock = note.children[note.children.length - 1];
      if (lastblock.tag === "para") {
        lastblock.children.push(backlink);
      } else {
        note.children.push({ tag: "para", children: [backlink] });
      }
    } else {
      note.children.push({ tag: "para", children: [backlink] });
    }
    return note;
  }

  renderChildren(node: HasChildren<AstNode>): string {
    let result = ""
    const oldtight = this.tight;
    if ("tight" in node) {
      this.tight = !!node.tight;
    }
    node.children.forEach((child) => {
      result += this.renderAstNode(child);
    });
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

  renderAstNodeDefault(node: AstNode): string {
    let result = ""
    let extraAttr: Record<string, string> = {};
    switch (node.tag) {
      case "para":
        if (this.tight) {
          result += this.renderChildren(node);
          result += "\n";
        } else {
          result += this.inTags("p", node, 1);
        }
        return result;

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
        let extraAttr : Record<string,string> = {};
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

      case "caption":
        // AST always has at least a dummy caption, no
        // need to render that.
        if (node.children.length > 0) {
          result += this.inTags("caption", node, 1);
        }
        return result;

      case "row":
        return this.inTags("tr", node, 2);

      case "cell": {
        const cellAttr: Record<string, string> = {};
        if (node.align !== "default") {
          cellAttr.style = `text-align: ${node.align};`;
        }
        return this.inTags(node.head ? "th" : "td", node, 1, cellAttr);
      }

      case "thematic_break":
        result += this.renderTag("hr", node);
        result += "\n";
        return result;

      case "code_block":
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

      case "raw_block":
        if (node.format === "html") {
          result += node.text;
        }
        return result;

      case "str":
        if (node.attributes) {
          result += this.renderTag("span", node);
          result += this.escape(node.text);
          result += this.renderCloseTag("span");
        } else {
          result += this.escape(node.text);
        }
        return result;

      case "smart_punctuation":
        return this.smartPunctuationMap[node.type] || node.text;

      case "double_quoted":
        result += this.smartPunctuationMap.left_double_quote || '"';
        result += this.renderChildren(node);
        result += this.smartPunctuationMap.right_double_quote || '"';
        return result;

      case "single_quoted":
        result += this.smartPunctuationMap.left_single_quote || "'";
        result += this.renderChildren(node);
        result += this.smartPunctuationMap.right_single_quote || "'";
        return result;

      case "symb":
        return this.escape(`:${node.alias}:`);

      case "inline_math":
        result += this.renderTag("span", node, { class: "math inline" });
        result += `\\(${this.escape(node.text)}\\)`;
        result += this.renderCloseTag("span");
        return result;

      case "display_math":
        result += this.renderTag("span", node, { class: "math display" });
        result += `\\[${this.escape(node.text)}\\]`;
        result += this.renderCloseTag("span");
        return result;

      case "verbatim":
        result += this.renderTag("code", node);
        result += this.escape(node.text);
        result += this.renderCloseTag("code");
        return result;

      case "raw_inline":
        if (node.format === "html") {
          result += node.text;
        }
        return result;

      case "soft_break":
        return "\n";

      case "hard_break":
        return "<br>\n";

      case "non_breaking_space":
        return "&nbsp;";

      case "link":
      case "image": {
        extraAttr = {};
        let dest: string | undefined = node.destination;
        if (node.reference) {
          const ref = this.references[node.reference];
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
          result += this.renderTag("img", node, extraAttr);
        } else {
          result += this.inTags("a", node, 0, extraAttr);
        }
        return result;
      }

      case "url":
      case "email":
        extraAttr = {};
        if (node.tag === "email") {
          extraAttr.href = "mailto:" + node.text;
        } else {
          extraAttr.href = node.text;
        }
        result += this.renderTag("a", node, extraAttr);
        result += this.escape(node.text);
        result += this.renderCloseTag("a");
        return result;

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
        return result;
    }
  }

  render(doc: Doc): string {
    let result = "";
    this.references = doc.references;
    this.footnotes = doc.footnotes;
    result += this.renderChildren(doc);
    if (this.nextFootnoteIndex > 1) {
      // render notes
      const orderedFootnotes = [];
      for (const k in this.footnotes) {
        const index = this.footnoteIndex[k];
        orderedFootnotes[index] = this.footnotes[k];
      }
      result += `<section role="doc-endnotes">\n<hr>\n<ol>\n`;
      for (let i = 1; i < orderedFootnotes.length; i++) {
        result += `<li id="fn${i}">\n`;
        const note = this.addBacklink(orderedFootnotes[i], i);
        result += this.renderChildren(note);
        result += `</li>\n`;
      }
      result += `</ol>\n</section>\n`;
    }
    return result;
  }
}

const renderHTML = function(ast: Doc, options: HTMLRenderOptions = {}): string {
  const renderer = new HTMLRenderer(options);
  return renderer.render(ast);
}

export {
  renderHTML,
  HTMLRenderer,
  HTMLRenderOptions
}
