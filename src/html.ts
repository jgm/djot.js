import {
  Doc, Reference, Footnote, Link, HasChildren, HasAttributes,
  AstNode, ParseOptions, getStringContent
}
  from "./ast";

const defaultWarnings = function(message: string, pos: number) {
  console.log(message + (pos ? " at " + pos : "") + "\n");
}

class HTMLRenderer {
  warn: (message: string, pos: number) => void;
  options : ParseOptions;
  buffer: string[];
  tight: boolean;
  footnoteIndex: Record<string, number>;
  nextFootnoteIndex: number;
  references: Record<string, Reference>;
  footnotes: Record<string, Footnote>;

  constructor(options : ParseOptions) {
    this.warn = options.warn || defaultWarnings;
    this.options = options || {};
    this.buffer = [];
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

  out(s: string): void {
    this.buffer.push(this.escape(s));
  }

  literal(s: string): void {
    this.buffer.push(s);
  }

  renderAttributes(node: HasAttributes, extraAttrs?: Record<string, string>)
    : void {
    if (extraAttrs) {
      for (const k in extraAttrs) {
        if (k === "class") {
          let v = extraAttrs[k];
          if (node.attributes && node.attributes.class) {
            v = v + " " + node.attributes.class;
          }
          this.literal(` ${k}="${this.escapeAttribute(v)}"`);
        } else {
          this.literal(` ${k}="${this.escapeAttribute(extraAttrs[k])}"`);
        }
      }
    }
    if (node.attributes) {
      for (const k in node.attributes) {
        const v = node.attributes[k];
        if (!(k === "class" && extraAttrs && extraAttrs.class)) {
          this.literal(` ${k}="${this.escapeAttribute(v)}"`);
        }
      }
    }
    if (this.options.sourcePositions && node.pos) {
      const sp = node.pos.start;
      const ep = node.pos.end;
      this.literal(` data-startpos="${sp.line}:${sp.col}:${sp.offset}" data-endpos="${ep.line}:${ep.col}:${ep.offset}"`);
    }
  }

  renderTag(tag: string, node: AstNode, extraAttrs?: Record<string, string>)
    : void {
    this.literal("<");
    this.literal(tag);
    if ("attributes" in node || extraAttrs || node.pos) {
      this.renderAttributes(node, extraAttrs);
    }
    this.literal(">");
  }

  renderCloseTag(tag: string): void {
    this.literal("</");
    this.literal(tag);
    this.literal(">");
  }

  inTags(tag: string, node: AstNode, newlines: number,
    extraAttrs?: Record<string, string>): void {
    this.renderTag(tag, node, extraAttrs);
    if (newlines >= 2) { this.literal("\n"); }
    if ("children" in node) {
      this.renderChildren(node);
    }
    this.renderCloseTag(tag);
    if (newlines >= 1) { this.literal("\n"); }
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

  renderChildren(node: HasChildren<AstNode>): void {
    const oldtight = this.tight;
    if ("tight" in node) {
      this.tight = !!node.tight;
    }
    node.children.forEach(child => {
      this.renderAstNode(child);
    });
    if ("tight" in node) {
      this.tight = oldtight;
    }
  }

  renderAstNode(node: AstNode): void {
    let extraAttr: Record<string, string> = {};
    switch (node.tag) {
      case "para":
        if (this.tight) {
          this.renderChildren(node);
          this.literal("\n");
        } else {
          this.inTags("p", node, 1);
        }
        break;

      case "blockquote":
        this.inTags("blockquote", node, 2);
        break;

      case "div":
        this.inTags("div", node, 2);
        break;

      case "section":
        this.inTags("section", node, 2);
        break;

      case "list_item":
        extraAttr = {};
        if (node.checkbox) {
          extraAttr.class =
            node.checkbox === "checked" ? "checked" : "unchecked";
        }
        this.inTags("li", node, 2, extraAttr);
        break;

      case "definition_list_item":
        this.renderChildren(node);
        break;

      case "definition":
        this.inTags("dd", node, 2);
        break;

      case "term":
        this.inTags("dt", node, 1);
        break;

      case "list":
        if (node.style === "-" || node.style === "*" || node.style === "+") {
          this.inTags("ul", node, 2);
        } else if (node.style === ":") {
          this.inTags("dl", node, 2);
        } else if (node.style === "X") {
          this.inTags("ul", node, 2, { class: "task-list" });
        } else {
          extraAttr = {};
          if (node.start && node.start !== 1) {
            extraAttr.start = node.start.toString()
          }
          if (node.style && !/1/.test(node.style)) {
            extraAttr.type = node.style.replace(/[().]/g, "");
          }
          this.inTags("ol", node, 2, extraAttr);
        }
        break;

      case "heading":
        this.inTags(`h${node.level}`, node, 1);
        break;

      case "footnote_reference": {
        const label = node.text;
        let index = this.footnoteIndex[label];
        if (!index) {
          index = this.nextFootnoteIndex;
          this.footnoteIndex[label] = index;
          this.nextFootnoteIndex++;
        }
        this.renderTag("a", node, {
          id: "fnref" + index,
          href: "#fn" + index,
          role: "doc-noteref"
        });
        this.literal("<sup>");
        this.out(index.toString());
        this.literal("</sup></a>");
        break;
      }

      case "table":
        this.inTags("table", node, 2);
        break;

      case "caption":
        this.inTags("caption", node, 1);
        break;

      case "row":
        this.inTags("tr", node, 2);
        break;

      case "cell": {
        const cellAttr: Record<string, string> = {};
        if (node.align !== "default") {
          cellAttr.style = `text-align: ${node.align};`;
        }
        this.inTags(node.head ? "th" : "td", node, 1, cellAttr);
        break;
      }

      case "thematic_break":
        this.renderTag("hr", node);
        this.literal("\n");
        break;

      case "code_block":
        this.renderTag("pre", node);
        this.literal("<code");
        if (node.lang) {
          this.literal(` class="language-${this.escapeAttribute(node.lang)}"`);
        }
        this.literal(">");
        this.out(node.text);
        this.renderCloseTag("code");
        this.renderCloseTag("pre");
        this.literal("\n");
        break;

      case "raw_block":
        if (node.format === "html") {
          this.literal(node.text);
        }
        break;

      case "str":
        if (node.attributes) {
          this.renderTag("span", node);
          this.out(node.text);
          this.renderCloseTag("span");
        } else {
          this.out(node.text);
        }
        break;

      case "left_double_quote":
        this.literal("&ldquo;");
        break;

      case "right_double_quote":
        this.literal("&rdquo;");
        break;

      case "left_single_quote":
        this.literal("&lsquo;");
        break;

      case "right_single_quote":
        this.literal("&rsquo;");
        break;

      case "double_quoted":
        this.literal("&ldquo;");
        this.renderChildren(node);
        this.literal("&rdquo;");
        break;

      case "single_quoted":
        this.literal("&lsquo;");
        this.renderChildren(node);
        this.literal("&rsquo;");
        break;

      case "ellipses":
        this.literal("&hellip;");
        break;

      case "em_dash":
        this.literal("&mdash;");
        break;

      case "en_dash":
        this.literal("&ndash;");
        break;

      case "symbol": {
        this.out(`:${node.alias}:`);
        break;
      }

      case "math":
        this.renderTag("span", node,
          { class: "math " + (node.display ? "display" : "inline") });
        if (node.display) {
          this.out("\\[");
        } else {
          this.out("\\(");
        }
        this.out(node.text);
        if (node.display) {
          this.out("\\]");
        } else {
          this.out("\\)");
        }
        this.renderCloseTag("span");
        break;

      case "verbatim":
        this.renderTag("code", node);
        this.out(node.text);
        this.renderCloseTag("code");
        break;

      case "raw_inline":
        if (node.format === "html") {
          this.literal(node.text);
        }
        break;

      case "softbreak":
        this.literal("\n");
        break;

      case "hardbreak":
        this.literal("<br>\n");
        break;

      case "nbsp":
        this.literal("&nbsp;");
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
          this.renderTag("img", node, extraAttr);
        } else {
          this.inTags("a", node, 0, extraAttr);
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
        this.renderTag("a", node, extraAttr);
        this.out(node.text);
        this.renderCloseTag("a");
        break;

      case "strong":
        this.inTags("strong", node, 0);
        break;

      case "emph":
        this.inTags("em", node, 0);
        break;

      case "span":
        this.inTags("span", node, 0);
        break;

      case "mark":
        this.inTags("mark", node, 0);
        break;

      case "insert":
        this.inTags("ins", node, 0);
        break;

      case "delete":
        this.inTags("del", node, 0);
        break;

      case "superscript":
        this.inTags("sup", node, 0);
        break;

      case "subscript":
        this.inTags("sub", node, 0);
        break;

      default:
    }
  }

  render(doc: Doc): string {
    this.references = doc.references;
    this.footnotes = doc.footnotes;
    this.renderChildren(doc);
    if (this.nextFootnoteIndex > 1) {
      // render notes
      const orderedFootnotes = [];
      for (const k in this.footnotes) {
        const index = this.footnoteIndex[k];
        orderedFootnotes[index] = this.footnotes[k];
      }
      this.literal(`<section role="doc-endnotes">\n<hr>\n<ol>\n`);
      for (let i = 1; i < orderedFootnotes.length; i++) {
        this.literal(`<li id="fn${i}">\n`);
        const note = this.addBacklink(orderedFootnotes[i], i);
        this.renderChildren(note);
        this.literal(`</li>\n`);
      }
      this.literal(`</ol>\n</section>\n`);
    }
    return this.buffer.join("");
  }
}

const renderHTML = function(ast: Doc, options ?: ParseOptions): string {
  options = options || {};
  const renderer = new HTMLRenderer(options);
  return renderer.render(ast);
}

export { renderHTML }

