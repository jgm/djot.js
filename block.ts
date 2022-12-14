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
    continue : () => boolean,
    open : (spec : BlockSpec) => boolean,
    close: () => void }

class Container {
  name : string;
  content : ContentType;
  continue : () => boolean;
  close: () => void;
  inlineParser: InlineParser | null;
  extra: undefined | object;

  constructor(spec : BlockSpec, extra : undefined | object) {
    this.name = spec.name;
    this.content = spec.content;
    this.continue = spec.continue;
    this.close = spec.close;
    this.inlineParser = null;
    this.extra = extra;
 }
}

class Parser {
  warn : (message : string, pos : number) => void;
  subject : string;
  indent : number;
  startline : number | null;
  starteol : number | null;
  endeol : number | null;
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
   this.startline = null;
   this.starteol = null;
   this.endeol = null;
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
       continue: () => {
         if (this.find(pattern("[^ \t\r\n]"))) {
           return true;
         } else {
           return false;
         }
       },
       open: (spec) => {
         // this.addContainer(new Container(spec));
         this.addMatch(this.pos, this.pos, "+para");
         return true;
       },
       close: () => {
         this.getInlineMatches();
         this.addMatch(this.pos - 1, this.pos - 1, "-para");
         this.containers.pop();
       }
     },
   ];


  }

  find(patt : RegExp) : null | { startpos : number, endpos : number, captures : string[] } {
    return find(this.subject, patt, this.pos);
  }

  addMatch(startpos : number, endpos : number, annot : string) : void {
    this.matches.push({startpos, endpos, annot});
  }

  getInlineMatches() : void {
    let ilparser = this.containers[this.containers.length - 1].inlineParser;
    let matches = this.matches;
    if (ilparser) {
      ilparser.getMatches().forEach(match => matches.push(match));
    }
  }

}




