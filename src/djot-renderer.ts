import { Doc, AstNode, HasChildren, Block, Inline, Str, Para, Heading,
         isBlock, isInline, HasAttributes, BlockQuote, Section } from "./ast";

class DjotRenderer {

  doc : Doc;
  wrapWidth ?: number;
  prefixes : string[] = [];
  buffer : string[] = [];
  startOfLine : boolean = true;
  endOfPrefix : number = 0;
  column : number = 1;
  needsSpace : boolean = false;
  needsBlankLine : boolean = false;

  constructor(doc : Doc, wrapWidth ?: number) {
    this.doc = doc;
    this.wrapWidth = wrapWidth;
  }

  escape (s : string) : string {
    return s.replace(/([!~`#${}[\]^<>\\*_]|-(?=-))/g, "\\$1");
  }

  out (s : string) : void {
    this.lit(this.escape(s));
  }

  doBlankLines() : void {
    if (this.needsBlankLine) {
      this.cr();
      this.newline();
      this.needsBlankLine = false;
    }
  }

  lit (s : string) : void {
    if (this.wrapWidth && !this.startOfLine &&
        this.column + s.length > this.wrapWidth) {
      this.newline();
      this.startOfLine = true;
      this.needsSpace = false;
      this.column = 1;
    }
    if (this.needsSpace && !this.startOfLine) {
      this.buffer.push(" ");
      this.column += 1;
    }
    this.buffer.push(s);
    this.column += s.length;
    this.startOfLine = false;
    this.needsSpace = false;
  }

  blankline () : void {
    this.needsBlankLine = true;
  }

  newline () : void {
    if (this.endOfPrefix === this.column) {
      // remove spaces after prefix
     this.buffer[this.buffer.length - 1] =
       this.buffer[this.buffer.length - 1].replace(/  *$/,"");
    }
    this.endOfPrefix = 0;
    this.column = 1;
    this.buffer.push("\n");
    if (this.prefixes.length > 0) {
      for (let i=0, len = this.prefixes.length; i < len; i++) {
        this.buffer.push(this.prefixes[i]);
        this.column += this.prefixes[i].length;
      }
      this.endOfPrefix = this.column;
    }
    this.startOfLine = true;
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
      this.renderChildren<Block>(node.children);
    },
    para: (node: Para) => {
      this.renderChildren<Inline>(node.children);
      this.blankline();
    },
    heading: (node : Heading) => {
      let hashes = "#".repeat(node.level);
      this.lit(hashes + " ");
      this.prefixes.push(hashes + " ");
      this.renderChildren<Inline>(node.children);
      this.prefixes.pop();
      this.blankline();
    },
    blockquote: (node: BlockQuote) => {
      this.prefixes.push("> ");
      this.lit("> ");
      this.renderChildren<Block>(node.children);
      this.prefixes.pop();
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
        this.renderNode<Block>(child);
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


  renderChildren<A extends AstNode>(children : A[]) : void {
    for (let i=0, len = children.length; i < len; i++) {
      this.renderNode(children[i]);
    }
  }

  renderNode<A extends AstNode>(node : A) : void {
    this.doBlankLines();
    let handler = this.handlers[node.tag];
    if (handler) {
      if ("attributes" in node && isBlock(node)) {
        this.renderAttributes<Block>(node);
        this.cr();
      }
      handler(node);
      if ("attributes" in node && isInline(node)) {
        this.renderAttributes<Inline>(node);
      }
    }
  }

  renderAttributes<A extends AstNode & HasAttributes>(node : A) : void {

  }

  render() : string {
    this.renderNode(this.doc);
    this.prefixes = [];
    this.cr();
    return this.buffer.join("");
  }

}

export { DjotRenderer }
