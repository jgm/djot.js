import { Event } from "./event";
import { AttributeParser } from "./attributes";
import { pattern, find, boundedFind } from "./find";
import { InlineParser } from "./inline";

// Return array of list styles that match a marker.
// In ambiguous cases we return multiple values.
const getListStyles = function(marker : string) : string[] {
  if (marker === "+" || marker === "-" || marker === "*" || marker === ":") {
    return [marker];
  } else if (/^[+*-] \[[Xx ]\]/.exec(marker)) {
    return ["X"]; // task list
  } else if (/^\[[Xx ]\]/.exec(marker)) {
    return ["X"];
  } else if (/^[(]?[0-9]+[).]/.exec(marker)) {
    return [marker.replace(/[0-9]+/,"1")];
  } else if (/^[(]?[ivxlcdm][).]/.exec(marker)) {
    return [marker.replace(/[a-z]+/, "a"), marker.replace(/[a-z]+/, "i")];
  } else if (/^[(]?[IVXLCDM][).]/.exec(marker)) {
    return [marker.replace(/[A-Z]+/, "A"), marker.replace(/[A-Z]+/, "I")];
  } else if (/^[(]?[ivxlcdm]+[).]/.exec(marker)) {
    return [marker.replace(/[a-z]+/, "i")];
  } else if (/^[(]?[IVXLCDM]+[).]/.exec(marker)) {
    return [marker.replace(/[A-Z]+/, "I")];
  } else if (/^[(]?[a-z][).]/.exec(marker)) {
    return [marker.replace(/[a-z]/, "a")];
  } else if (/^[(]?[A-Z][).]/.exec(marker)) {
    return [marker.replace(/[A-Z]/, "A")];
  } else { // doesn't match any list style
    return []
  }
}

const isSpaceOrTab = function(cp : number) {
  return (cp === 32 || cp === 9);
}

const pattEndline = pattern("[ \\t]*\\r?\\n");
const pattNonNewlines = pattern("[^\\n\\r]*");
const pattWord = pattern("^\\w+\\s");
const pattWhitespace = pattern("[ \\t\\r\\n]");
const pattNonWhitespace = pattern("[^ \\t\\r\\n]+");
const pattBlockquotePrefix = pattern("[>]\\s");
const pattBangs = pattern("#+");
const pattCodeFence = pattern("(~~~~*|````*)([ \\t]*)(\\S*)[ \\t]*\\r?\\n");
const pattRowSep = pattern("(:?)--*(:?)([ \\t]*\\|[ \\t]*)");
const pattNextBar = pattern("[^|\\r\\n]*\\|");
const pattCaptionStart = pattern("\\^[ \\t]+");
const pattFootnoteStart = pattern("\\[\\^([^\\]]+)\\]:\\s");
const pattThematicBreak = pattern("[-*][ \t]*[-*][ \\t]*[-*][-* \\t]*\\r?\\n");
const pattDivFence = pattern("(::::*)[ \\t]*\\r?\\n");
const pattDivFenceStart = pattern("(::::*)[ \\t]*");
const pattDivFenceEnd = pattern("([\\w_-]*)[ \\t]*\\r?\\n");
const pattReferenceDefinition = pattern("\\[([^\\]\\r\\n]*)\\]:[ \\t]*([^ \\t\\r\\n]*)[\\r\\n]");
const pattTableRow = pattern("(\\|[^\\r\\n]*\\|)[ \\t]*\\r?\\n");
const pattListMarker = pattern("(:?[-*+:]|\\([0-9]+\\)|[0-9]+[.)]|[ivxlcdmIVXLCDM]+[.)]|\\([ivxlcdmIVXLCDM]+\\)|[a-zA-Z][.)]|\\([a-zA-Z]\\))\\s");
const pattTaskListMarker = pattern("[*+-] \\[[Xx ]\\]\\s");

type EventIterator = {
  next : () => { value: Event, done: boolean };
}

enum ContentType {
  None = 0,
  Inline,
  Block,
  Text,
  Cells,
  Attributes,
  ListItem
}

type BlockSpec =
  { name : string,
    type : ContentType,
    content : ContentType,
    continue : (container : Container) => boolean,
    open : (spec : BlockSpec) => boolean,
    close: (container : Container) => void }

