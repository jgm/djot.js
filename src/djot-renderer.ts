import { Doc, AstNode, HasInlineChildren,
         HasAttributes, Block, Para, Heading, Div, List, Table,
         BlockQuote, Section, CodeBlock, isBlock, RawBlock,
         ListItem, DefinitionListItem, Term, Definition,
         Link, Image, HasText, RawInline,
         isInline, Inline, Str, Math,
         Verbatim, getStringContent } from "./ast";

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

const verbatimDelim = function(node : HasText, minticks : number) : string {
  let backtickGroups = node.text.match(/(`+)/g);
  let backtickGroupLens : Record<number,boolean> = {};
  if (backtickGroups) {
    for (let i in backtickGroups) {
      backtickGroupLens[backtickGroups[i].length] = true;
    }
  }
  let numticks = minticks;
  while (backtickGroupLens[numticks]) {
    numticks++;
  }
  return "`".repeat(numticks);
}

const toRoman = function(x : number) : string {
  if (x < 0 || x >= 4000) {
    return "?";
  }
  let rom : string = "";
  while (x > 0) {
    if (x >= 1000) { rom += "M"; x -= 1000 }
    else if (x >= 900) { rom += "CM"; x-= 900 }
    else if (x >= 500) { rom += "D"; x -= 500 }
    else if (x >= 400) { rom += "CD"; x -= 400 }
    else if (x >= 100) { rom += "C"; x -= 100 }
    else if (x >= 90)  { rom += "XC"; x -= 90 }
    else if (x >= 50)  { rom += "L" ; x -= 50 }
    else if (x >= 40)  { rom += "XL"; x -= 40 }
    else if (x >= 10)  { rom += "X"; x -= 10 }
    else if (x == 9)   { rom += "IX"; x -= 9 }
    else if (x >= 5)   { rom += "V"; x -= 5 }
    else if (x == 4)   { rom += "IV"; x -= 4 }
    else if (x >= 1)   { rom += "I"; x -= 1 }
    else { throw("toRoman encountered x = " + x); }
  }
  return rom;
}

const formatNumber = function(num : number, style : string) : string {
  let delimPattern = style.replace(/[a-zA-Z0-9]+/g,"$");
  let numFormat = style.replace(/[.()]/g, "");
  let numStr : string;
  switch (numFormat) {
    case "1":
      numStr = num.toString();
      break;
    case "a":
      numStr = String.fromCodePoint(96 + (num % 26));
      break;
    case "A":
      numStr = String.fromCodePoint(64 + (num % 26));
      break;
    case "i":
      numStr = toRoman(num).toLowerCase();
      break;
    case "I":
      numStr = toRoman(num);
      break;
    default:
      throw("formatNumber encountered unknown style " + style);
  }
  return delimPattern.replace("$", numStr);
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
      for (let i=excessOnLine.length - 1; i >= 0; i--) {
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

  litlines (s : string) : void {
    let lns = s.split(/\r?\n/);
    if (lns[lns.length - 1] === "") {
      lns.pop();
    }
    lns.forEach((ln : string) => {
      this.lit(ln);
      this.cr();
    });
  }

  verbatimNode (node : HasText) : void {
    let ticks = verbatimDelim(node, 1);
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

  handlers : Record<string, (node : any) => void> = {
    doc: (node : Doc) => {
      this.renderChildren<Block>(node.children);
      this.prefixes = [];
      this.cr();
      let hasReferences = Object.keys(node.references).length > 0;
      if (hasReferences) {
        this.cr();
        this.newline();
      }
      for (let k in node.references) {
        this.cr();
        this.renderAttributes(node.references[k]);
        this.lit("[");
        this.lit(k);
        this.lit("]:");
        this.prefixes.push("  ");
        this.space();
        this.lit(node.references[k].destination);
        this.prefixes.pop();
        this.cr();
      }
      let hasFootnotes = Object.keys(node.footnotes).length > 0;
      for (let k in node.footnotes) {
        this.cr();
        this.newline();
        this.renderAttributes(node.footnotes[k]);
        this.lit("[^" + k + "]:");
        this.space();
        this.needsBlankLine = false;
        this.prefixes.push("  ");
        this.renderChildren<Block>(node.footnotes[k].children);
        this.prefixes.pop();
        this.cr();
      }
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
      this.blankline();
    },
    section: (node : Section) => {
      this.renderChildren<Block>(node.children);
    },
    code_block: (node : CodeBlock) => {
      let ticks = verbatimDelim(node, 3);
      this.lit(ticks);
      if (node.lang) {
        this.lit(" " + node.lang);
      }
      this.cr();
      this.litlines(node.text);
      this.cr();
      this.lit(ticks);
      this.blankline();
    },
    raw_block: (node : RawBlock) => {
      let ticks = verbatimDelim(node, 3);
      this.lit(ticks);
      this.lit(" =" + node.format);
      this.cr();
      this.litlines(node.text);
      this.cr();
      this.lit(ticks);
      this.blankline();
    },
    list: (node : List)  => {
      let style = node.style;
      let start = node.start || 1;
      let items = node.children;
      let tight = node.tight;
      for (let i=0; i < items.length; i++) {
        let item = items[i];
        if (i > 0) {
          this.cr();
          if (!tight) {
            this.newline();
          }
        }
        let marker : string;
        if (/[().]/.test(style)) {
          marker = formatNumber(start + i, style);
        } else if (style === "X") {
          marker = "-";
        } else {
          marker = style;
        }
        this.lit(marker);
        this.needsBlankLine = false;
        this.space();
        if ("checkbox" in item && item.checkbox) {
          this.lit(item.checkbox === "checked" ? "[X]" : "[ ]");
          this.space();
        }
        this.prefixes.push(" ".repeat(marker.length + 1));
        if (item.tag === "definition_list_item") {
          this.renderChildren<Term | Definition>(item.children);
        } else {
          this.renderChildren<Block>(item.children);
        }
        this.prefixes.pop();

      }
      if (tight) { // otherwise we already have a blankline
        this.blankline();
      }
    },
    table: (node : Table) => {
      // TODO
    },
    str: (node : Str) => {
      node.text.split(/  */).forEach((s : string, i : number) => {
        if (i > 0) {
          this.space();
        }
        this.out(s);
      });
    },
    space: () => { this.space(); },
    softbreak: () => { this.softbreak(); },
    right_single_quote: () => { this.lit("'"); },
    left_single_quote: () => { this.lit("'"); },
    right_double_quote: () => { this.lit("\""); },
    left_double_quote: () => { this.lit("\""); },
    ellipses: () => { this.lit("..."); },
    em_dash: () => { this.lit("---"); },
    en_dash: () => { this.lit("--"); },
    nbsp: () => { this.lit("\\ "); },
    single_quoted: this.inlineContainer("'"),
    double_quoted: this.inlineContainer("\""),
    emph: this.inlineContainer("_"),
    strong: this.inlineContainer("*"),
    superscript: this.inlineContainer("^"),
    subscript: this.inlineContainer("~"),
    mark: this.inlineContainer("=", true),
    delete: this.inlineContainer("-", true),
    insert: this.inlineContainer("+", true),
    link: (node : Link) => {
      this.lit("[");
      this.renderChildren<Inline>(node.children);
      this.lit("]");
      if (node.reference) {
        this.lit("[");
        if (node.reference !== getStringContent(node)) {
          this.lit(node.reference);
        }
        this.lit("]");
      } else if (node.destination) {
        this.lit("(");
        this.lit(node.destination);
        this.lit(")");
      } else { // should not happen
        this.lit("()");
      }
    },
    image: (node : Image) => {
      this.lit("![");
      this.renderChildren<Inline>(node.children);
      this.lit("]");
      if (node.reference) {
        this.lit("[");
        if (node.reference !== getStringContent(node)) {
          this.lit(node.reference);
        }
        this.lit("]");
      } else if (node.destination) {
        this.lit("(");
        this.lit(node.destination);
        this.lit(")");
      } else { // should not happen
        this.lit("()");
      }
    },
    raw_inline: (node : RawInline) => {
      this.verbatimNode(node);
      this.lit("{=" + node.format + "}");
    },
    verbatim: (node : Verbatim) => {
      this.verbatimNode(node);
    },
    math:  (node : Math) => {
      if (node.display) {
        this.lit("$$");
      } else {
        this.lit("$");
      }
      this.verbatimNode(node);
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
        this.lit(attr[k]);
      } else if (k === "class") {
        let classes = attr[k].split(/  */);
        for (let i=0; i < classes.length; i++) {
          if (i > 0) {
            this.space();
          }
          this.lit(".");
          this.lit(classes[i]);
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
    return this.buffer.join("");
  }

}

export { DjotRenderer }
