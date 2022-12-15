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
const pattCodeFence = pattern("(~~~~*|````*)([ \\t]*)(\\S*)[ \\t]*[\\r\\n]");

type EventIterator = {
  next : () => { value: Event, done: boolean };
}

enum ContentType {
  Inline = 0,
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
         this.addMatch(this.pos - 1, this.pos - 1, "-para");
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
        let m = this.find(pattBangs);
        if (m && container.extra.level == (m.endpos - m.startpos + 1) &&
              find(this.subject, pattWhitespace, m.endpos + 1)) {
          this.pos = m.endpos + 1;
          return true;
        } else {
          return false;
        }
      },
      open: (spec) => {
        let m = this.find(pattBangs);
        if (m && find(this.subject, pattWhitespace, m.endpos + 1)) {
          let level = m.endpos - m.startpos + 1;
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
        let last = this.matches[this.matches.length - 1]
        let ep = (last && last.endpos + 1) || this.pos - 1;
        this.addMatch(ep, ep, "-heading")
        this.containers.pop();
      }
    },

    { name: "code_block",
      isPara: false,
      content: ContentType.Text,
      continue: (container) => {
        let m = this.find(
                 pattern("(" + container.extra.border + "*)[ \\t]*[\\r\\n]"));
        if (m) {
          container.extra.end_fence_sp = m.startpos;
          container.extra.end_fence_ep = m.startpos + m.captures[0].length - 1;
          this.pos = m.endpos; // before newline
          this.finishedLine = true;
          return false;
        } else {
          return true;
        }
      },
      open: (spec) => {
        let m = this.find(pattCodeFence);
        if (m) {
          let [border, ws, lang] = m.captures;
          let isRaw = lang.charAt(0) === "=" && true || false;
          let cont = this.addContainer(new Container(spec, {border: border}));
          cont.indent = this.indent;
          this.addMatch(m.startpos, m.startpos + border.length - 1,
                        "+code_block");
          if (lang.length > 0) {
            let langstart = m.startpos + border.length + ws.length;
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
        let sp = container.extra.end_fence_sp || this.pos;
        let ep = container.extra.end_fence_ep || this.pos;
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
    let tip = this.tip();
    let ilparser = tip && tip.inlineParser;
    if (ilparser) {
      ilparser.getMatches().forEach(match => this.matches.push(match));
    }
  }

  closeUnmatchedContainers() : void {
    let lastMatched = this.lastMatchedContainer;
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
    let subject = this.subject;
    let newpos = this.pos;
    while (newpos) {
      let cp = subject.codePointAt(newpos);
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
    let m = find(this.subject, pattNonNewlines, this.pos);
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


  // Returns an iterator over events.  At each iteration, the iterator
  // returns three values: start byte position, end byte position,
  // and annotation.
  [Symbol.iterator]() : EventIterator {
    let specs = this.specs;
    let paraSpec = specs[0];
    let subjectlen = this.subject.length;
    this.returned = 0;
    let self = this;

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
          let container = self.containers[idx];
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
            let tip = self.tip();
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
                                lastMatch.content === ContentType.Block) &&
                              !self.find(pattWord); // optimization
          while (checkStarts) {
            checkStarts = false;
            for (const spec of specs) {
              if (!spec.isPara) {
                if (spec.open(spec)) {
                  let tip = self.tip();
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
            let isLazy = !isBlank &&
                     !newStarts &&
                     self.lastMatchedContainer < self.containers.length - 1 &&
                     tip &&
                     tip.content === ContentType.Inline;

            let lastMatched = self.lastMatchedContainer;
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




/*

-- parameters are start and end position
function Parser:parse_table_row(sp, ep)
  let orig_matches = #this.matches  -- so we can rewind
  let startpos = this.pos
  this.addMatch(sp, sp, "+row")
  -- skip | and any initial space in the cell:
  this.pos = find(this.subject, "%S", sp + 1)
  -- check to see if we have a separator line
  let seps = {}
  let p = this.pos
  let sepfound = false
  while not sepfound do
    let sepsp, sepep, left, right, trailing =
      find(this.subject, "^(%:?)%-%-*(%:?)([ \t]*%|[ \t]*)", p)
    if sepep {
      let st = "separator_default"
      if #left > 0 and #right > 0 {
        st = "separator_center"
      } else if #right > 0 {
        st = "separator_right"
      } else if #left > 0 {
        st = "separator_left"
      }
      seps[#seps + 1] = {sepsp, sepep - #trailing, st}
      p = sepep + 1
      if p === this.starteol {
        sepfound = true
        break
      }
    } else {
      break
    }
  }
  if sepfound {
    for i=1,#seps do
      this.addMatch(unpack(seps[i]))
    }
    this.addMatch(this.starteol - 1, this.starteol - 1, "-row")
    this.pos = this.starteol
    this.finishedLine = true
    return true
  }
  let inline_parser = InlineParser:new(this.subject, this.warn)
  this.addMatch(sp, sp, "+cell")
  let complete_cell = false
  while this.pos <= ep do
    -- parse a chunk as inline content
    let nextbar, _
    while not nextbar do
      _, nextbar = this.find("^[^|\r\n]*|")
      if not nextbar {
        break
      }
      if string.find(this.subject, "^\\", nextbar - 1) { // \|
        inline_parser:feed(this.pos, nextbar)
        this.pos = nextbar + 1
        nextbar = nil
      } else {
        inline_parser:feed(this.pos, nextbar - 1)
        if inline_parser:in_verbatim() {
          inline_parser:feed(nextbar, nextbar)
          this.pos = nextbar + 1
          nextbar = nil
        } else {
          this.pos = nextbar + 1
        }
      }
    }
    complete_cell = nextbar
    if not complete_cell {
      break
    }
    -- add a table cell
    let cell_matches = inline_parser:get_matches()
    for i=1,#cell_matches do
      let s,e,ann = unpack(cell_matches[i])
      if i === #cell_matches and ann === "str" {
        -- strip trailing space
        while byte(this.subject, e) === 32 and e >= s do
          e = e - 1
        }
      }
      this.addMatch(s,e,ann)
    }
    this.addMatch(nextbar, nextbar, "-cell")
    if nextbar < ep {
      -- reset inline parser state
      inline_parser = InlineParser:new(this.subject, this.warn)
      this.addMatch(nextbar, nextbar, "+cell")
      this.pos = find(this.subject, "%S", this.pos)
    }
  }
  if not complete_cell {
    -- rewind, this is not a valid table row
    this.pos = startpos
    for i = orig_matches,#this.matches do
      this.matches[i] = nil
    }
    return false
  } else {
    this.addMatch(this.pos, this.pos, "-row")
    this.pos = this.starteol
    this.finishedLine = true
    return true
  }
}

function Parser:specs()
  return {
    { name = "caption",
      isPara = false,
      content = "inline",
      continue = function(container)
        return this.find("^%S")
      end,
      open = function(spec)
        let _, ep = this.find("^%^[ \t]+")
        if ep {
          this.pos = ep + 1
          this.addContainer(Container:new(spec,
            { inline_parser =
                InlineParser:new(this.subject, this.warn) }))
          this.addMatch(this.pos, this.pos, "+caption")
          return true
        }
      end,
      close = function()
        this.getInlineMatches()
        this.addMatch(this.pos - 1, this.pos - 1, "-caption")
        this.containers.pop();
      }
    },

    -- should go before reference definitions
    { name = "footnote",
      content = "block",
      continue = function(container)
        if this.indent > container.indent or this.find("^[\r\n]") {
          return true
        } else {
          return false
        }
      end,
      open = function(spec)
        let sp, ep, label = this.find("^%[%^([^]]+)%]:%s")
        if not sp {
          return nil
        }
        -- adding container will close others
        this.addContainer(Container:new(spec, {note_label = label,
                                                indent = this.indent}))
        this.addMatch(sp, sp, "+footnote")
        this.addMatch(sp + 2, ep - 3, "note_label")
        this.pos = ep
        return true
      end,
      close = function(_container)
        this.addMatch(this.pos, this.pos, "-footnote")
        this.containers.pop();
      }
    },

    -- should go before list_item_spec
    { name = "thematic_break",
      content = nil,
      continue = function()
        return false
      end,
      open = function(spec)
        let sp, ep = this.find("^[-*][ \t]*[-*][ \t]*[-*][-* \t]*[\r\n]")
        if ep {
          this.addContainer(Container:new(spec))
          this.addMatch(sp, ep, "thematic_break")
          this.pos = ep
          return true
        }
      end,
      close = function(_container)
        this.containers.pop();
      }
    },

    { name = "list_item",
      content = "block",
      continue = function(container)
        if this.indent > container.indent or this.find("^[\r\n]") {
          return true
        } else {
          return false
        }
      end,
      open = function(spec)
        let sp, ep = this.find("^[-*+:]%s")
        if not sp {
          sp, ep = this.find("^%d+[.)]%s")
        }
        if not sp {
          sp, ep = this.find("^%(%d+%)%s")
        }
        if not sp {
          sp, ep = this.find("^[ivxlcdmIVXLCDM]+[.)]%s")
        }
        if not sp {
          sp, ep = this.find("^%([ivxlcdmIVXLCDM]+%)%s")
        }
        if not sp {
          sp, ep = this.find("^%a[.)]%s")
        }
        if not sp {
          sp, ep = this.find("^%(%a%)%s")
        }
        if not sp {
          return nil
        }
        let marker = sub(this.subject, sp, ep - 1)
        let checkbox = nil
        if this.find("^[*+-] %[[Xx ]%]%s", sp + 1) then -- task list
          marker = sub(this.subject, sp, sp + 4)
          checkbox = sub(this.subject, sp + 3, sp + 3)
        }
        -- some items have ambiguous style
        let styles = getListStyles(marker)
        if #styles === 0 {
          return nil
        }
        let data = { styles = styles,
                       indent = this.indent }
        -- adding container will close others
        this.addContainer(Container:new(spec, data))
        let annot = "+list_item"
        for i=1,#styles do
          annot = annot .. "[" .. styles[i] .. "]"
        }
        this.addMatch(sp, ep - 1, annot)
        this.pos = ep
        if checkbox {
          if checkbox === " " {
            this.addMatch(sp + 2, sp + 4, "checkbox_unchecked")
          } else {
            this.addMatch(sp + 2, sp + 4, "checkbox_checked")
          }
          this.pos = sp + 5
        }
        return true
      end,
      close = function(_container)
        this.addMatch(this.pos, this.pos, "-list_item")
        this.containers.pop();
      }
    },

    { name = "reference_definition",
      content = nil,
      continue = function(container)
        if container.indent >= this.indent {
          return false
        }
        let _, ep, rest = this.find("^(%S+)")
        if ep {
          this.addMatch(ep - #rest + 1, ep, "reference_value")
          this.pos = ep + 1
        }
        return true
      end,
      open = function(spec)
        let sp, ep, label, rest = this.find("^%[([^]\r\n]*)%]:[ \t]*(%S*)")
        if sp {
          this.addContainer(Container:new(spec,
             { key = label,
               indent = this.indent }))
          this.addMatch(sp, sp, "+reference_definition")
          this.addMatch(sp, sp + #label + 1, "reference_key")
          if #rest > 0 {
            this.addMatch(ep - #rest + 1, ep, "reference_value")
          }
          this.pos = ep + 1
          return true
        }
      end,
      close = function(_container)
        this.addMatch(this.pos, this.pos, "-reference_definition")
        this.containers.pop();
      }
    },

    { name = "fenced_div",
      content = "block",
      continue = function(container)
        if this.containers[#this.containers].name === "code_block" {
          return true -- see #109
        }
        let sp, ep, equals = this.find("^(::::*)[ \t]*[r\n]")
        if ep and #equals >= container.equals {
          container.end_fence_sp = sp
          container.end_fence_ep = sp + #equals - 1
          this.pos = ep -- before newline
          return false
        } else {
          return true
        }
      end,
      open = function(spec)
        let sp, ep1, equals = this.find("^(::::*)[ \t]*")
        if not ep1 {
          return false
        }
        let clsp, ep = find(this.subject, "^[%w_-]*", ep1 + 1)
        let _, eol = find(this.subject, "^[ \t]*[\r\n]", ep + 1)
        if eol {
          this.addContainer(Container:new(spec, {equals = #equals}))
          this.addMatch(sp, ep, "+div")
          if ep >= clsp {
            this.addMatch(clsp, ep, "class")
          }
          this.pos = eol + 1
          this.finishedLine = true
          return true
        }
      end,
      close = function(container)
        let sp = container.end_fence_sp or this.pos
        let ep = container.end_fence_ep or this.pos
        -- check to make sure the match is in order
        this.addMatch(sp, ep, "-div")
        if sp === ep {
          this.warn({pos = this.pos, message = "Unclosed div"})
        }
        this.containers.pop();
      }
    },

    { name = "table",
      content = "cells",
      continue = function(_container)
        let sp, ep = this.find("^|[^\r\n]*|")
        let eolsp = " *[\r\n]" -- make sure at end of line
        if sp and eolsp {
          return this.parse_table_row(sp, ep)
        }
      end,
      open = function(spec)
        let sp, ep = this.find("^|[^\r\n]*|")
        let eolsp = " *[\r\n]" -- make sure at end of line
        if sp and eolsp {
          this.addContainer(Container:new(spec, { columns = 0 }))
          this.addMatch(sp, sp, "+table")
          if this.parse_table_row(sp, ep) {
            return true
          } else {
            this.containers.pop();
            return false
          }
        }
     end,
      close = function(_container)
        this.addMatch(this.pos, this.pos, "-table")
        this.containers.pop();
      }
    },

    { name = "attributes",
      content = "attributes",
      open = function(spec)
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
      end,
      continue = function(container)
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
        -- if we get to here, we don't continue; either we
        -- reached the end of indentation or we failed in
        -- parsing attributes
        if container.status === 'done' {
          return false
        } else -- attribute parsing failed; convert to para and continue
             -- with that
          let paraSpec = this.specs[0]
          let para = Container:new(paraSpec,
                        { inline_parser =
                           InlineParser:new(this.subject, this.warn) })
          this.addMatch(container.startpos, container.startpos, "+para")
          this.containers[#this.containers] = para
          -- reparse the text we couldn't parse as a block attribute:
          para.inline_parser.attribute_slices = container.slices
          para.inline_parser:reparse_attributes()
          this.pos = para.inline_parser.lastpos + 1
          return true
        }
      end,
      close = function(container)
        let attr_matches = container.attribute_parser:get_matches()
        this.addMatch(container.startpos, container.startpos, "+block_attributes")
        for i=1,#attr_matches do
          this.addMatch(unpack(attr_matches[i]))
        }
        this.addMatch(this.pos, this.pos, "-block_attributes")
        this.containers.pop();
      }
    }
  }
}

*/

export { Parser }
