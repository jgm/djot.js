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
    return s; // TODO
  }

  out (s : string) : void {
    this.buffer.push(s);
  }

  renderChildren (node : HasChildren) : void {
    node.children.forEach(child => {
      this.renderNode(child);
    });
  }

  renderNode (node : Node) : void {
    switch(node.tag) {
      case "para":
        this.out("<p>");
        this.renderChildren(node);
        this.out("</p>\n");
        break;

      case "str":
        this.out(this.escape(node.text));
        break;

      case "softbreak":
        this.out("\n");
        break;

      default:
    }
  }

  render (doc : Doc) : string {
    this.renderChildren(doc);
    return this.buffer.join("");
  }
}


export { HTMLRenderer }

