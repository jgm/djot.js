import { Event } from "./event.js";
import { AttributeParser } from "./attributes.js";
import { pattern, find, boundedFind } from "./find.js";
import { InlineParser } from "./inline.js";

// Return array of list styles that match a marker.
// In ambiguous cases we return multiple values.
const getListStyles = function(marker : string) : string[] {
  if (marker === "+" || marker === "-" || marker === "*" || marker === ":") {
    return [marker];
  } else if (/^[+*-] \[[Xx ]\]/.exec(marker)) {
    return ["X"]; // task list
  } else if (/^\[[Xx ]\]/.exec(marker)) {
    return ["X"];
  } else if (/^[(]?\d+[).]/.exec(marker)) {
    return [marker.replace(/\d+/,"1")];
  } else if (/^[(]?[ivxlcdm][).]/.exec(marker)) {
    return [marker.replace(/[a-z]+/, "a"), marker.replace(/[a-z]+/, "i")];
  } else if (/^[(]?[IVXLCDM][).]/.exec(marker)) {
    return [marker.replace(/[A-Z]+/, "A"), marker.replace(/[A-Z]+/, "I")];
  } else if (/^[(]?[a-z][).]/.exec(marker)) {
    return [marker.replace(/[a-z]/, "a")];
  } else if (/^[(]?[A-Z][).]/.exec(marker)) {
    return [marker.replace(/[A-Z]/, "A")];
  } else if (/^[(]?[ivxlcdm]+[).]/.exec(marker)) {
    return [marker.replace("[a-z]+", "i")];
  } else if (/^[(]?[IVXLCDM]+[).]/.exec(marker)) {
    return [marker.replace("[A-Z]+", "I")];
  } else { // doesn't match any list style
    return []
  }
}

const isSpaceOrTab = function(cp : number) {
  return (cp === 32 || cp === 9);
}

const pattNonNewlines = pattern("[^\\n\\r]*");
const pattWord = pattern("^\\w+\\s");
const pattWhitespace = pattern("[ \\t\\r\\n]");
const pattBlockquotePrefix = pattern("[>]\\s");
const pattBangs = pattern("#+");
const pattCodeFence = pattern("(~~~~*|````*)([ \\t]*)(\\S*)[ \\t]*\\r?\\n");
const pattRowSep = pattern("(%:?)%-%-*(%:?)([ \t]*%|[ \t]*)");
const pattNextBar = pattern("[^|\\r\\n]*|");
const pattCaptionStart = pattern("\\^[ \\t]+");
const pattFootnoteStart = pattern("\\[\\^([^\\]]+)\\]:\\s");
const pattThematicBreak = pattern("[-*][ \t]*[-*][ \\t]*[-*][-* \\t]*\\r?\\n");
const pattDivFence = pattern("(::::*)[ \\t]*\\r?\\n");
const pattDivFenceStart = pattern("(::::*)[ \\t]*");
const pattDivFenceEnd = pattern("([\\w_-]*)[ \\t]*\\r?\\n");
const pattReferenceDefinition = pattern("\\[([^\\]\\r\\n]*)\\]:[ \\t]*");

type EventIterator = {
  next : () => { value: Event, done: boolean };
}

enum ContentType {
  None = 0,
  Inline,
  Block,
  Text,
  Cells,
  Attributes
}

type BlockSpec =
  { name : string,
    isPara : boolean,
    content : ContentType,
    continue : (container : Container) => boolean,
    open : (spec : BlockSpec) => boolean,
    close: (container : Container) => void }

class Container {
  name : string;
  content : ContentType;
  continue : (container : Container) => boolean;
  close: (container : Container) => void;
  indent : number | null;
  inlineParser: InlineParser | null;
  extra: {[key : string] : any};

  constructor(spec : BlockSpec, extra : {[key : string] : any}) {
    this.name = spec.name;
    this.content = spec.content;
    this.continue = spec.continue;
    this.close = spec.close;
    this.indent = null;
    this.inlineParser = null;
    this.extra = extra;
 }
}

