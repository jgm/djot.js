import { Doc, Reference, Footnote, HasChildren, HasAttributes,
         Node, List, getStringContent }
  from "./ast";
const emoji = require("node-emoji");

const blockTag : Record<string, boolean> = {
  para: true,
  blockquote: true,
  thematic_break: true,
  list_item: true,
  list: true,
  code_block: true,
  heading: true,
  table: true
}

const defaultWarnings = function(message : string, pos : number) {
  process.stderr.write(message + (pos ? " at " + pos : "") + "\n");
}

class HTMLRenderer {
  warn : (message : string, pos : number) => void;
  buffer : string[];
  tight : boolean;
  footnoteIndex : Record<string, any>; // TODO
  nextFootnoteIndex : number; // TODO?
  references: Record<string, Reference>;
  footnotes: Record<string, Footnote>;

  constructor(warn ?: (message : string, pos : number) => void) {
    this.warn = warn || defaultWarnings;
    this.buffer = [];
    this.tight = false;
    this.footnoteIndex = {};
    this.nextFootnoteIndex = 1;
    this.references = {};
    this.footnotes = {};
  }

  escape (s : string) : string {
    return s
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;");
  }

  out (s : string) : void {
    this.buffer.push(this.escape(s));
  }

  literal (s : string) : void {
    this.buffer.push(s);
  }

  renderAttributes (node : HasAttributes, extraClasses ?: string[]) : void {
    if (node.attributes) {
      for (let k in node.attributes) {
        let v = node.attributes[k];
        if (k === "class" && extraClasses) {
          v = extraClasses.join(" ") + " " + v;
          extraClasses = undefined;
        }
        this.literal(` ${k}="${this.escape(v)}"`);
      }
    }
    if (extraClasses) {
      this.literal(` class="${extraClasses.join(' ')}"`);
    }
    if (node.pos) {
      let sp = node.pos.start;
      let ep = node.pos.end;
      this.literal(` data-startpos="${sp.line}:${sp.col}:${sp.offset}" data-endpos="${ep.line}:${ep.col}:${ep.offset}"`);
    }
  }

  renderTag (tag : string, node : Node, extraClasses ?: string[] )
      : void {
    this.literal("<");
    this.literal(tag);
    if ("attributes" in node) {
      this.renderAttributes(node, extraClasses);
    }
    this.literal(">");
  }

  renderCloseTag (tag : string) : void {
    this.literal("</");
    this.literal(tag);
    this.literal(">");
  }

  inTags (tag : string, node : Node, newlines : number) : void {
    this.renderTag(tag, node);
    if (newlines >= 2) { this.literal("\n"); }
    if ("children" in node) {
      this.renderChildren(node);
    }
    this.renderCloseTag(tag);
    if (newlines >= 1) { this.literal("\n"); }
  }

  renderChildren (node : HasChildren) : void {
    node.children.forEach(child => {
      this.renderNode(child);
    });
  }

