import { Doc, AstNode, HasChildren, HasInlineChildren, HasBlockChildren,
         HasAttributes, Block, Para, Heading, Div,
         BlockQuote, Section, CodeBlock, isBlock,
         isInline, Inline, Str, DoubleQuoted, SingleQuoted, Emph, Strong,
         Verbatim } from "./ast";

const isWhitespace = function(node : Inline) : boolean {
  let tag : string = node.tag;
  return (tag === "space" || tag === "softbreak" || tag === "linebreak");
}

const beginsWithWhitespace = function(node : HasInlineChildren) : boolean {
  return (node.children[0] && isWhitespace(node.children[0]));
}

const endsWithWhitespace = function(node : HasInlineChildren) : boolean {
  return (node.children[0] &&
          isWhitespace(node.children[node.children.length - 1]));
}

class DjotRenderer {

  doc : Doc;
  wrapWidth ?: number;
  prefixes : string[] = [];
  buffer : string[] = [];
  startOfLine : boolean = true;
  endOfPrefix : number = 0;
  column : number = 0;
  needsBlankLine : boolean = false;

  constructor(doc : Doc, wrapWidth ?: number) {
    this.doc = doc;
    this.wrapWidth = wrapWidth;
  }

  escape (s : string) : string {
    return s.replace(/([!~`'"#${}[\]^<>\\*_]|-(?=-)|\.(?=\.))/g, "\\$1");
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
    this.buffer.push(s);
    this.column += s.length;
    this.startOfLine = false;
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
    this.column = 0;
    this.buffer.push("\n");
    if (this.prefixes.length > 0) {
      for (let i=0, len = this.prefixes.length; i < len; i++) {
        this.buffer.push(this.prefixes[i]);
        this.column += this.prefixes[i].length;
      }
      this.endOfPrefix = this.column;
    }
    this.startOfLine = true;
  }

  cr () : void {
    if (!this.startOfLine) {
      this.newline();
    }
  }

  space () : void {
    let excessOnLine : string[] = [];
    if (this.wrapWidth && !this.startOfLine && this.buffer.length > 0 &&
           this.column > this.wrapWidth) {
      // backup to last space:
      let lastbuff;
      while (this.buffer.length > 0) {
        lastbuff = this.buffer[this.buffer.length - 1];
        if (lastbuff === " ") {
          this.buffer.pop(); // remove space at end of line
          break;
        } else if (lastbuff === "\n") {
          break;
        }
        excessOnLine.push(lastbuff);
        this.buffer.pop();
      }
    }

    if (excessOnLine.length > 0) {
      // put the content on next line:
      this.newline();
      this.column = 0;
      this.startOfLine = true;
      for (let i in excessOnLine) {
        this.buffer.push(excessOnLine[i]);
        this.column += excessOnLine[i].length;
        this.startOfLine = false;
      }
    }
    this.lit(" ");
  }

  softbreak () : void {
    if (this.wrapWidth) {
      this.space();
    } else {
      this.newline();
    }
  }

  needsBraces (node : HasInlineChildren) : boolean {
    return ( beginsWithWhitespace(node) ||
             endsWithWhitespace(node) ||
             (this.buffer.length > 0 &&
              /\w$/.test(this.buffer[this.buffer.length - 1])) );
  }

  inlineContainer (delim : string, needsBraces ?: boolean)
      : ((node : HasInlineChildren) => void) {
    let self = this;
    return function(node : HasInlineChildren) : void {
      needsBraces = needsBraces || self.needsBraces(node);
      if (needsBraces) self.lit("{");
      self.lit(delim);
      self.renderChildren<Inline>(node.children);
      self.lit(delim);
      if (needsBraces) self.lit("}");
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
    thematic_break: () => {
      this.lit("* * * * *");
      this.blankline();
    },
    div: (node : Div) => {
      this.renderAttributes<Block>(node);
      this.lit(":::");
      this.cr();
      this.renderChildren<Block>(node.children);
      this.cr();
      this.lit(":::");
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
      this.renderChildren<Block>(node.children);
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
    },
    right_single_quote: () => {
      this.lit("'");
    },
    left_single_quote: () => {
      this.lit("'");
    },
    right_double_quote: () => {
      this.lit("\"");
    },
    left_double_quote: () => {
      this.lit("\"");
    },
    nbsp: () => {
      this.lit("\\ ");
    },
    single_quoted: (node : SingleQuoted) => {
      this.lit("'");
      this.renderChildren<Inline>(node.children);
      this.lit("'");
    },
    double_quoted: (node : DoubleQuoted) => {
      this.lit("\"");
      this.renderChildren<Inline>(node.children);
      this.lit("\"");
    },
    emph: this.inlineContainer("_"),
    strong: this.inlineContainer("*"),
    verbatim: (node : Verbatim) => {
      let backtickGroups = node.text.match(/(`+)/g);
      let backtickGroupLens : Record<number,boolean> = {};
      if (backtickGroups) {
        for (let i in backtickGroups) {
          backtickGroupLens[backtickGroups[i].length] = true;
        }
      }
      let numticks = 1;
      while (backtickGroupLens[numticks]) {
        numticks++;
      }
      let ticks = "`".repeat(numticks);
      this.lit(ticks);
      if (/^`/.test(node.text)) {
        this.lit(" ");
      }
      this.lit(node.text);
      if (/`$/.test(node.text)) {
        this.lit(" ");
      }
      this.lit(ticks);
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
    if (!node.attributes || Object.keys(node.attributes).length === 0) {
      return;
    }
    let attr = node.attributes;
    this.lit("{");
    let isfirst = true;
    if (isBlock(node)) {
      this.prefixes.push(" ");
    }
    for (let k in attr) {
      if (!isfirst) {
        this.space();
      }
      if (k === "id") {
        this.lit("#");
        this.out(attr[k]);
      } else if (k === "class") {
        let classes = attr[k].split(/  */);
        for (let i=0; i < classes.length; i++) {
          if (i > 0) {
            this.space();
          }
          this.lit(".");
          this.out(classes[i]);
        }
      } else {
        this.lit(k);
        this.lit("=\"");
        this.out(attr[k]);
        this.lit("\"");
      }
      isfirst = false;
    }
    if (isBlock(node)) {
      this.prefixes.pop();
    }
    this.lit("}");
  }

  render() : string {
    this.renderNode(this.doc);
    this.prefixes = [];
    this.cr();
    return this.buffer.join("");
  }

}

export { DjotRenderer }
