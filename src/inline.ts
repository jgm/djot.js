import { Event } from "./event";
import { AttributeParser } from "./attributes";
import { Options, Warning } from "./options";
import { pattern, find } from "./find";

// General note on the parsing strategy:  our objective is to
// parse without backtracking. To that end, we keep a stack of
// potential 'openers' for links, images, emphasis, and other
// inline containers.  When we parse a potential closer for
// one of these constructions, we can scan the stack of openers
// for a match, which will tell us the location of the potential
// opener. We can then change the annotation of the match at
// that location to '+emphasis' or whatever.

// Opener:
// 1 = startpos, 2 = endpos, 3 = annotation, 4 = substartpos, 5 = endpos
//
// [link text](url)
// ^         ^^
// 1         23
// startpos    (1)
// endpos      (1)
// substartpos (2)
// subendpos   (3)
// annot       "explicit_link"

type Opener = {
  matchIndex: number,
  startpos: number,
  endpos: number,
  annot: null | string,
  subMatchIndex: number,
  substartpos: null | number,
  subendpos: null | number
}

type OpenerMap =
  { [opener: string]: Opener[] } // in reverse order

const C_TAB = 9;
const C_LF = 10;
const C_CR = 13;
const C_SPACE = 32;
const C_BANG = 33;
const C_DOUBLE_QUOTE = 34;
const C_DOLLARS = 36;
const C_SINGLE_QUOTE = 39;
const C_LEFT_PAREN = 40;
const C_RIGHT_PAREN = 41;
const C_ASTERISK = 42;
const C_PLUS = 43;
const C_HYPHEN = 45;
const C_PERIOD = 46;
const C_COLON = 58;
const C_LESSTHAN = 60;
const C_EQUALS = 61;
const C_LEFT_BRACKET = 91;
const C_BACKSLASH = 92;
const C_RIGHT_BRACKET = 93;
const C_HAT = 94;
const C_UNDERSCORE = 95;
const C_BACKTICK = 96;
const C_LEFT_BRACE = 123;
const C_RIGHT_BRACE = 125;
const C_TILDE = 126;

