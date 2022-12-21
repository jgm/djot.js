import { Event } from "./event";
import { EventParser } from "./block";

// Types for the AST

type Attributes = Record<string, string>;

type SourceLoc = { line: number, col: number, offset: number }

type Pos = { start: SourceLoc, end: SourceLoc }

interface HasAttributes {
  attributes?: Attributes;
}

interface HasAttributes {
  attributes?: Attributes;
  pos?: Pos;
}

interface HasChildren {
  children: any[];
}

interface HasInlineChildren {
  children: Inline[];
}

interface HasBlockChildren {
  children: Block[];
}

type Block = Para
           | Heading
           | ThematicBreak
           | Div
           | CodeBlock
           | RawBlock
           | BlockQuote
           | List
           | Table ;

interface Para extends HasAttributes, HasInlineChildren {
  tag: "para";
}

interface Heading extends HasAttributes, HasInlineChildren {
  tag: "heading";
  level: number;
}

interface ThematicBreak extends HasAttributes {
  tag: "thematic_break";
}

interface Div extends HasAttributes, HasBlockChildren {
  tag: "div";
}

interface BlockQuote extends HasAttributes, HasBlockChildren {
  tag: "blockquote";
}

interface CodeBlock extends HasAttributes {
  tag: "code_block";
  lang?: string;
  text: string;
}

interface RawBlock extends HasAttributes {
  tag: "raw_block";
  format: string;
  text: string;
}

interface List extends HasAttributes {
  tag: "list";
  children: ListItem[];
  // TODO
}

interface Caption extends HasAttributes {
  tag: "caption";
  children: Inline[];
}

type TablePart = Row | Caption;

interface Table extends HasAttributes {
  tag: "table";
  children: TablePart[];
}

type Inline = Str
            | SoftBreak
            | HardBreak
            | Nbsp
            | Emoji
            | Verbatim
            | RawInline
            | Math
            | Url
            | Email
            | FootnoteReference
            | RightSingleQuote
            | LeftDoubleQuote
            | Ellipses
            | EmDash
            | EnDash
            | Emph
            | Strong
            | Link
            | Image
            | Span
            | Mark
            | Superscript
            | Subscript
            | Insert
            | Delete
            | DoubleQuoted
            | SingleQuoted
            ;

interface Str extends HasAttributes {
  tag: "str";
  text: string;
}

interface FootnoteReference extends HasAttributes {
  tag: "footnote_reference";
  text: string;
}

interface RightSingleQuote extends HasAttributes {
  tag: "right_single_quote";
  text: string;
}

interface LeftDoubleQuote extends HasAttributes {
  tag: "left_double_quote";
  text: string;
}

interface Ellipses extends HasAttributes {
  tag: "ellipses";
  text: string;
}

interface EmDash extends HasAttributes {
  tag: "em_dash";
  text: string;
}

interface EnDash extends HasAttributes {
  tag: "en_dash";
  text: string;
}

interface SoftBreak extends HasAttributes {
  tag: "softbreak";
}

interface HardBreak extends HasAttributes {
  tag: "hardbreak";
}

interface Nbsp extends HasAttributes {
  tag: "nbsp";
}

interface Emoji extends HasAttributes {
  tag: "emoji";
  alias: string;
}

interface Verbatim extends HasAttributes {
  tag: "verbatim";
  text: string;
}

interface RawInline extends HasAttributes {
  tag: "raw_inline";
  format: string;
  text: string;
}

interface Math extends HasAttributes {
  tag: "math";
  display: boolean;
  text: string;
}

interface Url extends HasAttributes {
  tag: "url";
  text: string;
}

interface Email extends HasAttributes {
  tag: "email";
  text: string;
}

interface Link extends HasAttributes, HasInlineChildren {
  tag: "link";
  destination?: string;
  reference?: string;
}

interface Image extends HasAttributes, HasInlineChildren {
  tag: "image";
  destination?: string;
  reference?: string;
}

interface Emph extends HasAttributes, HasInlineChildren {
  tag: "emph";
}

interface Strong extends HasAttributes, HasInlineChildren {
  tag: "strong";
}

interface Span extends HasAttributes, HasInlineChildren {
  tag: "span";
}