/*

-- parameters are start and end position
function Parser:parse_table_row(sp, ep)
  local orig_matches = #self.matches  -- so we can rewind
  local startpos = self.pos
  self:add_match(sp, sp, "+row")
  -- skip | and any initial space in the cell:
  self.pos = find(self.subject, "%S", sp + 1)
  -- check to see if we have a separator line
  local seps = {}
  local p = self.pos
  local sepfound = false
  while not sepfound do
    local sepsp, sepep, left, right, trailing =
      find(self.subject, "^(%:?)%-%-*(%:?)([ \t]*%|[ \t]*)", p)
    if sepep {
      local st = "separator_default"
      if #left > 0 and #right > 0 {
        st = "separator_center"
      } else if #right > 0 {
        st = "separator_right"
      } else if #left > 0 {
        st = "separator_left"
      }
      seps[#seps + 1] = {sepsp, sepep - #trailing, st}
      p = sepep + 1
      if p === self.starteol {
        sepfound = true
        break
      }
    } else {
      break
    }
  }
  if sepfound {
    for i=1,#seps do
      self:add_match(unpack(seps[i]))
    }
    self:add_match(self.starteol - 1, self.starteol - 1, "-row")
    self.pos = self.starteol
    self.finished_line = true
    return true
  }
  local inline_parser = InlineParser:new(self.subject, self.warn)
  self:add_match(sp, sp, "+cell")
  local complete_cell = false
  while self.pos <= ep do
    -- parse a chunk as inline content
    local nextbar, _
    while not nextbar do
      _, nextbar = self:find("^[^|\r\n]*|")
      if not nextbar {
        break
      }
      if string.find(self.subject, "^\\", nextbar - 1) then -- \|
        inline_parser:feed(self.pos, nextbar)
        self.pos = nextbar + 1
        nextbar = nil
      } else {
        inline_parser:feed(self.pos, nextbar - 1)
        if inline_parser:in_verbatim() {
          inline_parser:feed(nextbar, nextbar)
          self.pos = nextbar + 1
          nextbar = nil
        } else {
          self.pos = nextbar + 1
        }
      }
    }
    complete_cell = nextbar
    if not complete_cell {
      break
    }
    -- add a table cell
    local cell_matches = inline_parser:get_matches()
    for i=1,#cell_matches do
      local s,e,ann = unpack(cell_matches[i])
      if i === #cell_matches and ann === "str" {
        -- strip trailing space
        while byte(self.subject, e) === 32 and e >= s do
          e = e - 1
        }
      }
      self:add_match(s,e,ann)
    }
    self:add_match(nextbar, nextbar, "-cell")
    if nextbar < ep {
      -- reset inline parser state
      inline_parser = InlineParser:new(self.subject, self.warn)
      self:add_match(nextbar, nextbar, "+cell")
      self.pos = find(self.subject, "%S", self.pos)
    }
  }
  if not complete_cell {
    -- rewind, this is not a valid table row
    self.pos = startpos
    for i = orig_matches,#self.matches do
      self.matches[i] = nil
    }
    return false
  } else {
    self:add_match(self.pos, self.pos, "-row")
    self.pos = self.starteol
    self.finished_line = true
    return true
  }
}

function Parser:specs()
  return {
    { name = "para",
      isPara = true,
      content = "inline",
      continue = function()
        if self:find("^%S") {
          return true
        } else {
          return false
        }
      end,
      open = function(spec)
        self:add_container(Container:new(spec,
            { inline_parser =
                InlineParser:new(self.subject, self.warn) }))
        self:add_match(self.pos, self.pos, "+para")
        return true
      end,
      close = function()
        self:get_inline_matches()
        self:add_match(self.pos - 1, self.pos - 1, "-para")
        self.containers[#self.containers] = nil
      }
    },

    { name = "caption",
      isPara = false,
      content = "inline",
      continue = function()
        return self:find("^%S")
      end,
      open = function(spec)
        local _, ep = self:find("^%^[ \t]+")
        if ep {
          self.pos = ep + 1
          self:add_container(Container:new(spec,
            { inline_parser =
                InlineParser:new(self.subject, self.warn) }))
          self:add_match(self.pos, self.pos, "+caption")
          return true
        }
      end,
      close = function()
        self:get_inline_matches()
        self:add_match(self.pos - 1, self.pos - 1, "-caption")
        self.containers[#self.containers] = nil
      }
    },

    { name = "blockquote",
      content = "block",
      continue = function()
        if self:find("^%>%s") {
          self.pos = self.pos + 1
          return true
        } else {
          return false
        }
      end,
      open = function(spec)
        if self:find("^%>%s") {
          self:add_container(Container:new(spec))
          self:add_match(self.pos, self.pos, "+blockquote")
          self.pos = self.pos + 1
          return true
        }
      end,
      close = function()
        self:add_match(self.pos, self.pos, "-blockquote")
        self.containers[#self.containers] = nil
      }
    },

    -- should go before reference definitions
    { name = "footnote",
      content = "block",
      continue = function(container)
        if self.indent > container.indent or self:find("^[\r\n]") {
          return true
        } else {
          return false
        }
      end,
      open = function(spec)
        local sp, ep, label = self:find("^%[%^([^]]+)%]:%s")
        if not sp {
          return nil
        }
        -- adding container will close others
        self:add_container(Container:new(spec, {note_label = label,
                                                indent = self.indent}))
        self:add_match(sp, sp, "+footnote")
        self:add_match(sp + 2, ep - 3, "note_label")
        self.pos = ep
        return true
      end,
      close = function(_container)
        self:add_match(self.pos, self.pos, "-footnote")
        self.containers[#self.containers] = nil
      }
    },

    -- should go before list_item_spec
    { name = "thematic_break",
      content = nil,
      continue = function()
        return false
      end,
      open = function(spec)
        local sp, ep = self:find("^[-*][ \t]*[-*][ \t]*[-*][-* \t]*[\r\n]")
        if ep {
          self:add_container(Container:new(spec))
          self:add_match(sp, ep, "thematic_break")
          self.pos = ep
          return true
        }
      end,
      close = function(_container)
        self.containers[#self.containers] = nil
      }
    },

    { name = "list_item",
      content = "block",
      continue = function(container)
        if self.indent > container.indent or self:find("^[\r\n]") {
          return true
        } else {
          return false
        }
      end,
      open = function(spec)
        local sp, ep = self:find("^[-*+:]%s")
        if not sp {
          sp, ep = self:find("^%d+[.)]%s")
        }
        if not sp {
          sp, ep = self:find("^%(%d+%)%s")
        }
        if not sp {
          sp, ep = self:find("^[ivxlcdmIVXLCDM]+[.)]%s")
        }
        if not sp {
          sp, ep = self:find("^%([ivxlcdmIVXLCDM]+%)%s")
        }
        if not sp {
          sp, ep = self:find("^%a[.)]%s")
        }
        if not sp {
          sp, ep = self:find("^%(%a%)%s")
        }
        if not sp {
          return nil
        }
        local marker = sub(self.subject, sp, ep - 1)
        local checkbox = nil
        if self:find("^[*+-] %[[Xx ]%]%s", sp + 1) then -- task list
          marker = sub(self.subject, sp, sp + 4)
          checkbox = sub(self.subject, sp + 3, sp + 3)
        }
        -- some items have ambiguous style
        local styles = getListStyles(marker)
        if #styles === 0 {
          return nil
        }
        local data = { styles = styles,
                       indent = self.indent }
        -- adding container will close others
        self:add_container(Container:new(spec, data))
        local annot = "+list_item"
        for i=1,#styles do
          annot = annot .. "[" .. styles[i] .. "]"
        }
        self:add_match(sp, ep - 1, annot)
        self.pos = ep
        if checkbox {
          if checkbox === " " {
            self:add_match(sp + 2, sp + 4, "checkbox_unchecked")
          } else {
            self:add_match(sp + 2, sp + 4, "checkbox_checked")
          }
          self.pos = sp + 5
        }
        return true
      end,
      close = function(_container)
        self:add_match(self.pos, self.pos, "-list_item")
        self.containers[#self.containers] = nil
      }
    },

    { name = "reference_definition",
      content = nil,
      continue = function(container)
        if container.indent >= self.indent {
          return false
        }
        local _, ep, rest = self:find("^(%S+)")
        if ep {
          self:add_match(ep - #rest + 1, ep, "reference_value")
          self.pos = ep + 1
        }
        return true
      end,
      open = function(spec)
        local sp, ep, label, rest = self:find("^%[([^]\r\n]*)%]:[ \t]*(%S*)")
        if sp {
          self:add_container(Container:new(spec,
             { key = label,
               indent = self.indent }))
          self:add_match(sp, sp, "+reference_definition")
          self:add_match(sp, sp + #label + 1, "reference_key")
          if #rest > 0 {
            self:add_match(ep - #rest + 1, ep, "reference_value")
          }
          self.pos = ep + 1
          return true
        }
      end,
      close = function(_container)
        self:add_match(self.pos, self.pos, "-reference_definition")
        self.containers[#self.containers] = nil
      }
    },

    { name = "heading",
      content = "inline",
      continue = function(container)
        local sp, ep = self:find("^%#+%s")
        if sp and ep and container.level === ep - sp {
          self.pos = ep
          return true
        } else {
          return false
        }
      end,
      open = function(spec)
        local sp, ep = self:find("^#+")
        if ep and find(self.subject, "^%s", ep + 1) {
          local level = ep - sp + 1
          self:add_container(Container:new(spec, {level = level,
               inline_parser = InlineParser:new(self.subject, self.warn) }))
          self:add_match(sp, ep, "+heading")
          self.pos = ep + 1
          return true
        }
      end,
      close = function(_container)
        self:get_inline_matches()
        local last = self.matches[#self.matches] or self.pos - 1
        local sp, ep, annot = unpack(last)
        self:add_match(ep, ep, "-heading")
        self.containers[#self.containers] = nil
      }
    },

    { name = "code_block",
      content = "text",
      continue = function(container)
        local char = sub(container.border, 1, 1)
        local sp, ep, border = self:find("^(" .. container.border ..
                                 char .. "*)[ \t]*[\r\n]")
        if ep {
          container.end_fence_sp = sp
          container.end_fence_ep = sp + #border - 1
          self.pos = ep -- before newline
          self.finished_line = true
          return false
        } else {
          return true
        }
      end,
      open = function(spec)
        local sp, ep, border, ws, lang =
          self:find("^(~~~~*)([ \t]*)(%S*)[ \t]*[\r\n]")
        if not ep {
          sp, ep, border, ws, lang =
            self:find("^(````*)([ \t]*)([^%s`]*)[ \t]*[\r\n]")
        }
        if border {
          local is_raw = find(lang, "^=") and true or false
          self:add_container(Container:new(spec, {border = border,
                                                  indent = self.indent }))
          self:add_match(sp, sp + #border - 1, "+code_block")
          if #lang > 0 {
            local langstart = sp + #border + #ws
            if is_raw {
              self:add_match(langstart, langstart + #lang - 1, "raw_format")
            } else {
              self:add_match(langstart, langstart + #lang - 1, "code_language")
            }
          }
          self.pos = ep  -- before newline
          self.finished_line = true
          return true
        }
      end,
      close = function(container)
        local sp = container.end_fence_sp or self.pos
        local ep = container.end_fence_ep or self.pos
        self:add_match(sp, ep, "-code_block")
        if sp === ep {
          self.warn({ pos = self.pos, message = "Unclosed code block" })
        }
        self.containers[#self.containers] = nil
      }
    },

    { name = "fenced_div",
      content = "block",
      continue = function(container)
        if self.containers[#self.containers].name === "code_block" {
          return true -- see #109
        }
        local sp, ep, equals = self:find("^(::::*)[ \t]*[r\n]")
        if ep and #equals >= container.equals {
          container.end_fence_sp = sp
          container.end_fence_ep = sp + #equals - 1
          self.pos = ep -- before newline
          return false
        } else {
          return true
        }
      end,
      open = function(spec)
        local sp, ep1, equals = self:find("^(::::*)[ \t]*")
        if not ep1 {
          return false
        }
        local clsp, ep = find(self.subject, "^[%w_-]*", ep1 + 1)
        local _, eol = find(self.subject, "^[ \t]*[\r\n]", ep + 1)
        if eol {
          self:add_container(Container:new(spec, {equals = #equals}))
          self:add_match(sp, ep, "+div")
          if ep >= clsp {
            self:add_match(clsp, ep, "class")
          }
          self.pos = eol + 1
          self.finished_line = true
          return true
        }
      end,
      close = function(container)
        local sp = container.end_fence_sp or self.pos
        local ep = container.end_fence_ep or self.pos
        -- check to make sure the match is in order
        self:add_match(sp, ep, "-div")
        if sp === ep {
          self.warn({pos = self.pos, message = "Unclosed div"})
        }
        self.containers[#self.containers] = nil
      }
    },

    { name = "table",
      content = "cells",
      continue = function(_container)
        local sp, ep = self:find("^|[^\r\n]*|")
        local eolsp = " *[\r\n]" -- make sure at end of line
        if sp and eolsp {
          return self:parse_table_row(sp, ep)
        }
      end,
      open = function(spec)
        local sp, ep = self:find("^|[^\r\n]*|")
        local eolsp = " *[\r\n]" -- make sure at end of line
        if sp and eolsp {
          self:add_container(Container:new(spec, { columns = 0 }))
          self:add_match(sp, sp, "+table")
          if self:parse_table_row(sp, ep) {
            return true
          } else {
            self.containers[#self.containers] = nil
            return false
          }
        }
     end,
      close = function(_container)
        self:add_match(self.pos, self.pos, "-table")
        self.containers[#self.containers] = nil
      }
    },

    { name = "attributes",
      content = "attributes",
      open = function(spec)
        if self:find("^%{") {
          local attribute_parser =
                  attributes.AttributeParser:new(self.subject)
          local status, ep =
                 attribute_parser:feed(self.pos, self.endeol)
          if status === 'fail' or ep + 1 < self.endeol {
            return false
          } else {
            self:add_container(Container:new(spec,
                               { status = status,
                                 indent = self.indent,
                                 startpos = self.pos,
                                 slices = {},
                                 attribute_parser = attribute_parser }))
            local container = self.containers[#self.containers]
            container.slices = { {self.pos, self.endeol } }
            self.pos = self.starteol
            return true
          }

        }
      end,
      continue = function(container)
        if self.indent > container.indent {
          table.insert(container.slices, { self.pos, self.endeol })
          local status, ep =
            container.attribute_parser:feed(self.pos, self.endeol)
          container.status = status
          if status ~= 'fail' or ep + 1 < self.endeol {
            self.pos = self.starteol
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
          local para_spec = self:specs()[1]
          local para = Container:new(para_spec,
                        { inline_parser =
                           InlineParser:new(self.subject, self.warn) })
          self:add_match(container.startpos, container.startpos, "+para")
          self.containers[#self.containers] = para
          -- reparse the text we couldn't parse as a block attribute:
          para.inline_parser.attribute_slices = container.slices
          para.inline_parser:reparse_attributes()
          self.pos = para.inline_parser.lastpos + 1
          return true
        }
      end,
      close = function(container)
        local attr_matches = container.attribute_parser:get_matches()
        self:add_match(container.startpos, container.startpos, "+block_attributes")
        for i=1,#attr_matches do
          self:add_match(unpack(attr_matches[i]))
        }
        self:add_match(self.pos, self.pos, "-block_attributes")
        self.containers[#self.containers] = nil
      }
    }
  }
}


function Parser:add_container(container)
  local last_matched = self.last_matched_container
  while #self.containers > last_matched or
         (#self.containers > 0 and
          self.containers[#self.containers].content ~= "block") do
    self.containers[#self.containers]:close()
  }
  self.containers[#self.containers + 1] = container
}

function Parser:skip_space()
  local newpos, _ = find(self.subject, "[^ \t]", self.pos)
  if newpos {
    self.indent = newpos - self.startline
    self.pos = newpos
  }
}

function Parser:get_eol()
  local starteol, endeol = find(self.subject, "[\r]?[\n]", self.pos)
  if not endeol {
    starteol, endeol = #self.subject, #self.subject
  }
  self.starteol = starteol
  self.endeol = endeol
}

-- Returns an iterator over events.  At each iteration, the iterator
-- returns three values: start byte position, end byte position,
-- and annotation.
function Parser:events()
  local specs = self:specs()
  local para_spec = specs[1]
  local subjectlen = #self.subject

  return function()  -- iterator

    while self.pos <= subjectlen do

      -- return any accumulated matches
      if self.returned < #self.matches {
        self.returned = self.returned + 1
        return unpack(self.matches[self.returned])
      }

      self.indent = 0
      self.startline = self.pos
      self.finished_line = false
      self:get_eol()

      -- check open containers for continuation
      self.last_matched_container = 0
      local idx = 0
      while idx < #self.containers do
        idx = idx + 1
        local container = self.containers[idx]
        -- skip any indentation
        self:skip_space()
        if container:continue() {
          self.last_matched_container = idx
        } else {
          break
        }
      }

      -- if we hit a close fence, we can move to next line
      if self.finished_line {
        while #self.containers > self.last_matched_container do
          self.containers[#self.containers]:close()
        }
      }

      if not self.finished_line {
        -- check for new containers
        self:skip_space()
        local is_blank = (self.pos === self.starteol)

        local new_starts = false
        local last_match = self.containers[self.last_matched_container]
        local check_starts = not is_blank and
                            (not last_match or last_match.content === "block") and
                              not self:find("^%a+%s") -- optimization
        while check_starts do
          check_starts = false
          for i=1,#specs do
            local spec = specs[i]
            if not spec.isPara {
              if spec:open() {
                self.last_matched_container = #self.containers
                if spec.content === ContentType.Inline {
                  self.containers[#self.containers].inlineParser = InlineParser:new(self.subject, self.warn)
                }
                if self.finished_line {
                  check_starts = false
                } else {
                  self:skip_space()
                  new_starts = true
                  check_starts = spec.content === "block"
                }
                break
              }
            }
          }
        }

        if not self.finished_line {
          -- handle remaining content
          self:skip_space()

          is_blank = (self.pos === self.starteol)

          local is_lazy = not is_blank and
                          not new_starts and
                          self.last_matched_container < #self.containers and
                          self.containers[#self.containers].content === 'inline'

          local last_matched = self.last_matched_container
          if not is_lazy {
            while #self.containers > 0 and #self.containers > last_matched do
              self.containers[#self.containers]:close()
            }
          }

          local tip = self.containers[#self.containers]

          -- add para by default if there's text
          if not tip or tip.content === 'block' {
            if is_blank {
              if not new_starts {
                -- need to track these for tight/loose lists
                self:add_match(self.pos, self.endeol, "blankline")
              }
            } else {
              para_spec:open()
            }
            tip = self.containers[#self.containers]
          }

          if tip {
            if tip.content === "text" {
              local startpos = self.pos
              if tip.indent and self.indent > tip.indent {
                -- get back the leading spaces we gobbled
                startpos = startpos - (self.indent - tip.indent)
              }
              self:add_match(startpos, self.endeol, "str")
            } else if tip.content === "inline" {
              if not is_blank {
                tip.inline_parser:feed(self.pos, self.endeol)
              }
            }
          }
        }
      }

      self.pos = self.endeol + 1

    }

    -- close unmatched containers
    while #self.containers > 0 do
      self.containers[#self.containers]:close()
    }
    -- return any accumulated matches
    if self.returned < #self.matches {
      self.returned = self.returned + 1
      return unpack(self.matches[self.returned])
    }

  }

}

*/

export { Parser }
