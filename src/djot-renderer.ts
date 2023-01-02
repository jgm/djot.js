import { Doc, AstNode, HasChildren,
         HasAttributes, isBlock, Block, Para, Heading, Div, List,
         Table, Caption, Row, isCaption, isRow,
         BlockQuote, Section, CodeBlock, RawBlock,
         Term, Definition, Footnote, Reference, Symb,
         Link, Image, HasText, RawInline, FootnoteReference,
         isInline, Inline, Str, Math,
         Verbatim, getStringContent } from "./ast";

const isWhitespace = function(node : Inline) : boolean {
  const tag : string = node.tag;
  return (tag === "space" || tag === "softbreak" || tag === "linebreak");
}

const beginsWithWhitespace = function(node : HasChildren<Inline>) : boolean {
  return (node.children[0] && isWhitespace(node.children[0]));
}

const endsWithWhitespace = function(node : HasChildren<Inline>) : boolean {
  return (node.children[0] &&
          isWhitespace(node.children[node.children.length - 1]));
}

const verbatimDelim = function(node : HasText, minticks : number) : string {
  const backtickGroups = node.text.match(/(`+)/g);
  const backtickGroupLens : Record<number,boolean> = {};
  if (backtickGroups) {
    for (const i in backtickGroups) {
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
  let rom  = "";
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
    else { throw(new Error("toRoman encountered x = " + x)); }
  }
  return rom;
}

const formatNumber = function(num : number, style : string) : string {
  const delimPattern = style.replace(/[a-zA-Z0-9]+/g,"$");
  const numFormat = style.replace(/[.()]/g, "");
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
      throw(new Error("formatNumber encountered unknown style " + style));
  }
  return delimPattern.replace("$", numStr);
}

class DjotRenderer {

  doc : Doc;
  wrapWidth : number;
  // wrapWidth == 0 means no wrap but softbreaks are breaks
  //             -1 means no wrap and softbreaks are spaces
  //             >0 means wrap to width, with softbreaks as spaces
  prefixes : string[] = [];
  buffer : string[] = [];
  startOfLine  = true;
  endOfPrefix  = 0;
  column  = 0;
  needsBlankLine  = false;

  constructor(doc : Doc, wrapWidth ?: number) {
    this.doc = doc;
    this.wrapWidth = wrapWidth || 0;
  }

  escape (s : string) : string {
    s = s.replace(/([~`'"${}[\]^<>\\*_]|-(?=-)|!(=\[)|\.(?=\.))/g, "\\$1");
    if (this.column === 0 || this.column === this.endOfPrefix) {
      s = s.replace(/^#/, "\\#");
    }
    return s;
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
      while (/  *$|^$/.test(this.buffer[this.buffer.length - 1])) {
       this.buffer[this.buffer.length - 1] =
         this.buffer[this.buffer.length - 1].replace(/  *$/,"");
       if (this.buffer[this.buffer.length - 1] === "") {
         this.buffer.pop();
       }
      }
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

  wrap () : void {
    if (this.wrapWidth <= 0) {
      return;
    }
    let idx = this.buffer.length - 1;
    if (!this.startOfLine && this.buffer.length > 0 &&
           this.column > this.wrapWidth) {
      // backup to last space:
      let lastbuff;
      while (idx >= 0) {
        lastbuff = this.buffer[idx];
        if (lastbuff === " ") {
          break;
        } else if (/^[ \r\n]+$/.test(lastbuff)) { // e.g. indentation
          return; // can't wrap
        }
        idx--;
      }
    }

    if (idx < this.buffer.length - 1) {
      const excessOnLine : string[] = this.buffer.splice(idx + 1);
      if (this.buffer[this.buffer.length - 1] === " ") {
        this.buffer.pop();  // pop space at end of line
      }
      // put the content on next line:
      this.newline();
      this.startOfLine = true;
      for (let i=0; i < excessOnLine.length; i++) {
        this.buffer.push(excessOnLine[i]);
        this.column += excessOnLine[i].length;
        this.startOfLine = false;
      }
    }
  }

  space () : void {
    this.wrap();
    this.lit(" ");
  }

  softbreak () : void {
    if (this.wrapWidth === 0) {
      this.newline();
    } else {
      this.space();
    }
  }

  needsBraces (node : HasChildren<Inline>) : boolean {
    return ( beginsWithWhitespace(node) ||
             endsWithWhitespace(node) ||
             (this.buffer.length > 0 &&
              /\w$/.test(this.buffer[this.buffer.length - 1])) );
  }

  noWrap (action : () => void) : void {
    const oldWrapWidth = this.wrapWidth;
    this.wrapWidth = -1; // no wrap + soft breaks are spaces
    action();
    this.wrapWidth = oldWrapWidth;
  }

  inlineContainer (delim : string, needsBraces ?: boolean)
      : ((node : HasChildren<Inline>) => void) {
    const self = this;
    return function(node : HasChildren<Inline>) : void {
      needsBraces = needsBraces || self.needsBraces(node);
      if (needsBraces) self.lit("{");
      self.lit(delim);
      self.renderChildren<Inline>(node.children);
      self.lit(delim);
      if (needsBraces) self.lit("}");
    }
  }

  litlines (s : string) : void {
    const lns = s.split(/\r?\n/);
    if (lns[lns.length - 1] === "") {
      lns.pop();
    }
    lns.forEach((ln : string) => {
      this.lit(ln);
      this.cr();
    });
  }

  verbatimNode (node : HasText) : void {
    const ticks = verbatimDelim(node, 1);
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
      const hasReferences = Object.keys(node.references).length > 0;
      if (hasReferences) {
        this.cr();
        this.newline();
      }
      for (const k in node.references) {
        this.renderNode(node.references[k]);
      }
      const hasFootnotes = Object.keys(node.footnotes).length > 0;
      for (const k in node.footnotes) {
        this.renderNode(node.footnotes[k]);
      }
      this.prefixes = [];
      this.cr();
    },
    footnote: (node : Footnote) => {
      this.lit("[^" + node.label + "]:");
      this.space();
      this.needsBlankLine = false;
      this.prefixes.push("  ");
      this.renderChildren<Block>(node.children);
      this.prefixes.pop();
      this.blankline();
    },
    reference: (node : Reference) => {
      this.lit("[");
      this.lit(node.label);
      this.lit("]:");
      this.prefixes.push("  ");
      this.space();
      this.lit(node.destination);
      this.wrap();
      this.prefixes.pop();
      this.blankline();
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
      this.lit(":::");
      this.cr();
      this.renderChildren<Block>(node.children);
      this.cr();
      this.lit(":::");
      this.blankline();
    },
    heading: (node : Heading) => {
      const hashes = "#".repeat(node.level);
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
      const ticks = verbatimDelim(node, 3);
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
      const ticks = verbatimDelim(node, 3);
      this.lit(ticks);
      this.lit(" =" + node.format);
      this.cr();
      this.litlines(node.text);
      this.cr();
      this.lit(ticks);
      this.blankline();
    },
    list: (node : List)  => {
      const style = node.style;
      const start = node.start || 1;
      const items = node.children;
      const tight = node.tight;
      for (let i=0; i < items.length; i++) {
        const item = items[i];
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
    term: (node : Term) => {
      this.renderChildren<Inline>(node.children);
      this.blankline();
    },
    definition: (node : Definition) => {
      this.renderChildren<Block>(node.children);
    },
    table: (node : Table) => {
      const captions : Caption[] = node.children.filter(isCaption);
      const rows : Row[] = node.children.filter(isRow);
      for (let i=0; i < rows.length; i++) {
        const row = rows[i];
        // if last row was head and this is not, add separator line
        if ("head" in row && !row.head && i > 0 &&
            rows[i-1].head) {
          const lastRow : Row = rows[i-1];
          for (let j=0; j < lastRow.children.length; j++) {
            if (j === 0) { this.lit("|"); }
            switch (lastRow && lastRow.children[j].align) {
              case "left":
                this.lit(":--");
                break;
              case "right":
                this.lit("--:");
                break;
              case "center":
                this.lit(":-:")
                break;
              default:
                this.lit("---");
            }
            this.lit("|");
          }
          this.cr();
        }
        // now add the proper row
        for (let j=0; j < row.children.length; j++) {
          const cell = row.children[j];
          if (j === 0) { this.lit("|"); }
          this.noWrap(() => {
            // this awkward test is needed because a Caption can
            // be a child of Table; revisit this?
            if (cell.tag === "cell") {
              this.renderChildren(cell.children);
            }
          });
          this.lit("|");
        }
        this.cr();
      }
      if (captions.length > 0) {
        this.newline();
        this.lit("^ ");
        this.needsBlankLine = false;
        this.prefixes.push("  ");
        this.renderChildren<Inline>(captions[0].children);
        this.prefixes.pop();
        this.blankline();
      }
      this.blankline();
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
    footnote_reference: (node : FootnoteReference) => {
      this.lit("[^" + node.text + "]");
    },
    symbol: (node : Symb) => {
      this.lit(":" + node.alias + ":");
    },
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
    if (children[0] && !isBlock(children[0])) {
      this.wrap();
    }
  }

  renderNode<A extends AstNode>(node : A) : void {
    this.doBlankLines();
    const handler = this.handlers[node.tag];
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
    const attr = node.attributes;
    this.lit("{");
    let isfirst = true;
    if (isBlock(node)) {
      this.prefixes.push(" ");
    }
    for (const k in attr) {
      if (!isfirst) {
        this.space();
      }
      if (k === "id") {
        this.lit("#");
        this.lit(attr[k]);
      } else if (k === "class") {
        const classes = attr[k].split(/  */);
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