class Parser {
  warn : (message : string, pos : number) => void;
  subject : string;
  indent : number;
  startline : number;
  starteol : number;
  endeol : number;
  matches : Event[];
  containers : Container[];
  pos : number;
  lastMatchedContainer : number;
  finishedLine : boolean;
  returned : number;
  specs : BlockSpec[];

  constructor(subject : string, warn : (message : string, pos : number) => void) {
   // Ensure the subject ends with a newline character
   if (subject.charAt(subject.length - 1) !== '\n') {
     subject = subject + "\n";
   }
   this.subject = subject;
   this.warn = warn;
   this.indent = 0;
   this.startline = 0;
   this.starteol = 0;
   this.endeol = 0;
   this.matches = [];
   this.containers = [];
   this.pos = 0;
   this.lastMatchedContainer = 0;
   this.finishedLine = false;
   this.returned = 0;
   this.specs = [
     { name: "para",
       isPara: true,
       content: ContentType.Inline,
       continue: (container) => {
         if (this.find(pattWhitespace) === null) {
           return true;
         } else {
           return false;
         }
       },
       open: (spec) => {
         this.addContainer(new Container(spec, {}));
         this.addMatch(this.pos, this.pos, "+para");
         return true;
       },
       close: (container) => {
         this.getInlineMatches();
         const last = this.matches[this.matches.length - 1]
         const ep = (last && last.endpos + 1) || this.pos;
         this.addMatch(ep, ep, "-para");
         this.containers.pop();
       }
     },

    { name: "blockquote",
      isPara: false,
      content: ContentType.Block,
      continue: (container) => {
        if (this.find(pattBlockquotePrefix) !== null) {
          this.pos = this.pos + 1;
          return true;
        } else {
          return false;
        }
      },
      open: (spec) => {
        if (this.find(pattBlockquotePrefix) !== null) {
          this.addContainer(new Container(spec, {}));
          this.addMatch(this.pos, this.pos, "+blockquote");
          this.pos = this.pos + 1;
          return true;
        } else {
          return false;
        }
      },
      close: (container) => {
        this.addMatch(this.pos, this.pos, "-blockquote");
        this.containers.pop();
      }
    },

    { name: "heading",
      isPara: false,
      content: ContentType.Inline,
      continue: (container) => {
        const m = this.find(pattBangs);
        if (m && container.extra.level == (m.endpos - m.startpos + 1) &&
              find(this.subject, pattWhitespace, m.endpos + 1)) {
          this.pos = m.endpos + 1;
          return true;
        } else {
          return false;
        }
      },
      open: (spec) => {
        const m = this.find(pattBangs);
        if (m && find(this.subject, pattWhitespace, m.endpos + 1)) {
          const level = m.endpos - m.startpos + 1;
          this.addContainer(new Container(spec, {level: level}));
          this.addMatch(m.startpos, m.endpos, "+heading");
          this.pos = m.endpos + 1;
          return true;
        } else {
          return false;
        }
      },
      close: (container) => {
        this.getInlineMatches()
        const last = this.matches[this.matches.length - 1]
        const ep = (last && last.endpos + 1) || this.pos;
        this.addMatch(ep, ep, "-heading")
        this.containers.pop();
      }
    },

    { name: "caption",
      isPara: false,
      content: ContentType.Inline,
      continue: (container) => {
        return (find(this.subject, pattWhitespace, this.pos) === null);
      },
      open: (spec) => {
        let m = this.find(pattCaptionStart);
        if (m) {
          this.pos = m.endpos + 1;
          this.addContainer(new Container(spec, {}));
          this.addMatch(this.pos, this.pos, "+caption");
          return true;
        } else {
          return false;
        }
      },
      close: (container) => {
        this.getInlineMatches();
        this.addMatch(this.pos - 1, this.pos - 1, "-caption");
        this.containers.pop();
      }
    },

    // should go before reference definitions
    { name: "footnote",
      isPara: false,
      content: ContentType.Block,
      continue: (container) => {
        if (this.indent > (container.extra.indent || 0) ||
             this.pos === this.starteol) {
          return true;
        } else {
          return false;
        }
      },
      open: (spec) => {
        let m = this.find(pattFootnoteStart);
        if (m) {
          let sp = m.startpos;
          let ep = m.endpos;
          let label = m.captures[0];
          // adding container will close others
          this.addContainer(new Container(spec, {note_label: label,
                                                 indent: this.indent}));
          this.addMatch(sp, sp, "+footnote");
          this.addMatch(sp + 2, ep - 3, "note_label");
          this.pos = ep;
          return true;
        } else {
          return false;
        }
      },
      close: (container) => {
        this.addMatch(this.pos, this.pos, "-footnote");
        this.containers.pop();
      }
    },

    { name: "reference_definition",
      isPara: false,
      content: ContentType.None,
      continue: (container) => {
        if (container.extra.indent >= this.indent) {
          return false;
        }
        if (this.pos < this.starteol) {
          this.addMatch(this.pos, this.starteol - 1, "reference_value");
          this.pos = this.starteol;
          return true;
        } else {
          return false;
        }
      },
      open: (spec) => {
        let m = this.find(pattReferenceDefinition);
        if (m) {
          let label = m.captures[0];
          this.addContainer(new Container(spec,
             { key: label, indent: this.indent }));
          this.addMatch(m.startpos, m.startpos, "+reference_definition");
          this.addMatch(m.startpos, m.startpos + label.length + 1,
                          "reference_key");
          if (m.endpos + 1 < this.starteol) {
            this.addMatch(m.endpos + 1, this.starteol - 1, "reference_value");
          }
          this.pos = this.starteol - 1;
          return true;
        } else {
          return false;
        }
      },
      close: (container) => {
        this.addMatch(this.pos, this.pos, "-reference_definition");
        this.containers.pop();
      }
    },


    // should go before list_item_spec
    { name: "thematic_break",
      isPara: false,
      content: ContentType.None,
      continue: (container) => {
        return false;
      },
      open: (spec) => {
        let m = this.find(pattThematicBreak);
        if (m) {
          this.addContainer(new Container(spec, {}));
          this.addMatch(m.startpos, m.endpos, "thematic_break");
          this.pos = m.endpos;
          return true;
        } else {
          return false;
        }
      },
      close: (container) => {
        this.containers.pop();
      }
    },

    { name: "list_item",
      isPara: false,
      content: ContentType.Block,
      continue: (container) => {
        if (this.indent > container.extra.indent || this.find("^[\r\n]")) {
          return true;
        } else {
          return false;
        }
      },
      open: (spec) => {
        let sp, ep = this.find("^[-*+:]%s");
        if (!sp) {
          sp, ep = this.find("^%d+[.)]%s");
        }
        if (!sp) {
          sp, ep = this.find("^%(%d+%)%s");
        }
        if (!sp) {
          sp, ep = this.find("^[ivxlcdmIVXLCDM]+[.)]%s");
        }
        if (!sp) {
          sp, ep = this.find("^%([ivxlcdmIVXLCDM]+%)%s");
        }
        if (!sp) {
          sp, ep = this.find("^%a[.)]%s");
        }
        if (!sp) {
          sp, ep = this.find("^%(%a%)%s");
        }
        if (!sp) {
          return false;
        }
        let marker = sub(this.subject, sp, ep - 1);
        let checkbox = null;
        if (this.find("^[*+-] %[[Xx ]%]%s", sp + 1)) { // task list
          marker = sub(this.subject, sp, sp + 4);
          checkbox = sub(this.subject, sp + 3, sp + 3);
        }
        // some items have ambiguous style
        let styles = getListStyles(marker);
        if (styles.length === 0) {
          return false;
        }
        let data = { styles = styles,
                       indent = this.indent };
        // adding container will close others
        this.addContainer(new Container(spec, data));
        let annot = "+list_item";
        for (let i=1;i < styles.length;i++) do
          annot = annot .. "[" .. styles[i] .. "]";
        }
        this.addMatch(sp, ep - 1, annot);
        this.pos = ep;
        if (checkbox) {
          if (checkbox === " ") {
            this.addMatch(sp + 2, sp + 4, "checkbox_unchecked");
          } else {
            this.addMatch(sp + 2, sp + 4, "checkbox_checked");
          }
          this.pos = sp + 5;
        }
        return true;
      },
      close: function(_container)
        this.addMatch(this.pos, this.pos, "-list_item");
        this.containers.pop();
      }
    },

/*
    { name: "table",
      content: ContentType.Cells,
      continue: function(_container)
        let sp, ep = this.find("^|[^\r\n]*|")
        let eolsp = " *[\r\n]" // make sure at end of line
        if sp and eolsp {
          return this.parseTableRow(sp, ep)
        }
      },
      open: (spec) => {
        let sp, ep = this.find("^|[^\r\n]*|")
        let eolsp = " *[\r\n]" // make sure at end of line
        if sp and eolsp {
          this.addContainer(Container:new(spec, { columns = 0 }))
          this.addMatch(sp, sp, "+table")
          if this.parseTableRow(sp, ep) {
            return true
          } else {
            this.containers.pop();
            return false
          }
        }
     },
      close: function(_container)
        this.addMatch(this.pos, this.pos, "-table")
        this.containers.pop();
      }
    },

    { name: "attributes",
      content: ContentType.Attributes,
      open: (spec) => {
        if this.find("^%{") {
          let attribute_parser =
                  attributes.AttributeParser:new(this.subject)
          let status, ep =
                 attribute_parser:feed(this.pos, this.endeol)
          if status === 'fail' or ep + 1 < this.endeol {
            return false
          } else {
            this.addContainer(Container:new(spec,
                               { status = status,
                                 indent = this.indent,
                                 startpos = this.pos,
                                 slices = {},
                                 attribute_parser = attribute_parser }))
            let container = this.containers[#this.containers]
            container.slices = { {this.pos, this.endeol } }
            this.pos = this.starteol
            return true
          }

        }
      },
      continue: (container) => {
        if this.indent > container.indent {
          table.insert(container.slices, { this.pos, this.endeol })
          let status, ep =
            container.attribute_parser:feed(this.pos, this.endeol)
          container.status = status
          if status ~= 'fail' or ep + 1 < this.endeol {
            this.pos = this.starteol
            return true
          }
        }
        // if we get to here, we don't continue; either we
        // reached the end of indentation or we failed in
        // parsing attributes
        if container.status === 'done' {
          return false
        } else { // attribute parsing failed; convert to para and continue
             // with that
          let paraSpec = this.specs[0]
          let para = Container:new(paraSpec,
                        { inlineParser =
                           InlineParser:new(this.subject, this.warn) })
          this.addMatch(container.startpos, container.startpos, "+para")
          this.containers[#this.containers] = para
          // reparse the text we couldn't parse as a block attribute:
          para.inlineParser.attribute_slices = container.slices
          para.inlineParser:reparse_attributes()
          this.pos = para.inlineParser.lastpos + 1
          return true
        }
      },
      close: (container) => {
        let attr_matches = container.attribute_parser:getMatches()
        this.addMatch(container.startpos, container.startpos, "+block_attributes")
        for i=1,#attr_matches {
          this.addMatch(unpack(attr_matches[i]))
        }
        this.addMatch(this.pos, this.pos, "-block_attributes")
        this.containers.pop();
      }
    },
*/


