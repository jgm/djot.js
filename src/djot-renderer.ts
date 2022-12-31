import { Doc, AstNode, HasChildren, Str, Para, Heading,
         Section } from "./ast";

class DjotRenderer {

  doc : Doc;
  wrapWidth ?: number;
  prefixes : string[] = [];
  buffer : string[] = [];
  startOfLine : boolean = true;
  column : number = 0;
  needsSpace : boolean = false;

  constructor(doc : Doc, wrapWidth ?: number) {
    this.doc = doc;
    this.wrapWidth = wrapWidth;
  }

  escape (s : string) : string {
    return s.replace(/([!~`#${}[\]^<>\\*_-])/g, "\\$1");
  }

  out (s : string) : void {
    this.lit(this.escape(s));
  }

  lit (s : string) : void {
    this.startOfLine = false;
    if (this.wrapWidth && !this.startOfLine &&
        this.column + s.length > this.wrapWidth) {
      this.buffer.push("\n");
      this.startOfLine = true;
      this.column = 0;
    }
    if (this.startOfLine) {
      for (let i=0, len = this.prefixes.length; i < len; i++) {
        this.buffer.push(this.prefixes[i]);
      }
    } else if (this.needsSpace) {
      this.buffer.push(" ");
      this.column += 1;
    }
    this.buffer.push(s);
    this.column += s.length;
    this.needsSpace = false;
  }

  newline () : void {
    this.lit("\n");
    this.startOfLine = true;
    this.column = 0;
    this.needsSpace = false;
  }

  cr () : void {
    if (!this.startOfLine) {
      this.newline();
    }
  }

  space () : void {
    this.needsSpace = true;
  }

  softbreak () : void {
    if (this.wrapWidth) {
      this.space();
    } else {
      this.newline();
    }
  }

  handlers : Record<string, (node : any) => void> = {
    doc: (node : Doc) => {
      this.renderChildren(node);
    },
    para: (node: Para) => {
      this.renderChildren(node);
      this.cr();
      this.newline();
    },
    heading: (node : Heading) => {
      this.lit("#".repeat(node.level) + " ");
      this.renderChildren(node);
      this.cr();
      this.newline();
    },
    section: (node : Section) => {
      for (let i=0, len = node.children.length; i < len; i++) {
        let child = node.children[i];
        if (i === 0 && child.tag === "heading") {
          let newchild = structuredClone(child);
          if (node.attributes && node.attributes.id) {
            newchild.attributes = newchild.attributes || {};
            newchild.attributes.id = node.attributes.id;
          }
          child = newchild;
        }
        this.renderNode(child);
      }
    },
    str: (node : Str) => {
      node.text.split(/  */).forEach((s : string, i : number) => {
        if (i > 0) {
          this.space();
        }
        this.out(s);
      });
    },
    space: () => {
      this.space();
    },
    softbreak: () => {
      this.softbreak();
    }
  }

  renderChildren(node : HasChildren) : void {
    for (let i=0, len = node.children.length; i < len; i++) {
      this.renderNode(node.children[i]);
    }
  }

  renderNode(node : AstNode) : void {
  let handler = this.handlers[node.tag];
    if (handler) {
      handler(node);
    }
  }

  render() : string {
    this.renderNode(this.doc);
    return this.buffer.join("");
  }

}

export { DjotRenderer }