interface Mark extends HasAttributes, HasInlineChildren {
  tag: "mark";
}

interface Superscript extends HasAttributes, HasInlineChildren {
  tag: "superscript";
}

interface Subscript extends HasAttributes, HasInlineChildren {
  tag: "subscript";
}

interface Delete extends HasAttributes, HasInlineChildren {
  tag: "delete";
}

interface Insert extends HasAttributes, HasInlineChildren {
  tag: "insert";
}

interface DoubleQuoted extends HasAttributes, HasInlineChildren {
  tag: "double_quoted";
}

interface SingleQuoted extends HasAttributes, HasInlineChildren {
  tag: "single_quoted";
}

interface ListItem extends HasAttributes, HasBlockChildren {
  tag: "list_item";
  // TODO
}

interface Row extends HasAttributes {
  tag: "row";
  children: Cell[];
  head: boolean;
}

interface Cell extends HasAttributes, HasInlineChildren {
  tag: "cell";
  align: Alignment;
  head: boolean;
}

type Alignment = "default" | "left" | "right" | "center";

type Node = Doc | Block | Inline | ListItem | Row | Cell | Caption ;

interface Reference extends HasAttributes {
  tag: "reference";
  destination: string;
}

interface Footnote extends HasAttributes, HasBlockChildren {
  tag: "footnote";
  label: string;
}

interface Doc extends HasBlockChildren, HasAttributes {
  tag: "doc";
  references: Record<string, Reference>;
  footnotes: Record<string, Footnote>;
}

interface Container {
  children: any[];
  attributes?: Attributes;
  data?: any;
  pos?: Pos;
}

const getStringContent = function(node : any) : string {
  let buffer : string[] = [];
  addStringContent(node, buffer);
  return buffer.join("");
}

const addStringContent = function(node : any, buffer : string[]) : void {
  if ("text" in node) {
    buffer.push(node.text);
  } else if (node.tag === "softbreak" || node.tag === "hardbreak") {
    buffer.push("\n");
  } else if ("children" in node) {
    node.children.forEach((child : any) => {
      addStringContent(child, buffer);
    });
  }
}

const romanDigits : Record<string, number> = {
  i: 1,
  v: 5,
  x: 10,
  l: 50,
  c: 100,
  d: 500,
  m: 1000,
  I: 1,
  V: 5,
  X: 10,
  L: 50,
  C: 100,
  D: 500,
  M: 1000
};

const romanToNumber = function(s : string) : number {
  // go backwards through the digits
  let total = 0;
  let prevdigit = 0;
  let i = s.length - 1;
  while (i >= 0) {
    let c = s.charAt(i);
    let n = romanDigits[c];
    if (!n) {
      throw("Encountered bad character in roman numeral " + s);
    }
    if (n < prevdigit) { // e.g. ix
      total = total - n;
    } else {
      total = total + n;
    }
    prevdigit = n;
    i = i - 1;
  }
  return total;
}

