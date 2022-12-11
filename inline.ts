import { Event } from "./event.js";
import { AttributeParser } from "./attributes.js";
import { find, boundedFind } from "./find.js";

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
  startpos : number,
  endpos : number,
  annot : null | string,
  substartpos : null | number,
  subendpos : null | number
}

type OpenerMap =
  { [opener: string]: Opener[] } // in reverse order

/*

function InlineParser:str_matches(startpos, endpos)
  for i = startpos, endpos do
    local m = self.matches[i]
    if m then
      local sp, ep, annot = unpack(m)
      if annot ~= "str" and annot ~= "escape" then
        self.matches[i] = {sp, ep, "str"}
      end
    end
  end
end

local function matches_pattern(match, patt)
  if match then
    return string.find(match[3], patt)
  end
end


function InlineParser.between_matched(c, annotation, defaultmatch, opentest)
  return function(self, pos, endpos)
    defaultmatch = defaultmatch or "str"
    local subject = self.subject
    local can_open = find(subject, "^%S", pos + 1)
    local can_close = find(subject, "^%S", pos - 1)
    local has_open_marker = matches_pattern(self.matches[pos - 1], "^open%_marker")
    local has_close_marker = pos + 1 <= endpos and
                              byte(subject, pos + 1) == 125 -- }
    local endcloser = pos
    local startopener = pos

    if type(opentest) == "function" then
      can_open = can_open and opentest(self, pos)
    end

    -- allow explicit open/close markers to override:
    if has_open_marker then
      can_open = true
      can_close = false
      startopener = pos - 1
    end
    if not has_open_marker and has_close_marker then
      can_close = true
      can_open = false
      endcloser = pos + 1
    end

    if has_open_marker and defaultmatch:match("^right") then
      defaultmatch = defaultmatch:gsub("^right", "left")
    elseif has_close_marker and defaultmatch:match("^left") then
      defaultmatch = defaultmatch:gsub("^left", "right")
    end

    local d
    if has_close_marker then
      d = "{" .. c
    else
      d = c
    end
    local openers = self.openers[d]
    if can_close and openers and #openers > 0 then
       -- check openers for a match
      local openpos, openposend = unpack(openers[#openers])
      if openposend ~= pos - 1 then -- exclude empty emph
        self:clear_openers(openpos, pos)
        self:add_match(openpos, openposend, "+" .. annotation)
        self:add_match(pos, endcloser, "-" .. annotation)
        return endcloser + 1
      end
    end

    -- if we get here, we didn't match an opener
    if can_open then
      if has_open_marker then
        d = "{" .. c
      else
        d = c
      end
      self:add_opener(d, startopener, pos)
      self:add_match(startopener, pos, defaultmatch)
      return pos + 1
    else
      self:add_match(pos, endcloser, defaultmatch)
      return endcloser + 1
    end
  end
end

InlineParser.matchers = {
    -- 96 = `
    [96] = function(self, pos, endpos)
      local subject = self.subject
      local _, endchar = bounded_find(subject, "^`*", pos, endpos)
      if not endchar then
        return nil
      end
      if find(subject, "^%$%$", pos - 2) and
          not find(subject, "^\\", pos - 3) then
        self.matches[pos - 2] = nil
        self.matches[pos - 1] = nil
        self:add_match(pos - 2, endchar, "+display_math")
        self.verbatim_type = "display_math"
      elseif find(subject, "^%$", pos - 1) then
        self.matches[pos - 1] = nil
        self:add_match(pos - 1, endchar, "+inline_math")
        self.verbatim_type = "inline_math"
      else
        self:add_match(pos, endchar, "+verbatim")
        self.verbatim_type = "verbatim"
      end
      self.verbatim = endchar - pos + 1
      return endchar + 1
    end,

    -- 92 = \
    [92] = function(self, pos, endpos)
      local subject = self.subject
      local _, endchar = bounded_find(subject, "^[ \t]*\r?\n",  pos + 1, endpos)
      self:add_match(pos, pos, "escape")
      if endchar then
        -- see if there were preceding spaces
        if #self.matches > 0 then
          local sp, ep, annot = unpack(self.matches[#self.matches])
          if annot == "str" then
            while subject:byte(ep) == 32 or subject:byte(ep) == 9 do
              ep = ep -1
            end
            if sp == ep then
              self.matches[#self.matches] = nil
            else
              self:add_match(sp, ep, "str")
            end
          end
        end
        self:add_match(pos + 1, endchar, "hardbreak")
        return endchar + 1
      else
        local _, ec = bounded_find(subject, "^[%p ]", pos + 1, endpos)
        if not ec then
          self:add_match(pos, pos, "str")
          return pos + 1
        else
          self:add_match(pos, pos, "escape")
          if find(subject, "^ ", pos + 1) then
            self:add_match(pos + 1, ec, "nbsp")
          else
            self:add_match(pos + 1, ec, "str")
          end
          return ec + 1
        end
      end
    end,

    -- 60 = <
    [60] = function(self, pos, endpos)
      local subject = self.subject
      local starturl, endurl =
              bounded_find(subject, "^%<[^<>%s]+%>", pos, endpos)
      if starturl then
        local is_url = bounded_find(subject, "^%a+:", pos + 1, endurl)
        local is_email = bounded_find(subject, "^[^:]+%@", pos + 1, endurl)
        if is_email then
          self:add_match(starturl, starturl, "+email")
          self:add_match(starturl + 1, endurl - 1, "str")
          self:add_match(endurl, endurl, "-email")
          return endurl + 1
        elseif is_url then
          self:add_match(starturl, starturl, "+url")
          self:add_match(starturl + 1, endurl - 1, "str")
          self:add_match(endurl, endurl, "-url")
          return endurl + 1
        end
      end
    end,

    -- 126 = ~
    [126] = InlineParser.between_matched('~', 'subscript'),

    -- 94 = ^
    [94] = InlineParser.between_matched('^', 'superscript'),

    -- 91 = [
    [91] = function(self, pos, endpos)
      local sp, ep = bounded_find(self.subject, "^%^([^]]+)%]", pos + 1, endpos)
      if sp then -- footnote ref
        self:add_match(pos, ep, "footnote_reference")
        return ep + 1
      else
        self:add_opener("[", pos, pos)
        self:add_match(pos, pos, "str")
        return pos + 1
      end
    end,

    -- 93 = ]
    [93] = function(self, pos, endpos)
      local openers = self.openers["["]
      local subject = self.subject
      if openers and #openers > 0 then
        local opener = openers[#openers]
        if opener[3] == "reference_link" then
          -- found a reference link
          -- add the matches
          local is_image = bounded_find(subject, "^!", opener[1] - 1, endpos)
                  and not bounded_find(subject, "^[\\]", opener[1] - 2, endpos)
          if is_image then
            self:add_match(opener[1] - 1, opener[1] - 1, "image_marker")
            self:add_match(opener[1], opener[2], "+imagetext")
            self:add_match(opener[4], opener[4], "-imagetext")
          else
            self:add_match(opener[1], opener[2], "+linktext")
            self:add_match(opener[4], opener[4], "-linktext")
          end
          self:add_match(opener[5], opener[5], "+reference")
          self:add_match(pos, pos, "-reference")
          -- convert all matches to str
          self:str_matches(opener[5] + 1, pos - 1)
          -- remove from openers
          self:clear_openers(opener[1], pos)
          return pos + 1
        elseif bounded_find(subject, "^%[", pos + 1, endpos) then
          opener[3] = "reference_link"
          opener[4] = pos  -- intermediate ]
          opener[5] = pos + 1  -- intermediate [
          self:add_match(pos, pos + 1, "str")
          -- remove any openers between [ and ]
          self:clear_openers(opener[1] + 1, pos - 1)
          return pos + 2
        elseif bounded_find(subject, "^%(", pos + 1, endpos) then
          self.openers["("] = {} -- clear ( openers
          opener[3] = "explicit_link"
          opener[4] = pos  -- intermediate ]
          opener[5] = pos + 1  -- intermediate (
          self.destination = true
          self:add_match(pos, pos + 1, "str")
          -- remove any openers between [ and ]
          self:clear_openers(opener[1] + 1, pos - 1)
          return pos + 2
        elseif bounded_find(subject, "^%{", pos + 1, endpos) then
          -- assume this is attributes, bracketed span
          self:add_match(opener[1], opener[2], "+span")
          self:add_match(pos, pos, "-span")
          -- remove any openers between [ and ]
          self:clear_openers(opener[1], pos)
          return pos + 1
        end
      end
    end,


    -- 40 = (
    [40] = function(self, pos)
      if not self.destination then return nil end
      self:add_opener("(", pos, pos)
      self:add_match(pos, pos, "str")
      return pos + 1
    end,

    -- 41 = )
    [41] = function(self, pos, endpos)
      if not self.destination then return nil end
      local parens = self.openers["("]
      if parens and #parens > 0 and parens[#parens][1] then
        parens[#parens] = nil -- clear opener
        self:add_match(pos, pos, "str")
        return pos + 1
      else
        local subject = self.subject
        local openers = self.openers["["]
        if openers and #openers > 0
            and openers[#openers][3] == "explicit_link" then
          local opener = openers[#openers]
          -- we have inline link
          local is_image = bounded_find(subject, "^!", opener[1] - 1, endpos)
                 and not bounded_find(subject, "^[\\]", opener[1] - 2, endpos)
          if is_image then
            self:add_match(opener[1] - 1, opener[1] - 1, "image_marker")
            self:add_match(opener[1], opener[2], "+imagetext")
            self:add_match(opener[4], opener[4], "-imagetext")
          else
            self:add_match(opener[1], opener[2], "+linktext")
            self:add_match(opener[4], opener[4], "-linktext")
          end
          self:add_match(opener[5], opener[5], "+destination")
          self:add_match(pos, pos, "-destination")
          self.destination = false
          -- convert all matches to str
          self:str_matches(opener[5] + 1, pos - 1)
          -- remove from openers
          self:clear_openers(opener[1], pos)
          return pos + 1
        end
      end
    end,

    -- 95 = _
    [95] = InlineParser.between_matched('_', 'emph'),

    -- 42 = *
    [42] = InlineParser.between_matched('*', 'strong'),

    -- 123 = {
    [123] = function(self, pos, endpos)
      if bounded_find(self.subject, "^[_*~^+='\"-]", pos + 1, endpos) then
        self:add_match(pos, pos, "open_marker")
        return pos + 1
      elseif self.allowAttributes then
        self.attributeParser = attributes.AttributeParser:new(self.subject)
        self.attributeStart = pos
        self.attributeSlices = {}
        return pos
      else
        self:add_match(pos, pos, "str")
        return pos + 1
      end
    end,

    -- 58 = :
    [58] = function(self, pos, endpos)
      local sp, ep = bounded_find(self.subject, "^%:[%w_+-]+%:", pos, endpos)
      if sp then
        self:add_match(sp, ep, "emoji")
        return ep + 1
      else
        self:add_match(pos, pos, "str")
        return pos + 1
      end
    end,

    -- 43 = +
    [43] = InlineParser.between_matched("+", "insert", "str",
                           function(self, pos)
                             return find(self.subject, "^%{", pos - 1) or
                                    find(self.subject, "^%}", pos + 1)
                           end),

    -- 61 = =
    [61] = InlineParser.between_matched("=", "mark", "str",
                           function(self, pos)
                             return find(self.subject, "^%{", pos - 1) or
                                    find(self.subject, "^%}", pos + 1)
                           end),

    -- 39 = '
    [39] = InlineParser.between_matched("'", "single_quoted", "right_single_quote",
                           function(self, pos) -- test to open
                             return pos == 1 or
                               find(self.subject, "^[%s\"'-([]", pos - 1)
                             end),

    -- 34 = "
    [34] = InlineParser.between_matched('"', "double_quoted", "left_double_quote"),

    -- 45 = -
    [45] = function(self, pos, endpos)
      local subject = self.subject
      local nextpos
      if byte(subject, pos - 1) == 123 or
         byte(subject, pos + 1) == 125 then -- (123 = { 125 = })
        nextpos = InlineParser.between_matched("-", "delete", "str",
                           function(slf, p)
                             return find(slf.subject, "^%{", p - 1) or
                                    find(slf.subject, "^%}", p + 1)
                           end)(self, pos, endpos)
        return nextpos
      end
      -- didn't match a del, try for smart hyphens:
      local _, ep = find(subject, "^%-*", pos)
      if endpos < ep then
        ep = endpos
      end
      local hyphens = 1 + ep - pos
      if byte(subject, ep + 1) == 125 then -- 125 = }
        hyphens = hyphens - 1 -- last hyphen is close del
      end
      if hyphens == 0 then  -- this means we have '-}'
        self:add_match(pos, pos + 1, "str")
        return pos + 2
      end
      -- Try to construct a homogeneous sequence of dashes
      local all_em = hyphens % 3 == 0
      local all_en = hyphens % 2 == 0
      while hyphens > 0 do
        if all_em then
          self:add_match(pos, pos + 2, "em_dash")
          pos = pos + 3
          hyphens = hyphens - 3
        elseif all_en then
          self:add_match(pos, pos + 1, "en_dash")
          pos = pos + 2
          hyphens = hyphens - 2
        elseif hyphens >= 3 and (hyphens % 2 ~= 0 or hyphens > 4) then
          self:add_match(pos, pos + 2, "em_dash")
          pos = pos + 3
          hyphens = hyphens - 3
        elseif hyphens >= 2 then
          self:add_match(pos, pos + 1, "en_dash")
          pos = pos + 2
          hyphens = hyphens - 2
        else
          self:add_match(pos, pos, "str")
          pos = pos + 1
          hyphens = hyphens - 1
        end
      end
      return pos
    end,

    -- 46 = .
    [46] = function(self, pos, endpos)
      if bounded_find(self.subject, "^%.%.", pos + 1, endpos) then
        self:add_match(pos, pos +2, "ellipses")
        return pos + 3
      end
    end
  }

-- Feed a slice to the parser, updating state.
function InlineParser:feed(spos, endpos)
  local special = "[][\\`{}_*()!<>~^:=+$\r\n'\".-]"
  local subject = self.subject
  local matchers = self.matchers
  local pos
  if self.firstpos == 0 or spos < self.firstpos then
    self.firstpos = spos
  end
  if self.lastpos == 0 or endpos > self.lastpos then
    self.lastpos = endpos
  end
  pos = spos
  while pos <= endpos do
    if self.attributeParser then
      local sp = pos
      local ep2 = bounded_find(subject, special, pos, endpos)
      if not ep2 or ep2 > endpos then
        ep2 = endpos
      end
      local status, ep = self.attributeParser:feed(sp, ep2)
      if status == "done" then
        local attributeStart = self.attributeStart
        -- add attribute matches
        self:add_match(attributeStart, attributeStart, "+attributes")
        self:add_match(ep, ep, "-attributes")
        local attr_matches = self.attributeParser:get_matches()
        -- add attribute matches
        for i=1,#attr_matches do
          self:add_match(unpack(attr_matches[i]))
        end
        -- restore state to prior to adding attribute parser:
        self.attributeParser = nil
        self.attributeStart = nil
        self.attributeSlices = nil
        pos = ep + 1
      elseif status == "fail" then
        self:reparse_attributes()
        pos = sp  -- we'll want to go over the whole failed portion again,
                  -- as no slice was added for it
      elseif status == "continue" then
        if #self.attributeSlices == 0 then
          self.attributeSlices = {}
        end
        self.attributeSlices[#self.attributeSlices + 1] = {sp,ep}
        pos = ep + 1
      end
    else
      -- find next interesting character:
      local newpos = bounded_find(subject, special, pos, endpos) or endpos + 1
      if newpos > pos then
        self:add_match(pos, newpos - 1, "str")
        pos = newpos
        if pos > endpos then
          break -- otherwise, fall through:
        end
      end
      -- if we get here, then newpos = pos,
      -- i.e. we have something interesting at pos
      local c = byte(subject, pos)

      if c == 13 or c == 10 then -- cr or lf
        if c == 13 and bounded_find(subject, "^[%n]", pos + 1, endpos) then
          self:add_match(pos, pos + 1, "softbreak")
          pos = pos + 2
        else
          self:add_match(pos, pos, "softbreak")
          pos = pos + 1
        end
      elseif self.verbatim > 0 then
        if c == 96 then
          local _, endchar = bounded_find(subject, "^`+", pos, endpos)
          if endchar and endchar - pos + 1 == self.verbatim then
            -- check for raw attribute
            local sp, ep =
              bounded_find(subject, "^%{%=[^%s{}`]+%}", endchar + 1, endpos)
            if sp and self.verbatim_type == "verbatim" then -- raw
              self:add_match(pos, endchar, "-" .. self.verbatim_type)
              self:add_match(sp, ep, "raw_format")
              pos = ep + 1
            else
              self:add_match(pos, endchar, "-" .. self.verbatim_type)
              pos = endchar + 1
            end
            self.verbatim = 0
            self.verbatim_type = nil
          else
            endchar = endchar or endpos
            self:add_match(pos, endchar, "str")
            pos = endchar + 1
          end
        else
          self:add_match(pos, pos, "str")
          pos = pos + 1
        end
      else
        local matcher = matchers[c]
        pos = (matcher and matcher(self, pos, endpos)) or self:single_char(pos)
      end
    end
  end
end

*/