class Container {
  name : string;
  type : ContentType;
  content : ContentType;
  continue : (container : Container) => boolean;
  close: (container : Container) => void;
  indent : number | null;
  inlineParser: InlineParser | null;
  attributeParser: AttributeParser | null;
  extra: {[key : string] : any};

  constructor(spec : BlockSpec, extra : {[key : string] : any}) {
    this.name = spec.name;
    this.type = spec.type;
    this.content = spec.content;
    this.continue = spec.continue;
    this.close = spec.close;
    this.indent = null;
    this.inlineParser = null;
    this.attributeParser = null;
    this.extra = extra;
 }
}

class EventParser {
  warn : (message : string, pos : number) => void;
  subject : string;
  maxoffset : number;
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
  paraSpec : BlockSpec;

  constructor(subject : string, warn : (message : string, pos : number) => void) {
   // Ensure the subject ends with a newline character
   if (subject.charAt(subject.length - 1) !== '\n') {
     subject = subject + "\n";
   }
   this.subject = subject;
   this.maxoffset = subject.length - 1;
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
   this.paraSpec =
     { name: "para",
       type: ContentType.Block,
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
     };

   this.specs = [
    { name: "blockquote",
      type: ContentType.Block,
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
      type: ContentType.Block,
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
      type: ContentType.Block,
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
      type: ContentType.Block,
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
      type: ContentType.Block,
      content: ContentType.None,
      continue: (container) => {
        if (container.extra.indent >= this.indent) {
          return false;
        }
        let nws = this.find(pattNonWhitespace);
        if (this.pos < this.starteol &&
             nws && nws.endpos === this.starteol - 1) {
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
          let value = m.captures[1];
          this.addContainer(new Container(spec,
             { key: label, indent: this.indent }));
          this.addMatch(m.startpos, m.startpos, "+reference_definition");
          this.addMatch(m.startpos, m.startpos + label.length + 1,
                          "reference_key");
          if (value.length > 0) {
            this.addMatch(this.starteol - value.length, this.starteol - 1,
                          "reference_value");
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
      type: ContentType.Block,
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

    { name: "list",
      type: ContentType.Block,
      content: ContentType.ListItem,
      continue: (container) => {
        // TODO remove code duplication btw list and list_item
        if (this.indent > container.extra.indent ||
                this.pos === this.starteol) {
          return true;
        } else { // match a list item of the correct type
          let m = this.find(pattListMarker);
          if (m === null) {
            return false;
          }
          let marker = this.subject.substring(m.startpos, m.endpos);
          let styles = getListStyles(marker);
          let newstyles : string[] = [];
          container.extra.styles.forEach((style : string) => {
            if (styles.includes(style)) {
              newstyles.push(style);
            }
          });
          if (newstyles.length > 0) {
            // narrow styles
            container.extra.styles = newstyles;
            return true;
          }
        }
        return false;
      },
      open: (spec) => {
        let m = this.find(pattListMarker);
        if (m === null) {
          return false;
        }
        let sp = m.startpos;
        let ep = m.endpos;
        let marker = this.subject.substring(sp, ep);
        let checkbox = null;

        let mtask = this.find(pattTaskListMarker);
        if (mtask !== null) {
          marker = this.subject.substring(mtask.startpos, mtask.startpos + 5);
          checkbox = this.subject.substring(mtask.startpos + 3, mtask.startpos + 6);
        }

        // some items have ambiguous style
        let styles = getListStyles(marker);
        if (styles.length === 0) {
          return false;
        }
        let data = { styles: styles, indent: this.indent };
        // adding container will close others
        this.addContainer(new Container(spec, data));
        let annot = "+list";
        styles.forEach(style => {
          annot = annot + "|" + style ;
        });
        this.addMatch(sp, ep - 1, annot);
        return true;
      },
      close: (container) => {
        this.addMatch(this.pos, this.pos, "-list");
        this.containers.pop();
      }
    },

    { name: "list_item",
      type: ContentType.ListItem,
      content: ContentType.Block,
      continue: (container) => {
        return (this.indent > container.extra.indent ||
                this.pos === this.starteol);
      },
      open: (spec) => {
        let m = this.find(pattListMarker);
        if (m === null) {
          return false;
        }
        let sp = m.startpos;
        let ep = m.endpos;
        let marker = this.subject.substring(sp, ep);
        let checkbox = null;

        let mtask = this.find(pattTaskListMarker);
        if (mtask !== null) {
          marker = this.subject.substring(mtask.startpos, mtask.startpos + 5);
          checkbox = this.subject.substring(mtask.startpos + 3, mtask.startpos + 6);
        }

        // some items have ambiguous style
        let styles = getListStyles(marker);
        if (styles.length === 0) {
          return false;
        }
        let data = { styles: styles, indent: this.indent };
        // adding container will close others
        this.addContainer(new Container(spec, data));
        let annot = "+list_item";
        styles.forEach(style => {
          annot = annot + "|" + style;
        });
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
      close: (container) => {
        this.addMatch(this.pos, this.pos, "-list_item");
        this.containers.pop();
      }
    },


    { name: "table",
      type: ContentType.Block,
      content: ContentType.Cells,
      continue: (container) => {
        let m = this.find(pattTableRow);
        if (m) {
          let rawrow = m.captures[0];
          return this.parseTableRow(m.startpos, m.startpos + rawrow.length - 1);
        } else {
          return false;
        }
      },
      open: (spec) => {
        let m = this.find(pattTableRow);
        if (m) {
          this.addContainer(new Container(spec, { columns: 0 }));
          let rawrow = m.captures[0];
          this.addMatch(m.startpos, m.startpos, "+table");
          if (this.parseTableRow(m.startpos,
                                 m.startpos + rawrow.length - 1)) {
            return true;
          } else {
            this.matches.pop(); // remove "+table" match
            this.containers.pop();
            return false;
          }
        } else {
          return false;
        }
     },
      close: (container) => {
        this.addMatch(this.pos, this.pos, "-table");
        this.containers.pop();
      }
    },

    { name: "attributes",
      type: ContentType.Block,
      content: ContentType.Attributes,
      open: (spec) => {
        if (this.subject.codePointAt(this.pos) === 123) { // {
          let attributeParser = new AttributeParser(this.subject);
          let res = attributeParser.feed(this.pos, this.starteol);
          if (res.status === "fail") {
            return false;
          } else if (res.status === "done" &&
                     find(this.subject, pattEndline, res.position + 1)
                        === null) {
            return false;
          } else {
            let container = this.addContainer(new Container(spec,
                               { status: res.status,
                                 indent: this.indent,
                                 startpos: this.pos,
                                 slices: [] }));
            container.attributeParser = attributeParser;
            container.extra.slices =
               [ { startpos: this.pos, endpos: this.starteol } ];
            this.pos = this.starteol;
            return true;
          }
        } else {
          return false;
        }
      },
      continue: (container) => {
        if (container.extra.status === "done") {
          return false;
        }
        if (container.attributeParser && this.indent > container.extra.indent) {
          container.extra.slices.push({ startpos: this.pos,
                                        endpos: this.starteol });
          let res = container.attributeParser.feed(this.pos, this.endeol);
          container.extra.status = res.status;
          if (res.status !== "fail" ||
              !find(this.subject, pattEndline, res.position + 1)) {
            this.pos = this.starteol;
            return true;
          }
        }
        // if we get to here, we don't continue; either we
        // reached the end of indentation or we failed in
        // parsing attributes
        // attribute parsing failed; convert to para and continue with that
        this.addMatch(container.extra.startpos,
                      container.extra.startpos, "+para");
        let attrContainer = this.containers.pop(); // remove attribute contain
        // add para container
        let para = this.addContainer(new Container(this.paraSpec, {}));
        // reparse the text we couldn't parse as a block attribute:
        if (!para.inlineParser || !attrContainer) {
          throw("Missing inlineParser or attrContainer");
          return false;
        }
        para.inlineParser.attributeSlices = attrContainer.extra.slices;
        para.inlineParser.reparseAttributes();
        this.pos = para.inlineParser.lastpos + 1;
        return true;
      },
      close: (container) => {
        this.addMatch(container.extra.startpos, container.extra.startpos,
                      "+block_attributes");
        if (container.attributeParser) { // should always be true
          let attrMatches = container.attributeParser.matches;
          attrMatches.forEach(match => {
            this.matches.push(match);
          });
        }
        this.addMatch(this.pos, this.pos, "-block_attributes");
        this.containers.pop();
      }
    },

    { name: "fenced_div",
      type: ContentType.Block,
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
      type: ContentType.Block,
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
    this.matches.push({startpos: Math.min(startpos, this.maxoffset),
                       endpos: Math.min(endpos, this.maxoffset),
                       annot: annot});
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
    while (tip && tip.content !== container.type) {
      tip.close(tip);
      tip = this.tip();
    }
    if (container.content === ContentType.Inline) {
      container.inlineParser =
        new InlineParser(this.subject, this.warn);
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

  parseTableCell() : null | { startpos : number,
                              endpos : number,
                              matches : Event[] } {
    let inlineParser = new InlineParser(this.subject, this.warn);
    let cellComplete = false;
    let sp = this.pos - 1; // we start on char after |
    let ep = sp; // for now
    this.skipSpace();
    while (!cellComplete) {
      let m = this.find(pattNextBar);
      if (m === null) {
        cellComplete = false;
      } else { // we matched a |
        let nextbar = m.endpos;
        if (this.subject.charAt(nextbar - 1) === "\\") {  // \|
          inlineParser.feed(this.pos, nextbar);
          this.pos = nextbar + 1;
        } else if (inlineParser.inVerbatim()) {
          inlineParser.feed(this.pos, nextbar);
          this.pos = nextbar + 1;
        } else {
          inlineParser.feed(this.pos, nextbar - 1);
          this.pos = nextbar + 1;
          cellComplete = true;
          ep = nextbar;
        }
      }
    }
    if (cellComplete) {
      let cellMatches = inlineParser.getMatches();
      return { startpos: sp, endpos: ep, matches: cellMatches };
    } else {
      return null;
    }
  }

  // Parameters are start and end position
  parseTableRow(sp : number, ep : number) : boolean {
    let origMatches = this.matches.length;   // so we can rewind
    let startpos = this.pos;
    this.addMatch(sp, sp, "+row");
    // skip | and any initial space in the cell:
    this.pos++;

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

    // if we get here, we're parsing a regular row
    while (this.pos <= ep) {
      let cell = this.parseTableCell();
      if (cell !== null) {
        // add matches for cell
        this.addMatch(cell.startpos, cell.startpos, "+cell");
        let cellMatches = cell.matches;
        cellMatches.forEach((match, i) => {
          let { startpos: s, endpos: e, annot: ann } = match;
          if (i === cellMatches.length - 1 && ann === "str") {
            // strip trailing space
            while (this.subject.codePointAt(e) === 32 && e >= s) {
              e = e - 1;
            }
          }
          this.addMatch(s,e,ann);
        });
        this.addMatch(cell.endpos, cell.endpos, "-cell");
      } else {
        // rewind, this is not a valid table row
        this.pos = startpos;
        while (this.matches.length > origMatches) {
          this.matches.pop();
        }
        return false;
      }
    }

    // if we get here, we've parsed a table row
    this.addMatch(this.pos, this.pos, "-row");
    this.pos = this.starteol;
    this.finishedLine = true;
    return true;
    return true;
  }

  // Returns an iterator over events.  At each iteration, the iterator
  // returns three values: start byte position, end byte position,
  // and annotation.
  [Symbol.iterator]() : EventIterator {
    const specs = this.specs;
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
          let lastMatch = self.containers[self.lastMatchedContainer];
          let checkStarts = !isBlank &&
                              (!lastMatch ||
                                lastMatch.content === ContentType.Block ||
                                lastMatch.content === ContentType.ListItem) &&
                              !self.find(pattWord); // optimization
          while (checkStarts) {
            checkStarts = false;
            for (const spec of specs) {
              if ((!lastMatch && spec.type === ContentType.Block) ||
                    (lastMatch && lastMatch.content === spec.type)) {
                if (spec.open(spec)) {
                  const tip = self.tip();
                  if (tip) {
                    self.lastMatchedContainer = self.containers.length - 1;
                    lastMatch = self.containers[self.lastMatchedContainer];
                    if (self.finishedLine) {
                      checkStarts = false;
                    } else {
                      self.skipSpace();
                      newStarts = true;
                      checkStarts = spec.content === ContentType.Block ||
                                    spec.content === ContentType.ListItem;
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
                self.paraSpec.open(self.paraSpec);
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

export { EventParser }