// in verbatim text, trim one space next to ` at beginning or end:
const trimVerbatim = function(s : string) : string {
  return s
    .replace(/^ ( *)`/, "$1`")
    .replace(/( *) (`+)$/, "$1$2");
}

const getListStart = function(marker : string, style : string) : number | null {
  let numtype = style.replace(/[().]/g, "");
  let s = marker.replace(/[().]/g, "");
  switch (numtype) {
    case "1": return parseInt(s,10);
    case "A": return ((s.codePointAt(0) || 65) - 65 + 1); // 65 = "A"
    case "a": return ((s.codePointAt(0) || 97) - 97 + 1); // 97 = "a"
    case "I": return romanToNumber(s);
    case "i": return romanToNumber(s);
  }
  return null;
}

  /*  NOTE: this was in addChildToTip
   *
  if containers[#containers].t == "list" and
      not (child.t == "list_item" or child.t == "definition_list_item") then
    -- close list
    local oldlist = table.remove(containers)
    add_child_to_tip(containers, oldlist)
  end
  if child.t == "list" then
    if child.pos then
      child.pos[2] = child.c[#child.c].pos[2]
    end
    -- calculate tightness (TODO not quite right)
    local tight = true
    for i=1,#child.c do
      tight = tight and is_tight(child.c[i].startidx,
                                   child.c[i].endidx, i == #child.c)
      child.c[i].startidx = nil
      child.c[i].endidx = nil
    end
    child.tight = tight

    -- resolve style if still ambiguous
    resolve_style(child)
  end
  */

interface ParseOptions {
  sourcePositions?: boolean;
  warn?: (message : string, pos : number) => void;
}

// Parsing ocntext:
enum Context {
  Normal = 0,    // add str nodes as children of tip
  Verbatim = 1,  // gather str, escape, softbreak, hardbreak in accumulatedText
  Literal = 2    // gather str, softbreak, hardbreak in accumulatedText
}

const parse = function(input : string, options : ParseOptions) : Doc {

  let linestarts : number[] = [0];

  if (options.sourcePositions) { // construct map of newline positions
    for(var i=0; i < input.length; i++) {
      if (input[i] === "\n") {
        linestarts.push(i);
      }
    }
  }

  // use binary search on linestarts to find line number and col
  const getSourceLoc = function(pos : number) :  SourceLoc {
    let numlines = linestarts.length;
    let bottom = 0;
    let top = numlines - 1;
    let line = 0;
    let col = 0;
    while (!line) {
      let mid = bottom + ~~((top - bottom) / 2);
      if (linestarts[mid] > pos) {
        top = mid;
      } else if (linestarts[mid] <= pos) {
        if (mid === top || linestarts[mid + 1] > pos) {
          line = mid + 1;
          col = pos - linestarts[mid] + 1;
        } else {
          if (bottom === mid && bottom < top) {
            bottom = mid + 1;
          } else {
            bottom = mid;
          }
        }
      }
    }
    return { line: line, col: col, offset: pos };
  }


  let context = Context.Normal;
  let accumulatedText : string[] = [];
  const references : Record<string, Reference> = {};
  const footnotes : Record<string, Footnote> = {};
  const identifiers : Record<string, boolean> = {}; // identifiers used
  const blockAttributes : Attributes = {}; // accumulated block attributes
  const defaultWarnings = function(message : string, pos : number) {
    process.stderr.write(message + (pos ? " at " + pos : "") + "\n");
  }
  const warn = options.warn || defaultWarnings;
  const parser = new EventParser(input, warn);
  const addBlockAttributes = function(container : HasAttributes) {
      if (Object.keys(blockAttributes).length > 0) {
        container.attributes = container.attributes || {};
        for (const k in blockAttributes) {
          container.attributes[k] = blockAttributes[k];
          delete blockAttributes[k];
        }
      }
  };
  const pushContainer = function(startpos ?: SourceLoc) {
      let container : Container = {children: [],
                                   data: {}};
      if (startpos) {
        container.pos = {start: startpos, end: startpos};
      }
      addBlockAttributes(container);
      containers.push(container);
  };
  const popContainer = function(endpos ?: SourceLoc) {
      let node = containers.pop();
      if (!node) {
        throw("Container stack is empty (popContainer)");
      }
      if (endpos && node.pos) {
        node.pos.end = endpos;
      }
      return node;
  };
  const topContainer = function() {
      if (containers.length > 0) {
        return containers[containers.length - 1];
      } else {
        throw("Container stack is empty (topContainer)");
      }
  }
  // points to last child of top container, or top container if
  // it doesn't have children
  const getTip = function() : any {
      let top = topContainer();
      if (top.children.length > 0) {
        return top.children[top.children.length - 1];
      } else {
        return top;
      }
  }

  const addChildToTip = function(child : Node, pos ?: Pos) : void {
    if (containers.length > 0) {
      let tip = containers[containers.length - 1];
      if (pos) {
        child.pos = pos;
      }
      tip.children.push(child);
    }
  }

  const handleEvent = function(containers : Container[], event : Event) : void {
    let node;
    let top;
    let tip;
    let sp;
    let ep;
    let pos;
    if (options.sourcePositions) {
      sp = getSourceLoc(event.startpos);
      ep = getSourceLoc(event.endpos);
      pos = {start: sp, end: ep};
    }
    switch (event.annot) {

      case "str":
        let txt = input.substring(event.startpos, event.endpos + 1);
        if (context === Context.Normal) {
          addChildToTip({tag: "str", text: txt}, pos);
        } else {
          accumulatedText.push(txt);
        }
        break;

      case "softbreak":
        if (context === Context.Normal) {
          addChildToTip({tag: "softbreak"}, pos);
        } else {
          accumulatedText.push("\n");
        }
        break;

      case "escape":
        if (context === Context.Verbatim) {
          accumulatedText.push("\\");
        }
        break;

      case "hardbreak":
        if (context === Context.Normal) {
          addChildToTip({tag: "hardbreak"}, pos);
        } else {
          accumulatedText.push("\n");
        }
        break;

      case "nbsp":
        if (context === Context.Verbatim) {
          accumulatedText.push("\\ ");
        } else {
          addChildToTip({tag: "nbsp"}, pos);
        }
        break;

      case "emoji":
        if (context === Context.Normal) {
          let alias = input.substring(event.startpos + 1, event.endpos);
          addChildToTip({tag: "emoji", alias: alias}, pos);
        } else {
          let txt = input.substring(event.startpos, event.endpos + 1);
          accumulatedText.push(txt);
        }
        break;

      case "footnote_reference":
        let fnref = input.substring(event.startpos + 2, event.endpos);
        addChildToTip({tag: "footnote_reference", text: fnref}, pos);
        break;

      case "+reference_definition":
        pushContainer(sp);
        break;

      case "-reference_definition":
        node = popContainer(ep);
        let r : Reference = { tag: "reference",
                              destination: node.data.value || "",
                              attributes: node.attributes };
        if (node.data.key) {
          console.log(node.data.key);
          references[node.data.key] = r;
        }
        break;

      case "reference_key":
        topContainer().data.key = input.substring(event.startpos + 1,
                                                  event.endpos);
        topContainer().data.value = "";
        break;

      case "reference_value":
        topContainer().data.value =
          topContainer().data.value + input.substring(event.startpos,
                                                      event.endpos + 1);
        break;

      case "+emph":
        pushContainer(sp);
        break;

      case "-emph":
        node = popContainer(ep);
        addChildToTip({tag: "emph", children: node.children}, node.pos);
        break;

      case "+strong":
        pushContainer(sp);
        break;

      case "-strong":
        node = popContainer(ep);
        addChildToTip({tag: "strong", children: node.children}, node.pos);
        break;

      case "+span":
        pushContainer(sp);
        break;

      case "-span":
        node = popContainer(ep);
        addChildToTip({tag: "span", children: node.children}, node.pos);
        break;

      case "+mark":
        pushContainer(sp);
        break;

      case "-mark":
        node = popContainer(ep);
        addChildToTip({tag: "mark", children: node.children}, node.pos);
        break;

      case "+superscript":
        pushContainer(sp);
        break;

      case "-superscript":
        node = popContainer(ep);
        addChildToTip({tag: "superscript", children: node.children}, node.pos);
        break;

      case "+subscript":
        pushContainer(sp);
        break;

      case "-subscript":
        node = popContainer(ep);
        addChildToTip({tag: "subscript", children: node.children}, node.pos);
        break;

      case "+delete":
        pushContainer(sp);
        break;

      case "-delete":
        node = popContainer(ep);
        addChildToTip({tag: "delete", children: node.children}, node.pos);
        break;

      case "+insert":
        pushContainer(sp);
        break;

      case "-insert":
        node = popContainer(ep);
        addChildToTip({tag: "insert", children: node.children}, node.pos);
        break;

      case "+double_quoted":
        pushContainer(sp);
        break;

      case "-double_quoted":
        node = popContainer(ep);
        addChildToTip({tag: "double_quoted", children: node.children}, node.pos);
        break;

      case "+single_quoted":
        pushContainer(sp);
        break;

      case "-single_quoted":
        node = popContainer(ep);
        addChildToTip({tag: "single_quoted", children: node.children}, node.pos);
        break;

      case "+attributes":
        pushContainer(sp);
        break;

      case "-attributes":
        node = popContainer(ep);
        if (node.attributes && containers.length > 0) {
          tip = getTip();
          if (!tip.attributes) {
            tip.attributes = {};
          }
          for (const k in node.attributes) {
            if (k === "class") {
              if (tip.attributes[k]) {
                tip.attributes[k] = tip.attributes[k] +
                                      " " + node.attributes[k];
              } else {
                tip.attributes[k] = node.attributes[k];
              }
            } else {
              tip.attributes[k] = node.attributes[k];
            }
          }
        }
        break;

      case "+block_attributes":
        pushContainer(sp);
        break;

      case "-block_attributes":
        node = popContainer(ep);
        if (node.attributes && containers.length > 0) {
          for (const k in node.attributes) {
            if (k === "class") {
              if (blockAttributes[k]) {
                blockAttributes[k] = blockAttributes[k] +
                                      " " + node.attributes[k];
              } else {
                blockAttributes[k] = node.attributes[k];
              }
            } else {
              blockAttributes[k] = node.attributes[k];
            }
          }
        }
        break;

      case "class":
        top = topContainer();
        let cl = input.substring(event.startpos, event.endpos + 1);
        if (!top.attributes) {
          top.attributes = {};
        }
        if (top.attributes.class) {
          top.attributes.class = top.attributes.class + " " + cl;
        } else {
          top.attributes.class = cl;
        }
        break;

      case "id":
        top = topContainer();
        let id = input.substring(event.startpos, event.endpos + 1);
        if (!top.attributes) {
          top.attributes = { id: id };
        } else {
          top.attributes.id = id;
        }
        break;

      case "key":
        top = topContainer();
        let key = input.substring(event.startpos, event.endpos + 1);
        top.data.key = key;
        break;

      case "value":
        top = topContainer();
        let val = input.substring(event.startpos, event.endpos + 1);
        if (!top.attributes) {
          top.attributes = {};
        }
        if (top.data.key) {
          top.attributes[top.data.key] = val;
        } else {
          throw("Encountered value without key");
        }
        top.data.key = null;
        break;

      case "+linktext":
        pushContainer(sp);
        topContainer().data.isimage = false;
        break;

      case "-linktext":
        // we don't pop yet, but wait for -destination
        break;

      case "+imagetext":
        pushContainer(sp);
        topContainer().data.isimage = true;
        break;

      case "-imagetext":
        // we don't pop yet, but wait for -destination
        break;

      case "+destination":
        context = Context.Literal;
        break;

      case "-destination":
        node = popContainer(ep);  // the container added by +linktext/+imagetext
        addChildToTip({tag: node.data.isimage ? "image" : "link",
                       destination: accumulatedText.join(""),
                       children: node.children}, node.pos);
        context = Context.Normal;
        accumulatedText = [];
        break;

      case "+reference":
        context = Context.Literal;
        break;

      case "-reference":
        node = popContainer(ep);  // the container added by +linktext
        let ref = accumulatedText.join("");
        if (ref.length === 0) {
          ref = getStringContent(node);
        }
        addChildToTip({tag: "link",
                       reference: ref,
                       children: node.children}, node.pos);
        context = Context.Normal;
        accumulatedText = [];
        break;

      case "+verbatim":
        context = Context.Verbatim;
        pushContainer(sp);
        break;

      case "-verbatim":
        node = popContainer(ep);
        addChildToTip({tag: "verbatim",
                       text: trimVerbatim(accumulatedText.join(""))},
                      node.pos);
        context = Context.Normal;
        accumulatedText = [];
        break;

      case "raw_format":
        let format = input.substring(event.startpos + 2, event.endpos);
        top = topContainer();
        if (context === Context.Verbatim) { // in a code block
          top.data.format = format;
        } else {
          tip = top.children[top.children.length - 1];
          if (tip && tip.tag === "verbatim") {
            tip.tag = "raw_inline";
            tip.format = format;
          } else {
            throw("raw_format is not after verbatim or code_block");
          }
        }
        break;

      case "+display_math":
      case "+inline_math":
        context = Context.Verbatim;
        pushContainer(sp);
        break;

      case "-display_math":
      case "-inline_math":
        node = popContainer(ep);
        addChildToTip({tag: "math", display: event.annot === "-display_math",
                       text: trimVerbatim(accumulatedText.join(""))},
                      node.pos);
        context = Context.Normal;
        accumulatedText = [];
        break;

      case "+url":
        context = Context.Literal;
        pushContainer(sp);
        break;

      case "-url":
        node = popContainer(ep);
        addChildToTip({tag: "url", text: accumulatedText.join("")}, node.pos);
        context = Context.Normal;
        accumulatedText = [];
        break;

      case "+email":
        context = Context.Literal;
        pushContainer(sp);
        break;

      case "-email":
        node = popContainer(ep);
        addChildToTip({tag: "email", text: accumulatedText.join("")}, node.pos);
        context = Context.Normal;
        accumulatedText = [];
        break;

      case "+para":
        pushContainer(sp);
        break;

      case "-para":
        node = popContainer(ep);
        addChildToTip({tag: "para",
                       children: node.children,
                       attributes: node.attributes }, node.pos);
        break;

      case "+heading":
        pushContainer(sp);
        topContainer().data.level =  1 + event.endpos - event.startpos;
        break;

      case "-heading":
        node = popContainer(ep);
        addChildToTip({tag: "heading",
                       level: node.data.level,
                       children: node.children,
                       attributes: node.attributes }, node.pos);
        break;

      case "+blockquote":
        pushContainer(sp);
        break;

      case "-blockquote":
        node = popContainer(ep);
        addChildToTip({tag: "blockquote",
                       children: node.children,
                       attributes: node.attributes }, node.pos);
        break;

      case "+table":
        pushContainer(sp);
        topContainer().data.aligns = [];
        break;

      case "-table":
        node = popContainer(ep);
        addChildToTip({tag: "table",
                       children: node.children,
                       attributes: node.attributes }, node.pos);
        break;

      case "+row":
        pushContainer(sp);
        topContainer().data.aligns = [];
        break;

      case "-row":
        node = popContainer(ep);
        if (node.children.length === 0) { // a separator line
          // set table aligns, so they can be propagated to future rows
          topContainer().data.aligns = node.data.aligns;
          tip = getTip();
          if (tip && tip.tag === "row") { // previous row of table
            tip.head = true;
            for (let i=0; i < tip.children.length; i++) {
              tip.children[i].head = true;
              tip.children[i].align = node.data.aligns[i];
            }
          }
        } else {
          // get aligns from table
          node.data.aligns = [];
          for (let i=0; i < node.children.length; i++) {
            node.children[i].align = topContainer().data.aligns[i];
          }
          addChildToTip({tag: "row",
                         children: node.children,
                         head: false, // gets set later
                         attributes: node.attributes }, node.pos);
        }
        break;

      case "separator_default":
        topContainer().data.aligns.push("default");
        break;

      case "separator_left":
        topContainer().data.aligns.push("left");
        break;

      case "separator_right":
        topContainer().data.aligns.push("right");
        break;

      case "separator_center":
        topContainer().data.aligns.push("center");
        break;

      case "+cell":
        pushContainer(sp);
        break;

      case "-cell":
        node = popContainer(ep);
        let cellnum = topContainer().children.length;
        addChildToTip({tag: "cell",
                       children: node.children,
                       head: false, // gets set in "-row"
                       align: "left", // set at "-row"
                       attributes: node.attributes }, node.pos);
        break;

      case "+caption":
        pushContainer(sp);
        break;

      case "-caption":
        node = popContainer(ep);
        addChildToTip({tag: "caption",
                       children: node.children,
                       attributes: node.attributes}, node.pos);
        break;

      case "+footnote":
        pushContainer(sp);
        break;

      case "-footnote":
        node = popContainer(ep);
        if (node.data.label) {
          footnotes[node.data.label] =
                      {tag: "footnote",
                       label: node.data.label || "",
                       children: node.children,
                       attributes: node.attributes,
                       pos: node.pos};
        } else {
          warn("Ignoring footnote without a label.", event.endpos);
        }
        break;

      case "note_label":
        topContainer().data.label =
          input.substring(event.startpos + 1, event.endpos);
        break;

      case "+code_block":
        pushContainer(sp);
        context = Context.Verbatim;
        break;

      case "-code_block":
        node = popContainer(ep);
        if (node.data.format) {
          addChildToTip({tag: "raw_block",
                         format: node.data.format,
                         text: accumulatedText.join(""),
                         attributes: node.attributes }, node.pos);
        } else {
          addChildToTip({tag: "code_block",
                         text: accumulatedText.join(""),
                         lang:  node.data.lang,
                         attributes: node.attributes }, node.pos);
        }
        context = Context.Normal;
        accumulatedText = [];
        break;

      case "code_language":
        top = topContainer();
        top.data.lang = input.substring(event.startpos, event.endpos + 1);
        break;

      case "+div":
        pushContainer(sp);
        break;

      case "-div":
        node = popContainer(ep);
        addChildToTip({tag: "div",
                       children: node.children,
                       attributes: node.attributes }, node.pos);
        break;

      case "thematic_break":
        let tb : Node = { tag: "thematic_break" };
        addBlockAttributes(tb);
        addChildToTip(tb, pos);
        break;

      case "right_single_quote":
        addChildToTip({tag: "right_single_quote", text: "'"}, pos);
        break;

      case "left_double_quote":
        addChildToTip({tag: "left_double_quote", text: "'"}, pos);
        break;

      case "ellipses":
        addChildToTip({tag: "ellipses", text: "..."}, pos);
        break;

      case "en_dash":
        addChildToTip({tag: "en_dash", text: "--"}, pos);
        break;

      case "em_dash":
        addChildToTip({tag: "em_dash", text: "---"}, pos);
        break;

      case "blankline":
        break;

      default:
        // throw("Unknown event " + event.annot);
    }
  }

  let containers : Container[] =
         [{ children: [],
            data: {},
            pos: { start: {line: 0, col: 0, offset: 0},
                   end:   {line: 0, col: 0, offset: 0}
                 }}];

  let lastpos = 0;
  for (const event of parser) {
    handleEvent(containers, event);
    lastpos = event.endpos;
  }

  let doc : Doc =
         { tag: "doc",
           references: references,
           footnotes: footnotes,
           children: containers[0].children,
           attributes: containers[0].attributes
          };
  if (options.sourcePositions) {
    doc.pos = {start: {line: 0, col: 0, offset: 0},
               end: getSourceLoc(lastpos) };
  }
  return doc;
}

const omitFields : Record<string, boolean> =
  { children: true,
    tag: true,
    pos: true,
    attributes: true,
    references: true,
    footnotes: true };

const renderNode = function(node : Record<string, any>, buff : string[], indent : number) : void {
  buff.push(" ".repeat(indent));
  if (indent > 128) {
    buff.push("(((DEEPLY NESTED CONTENT OMITTED)))\n");
    return;
  }

  buff.push(node.tag);
  if (node.pos) {
    buff.push(` (${node.pos.start.line}:${node.pos.start.col}:${node.pos.start.offset}-${node.pos.end.line}:${node.pos.end.col}:${node.pos.end.offset})`);
  }
  for (let k in node) {
    if (!omitFields[k]) {
      let v : any = node[k];
      buff.push(` ${k}=${JSON.stringify(v)}`);
    }
  }
  if (node.attributes) {
    for (let k in node.attributes) {
      buff.push(` ${k}=${JSON.stringify(node[k])}`);
    }
  }
  buff.push("\n");
  if (node.children) {
    node.children.forEach((child : any) => {
      renderNode(child, buff, indent + 2);
    });
  }
}

// Render an AST in human-readable form, with indentation
// showing the hierarchy.
const renderAST = function(doc : Doc) : string {
  let buff : string[] = [];
  renderNode(doc, buff, 0)
  if (Object.keys(doc.references).length > 0) {
    buff.push("references\n");
    for (let k in doc.references) {
      buff.push(`  [${JSON.stringify(k)}] =\n`);
      renderNode(doc.references[k], buff, 4);
    }
  }
  if (Object.keys(doc.footnotes).length > 0) {
    buff.push("footnotes\n")
    for (let k in doc.footnotes) {
      buff.push(`  [${JSON.stringify(k)}] =\n`);
      renderNode(doc.footnotes[k], buff, 4)
    }
  }
  return buff.join("");
}



export {
  parse,
  ParseOptions,
  Node,
  HasChildren,
  HasAttributes,
  Doc,
  Reference,
  Footnote,
  renderAST,
  getStringContent
}