class InlineParser {
  warn : (message : string, pos : number) => void;
  subject : string;
  matches : Event[];
  openers : OpenerMap; // map from opener type to Opener[] in reverse order
  verbatim : number; // parsing a verbatim span to be ended by N backticks
  verbatimType : string; // math or regular
  destination : boolean; // parsing link destination?
  firstpos : number; // position of first slice
  lastpos : number; // position of last slice
  allowAttributes : boolean; // allow parsing of attributes
  attributeParser : null | AttributeParser; // attribute parser
  attributeStart : null | number; // start pos of potential attribute
  attributeSlices : null | {startpos : number, endpos : number}[]; // slices we've tried to parse as atttributes

  constructor(subject : string, warn : (message : string, pos : number) => void) {
    this.warn = warn;
    this.subject = subject;
    this.matches = [];
    this.openers = {};
    this.verbatim = 0;
    this.verbatimType = "";
    this.destination = false;
    this.firstpos = 0;
    this.lastpos = 0;
    this.allowAttributes = false;
    this.attributeParser = null;
    this.attributeStart = null;
    this.attributeSlices = null;
  }

  addMatch(startpos : number, endpos : number, annot : string) : void {
    this.matches[startpos] = {startpos: startpos, endpos: endpos, annot: annot};
  }