  renderNode (node : Node) : void {
    switch(node.tag) {
      case "para":
        this.inTags("p", node, 1);
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
        this.inTags("li", node, 2);
        break;

      case "definition_list_item":
        this.renderChildren(node);
        break;

      case "definition":
        this.inTags("dd", node, 2);
        break;

      case "term":
        this.inTags("dt", node, 2);
        break;

      case "list":
        if (node.style === "-" || node.style === "*" || node.style === "+") {
          this.inTags("ul", node, 2);
        } else if (node.style === ":") {
          this.inTags("dl", node, 2);
        } else {
          let newattrs : Record<string,string> = {};
          for (let k in node.attributes) {
            newattrs[k] = node.attributes[k];
          }
          if (typeof node.start === "number" && node.start !== 1) {
            newattrs.start = node.start.toString();
          }
          if (node.style.match(/[aAiI]/)) {
            newattrs.type = node.style.replace(/[().]/g,"");
          }
          let linode : List =
                       { tag: "list",
                         children: node.children,
                         pos: node.pos,
                         attributes: newattrs,
                         style: node.style,
                         start: node.start };
          this.inTags("ol", linode, 2);
        }
        break;

      case "heading":
        this.inTags(`h${node.level}`, node, 1);
        break;

      case "table":
        this.inTags("table", node, 2);
        break;

      case "caption":
        this.inTags("caption", node, 1);
        break;

      case "row":
        this.inTags("tr", node, 2);
        break;

      case "cell":
        let cellnode : any = {};  // new node for combined attributes
        cellnode.pos = node.pos;
        cellnode.children = node.children;
        cellnode.attributes = {};
        if (node.align !== "default") {
          cellnode.attributes.style = `text-align: ${node.align};`;
        }
        for (let k in node.attributes) {
          if (cellnode.attributes[k]) { // allow adding to style
            cellnode.attributes[k] =
              cellnode.attributes[k] + " " + node.attributes[k];
          } else {
            cellnode.attributes[k] = node.attributes[k];
          }
        }
        this.inTags(node.head ? "th" : "td", cellnode, 1);
        break;

      case "thematic_break":
        this.renderTag("hr", node);
        this.literal("\n");
        break;

      case "code_block":
        this.renderTag("pre", node);
        this.literal("<code");
        if (node.lang) {
          this.literal(` class="language-${this.escape(node.lang)}"`);
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
        this.out(node.text);
        break;

      case "left_double_quote":
        this.literal("&ldquo;");
        break;

      case "right_single_quote":
        this.literal("&rsquo;");
        break;

      case "double_quoted":
        this.literal("&ldquo;");
        this.renderChildren(node);
        this.literal("rldquo;");
        break;

      case "single_quoted":
        this.literal("&lsquo;");
        this.renderChildren(node);
        this.literal("rsquo;");
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

      case "emoji":
        let ch = emoji.get(node.alias);
        if (ch) {
          this.out(ch);
        } else {
          this.out(`:${node.alias}:`);
        }
        break;

      case "math":
        this.renderTag("span", node,
                       ["math", node.display ? "display" : "inline"]);
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
      case "image":
        let newnode : any = {};  // new node for combined attributes
        newnode.pos = node.pos;
        newnode.children = node.children;
        newnode.attributes = {};
        let dest : string = node.destination || "";
        if (node.reference) {
          const ref = this.references[node.reference];
          if (ref) {
            dest = ref.destination;
            if (ref.attributes) {
              for (let k in ref.attributes) {
                newnode.attributes[k] = ref.attributes[k];
              }
            }
          } else {
            this.warn(`Reference ${JSON.stringify(node.reference)} not found`,
                       (node.pos && node.pos.end.offset) || 0);
            dest = "";
          }
        }
        if (node.tag === "image") {
          newnode.attributes.alt = getStringContent(node);
          newnode.attributes.src = dest;
        } else {
          newnode.attributes.href = dest;
        }
        if (node.attributes) {
          for (let k in node.attributes) {
            newnode.attributes[k] = node.attributes[k];
          }
        }
        if (node.tag === "image") {
          this.renderTag("img", newnode);
        } else {
          this.inTags("a", newnode, 0);
        }
        break;

      case "url":
      case "email":
        let linknode : any = {};  // new node for combined attributes
        linknode.pos = node.pos;
        linknode.children = {};
        linknode.text = node.text;
        linknode.attributes = {};
        if (node.tag === "email") {
          linknode.attributes.href = "mailto:" + node.text;
        } else {
          linknode.attributes.href = node.text;
        }
        if (node.attributes) {
          for (let k in node.attributes) {
            linknode.attributes[k] = node.attributes[k];
          }
        }
        if (linknode.attributes.class) {
          linknode.attributes.class = node.tag + " " +
                                        linknode.attributes.class;
        } else {
          linknode.attributes.class = node.tag;
        }
        this.renderTag("a", linknode);
        this.out(linknode.text);
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

  render (doc : Doc) : string {
    this.references = doc.references;
    this.footnotes = doc.footnotes;
    this.renderChildren(doc);
    return this.buffer.join("");
  }
}

const renderHTML = function(ast : Doc) : string {
  let renderer = new HTMLRenderer();
  return renderer.render(ast);
}

export { renderHTML }