    { name: "fenced_div",
      isPara: false,
      content: ContentType.Block,
      continue: (container) => {
        let tip = this.tip();
        if (tip && tip.name === "code_block") {
          return true; // see #109
        }
        let m = this.find(pattDivFence);
        if (m && container.extra.colons) {
          let colons = m.captures[0];
          if (colons.length >= container.extra.colons) {
            container.extra.endFenceStartpos = m.startpos;
            container.extra.endFenceEndpos = m.startpos + colons.length - 1;
            this.pos = m.endpos; // before newline
            return false;
          }
        }
        return true;
      },
      open: (spec) => {
        let m = this.find(pattDivFenceStart);
        if (!m) {
          return false;
        }
        let colons = m.captures[0];
        let m2 = find(this.subject, pattDivFenceEnd, m.endpos + 1);
        if (!m2) {
          return false;
        }
        let clsp = m2.startpos;
        let lang = m2.captures[0];
        this.addContainer(new Container(spec, {colons: colons.length}));
        this.addMatch(m.startpos, m.endpos, "+div");
        if (lang.length > 0) {
          this.addMatch(clsp, clsp + lang.length - 1, "class");
        }
        this.pos = m2.endpos + 1;
        this.finishedLine = true;
        return true;
      },
      close: (container) => {
        let sp = container.extra.endFenceStartpos || this.pos;
        let ep = container.extra.endFenceEndpos || this.pos;
        // check to make sure the match is in order
        this.addMatch(sp, ep, "-div");
        if (sp === ep) {
          this.warn("Unclosed div", this.pos);
        }
        this.containers.pop();
      }
    },

