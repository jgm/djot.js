import { Doc, Reference, Footnote, HasChildren, Node } from "./ast.js";

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

class HTMLRenderer {
  buffer : string[];
  tight : boolean;
  footnoteIndex : Record<string, any>; // TODO
  nextFootnoteIndex : number; // TODO?
  references: Record<string, Reference>;
  footnotes: Record<string, Footnote>;

  constructor() {
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
    this.buffer.push(s);
  }

  renderAttributes (node : any) : void {
    if (node.attributes) {
      for (let k in node.attributes) {
        this.out(` ${k}="${escape(node.attributes[k])}"`);
      }
    }
    if (node.pos) {
      let sp = node.pos.start;
      let ep = node.pos.end;
      this.out(` data-startpos="${sp.line}:${sp.col}:${sp.offset}" data-endpos="${ep.line}:${ep.col}:${ep.offset}"`);
    }
  }

  renderTag (tag : string, node : any) : void {
    this.out("<");
    this.out(tag);
    this.renderAttributes(node);
    this.out(">");
  }

  renderCloseTag (tag : string) : void {
    this.out("</");
    this.out(tag);
    this.out(">");
  }

  inTags (tag : string, node : any, newlines : number) : void {
    this.renderTag(tag, node);
    if (newlines > 1) { this.out("\n"); }
    this.renderChildren(node);
    this.renderCloseTag(tag);
    if (newlines === 1) { this.out("\n"); }
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

      case "heading":
        this.inTags(`h${node.level}`, node, 1);
        break;

      case "thematic_break":
        this.renderTag("hr", node);
        this.out("\n");
        break;

      case "str":
        this.out(this.escape(node.text));
        break;

      case "softbreak":
        this.out("\n");
        break;

      case "strong":
        this.inTags("strong", node, 0);
        break;

      case "emph":
        this.inTags("em", node, 0);
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
    this.renderChildren(doc);
    return this.buffer.join("");
  }
}

const renderHTML = function(ast : Doc) : string {
  let renderer = new HTMLRenderer();
  return renderer.render(ast);
}

export { renderHTML }