const reSpecial = /[\r\n"'()*+.:<=[\\\]^_`${}~-]/g;

// find first special character starting from startpos, and not
// going beyond endpos, or null if none found.
const findSpecial = function(s: string, startpos: number, endpos: number)
                          : number | null {
  reSpecial.lastIndex = startpos;
  const result = reSpecial.exec(s);
  if (result && result.index <= endpos) {
    return result.index;
  } else {
    return null;
  }
}

const pattNonspace = pattern("[^ \t\r\n]");
const pattLineEnd = pattern("[ \\t]*\\r?\\n");
const pattPunctuation = pattern("['!\"#$%&\\\\'()\\*+,\\-\\.\\/:;<=>?@\\[\\]\\^_`{|}~']");
const pattAutolink = pattern("\\<([^<>\\s]+)\\>");
const pattDelim = pattern("[_*~^+='\"-]");
const pattSymbol = pattern(":[\\w_+-]+:");
const pattTwoPeriods = pattern("\\.\\.");
const pattBackticks0 = pattern("`*");
const pattBackticks1 = pattern("`+");
const pattDoubleDollars = pattern("\\$\\$");
const pattSingleDollar = pattern("\\$");
const pattBackslash = pattern("\\\\");
const pattRawAttribute = pattern("\\{=[^\\s{}`]+\\}");
const pattNoteReference = pattern("\\^([^\\]]+)\\]");

const hasBrace = function(self: InlineParser, pos: number): boolean {
  return ((pos > 0 && self.subject.codePointAt(pos - 1) === C_LEFT_BRACE) ||
    self.subject.codePointAt(pos + 1) === C_RIGHT_BRACE);
}

const alwaysTrue = function() { return true; };

const betweenMatched = function(
  c: string,
  annotation: string,
  defaultmatch: string,
  opentest: ((self: InlineParser, pos: number) => boolean)) {
  return function(self: InlineParser, pos: number, endpos: number): number {
    const subject = self.subject;
    let can_open = find(subject, pattNonspace, pos + 1) !== null &&
      opentest(self, pos);
    let can_close = find(subject, pattNonspace, pos - 1) !== null;
    const lastmatch = self.matches[self.matches.length - 1];
    const has_open_marker = lastmatch && lastmatch.annot === "open_marker";
    const has_close_marker = pos + 1 <= endpos &&
      subject.codePointAt(pos + 1) === C_RIGHT_BRACE;
    let endcloser = pos;
    let startopener = pos;

    // Allow explicit open/close markers to override:
    if (has_open_marker) {
      can_open = true;
      can_close = false;
      startopener = pos - 1;
    }
    if (!has_open_marker && has_close_marker) {
      can_close = true;
      can_open = false;
      endcloser = pos + 1;
    }

    if (has_open_marker && defaultmatch.match(/^right/)) {
      defaultmatch = defaultmatch.replace(/^right/, "left");
    } else if (has_close_marker && defaultmatch.match(/^left/)) {
      defaultmatch = defaultmatch.replace(/^left/, "right");
    }

    let d = c;
    if (has_close_marker) {
      d = "{" + d;
    }
    const openers = self.openers[d];

    if (can_close && openers && openers.length > 0) {
      // check openers for a match
      const opener = openers[openers.length - 1];
      if (opener.endpos !== pos - 1) { // exclude empty emph
        self.clearOpeners(opener.startpos, pos);
        self.addMatch(opener.startpos, opener.endpos, "+" + annotation,
                      opener.matchIndex);
        self.addMatch(pos, endcloser, "-" + annotation);
        return endcloser + 1;
      }
    }

    // If we get here, we didn't match an opener:
    if (can_open) {
      let e = c;
      if (has_open_marker) {
        e = "{" + e;
      }
      self.addOpener(e, startopener, pos, defaultmatch);
      return pos + 1;
    } else {
      self.addMatch(pos, endcloser, defaultmatch);
      return endcloser + 1;
    }
  }
}

// handlers for specific code points:
const matchers = {
  [C_BACKTICK]: function(self: InlineParser, pos: number, endpos: number): number | null {
    const subject = self.subject;
    const m = find(subject, pattBackticks0, pos, endpos);
    if (m === null) {
      return null;
    }
    const endchar = m.endpos;
    if (find(subject, pattDoubleDollars, pos - 2) &&
      !find(subject, pattBackslash, pos - 3)) {
      self.matches.pop(); // remove first $
      self.matches.pop(); // remove second $
      self.addMatch(pos - 2, endchar, "+display_math");
      self.verbatimType = "display_math"
    } else if (find(subject, pattSingleDollar, pos - 1)) {
      self.matches.pop(); // remove $
      self.addMatch(pos - 1, endchar, "+inline_math");
      self.verbatimType = "inline_math";
    } else {
      self.addMatch(pos, endchar, "+verbatim");
      self.verbatimType = "verbatim";
    }
    self.verbatim = endchar - pos + 1;
    return endchar + 1;
  },

  [C_BACKSLASH]: function(self: InlineParser, pos: number, endpos: number): number | null {
    const subject = self.subject;
    const mLineEnd = find(subject, pattLineEnd, pos + 1, endpos);
    if (mLineEnd !== null) {
      // see if there were preceding spaces and remove them
      if (self.matches.length > 0) {
        const lastmatch = self.matches[self.matches.length - 1];
        if (lastmatch.annot === "str") {
          let ep = lastmatch.endpos;
          const sp = lastmatch.startpos;
          while (ep >= sp &&
            (subject.codePointAt(ep) === C_SPACE ||
              subject.codePointAt(ep) === C_TAB)) {
            ep = ep - 1;
          }
          if (ep < sp) {
            self.matches.pop();
          } else {
            lastmatch.endpos = ep;
          }
        }
      }
      self.addMatch(pos, pos, "escape");
      self.addMatch(pos + 1, mLineEnd.endpos, "hard_break");
      return mLineEnd.endpos + 1;
    } else {
      const mPunct = find(subject, pattPunctuation, pos + 1, endpos);
      if (mPunct !== null) {
        self.addMatch(pos, pos, "escape");
        self.addMatch(mPunct.startpos, mPunct.endpos, "str");
        return mPunct.endpos + 1;
      } else if (pos + 1 <= endpos &&
        subject.codePointAt(pos + 1) === C_SPACE) {
        self.addMatch(pos, pos, "escape");
        self.addMatch(pos + 1, pos + 1, "non_breaking_space");
        return pos + 2;
      } else {
        self.addMatch(pos, pos, "str");
        return pos + 1;
      }
    }
  },

  [C_LESSTHAN]: function(self: InlineParser, pos: number, endpos: number): number | null {
    const subject = self.subject;
    const m = find(subject, pattAutolink, pos, endpos);
    if (m === null) {
      return null;
    }
    const endurl = m.endpos;
    const starturl = m.startpos;
    const url = m.captures[0];
    if (url.match(/[^:]@/)) { // email
      self.addMatch(starturl, starturl, "+email");
      self.addMatch(starturl + 1, endurl - 1, "str");
      self.addMatch(endurl, endurl, "-email");
      return endurl + 1;
    } else if (url.match(/[a-zA-Z]:/)) { /// url
      self.addMatch(starturl, starturl, "+url");
      self.addMatch(starturl + 1, endurl - 1, "str");
      self.addMatch(endurl, endurl, "-url");
      return endurl + 1;
    }
    return null;
  },

  [C_TILDE]: betweenMatched('~', 'subscript', 'str', alwaysTrue),

  [C_HAT]: betweenMatched('^', 'superscript', 'str', alwaysTrue),

  [C_UNDERSCORE]: betweenMatched('_', 'emph', 'str', alwaysTrue),

  [C_ASTERISK]: betweenMatched('*', 'strong', 'str', alwaysTrue),

  [C_PLUS]: betweenMatched("+", "insert", "str", hasBrace),

  [C_EQUALS]: betweenMatched("=", "mark", "str", hasBrace),

  [C_SINGLE_QUOTE]: betweenMatched("'", "single_quoted", "right_single_quote",
    function(self: InlineParser, pos: number): boolean {
      if (pos === 0) {
        return true;
      } else {
        const cp = self.subject.codePointAt(pos - 1);
        return (cp === C_SPACE ||
          cp === C_TAB ||
          cp === C_CR ||
          cp === C_LF ||
          cp === C_DOUBLE_QUOTE ||
          cp === C_SINGLE_QUOTE ||
          cp === C_HYPHEN ||
          cp === C_LEFT_PAREN ||
          cp === C_LEFT_BRACKET);
      }
    }),

  [C_DOUBLE_QUOTE]: betweenMatched('"', "double_quoted", "left_double_quote",
    alwaysTrue),

  [C_LEFT_BRACE]: function(self: InlineParser, pos: number, endpos: number): number | null {
    if (find(self.subject, pattDelim, pos + 1, endpos)) {
      self.addMatch(pos, pos, "open_marker");
      return pos + 1;
    } else if (self.allowAttributes) {
      self.attributeParser = new AttributeParser(self.subject);
      self.attributeStart = pos;
      self.attributeSlices = [];
      return pos;
    } else {
      self.addMatch(pos, pos, "str");
      return pos + 1;
    }
  },

  [C_COLON]: function(self: InlineParser, pos: number, endpos: number): number | null {
    const m = find(self.subject, pattSymbol, pos, endpos)
    if (m) {
      self.addMatch(m.startpos, m.endpos, "symb");
      return m.endpos + 1;
    } else {
      self.addMatch(pos, pos, "str");
      return pos + 1;
    }
  },

  [C_PERIOD]: function(self: InlineParser, pos: number, endpos: number): number | null {
    if (find(self.subject, pattTwoPeriods, pos + 1, endpos)) {
      self.addMatch(pos, pos + 2, "ellipses");
      return pos + 3;
    } else {
      return null;
    }
  },

  [C_LEFT_BRACKET]: function(self: InlineParser, pos: number, endpos: number): number {
    const m = find(self.subject, pattNoteReference, pos + 1, endpos);
    if (m) { // footnote ref
      self.addMatch(pos, m.endpos, "footnote_reference");
      return m.endpos + 1;
    } else {
      self.addOpener("[", pos, pos, "str");
      return pos + 1;
    }
  },

  [C_RIGHT_BRACKET]: function(self: InlineParser, pos: number, endpos: number): number | null {
    const openers = self.openers["["];
    const subject = self.subject;
    if (openers && openers.length > 0) {
      const opener = openers[openers.length - 1];
      if (opener.annot === "reference_link") {
        // found a reference link
        // convert all matches inside reference to str
        self.strMatches((opener.subendpos || opener.endpos) + 1, pos - 1);
        // add the matches
        const isImage =
          subject.codePointAt(opener.startpos - 1) === C_BANG &&
          subject.codePointAt(opener.startpos - 2) !== C_BACKSLASH;
        if (isImage) {
          self.addMatch(opener.startpos - 1, opener.startpos - 1,
            "image_marker", opener.matchIndex - 1);
          self.addMatch(opener.startpos, opener.endpos, "+imagetext",
                        opener.matchIndex);
          self.addMatch(opener.substartpos || opener.startpos,
            opener.substartpos || opener.startpos, "-imagetext",
            opener.subMatchIndex);
        } else {
          self.addMatch(opener.startpos, opener.endpos, "+linktext",
                        opener.matchIndex);
          self.addMatch(opener.substartpos || opener.startpos,
            opener.substartpos || opener.startpos, "-linktext",
            opener.subMatchIndex);
        }
        self.addMatch(opener.subendpos || opener.endpos,
          opener.subendpos || opener.endpos, "+reference",
          opener.subMatchIndex + 1);
        self.addMatch(pos, pos, "-reference");
        // remove from openers
        self.clearOpeners(opener.startpos, pos);
        return pos + 1;
      } else if (pos + 1 <= endpos &&
        subject.codePointAt(pos + 1) === C_LEFT_BRACKET) {
        opener.annot = "reference_link";
        self.addMatch(pos, pos, "str");
        opener.subMatchIndex = self.matches.length - 1;
        self.addMatch(pos + 1, pos + 1, "str");
        opener.substartpos = pos;  // intermediate ]
        opener.subendpos = pos + 1;  // intermediate [
        // remove any openers between [ and ]
        self.clearOpeners(opener.startpos + 1, pos - 1);
        return pos + 2;
      } else if (pos + 1 <= endpos &&
        subject.codePointAt(pos + 1) === C_LEFT_PAREN) {
        self.openers["("] = []; // clear ( openers
        opener.annot = "explicit_link";
        self.addMatch(pos, pos, "str"); // ]
        opener.subMatchIndex = self.matches.length - 1;
        self.addMatch(pos + 1, pos + 1, "str"); // (
        opener.substartpos = pos;  // intermediate ]
        opener.subendpos = pos + 1;  // intermediate (
        self.destination = true;
        // remove any openers between [ and ]
        self.clearOpeners(opener.startpos + 1, pos - 1);
        return pos + 2;
      } else if (pos + 1 <= endpos &&
        subject.codePointAt(pos + 1) === C_LEFT_BRACE) {
        // assume this is attributes, bracketed span
        self.addMatch(opener.startpos, opener.endpos, "+span",
                      opener.matchIndex);
        self.addMatch(pos, pos, "-span");
        // remove any openers between [ and ]
        self.clearOpeners(opener.startpos, pos);
        return pos + 1;
      }
    }
    return null;
  },

  [C_LEFT_PAREN]: function(self: InlineParser, pos: number, endpos: number): number | null {
    if (!self.destination) {
      return null;
    }
    self.addOpener("(", pos, pos, "str");
    return pos + 1;
  },

  [C_RIGHT_PAREN]: function(self: InlineParser, pos: number, endpos: number): number | null {
    if (!self.destination) {
      return null;
    }
    const parens = self.openers["("];
    if (parens && parens.length > 0) {
      parens.pop(); // clear opener
      self.addMatch(pos, pos, "str");
      return pos + 1;
    } else {
      const subject = self.subject;
      const openers = self.openers["["];
      const opener = openers[openers.length - 1];
      if (openers && openers.length > 0 && opener.annot === "explicit_link") {
        // we have inline link
        // convert all matches inside destination to str
        self.strMatches((opener.subendpos || opener.endpos) + 1, pos - 1);
        const isImage =
          subject.codePointAt(opener.startpos - 1) === C_BANG &&
          subject.codePointAt(opener.startpos - 2) !== C_BACKSLASH;
        if (isImage) {
          self.addMatch(opener.startpos - 1, opener.startpos - 1,
                        "image_marker", opener.matchIndex - 1);
          self.addMatch(opener.startpos, opener.endpos, "+imagetext",
                        opener.matchIndex);
          self.addMatch(opener.substartpos || opener.startpos,
            opener.substartpos || opener.startpos, "-imagetext",
            opener.subMatchIndex);
        } else {
          self.addMatch(opener.startpos, opener.endpos, "+linktext",
                        opener.matchIndex);
          self.addMatch(opener.substartpos || opener.startpos,
            opener.substartpos || opener.startpos, "-linktext",
            opener.subMatchIndex);
        }
        self.addMatch(opener.subendpos || opener.endpos,
          opener.subendpos || opener.endpos, "+destination",
          opener.subMatchIndex + 1);
        self.addMatch(pos, pos, "-destination");
        self.destination = false;
        // remove from openers
        self.clearOpeners(opener.startpos, pos);
        return pos + 1;
      }
    }
    return null;
  },

  [C_HYPHEN]: function(self: InlineParser, pos: number, endpos: number): number | null {
    const subject = self.subject;
    if (subject.codePointAt(pos - 1) === C_LEFT_BRACE ||
      subject.codePointAt(pos + 1) === C_RIGHT_BRACE) {
      const newpos =
            betweenMatched("-", "delete", "str", hasBrace)(self, pos, endpos);
      if (newpos) {
        return newpos;
      }
    }
    // didn't match a del, try for smart hyphens:
    let ep = pos;
    let hyphens = 0;
    while (ep <= endpos && subject.codePointAt(ep) === C_HYPHEN) {
      ep++;
      hyphens++;
    }
    if (subject.codePointAt(ep) === C_RIGHT_BRACE) {
      hyphens--;  // last hyphen is close del
    }
    if (hyphens === 0) { // this means we have '-}'
      self.addMatch(pos, pos + 1, "str");
      return pos + 2;
    }
    // Try to construct a homogeneous sequence of dashes
    const all_em = hyphens % 3 === 0;
    const all_en = hyphens % 2 === 0;
    while (hyphens > 0) {
      if (all_em) {
        self.addMatch(pos, pos + 2, "em_dash");
        pos = pos + 3;
        hyphens = hyphens - 3;
      } else if (all_en) {
        self.addMatch(pos, pos + 1, "en_dash");
        pos = pos + 2;
        hyphens = hyphens - 2;
      } else if (hyphens >= 3 && (hyphens % 2 !== 0 || hyphens > 4)) {
        self.addMatch(pos, pos + 2, "em_dash");
        pos = pos + 3;
        hyphens = hyphens - 3;
      } else if (hyphens >= 2) {
        self.addMatch(pos, pos + 1, "en_dash");
        pos = pos + 2;
        hyphens = hyphens - 2;
      } else {
        self.addMatch(pos, pos, "str");
        pos = pos + 1;
        hyphens = hyphens - 1;
      }
    }
    return pos;
  }
};

class InlineParser {
  options: Options;
  warn: (warning : Warning) => void;
  subject: string;
  matches: Event[];
  openers: OpenerMap; // map from opener type to Opener[] in reverse order
  verbatim: number; // parsing a verbatim span to be ended by N backticks
  verbatimType: string; // math or regular
  destination: boolean; // parsing link destination?
  firstpos: number; // position of first slice
  lastpos: number; // position of last slice
  allowAttributes: boolean; // allow parsing of attributes
  attributeParser: null | AttributeParser; // attribute parser
  attributeStart: null | number; // start pos of potential attribute
  attributeSlices: null | { startpos: number, endpos: number }[]; // slices we've tried to parse as atttributes
  matchers: Record<number, (self: InlineParser, sp: number, ep: number) => null | number>; // functions to handle different code points

  constructor(subject: string,
              options: Options = {}) {
    this.options = options;
    this.warn = options.warn || (() => {});
    this.subject = subject;
    this.matches = [];  // array of matches
    this.openers = {};
    this.verbatim = 0;
    this.verbatimType = "";
    this.destination = false;
    this.firstpos = -1;
    this.lastpos = 0;
    this.allowAttributes = true;
    this.attributeParser = null;
    this.attributeStart = null;
    this.attributeSlices = null;
    this.matchers = matchers;
  }

  addMatch(startpos: number, endpos: number,
           annot: string, matchIndex?: number): void {
    const match = { startpos: startpos, endpos: endpos, annot: annot };
    if (matchIndex !== undefined) {
      // insert into the proper place, replacing placeholder
      this.matches.splice(matchIndex, 1, match);
    } else {
      this.matches.push(match);
    }
  }

  inVerbatim(): boolean {
    return (this.verbatim > 0);
  }

  singleChar(pos: number): number {
    this.addMatch(pos, pos, "str");
    return pos + 1;
  }

  reparseAttributes(): void {
    // Reparse attributeSlices that we tried to parse as an attribute
    const slices = this.attributeSlices;
    if (slices === null) {
      return;
    }
    this.allowAttributes = false;
    this.attributeParser = null;
    this.attributeStart = null;
    if (slices !== null) {
      for (const slice of slices) {
        this.feed(slice.startpos, slice.endpos);
      }
    }
    this.allowAttributes = true;
    this.attributeSlices = null;
  }

  getMatches(): Event[] {
    const subject = this.subject;
    if (this.attributeParser) {
      // we're still in an attribute parse
      this.reparseAttributes();
    }
    let i = this.matches.length - 1;
    // remove trailing softbreak and any spaces
    if (this.matches[i] && this.matches[i].annot === "soft_break") {
      this.matches.pop();
      const match = this.matches[this.matches.length - 1];
      if (match && match.annot === "str" &&
          subject.codePointAt(match.endpos) === 32) {
        while (match.endpos >= match.startpos &&
               subject.codePointAt(match.endpos) === 32) {
          match.endpos = match.endpos - 1;
        }
        if (match.endpos < match.startpos) {
          this.matches.pop();
        }
      }
    }
    // add -verbatim if needed
    if (this.matches.length > 0 && this.verbatim > 0) { // unclosed verbatim
      const last = this.matches[this.matches.length - 1];
      this.warn(new Warning("Unclosed verbatim", last.endpos));
      this.matches.push({
        startpos: last.endpos,
        endpos: last.endpos,
        annot: "-" + this.verbatimType
      });
    }
    return this.matches;
  }

  addOpener(name: string,
            startpos: number,
            endpos: number,
            defaultAnnot: string) : void {
    if (!this.openers[name]) {
      this.openers[name] = [];
    }
    this.openers[name].push({ matchIndex: this.matches.length,
                              startpos: startpos,
                              endpos: endpos,
                              annot: null,
                              subMatchIndex: this.matches.length,
                              substartpos: null,
                              subendpos: null });
    // add default match (to be used if we don't match the opener)
    this.addMatch(startpos, endpos, defaultAnnot);
  }

  clearOpeners(startpos: number, endpos: number): void {
    // Remove other openers in between the matches
    for (const k in this.openers) {
      const v = this.openers[k];
      let i = v.length - 1
      while (v[i]) {
        const opener = v[i];
        if (opener.startpos >= startpos && opener.endpos <= endpos) {
          v.splice(i, 1);
        } else if ((opener.substartpos && opener.substartpos >= startpos) &&
          (opener.subendpos && opener.subendpos <= endpos)) {
          v[i].substartpos = null;
          v[i].subendpos = null;
          v[i].annot = null;
        } else {
          break;
        }
        i--;
      }
    }
  }

  strMatches(startpos: number, endpos: number): void {
    // convert matches between startpos and endpos to str
    let i = this.matches.length - 1;
    // backup to startpos
    while (i > 0 && this.matches[i].startpos >= startpos) {
      i--;
    }
    if (this.matches[i].startpos < startpos) {
      i++
    }
    while (this.matches[i] && this.matches[i].endpos <= endpos) {
      const m = this.matches[i];
      if (m.annot !== "escape" && m.annot !== "str") {
        m.annot = "str";
      }
      i++;
    }
  }


  feed(startpos: number, endpos: number): void {

    // Feed a slice to the parser, updating state.
    const subject = this.subject;
    if (this.firstpos === -1 || startpos < this.firstpos) {
      this.firstpos = startpos;
    }
    if (this.lastpos === 0 || endpos > this.lastpos) {
      this.lastpos = endpos;
    }
    let pos = startpos;
    while (pos <= endpos) {
      if (this.attributeParser !== null) {
        const sp = pos;
        const nextSpecial = findSpecial(subject, pos, endpos);
        let ep2;
        if (nextSpecial === null) {
          ep2 = endpos;
        } else {
          ep2 = nextSpecial;
        }
        const result = this.attributeParser.feed(sp, ep2);
        const ep = result.position;
        if (result.status === "done") {
          const attributeStart = this.attributeStart;
          // add attribute matches
          if (attributeStart !== null) {
            this.addMatch(attributeStart, attributeStart, "+attributes");
          }
          const attrMatches = this.attributeParser.matches;
          // add attribute matches
          for (const match of attrMatches) {
            this.addMatch(match.startpos, match.endpos, match.annot);
          }
          this.addMatch(ep, ep, "-attributes");
          // restore state to prior to adding attribute parser
          this.attributeParser = null;
          this.attributeStart = null;
          this.attributeSlices = null;
          pos = ep + 1;
        } else if (result.status === "fail") {
          this.reparseAttributes();
          pos = sp;
          // as no slice was added for it
        } else if (result.status === "continue") {
          if (this.attributeSlices === null) {
            this.attributeSlices = [];
          }
          this.attributeSlices.push({ startpos: sp, endpos: ep });
          pos = ep + 1;
        }
      } else {
        // find next interesting character:
        const nextSpecial = findSpecial(subject, pos, endpos);
        let newpos;
        if (nextSpecial === null) {
          newpos = endpos + 1;
        } else {
          newpos = nextSpecial;
        }
        if (newpos > pos) {
          this.addMatch(pos, newpos - 1, "str");
          pos = newpos;
          if (pos > endpos) {
            break; // otherwise, fall through:
          }
        }
        // if we get here, then newpos = pos,
        // i.e. we have something interesting at pos
        const c = subject.codePointAt(pos);
        if (c === undefined) {
          throw (new Error("Code point at " + pos + " is undefined."));
        }

        if (c === C_CR || c === C_LF) { // cr or lf
          if (c === C_CR && subject.codePointAt(pos + 1) === C_LF &&
            pos + 1 <= endpos) {
            this.addMatch(pos, pos + 1, "soft_break");
            pos = pos + 2;
          } else {
            this.addMatch(pos, pos, "soft_break");
            pos = pos + 1;
          }
        } else if (this.verbatim > 0) {
          if (c === 96) {
            const m = find(subject, pattBackticks1, pos, endpos);
            if (m) {
              const endchar = m.endpos;
              if (m.endpos - pos + 1 === this.verbatim) {
                // check for raw attribute
                const m2 = find(subject, pattRawAttribute, endchar + 1, endpos);
                if (m2 && this.verbatimType === "verbatim") { // raw
                  this.addMatch(pos, endchar, "-" + this.verbatimType);
                  this.addMatch(m2.startpos, m2.endpos, "raw_format");
                  pos = m2.endpos + 1;
                } else {
                  this.addMatch(pos, endchar, "-" + this.verbatimType);
                  pos = endchar + 1;
                }
                this.verbatim = 0;
                this.verbatimType = "verbatim";
              } else {
                this.addMatch(pos, endchar, "str");
                pos = endchar + 1;
              }
            } else {
              this.addMatch(pos, endpos, "str");
              pos = endpos + 1;
            }
          } else {
            this.addMatch(pos, pos, "str");
            pos = pos + 1;
          }
        } else {
          const matcher = this.matchers[c];
          if (matcher) {
            const res = matcher(this, pos, endpos);
            if (res === null) {
              pos = this.singleChar(pos);
            } else {
              pos = res;
            }
          } else {
            pos = this.singleChar(pos);
          }
        }
      }
    }
    return;
  }


}


export { InlineParser }