    { name: "code_block",
      isPara: false,
      content: ContentType.Text,
      continue: (container) => {
        const m = this.find(
                 pattern("(" + container.extra.border + "*)[ \\t]*[\\r\\n]"));
        if (m) {
          container.extra.endFenceStartpos = m.startpos;
          container.extra.endFenceEndpos = m.startpos + m.captures[0].length - 1;
          this.pos = m.endpos; // before newline
          this.finishedLine = true;
          return false;
        } else {
          return true;
        }
      },
      open: (spec) => {
        const m = this.find(pattCodeFence);
        if (m) {
          const [border, ws, lang] = m.captures;
          const isRaw = lang.charAt(0) === "=" && true || false;
          const cont = this.addContainer(new Container(spec, {border: border}));
          cont.indent = this.indent;
          this.addMatch(m.startpos, m.startpos + border.length - 1,
                        "+code_block");
          if (lang.length > 0) {
            const langstart = m.startpos + border.length + ws.length;
            if (isRaw) {
              this.addMatch(langstart, langstart + lang.length - 1,
                            "raw_format");
            } else {
              this.addMatch(langstart, langstart + lang.length - 1,
                             "code_language");
            }
          }
          this.pos = m.endpos;  // before newline;
          this.finishedLine = true;
          return true;
        } else {
          return false;
        }
      },
      close: (container) => {
        const sp = container.extra.endFenceStartpos || this.pos;
        const ep = container.extra.endFenceEndpos || this.pos;
        this.addMatch(sp, ep, "-code_block");
        if (sp === ep) {
          this.warn("Unclosed code block", this.pos);
        }
        this.containers.pop();
      }
    }
   ];
  }

  find(patt : RegExp) : null | { startpos : number, endpos : number, captures : string[] } {
    return find(this.subject, patt, this.pos);
  }

  tip() : Container | null {
    if (this.containers.length >= 1) {
      return this.containers[this.containers.length - 1];
    } else {
      return null;
    }
  }

  addMatch(startpos : number, endpos : number, annot : string) : void {
    this.matches.push({startpos, endpos, annot});
  }

  getInlineMatches() : void {
    const tip = this.tip();
    const ilparser = tip && tip.inlineParser;
    if (ilparser) {
      ilparser.getMatches().forEach(match => this.matches.push(match));
    }
  }

  closeUnmatchedContainers() : void {
    const lastMatched = this.lastMatchedContainer;
    // close unmatched containers
    let tip = this.tip();
    while (tip &&
           this.containers.length - 1 > lastMatched) {
      tip.close(tip);
      tip = this.tip();
    }
  }

  addContainer(container : Container) : Container {
    this.closeUnmatchedContainers();
    // close containers that can't contain this one:
    let tip = this.tip();
    while (tip && tip.content !== ContentType.Block) {
      tip.close(tip);
      tip = this.tip();
    }
    this.containers.push(container);
    return container;
  }

  // move parser position to first nonspace, adjusting indent
  skipSpace() : void {
    const subject = this.subject;
    let newpos = this.pos;
    while (true) {
      const cp = subject.codePointAt(newpos);
      if (cp && isSpaceOrTab(cp)) {
        newpos++;
      } else {
        break;
      }
    }
    this.indent = newpos - this.startline;
    this.pos = newpos;
  }

  // set this.starteol, this.endeol
  getEol() : void {
    const m = find(this.subject, pattNonNewlines, this.pos);
    if (m) {
      this.starteol = m.endpos + 1;
      if (this.subject.codePointAt(this.starteol) === 13 &&
          this.subject.codePointAt(this.starteol + 1) === 10) { // CR
        this.endeol = this.starteol + 1;
      } else {
        this.endeol = this.starteol;
      }
    }
  }

  // Parameters are start and end position
  parseTableRow(sp : number, ep : number) : boolean {
    let origMatches = this.matches.length;   // so we can rewind
    let startpos = this.pos;
    this.addMatch(sp, sp, "+row");
    // skip | and any initial space in the cell:
    this.pos++;
    this.skipSpace();
    // check to see if we have a separator line
    let seps = [];
    let p = this.pos;
    let sepfound = false;
    while (!sepfound) {
      let m = find(this.subject, pattRowSep, p);
      if (m !== null) {
        let [left, right, trailing] = m.captures;
        let st = "separator_default";
        if (left.length > 0 && right.length > 0) {
          st = "separator_center";
        } else if (right.length > 0) {
          st = "separator_right";
        } else if (left.length > 0) {
          st = "separator_left";
        }
        seps.push({startpos: m.startpos, endpos: m.endpos - trailing.length,
                   annot: st});
        p = m.endpos + 1;
        if (p === this.starteol) {
          sepfound = true;
          break;
        }
      } else {
        break;
      }
    }
    if (sepfound) {
      for (const k in seps) {
        let match = seps[k];
        this.addMatch(match.startpos, match.endpos, match.annot);
      }
      this.addMatch(this.starteol - 1, this.starteol - 1, "-row");
      this.pos = this.starteol;
      this.finishedLine = true;
      return true;
    }
    let inlineParser = new InlineParser(this.subject, this.warn);
    this.addMatch(sp, sp, "+cell");
    let completeCell = false;
    while (this.pos <= ep) {
      // parse a chunk as inline content
      let nextbar
      while (!nextbar) {
        let m1 = this.find(pattNextBar);
        if (m1 !== null) {
          nextbar = m1.endpos;
        } else {
          break;
        }

        if (this.subject.charAt(nextbar - 1) === "\\") {  // \|
          inlineParser.feed(this.pos, nextbar);
          this.pos = nextbar + 1;
          nextbar = null;
        } else {
          inlineParser.feed(this.pos, nextbar - 1);
          if (inlineParser.inVerbatim()) {
            inlineParser.feed(nextbar, nextbar);
            this.pos = nextbar + 1;
            nextbar = null;
          } else {
            this.pos = nextbar + 1;
          }
        }
      }
      completeCell = (nextbar !== null);
      if (!completeCell) {
        break;
      }
      // add a table cell
      let cellMatches = inlineParser.getMatches();
      for (let i=0; i < cellMatches.length; i++) {
        let match = cellMatches[i];
        let { startpos: s, endpos: e, annot: ann } = match;
        if (i === cellMatches.length - 1 && ann === "str") {
          // strip trailing space
          while (this.subject.codePointAt(e) === 32 && e >= s) {
            e = e - 1
          }
        }
        this.addMatch(s,e,ann);
      }
      if (nextbar) {
        this.addMatch(nextbar, nextbar, "-cell");
        if (nextbar < ep) {
          // reset inline parser state
          inlineParser = new InlineParser(this.subject, this.warn);
          this.addMatch(nextbar, nextbar, "+cell");
          this.skipSpace();
        }
      }
    }
    if (!completeCell) {
      // rewind, this is not a valid table row
      this.pos = startpos;
      while (this.matches.length - 1 > origMatches) {
        this.matches.pop();
      }
      return false;
    } else {
      this.addMatch(this.pos, this.pos, "-row");
      this.pos = this.starteol;
      this.finishedLine = true;
      return true;
    }
  }


  // Returns an iterator over events.  At each iteration, the iterator
  // returns three values: start byte position, end byte position,
  // and annotation.
  [Symbol.iterator]() : EventIterator {
    const specs = this.specs;
    const paraSpec = specs[0];
    const subjectlen = this.subject.length;
    this.returned = 0;
    const self = this;

    return { next() {

      while (self.pos < subjectlen) {

        // return any accumulated matches
        if (self.matches.length > 0 && self.returned < self.matches.length) {
          self.returned = self.returned + 1;
          return { value: self.matches[self.returned - 1],
                   done: false };
        }

        self.indent = 0;
        self.startline = self.pos;
        self.finishedLine = false;
        self.getEol();

        // check open containers for continuation
        self.lastMatchedContainer = -1;
        let idx = 0;
        while (idx < self.containers.length) {
          const container = self.containers[idx];
          // skip any indentation
          self.skipSpace()
          if (container.continue(container)) {
            self.lastMatchedContainer = idx;
          } else {
            break;
          }
          idx = idx + 1;
        }

        // if we hit a close fence, we can move to next line
        if (self.finishedLine) {
          while (self.containers.length > 0 &&
                 self.lastMatchedContainer < self.containers.length - 1) {
            const tip = self.tip();
            if (tip) {
              tip.close(tip);
            }
          }
        }

        if (!self.finishedLine) {
          // check for new containers
          self.skipSpace();
          let isBlank = (self.pos === self.starteol);
          let newStarts = false;
          const lastMatch = self.containers[self.lastMatchedContainer];
          let checkStarts = !isBlank &&
                              (!lastMatch ||
                                lastMatch.content === ContentType.Block) &&
                              !self.find(pattWord); // optimization
          while (checkStarts) {
            checkStarts = false;
            for (const spec of specs) {
              if (!spec.isPara) {
                if (spec.open(spec)) {
                  const tip = self.tip();
                  if (tip) {
                    self.lastMatchedContainer = self.containers.length - 1;
                    if (spec.content === ContentType.Inline) {
                      tip.inlineParser =
                        new InlineParser(self.subject, self.warn);
                    }
                    if (self.finishedLine) {
                      checkStarts = false;
                    } else {
                      self.skipSpace();
                      newStarts = true;
                      checkStarts = spec.content === ContentType.Block;
                    }
                  } else {
                    throw "No tip after opening container";
                  }
                  break;
                }
              }
            }
          }

          if (!self.finishedLine) {
            // handle remaining content
            self.skipSpace();

            isBlank = (self.pos === self.starteol);
            let tip = self.tip();
            const isLazy = !isBlank &&
                     !newStarts &&
                     self.lastMatchedContainer < self.containers.length - 1 &&
                     tip &&
                     tip.content === ContentType.Inline;

            if (!isLazy) {
              self.closeUnmatchedContainers();
            }
            tip = self.tip();

            // add para by default if there's text
            if (!tip || tip.content === ContentType.Block) {
              if (isBlank) {
                if (!newStarts) {
                  // need to track these for tight/loose lists
                  self.addMatch(self.pos, self.endeol, "blankline");
                }
              } else {
                paraSpec.open(paraSpec);
                tip = self.tip();
                if (tip) {
                  tip.inlineParser = new InlineParser(self.subject, self.warn);
                }
              }
            }

            if (tip && tip.content === ContentType.Text) {
              let startpos = self.pos;
              if (tip.indent !== null && self.indent > tip.indent) {
                // get back the leading spaces we gobbled
                startpos = startpos - (self.indent - tip.indent);
              }
              self.addMatch(startpos, self.endeol, "str");
            } else if (tip && tip.content === ContentType.Inline &&
                      !isBlank && tip.inlineParser) {
              tip.inlineParser.feed(self.pos, self.endeol);
            }
          }
        }

        self.pos = (self.endeol || self.pos) + 1;

      }

      // close all remaining containers
      self.lastMatchedContainer = -1;
      self.closeUnmatchedContainers();
      // return any accumulated matches
      if (self.matches.length > 0 && self.returned < self.matches.length) {
        self.returned = self.returned + 1;
        return { value: self.matches[self.returned - 1], done: false };
      }
      // catch-all (should not be needed)
      return { value: {startpos: self.pos, endpos: self.pos, annot: ""},
               done: true };
    } };

  }

}

export { Parser }