  inVerbatim() : boolean {
    return (this.verbatim > 0);
  }

  singleChar(pos : number) : number {
    this.addMatch(pos, pos, "str");
    return pos + 1;
  }

  reparseAttributes() : void {
    // Reparse attributeSlices that we tried to parse as an attribute
    let slices = this.attributeSlices;
    if (slices === null) {
      return;
    }
    this.allowAttributes = false;
    this.attributeParser = null;
    this.attributeStart = null;
    if (slices !== null) {
      slices.forEach( (slice) => {
        this.feed(slice.startpos, slice.endpos);
      });
    }
    this.allowAttributes = true;
    this.attributeSlices = null;
  }

  getMatches() : Event[] {
    let sorted = [];
    const subject = this.subject
    let lastsp, lastep, lastannot
    if (this.attributeParser) {
      // we're still in an attribute parse
      this.reparseAttributes();
    }
    for (let i = this.firstpos; this.lastpos; i++) {
      if (this.matches[i] !== null) {
        let {startpos: sp, endpos: ep, annot: annot} = this.matches[i];
        if (annot === "str" && lastannot === "str" && lastep && lastsp &&
            lastep + 1 == sp) {
          // consolidate adjacent strs
          sorted.push({startpos: lastsp, endpos: ep, annot: annot});
          lastsp = lastsp;
          lastep = ep;
          lastannot = annot;
        } else {
          sorted.push(this.matches[i]);
          lastsp = sp;
          lastep = ep;
          lastannot = annot;
        }
      }
    }
    if (sorted.length > 0) {
      let last = sorted[sorted.length - 1];
      let {startpos, endpos, annot} = last;
      // remove final softbreak
      if (annot === "softbreak") {
        sorted.pop();
        last = sorted[sorted.length - 1];
        startpos = last.startpos;
        endpos = last.endpos;
        annot = last.annot;
      }
      // remove trailing spaces
      if (annot === "str" && subject.codePointAt(endpos) === 32) {
        while (endpos > startpos && subject.codePointAt(endpos) === 32) {
          endpos = endpos - 1;
        }
        sorted.push({startpos: startpos, endpos: endpos, annot: annot});
      }
      if (this.verbatim > 0) { // unclosed verbatim
        this.warn("Unclosed verbatim", endpos);
        sorted.push({ startpos: endpos,
                      endpos: endpos,
                      annot: "-" + this.verbatimType });
      }
    }
    return sorted;
  }

  addOpener(name : string, opener : Opener) : void {
    if (!this.openers[name]) {
      this.openers[name] = [];
    }
    this.openers[name].push(opener);
  }

  clearOpeners(startpos : number, endpos : number) : void {
    // Remove other openers in between the matches
    for (let k in this.openers) {
      let v = this.openers[k];
      let i = v.length - 1
      while (v[i]) {
        let opener = v[i];
        if (opener.startpos >= startpos && opener.endpos <= endpos) {
          delete v[i];
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


  feed(startpos : number, endpos : number) : void {
    return; // TODO
  }


}


export { InlineParser }
