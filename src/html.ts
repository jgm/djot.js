import { Doc, Reference, Footnote, Link, HasChildren,
         HasAttributes, AstNode } from "./ast";
import { getStringContent, ParseOptions } from "./parse";

const defaultWarnings = function(message: string, pos?: number | null) {
  console.log(message + (pos ? " at " + pos : "") + "\n");
}

class HTMLRenderer {
  warn: (message: string, pos?: number | null) => void;
  options: ParseOptions;
  tight: boolean;
  footnoteIndex: Record<string, number>;
  nextFootnoteIndex: number;
  references: Record<string, Reference>;
  footnotes: Record<string, Footnote>;

  constructor(options : ParseOptions) {
    this.warn = options.warn || defaultWarnings;
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

  out(s: string): string {
    return this.escape(s);
  }

  literal(s: string): string {
    return s;
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
            v = v + " " + node.attributes.class;
          }
          result += this.literal(` ${k}="${this.escapeAttribute(v)}"`);
        } else {
          result += this.literal(` ${k}="${this.escapeAttribute(extraAttrs[k])}"`);
        }
      }
    }
    if (node.attributes) {
      for (const k in node.attributes) {
        const v = node.attributes[k];
        if (!(k === "class" && extraAttrs && extraAttrs.class)) {
          result += this.literal(` ${k}="${this.escapeAttribute(v)}"`);
        }
      }
    }
    if (this.options.sourcePositions && node.pos) {
      const sp = node.pos.start;
      const ep = node.pos.end;
      result += this.literal(` data-startpos="${sp.line}:${sp.col}:${sp.offset}" data-endpos="${ep.line}:${ep.col}:${ep.offset}"`);
    }
    return result;
  }

  renderTag(tag: string, node: AstNode, extraAttrs?: Record<string, string>)
    : string {
    let result = ""
    result += this.literal("<");
    result += this.literal(tag);
    if ("attributes" in node || extraAttrs || node.pos) {
      result += this.renderAttributes(node, extraAttrs);
    }
    result += this.literal(">");
    return result;
  }

  renderCloseTag(tag: string): string {
    return `</${tag}>`
  }

  inTags(tag: string, node: AstNode, newlines: number,
    extraAttrs?: Record<string, string>): string {
    let result = ""
    result += this.renderTag(tag, node, extraAttrs);
    if (newlines >= 2) { result += this.literal("\n"); }
    if ("children" in node) {
      result += this.renderChildren(node);
    }
    result += this.renderCloseTag(tag);
    if (newlines >= 1) { result += this.literal("\n"); }
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
    let result = ""
    let extraAttr: Record<string, string> = {};
    switch (node.tag) {
      case "para":
        if (this.tight) {
          result += this.renderChildren(node);
          result += this.literal("\n");
        } else {
          result += this.inTags("p", node, 1);
        }
        break;

      case "block_quote":
        result += this.inTags("blockquote", node, 2);
        break;

      case "div":
        result += this.inTags("div", node, 2);
        break;

      case "section":
        result += this.inTags("section", node, 2);
        break;

      case "list_item":
        extraAttr = {};
        if (node.checkbox) {
          extraAttr.class = node.checkbox === "checked"
            ? "checked"
            : "unchecked";
        }
        result += this.inTags("li", node, 2, extraAttr);
        break;

      case "definition_list_item":
        result += this.renderChildren(node);
        break;

      case "definition":
        result += this.inTags("dd", node, 2);
        break;

      case "term":
        result += this.inTags("dt", node, 1);
        break;

      case "list":
        if (node.style === "-" || node.style === "*" || node.style === "+") {
          result += this.inTags("ul", node, 2);
        } else if (node.style === ":") {
          result += this.inTags("dl", node, 2);
        } else if (node.style === "X") {
          result += this.inTags("ul", node, 2, { class: "task-list" });
        } else {
          extraAttr = {};
          if (node.start && node.start !== 1) {
            extraAttr.start = node.start.toString();
          }
          if (node.style && !/1/.test(node.style)) {
            extraAttr.type = node.style.replace(/[().]/g, "");
          }
          result += this.inTags("ol", node, 2, extraAttr);
        }
        break;

      case "heading":
        result += this.inTags(`h${node.level}`, node, 1);
        break;

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
        result += this.literal("<sup>");
        result += this.out(index.toString());
        result += this.literal("</sup></a>");
        break;
      }

      case "table":
        result += this.inTags("table", node, 2);
        break;

      case "caption":
        // AST always has at least a dummy caption, no
        // need to render that.
        if (node.children.length > 0) {
          result += this.inTags("caption", node, 1);
        }
        break;

      case "row":
        result += this.inTags("tr", node, 2);
        break;

      case "cell": {
        const cellAttr: Record<string, string> = {};
        if (node.align !== "default") {
          cellAttr.style = `text-align: ${node.align};`;
        }
        result += this.inTags(node.head ? "th" : "td", node, 1, cellAttr);
        break;
      }

      case "thematic_break":
        result += this.renderTag("hr", node);
        result += this.literal("\n");
        break;

      case "code_block":
        result += this.renderTag("pre", node);
        result += this.literal("<code");
        if (node.lang) {
          result += this.literal(` class="language-${this.escapeAttribute(node.lang)}"`);
        }
        result += this.literal(">");
        result += this.out(node.text);
        result += this.renderCloseTag("code");
        result += this.renderCloseTag("pre");
        result += this.literal("\n");
        break;

      case "raw_block":
        if (node.format === "html") {
          result += this.literal(node.text);
        }
        break;

      case "str":
        if (node.attributes) {
          result += this.renderTag("span", node);
          result += this.out(node.text);
          result += this.renderCloseTag("span");
        } else {
          result += this.out(node.text);
        }
        break;

      case "smart_punctuation":
        result += this.literal(this.smartPunctuationMap[node.type] || node.text);
        break;

      case "double_quoted":
        result += this.literal(this.smartPunctuationMap.left_double_quote || '"');
        result += this.renderChildren(node);
        result += this.literal(this.smartPunctuationMap.right_double_quote || '"');
        break;

      case "single_quoted":
        result += this.literal(this.smartPunctuationMap.left_single_quote || "'");
        result += this.renderChildren(node);
        result += this.literal(this.smartPunctuationMap.right_single_quote || "'");
        break;

      case "symb": {
        result += this.out(`:${node.alias}:`);
        break;
      }

      case "math":
        result += this.renderTag("span", node,
          { class: "math " + (node.display ? "display" : "inline") });
        if (node.display) {
          result += this.out("\\[");
        } else {
          result += this.out("\\(");
        }
        result += this.out(node.text);
        if (node.display) {
          result += this.out("\\]");
        } else {
          result += this.out("\\)");
        }
        result += this.renderCloseTag("span");
        break;

      case "verbatim":
        result += this.renderTag("code", node);
        result += this.out(node.text);
        result += this.renderCloseTag("code");
        break;

      case "raw_inline":
        if (node.format === "html") {
          result += this.literal(node.text);
        }
        break;

      case "soft_break":
        result += this.literal("\n");
        break;

      case "hard_break":
        result += this.literal("<br>\n");
        break;

      case "non_breaking_space":
        result += this.literal("&nbsp;");
        break;

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
            this.warn(`Reference ${JSON.stringify(node.reference)} not found`,
              (node.pos && node.pos.end.offset) || 0);
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
        break;
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
        result += this.out(node.text);
        result += this.renderCloseTag("a");
        break;

      case "strong":
        result += this.inTags("strong", node, 0);
        break;

      case "emph":
        result += this.inTags("em", node, 0);
        break;

      case "span":
        result += this.inTags("span", node, 0);
        break;

      case "mark":
        result += this.inTags("mark", node, 0);
        break;

      case "insert":
        result += this.inTags("ins", node, 0);
        break;

      case "delete":
        result += this.inTags("del", node, 0);
        break;

      case "superscript":
        result += this.inTags("sup", node, 0);
        break;

      case "subscript":
        result += this.inTags("sub", node, 0);
        break;

      default:
    }
    return result
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
      result += this.literal(`<section role="doc-endnotes">\n<hr>\n<ol>\n`);
      for (let i = 1; i < orderedFootnotes.length; i++) {
        result += this.literal(`<li id="fn${i}">\n`);
        const note = this.addBacklink(orderedFootnotes[i], i);
        result += this.renderChildren(note);
        result += this.literal(`</li>\n`);
      }
      result += this.literal(`</ol>\n</section>\n`);
    }
    return result;
  }
}

const renderHTML = function (ast: Doc, options: ParseOptions = {}): string {
  const renderer = new HTMLRenderer(options);
  return renderer.render(ast);
}

export { renderHTML }
