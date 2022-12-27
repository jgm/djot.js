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
  | Section
  | Div
  | CodeBlock
  | RawBlock
  | BlockQuote
  | List
  | Table;

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

interface Section extends HasAttributes, HasBlockChildren {
  tag: "section";
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
  style: string;
  tight: boolean;
  start?: number;
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

type CheckboxStatus = "checked" | "unchecked";

interface ListItem extends HasAttributes, HasBlockChildren {
  tag: "list_item";
  checkbox?: CheckboxStatus;
  // TODO
}

interface DefinitionListItem extends HasAttributes {
  tag: "definition_list_item";
  children: (Term | Definition)[];
}

interface Term extends HasAttributes, HasInlineChildren {
  tag: "term";
}

interface Definition extends HasAttributes, HasBlockChildren {
  tag: "definition";
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

type Node = Doc | Block | Inline | ListItem
  | DefinitionListItem | Term | Definition
  | Row | Cell | Caption;

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

const getStringContent = function(node: (Node | Container)): string {
  let buffer: string[] = [];
  addStringContent(node, buffer);
  return buffer.join("");
}

const addStringContent = function(node: (Node | Container),
  buffer: string[]): void {
  if ("text" in node) {
    buffer.push(node.text);
  } else if ("tag" in node &&
    (node.tag === "softbreak" || node.tag === "hardbreak")) {
    buffer.push("\n");
  } else if ("children" in node) {
    node.children.forEach((child: Node) => {
      addStringContent(child, buffer);
    });
  }
}

// in verbatim text, trim one space next to ` at beginning or end:
const trimVerbatim = function(s: string): string {
  return s
    .replace(/^ `/, "`")
    .replace(/` $/, "`");
}

const romanDigits: Record<string, number> = {
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

const romanToNumber = function(s: string): number {
  // go backwards through the digits
  let total = 0;
  let prevdigit = 0;
  let i = s.length - 1;
  while (i >= 0) {
    let c = s.charAt(i);
    let n = romanDigits[c];
    if (!n) {
      throw ("Encountered bad character in roman numeral " + s);
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

const getListStart = function(marker: string, style: string): number | undefined {
  let numtype = style.replace(/[().]/g, "");
  let s = marker.replace(/[().]/g, "");
  switch (numtype) {
    case "1": return parseInt(s, 10);
    case "A": return ((s.codePointAt(0) || 65) - 65 + 1); // 65 = "A"
    case "a": return ((s.codePointAt(0) || 97) - 97 + 1); // 97 = "a"
    case "I": return romanToNumber(s);
    case "i": return romanToNumber(s);
  }
  return undefined;
}

interface ParseOptions {
  sourcePositions?: boolean;
  warn?: (message: string, pos: number) => void;
}

// Parsing ocntext:
enum Context {
  Normal = 0,    // add str nodes as children of tip
  Verbatim = 1,  // gather str, escape, softbreak, hardbreak in accumulatedText
  Literal = 2    // gather str, softbreak, hardbreak in accumulatedText
}

const parse = function(input: string, options: ParseOptions): Doc {

  let linestarts: number[] = [0];

  if (options.sourcePositions) { // construct map of newline positions
    for (var i = 0; i < input.length; i++) {
      if (input[i] === "\n") {
        linestarts.push(i);
      }
    }
  }

  // use binary search on linestarts to find line number and col
  const getSourceLoc = function(pos: number): SourceLoc {
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
  let accumulatedText: string[] = [];
  const references: Record<string, Reference> = {};
  const footnotes: Record<string, Footnote> = {};
  const identifiers: Record<string, boolean> = {}; // identifiers used
  const blockAttributes: Attributes = {}; // accumulated block attributes
  const defaultWarnings = function(message: string, pos: number) {
    process.stderr.write(message + (pos ? " at " + pos : "") + "\n");
  }
  const warn = options.warn || defaultWarnings;
  const parser = new EventParser(input, warn);
  const addBlockAttributes = function(container: HasAttributes) {
    if (Object.keys(blockAttributes).length > 0) {
      container.attributes = container.attributes || {};
      for (const k in blockAttributes) {
        container.attributes[k] = blockAttributes[k];
        delete blockAttributes[k];
      }
    }
  };
  const getUniqueIdentifier = function(s: string): string {
    let base = s.trim()
      .replace(/[\W\s]+/g, "-")
      .replace(/-$/, "")
      .replace(/^-/, "");
    let i = 0;
    let ident = base;
    // generate unique id
    while (!ident || identifiers[ident]) {
      i = i + 1;
      ident = (base || "s") + "-" + i;
    }
    return ident;
  }
  const pushContainer = function(startpos?: SourceLoc) {
    let container: Container = {
      children: [],
      data: {}
    };
    if (startpos) {
      container.pos = { start: startpos, end: startpos };
    }
    addBlockAttributes(container);
    containers.push(container);
  };
  const popContainer = function(endpos?: SourceLoc) {
    let node = containers.pop();
    if (!node) {
      throw ("Container stack is empty (popContainer)");
    }
    if (endpos && node.pos) {
      node.pos.end = endpos;
    }
    return node;
  };
  const topContainer = function(): Container {
    if (containers.length > 0) {
      return containers[containers.length - 1];
    } else {
      throw ("Container stack is empty (topContainer)");
    }
  }
  // points to last child of top container, or top container if
  // it doesn't have children
  const getTip = function(): (Container | Node) {
    let top = topContainer();
    if (top.children.length > 0) {
      return top.children[top.children.length - 1];
    } else {
      return top;
    }
  }

  const addChildToTip = function(child: Node, pos?: Pos): void {
    if (containers.length > 0) {
      let tip = containers[containers.length - 1];
      if (pos) {
        child.pos = pos;
      }
      tip.children.push(child);
    }
  }

  const handleEvent = function(containers: Container[], event: Event): void {
    let node;
    let top;
    let tip;
    let sp;
    let ep;
    let pos;
    if (options.sourcePositions) {
      sp = getSourceLoc(event.startpos);
      ep = getSourceLoc(event.endpos);
      pos = { start: sp, end: ep };
    }
    let annot = event.annot;
    let suffixes: string[] = [];
    if (event.annot.includes("|")) {
      let parts = event.annot.split("|");
      annot = parts[0];
      suffixes = parts.slice(1);
    }

    // The following is for tight/loose determination.
    // If blanklines have already been seen, and we're
    // about to process something other than a blankline,
    // the end of a list or list item, or the start of
    // a list, then it's a loose list.
    if (annot !== "blankline" && annot !== "-list" &&
      annot !== "-list_item" && annot !== "+list") {
      let ln;
      top = topContainer();
      if (top) {
        if (top.data && "tight" in top.data) {
          ln = top;
        } else if (containers.length >= 2 &&
          "tight" in containers[containers.length - 2].data) {
          ln = containers[containers.length - 2];
        }
        if (ln && ln.data.blanklines) {
          ln.data.tight = false;
        }
      }
    }

    switch (annot) {

      case "str":
        let txt = input.substring(event.startpos, event.endpos + 1);
        if (context === Context.Normal) {
          addChildToTip({ tag: "str", text: txt }, pos);
        } else {
          accumulatedText.push(txt);
        }
        break;

      case "softbreak":
        if (context === Context.Normal) {
          addChildToTip({ tag: "softbreak" }, pos);
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
          addChildToTip({ tag: "hardbreak" }, pos);
        } else {
          accumulatedText.push("\n");
        }
        break;

      case "nbsp":
        if (context === Context.Verbatim) {
          accumulatedText.push("\\ ");
        } else {
          addChildToTip({ tag: "nbsp" }, pos);
        }
        break;

      case "emoji":
        if (context === Context.Normal) {
          let alias = input.substring(event.startpos + 1, event.endpos);
          addChildToTip({ tag: "emoji", alias: alias }, pos);
        } else {
          let txt = input.substring(event.startpos, event.endpos + 1);
          accumulatedText.push(txt);
        }
        break;

      case "footnote_reference":
        let fnref = input.substring(event.startpos + 2, event.endpos);
        addChildToTip({ tag: "footnote_reference", text: fnref }, pos);
        break;

      case "+reference_definition":
        pushContainer(sp);
        break;

      case "-reference_definition":
        node = popContainer(ep);
        let r: Reference = {
          tag: "reference",
          destination: node.data.value || "",
          attributes: node.attributes
        };
        if (node.data.key) {
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
        addChildToTip({ tag: "emph", children: node.children }, node.pos);
        break;

      case "+strong":
        pushContainer(sp);
        break;

      case "-strong":
        node = popContainer(ep);
        addChildToTip({ tag: "strong", children: node.children }, node.pos);
        break;

      case "+span":
        pushContainer(sp);
        break;

      case "-span":
        node = popContainer(ep);
        addChildToTip({ tag: "span", children: node.children }, node.pos);
        break;

      case "+mark":
        pushContainer(sp);
        break;

      case "-mark":
        node = popContainer(ep);
        addChildToTip({ tag: "mark", children: node.children }, node.pos);
        break;

      case "+superscript":
        pushContainer(sp);
        break;

      case "-superscript":
        node = popContainer(ep);
        addChildToTip({ tag: "superscript", children: node.children }, node.pos);
        break;

      case "+subscript":
        pushContainer(sp);
        break;

      case "-subscript":
        node = popContainer(ep);
        addChildToTip({ tag: "subscript", children: node.children }, node.pos);
        break;

      case "+delete":
        pushContainer(sp);
        break;

      case "-delete":
        node = popContainer(ep);
        addChildToTip({ tag: "delete", children: node.children }, node.pos);
        break;

      case "+insert":
        pushContainer(sp);
        break;

      case "-insert":
        node = popContainer(ep);
        addChildToTip({ tag: "insert", children: node.children }, node.pos);
        break;

      case "+double_quoted":
        pushContainer(sp);
        break;

      case "-double_quoted":
        node = popContainer(ep);
        addChildToTip({ tag: "double_quoted", children: node.children }, node.pos);
        break;

      case "+single_quoted":
        pushContainer(sp);
        break;

      case "-single_quoted":
        node = popContainer(ep);
        addChildToTip({ tag: "single_quoted", children: node.children }, node.pos);
        break;

      case "+attributes":
        pushContainer(sp);
        break;

      case "-attributes":
        node = popContainer(ep);
        if (node.attributes && containers.length > 0) {
          if (node.attributes.id) {
            identifiers[node.attributes.id] = true;
          }
          tip = getTip();
          let endsWithSpace = false;
          if ("tag" in tip && tip.tag === "str") { // bare word
            // split off last consecutive word of string
            // and attach attributes to it
            let m = tip.text.match(/[^\s]+$/);
            if (m && m.index && m.index > 0) {
              let wordpos;
              if (tip.pos) {
                let origend = tip.pos.end;
                tip.pos.end = {
                  line: origend.line,
                  col: origend.col - m[0].length,
                  offset: origend.offset - m[0].length
                };
                wordpos = {
                  start: {
                    line: origend.line,
                    col: origend.col - m[0].length + 1,
                    offset: origend.offset - m[0].length + 1
                  },
                  end: origend
                };
              }
              tip.text = tip.text.substring(0, m.index);
              addChildToTip({ tag: "str", text: m[0] }, wordpos);
            } else if (!m) {
              endsWithSpace = true;
            }
          }
          tip = getTip(); // get new tip, which may be the new element
          if (endsWithSpace) {
            warn("Ignoring unattached attribute", event.startpos);
            break;
          }
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
          if (node.attributes.id) {
            identifiers[node.attributes.id] = true;
          }
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
        let val = input.substring(event.startpos, event.endpos + 1)
          .replace(/[ \r\n]+/g, " ")  // collapse interior whitespace
          .replace(/\\[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "$1");  // resolve backslash escapes
        if (!top.attributes) {
          top.attributes = {};
        }
        if (top.data.key) {
          top.attributes[top.data.key] = val;
        } else {
          throw ("Encountered value without key");
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
        addChildToTip({
          tag: node.data.isimage ? "image" : "link",
          destination: accumulatedText.join(""),
          children: node.children
        }, node.pos);
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
        addChildToTip({
          tag: node.data.isimage ? "image" : "link",
          reference: ref,
          children: node.children
        }, node.pos);
        context = Context.Normal;
        accumulatedText = [];
        break;

      case "+verbatim":
        context = Context.Verbatim;
        pushContainer(sp);
        break;

      case "-verbatim":
        node = popContainer(ep);
        addChildToTip({
          tag: "verbatim",
          text: trimVerbatim(accumulatedText.join(""))
        },
          node.pos);
        context = Context.Normal;
        accumulatedText = [];
        break;

      case "raw_format":
        let format = input.substring(event.startpos, event.endpos + 1)
          .replace(/^\{?=/, "")
          .replace(/\}$/, "");
        top = topContainer();
        if (context === Context.Verbatim) { // in a code block
          top.data.format = format;
        } else {
          tip = top.children[top.children.length - 1];
          if (tip && "tag" in tip && tip.tag === "verbatim") {
            tip.tag = "raw_inline";
            tip.format = format;
          } else {
            throw ("raw_format is not after verbatim or code_block");
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
        addChildToTip({
          tag: "math", display: event.annot === "-display_math",
          text: trimVerbatim(accumulatedText.join(""))
        },
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
        addChildToTip({ tag: "url", text: accumulatedText.join("") }, node.pos);
        context = Context.Normal;
        accumulatedText = [];
        break;

      case "+email":
        context = Context.Literal;
        pushContainer(sp);
        break;

      case "-email":
        node = popContainer(ep);
        addChildToTip({ tag: "email", text: accumulatedText.join("") }, node.pos);
        context = Context.Normal;
        accumulatedText = [];
        break;

      case "+para":
        pushContainer(sp);
        break;

      case "-para":
        node = popContainer(ep);
        addChildToTip({
          tag: "para",
          children: node.children,
          attributes: node.attributes
        }, node.pos);
        break;

      case "+heading":
        pushContainer(sp);
        topContainer().data.level = 1 + event.endpos - event.startpos;
        break;

      case "-heading":
        node = popContainer(ep);
        if (!node.attributes) {
          node.attributes = {};
        }
        let headingStr = getStringContent(node).trim();

        if (!node.attributes.id) {
          // generate auto identifier
          node.attributes.id = getUniqueIdentifier(headingStr);
          identifiers[node.attributes.id] = true;
        }
        // add implicit heading reference
        if (!references[headingStr]) {
          references[headingStr] = {
            tag: "reference",
            destination: "#" + node.attributes.id
          };
        }

        // add section structure
        let pnode = topContainer();
        if (pnode.data.headinglevel !== undefined) { // doc or section
          while (pnode && pnode.data.headinglevel !== undefined &&
            pnode.data.headinglevel >= node.data.level) {
            // close sections til we get to the right level
            pnode = popContainer(ep);
            addChildToTip({
              tag: "section",
              children: pnode.children,
              attributes: pnode.attributes
            }, pnode.pos);
            pnode = topContainer();
          }
          // now we know that pnode.data.headinglevel is either
          // undefined or < node.data.level
          pushContainer(sp);
          topContainer().data.headinglevel = node.data.level;
          // move id attribute from heading to section
          if (node.attributes && node.attributes.id) {
            topContainer().attributes = { id: node.attributes.id };
            delete node.attributes;
          }
        }
        addChildToTip({
          tag: "heading",
          level: node.data.level,
          children: node.children,
          attributes: node.attributes
        }, node.pos);
        break;

      case "+list":
        pushContainer(sp);
        topContainer().data.styles = suffixes;
        topContainer().data.blanklines = false;
        topContainer().data.tight = true;
        break;

      case "-list":
        node = popContainer(ep);
        // take first if ambiguous
        let listStyle = node.data.styles[0];
        if (!listStyle) {
          throw ("No style defined for list");
        }
        let tight = false; // TODO
        let listStart = getListStart(node.data.firstMarker, listStyle);
        addChildToTip({
          tag: "list",
          style: listStyle,
          children: node.children,
          start: listStart,
          tight: node.data.tight,
          attributes: node.attributes
        }, node.pos);
        break;

      case "+list_item":
        // narrow styles
        if (suffixes.length < topContainer().data.styles.length) {
          topContainer().data.styles = suffixes;
        }
        if (!topContainer().data.firstMarker) {
          topContainer().data.firstMarker =
            input.substring(event.startpos, event.endpos + 1);
        }
        pushContainer(sp);
        if (suffixes.length === 1 && suffixes[0] === ":") {
          topContainer().data.definitionList = true;
        }
        break;

      case "-list_item":
        node = popContainer(ep);
        if (node.data.definitionList) {
          if (node.children[0] && node.children[0].tag === "para") {
            let term: Term =
            {
              tag: "term",
              children: node.children[0].children
            };
            node.children.shift();
            let definition: Definition =
            {
              tag: "definition",
              children: node.children
            };
            addChildToTip({
              tag: "definition_list_item",
              children: [term, definition],
              attributes: node.attributes
            }, node.pos);
          } else {
            throw ("Definition list item has no term.")
          }
        } else {
          addChildToTip({
            tag: "list_item",
            children: node.children,
            attributes: node.attributes,
            checkbox: node.data.checkbox,
          }, node.pos);
        }
        break;

      case "checkbox_checked":
        topContainer().data.checkbox = "checked";
        break;

      case "checkbox_unchecked":
        topContainer().data.checkbox = "unchecked";
        break;

      case "+blockquote":
        pushContainer(sp);
        break;

      case "-blockquote":
        node = popContainer(ep);
        addChildToTip({
          tag: "blockquote",
          children: node.children,
          attributes: node.attributes
        }, node.pos);
        break;

      case "+table":
        pushContainer(sp);
        topContainer().data.aligns = [];
        break;

      case "-table":
        node = popContainer(ep);
        addChildToTip({
          tag: "table",
          children: node.children,
          attributes: node.attributes
        }, node.pos);
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
          if (tip && "tag" in tip && tip.tag === "row") { // prev row of table
            tip.head = true;
            for (let i = 0; i < tip.children.length; i++) {
              tip.children[i].head = true;
              tip.children[i].align = node.data.aligns[i];
            }
          }
        } else {
          // get aligns from table
          node.data.aligns = [];
          for (let i = 0; i < node.children.length; i++) {
            node.children[i].align = topContainer().data.aligns[i] || "default";
          }
          addChildToTip({
            tag: "row",
            children: node.children,
            head: false, // gets set later
            attributes: node.attributes
          }, node.pos);
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
        addChildToTip({
          tag: "cell",
          children: node.children,
          head: false, // gets set in "-row"
          align: "default", // set at "-row"
          attributes: node.attributes
        }, node.pos);
        break;

      case "+caption":
        pushContainer(sp);
        break;

      case "-caption":
        node = popContainer(ep);
        addChildToTip({
          tag: "caption",
          children: node.children,
          attributes: node.attributes
        }, node.pos);
        break;

      case "+footnote":
        pushContainer(sp);
        break;

      case "-footnote":
        node = popContainer(ep);
        if (node.data.label) {
          footnotes[node.data.label] =
          {
            tag: "footnote",
            label: node.data.label || "",
            children: node.children,
            attributes: node.attributes,
            pos: node.pos
          };
        } else {
          warn("Ignoring footnote without a label.", event.endpos);
        }
        break;

      case "note_label":
        topContainer().data.label =
          input.substring(event.startpos, event.endpos + 1);
        break;

      case "+code_block":
        pushContainer(sp);
        context = Context.Verbatim;
        break;

      case "-code_block":
        node = popContainer(ep);
        if (node.data.format) {
          addChildToTip({
            tag: "raw_block",
            format: node.data.format,
            text: accumulatedText.join(""),
            attributes: node.attributes
          }, node.pos);
        } else {
          addChildToTip({
            tag: "code_block",
            text: accumulatedText.join(""),
            lang: node.data.lang,
            attributes: node.attributes
          }, node.pos);
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
        addChildToTip({
          tag: "div",
          children: node.children,
          attributes: node.attributes
        }, node.pos);
        break;

      case "thematic_break":
        let tb: ThematicBreak = { tag: "thematic_break" };
        addBlockAttributes(tb);
        addChildToTip(tb, pos);
        break;

      case "right_single_quote":
        addChildToTip({ tag: "right_single_quote", text: "'" }, pos);
        break;

      case "left_double_quote":
        addChildToTip({ tag: "left_double_quote", text: "'" }, pos);
        break;

      case "ellipses":
        addChildToTip({ tag: "ellipses", text: "..." }, pos);
        break;

      case "en_dash":
        addChildToTip({ tag: "en_dash", text: "--" }, pos);
        break;

      case "em_dash":
        addChildToTip({ tag: "em_dash", text: "---" }, pos);
        break;

      // We set the blanklines property of a parent list or
      // sublist to aid with tight/loose list determination.
      case "blankline":
        let listnode;
        if ("tight" in topContainer().data) {
          listnode = topContainer();
        } else if (containers.length >= 2 &&
          "tight" in containers[containers.length - 2].data) {
          listnode = containers[containers.length - 2];
        }
        if (listnode) {
          listnode.data.blanklines = true;
        }
        break;

      default:
      // throw("Unknown event " + event.annot);
    }
  }

  let containers: Container[] =
    [{
      children: [],
      data: { headinglevel: 0 },
      pos: {
        start: { line: 0, col: 0, offset: 0 },
        end: { line: 0, col: 0, offset: 0 }
      }
    }];

  let lastpos = 0;
  for (const event of parser) {
    handleEvent(containers, event);
    lastpos = event.endpos;
  }
  let lastloc;
  if (options.sourcePositions) {
    lastloc = getSourceLoc(lastpos);
  }

  // close any open sections:
  let pnode = topContainer();
  while (pnode && pnode.data.headinglevel > 0) {
    // close sections til we get to the doc level
    popContainer(lastloc);
    addChildToTip({
      tag: "section",
      children: pnode.children,
      attributes: pnode.attributes
    }, pnode.pos);
    pnode = topContainer();
  }

  let doc: Doc =
  {
    tag: "doc",
    references: references,
    footnotes: footnotes,
    children: containers[0].children,
    attributes: containers[0].attributes
  };
  if (options.sourcePositions) {
    doc.pos = {
      start: { line: 0, col: 0, offset: 0 },
      end: lastloc || { line: 0, col: 0, offset: 0 }
    };
  }
  return doc;
}

const omitFields: Record<string, boolean> =
{
  children: true,
  tag: true,
  pos: true,
  attributes: true,
  references: true,
  footnotes: true
};

const renderNode = function(node: Record<string, any>, buff: string[], indent: number): void {
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
      let v: Node = node[k];
      if (v !== undefined && v !== null) {
        buff.push(` ${k}=${JSON.stringify(v)}`);
      }
    }
  }
  if (node.attributes) {
    for (let k in node.attributes) {
      buff.push(` ${k}=${JSON.stringify(node.attributes[k])}`);
    }
  }
  buff.push("\n");
  if (node.children) {
    node.children.forEach((child: Node) => {
      renderNode(child, buff, indent + 2);
    });
  }
}

// Render an AST in human-readable form, with indentation
// showing the hierarchy.
const renderAST = function(doc: Doc): string {
  let buff: string[] = [];
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
  renderAST,
  getStringContent,
  Attributes,
  SourceLoc,
  Pos,
  HasAttributes,
  HasChildren,
  HasInlineChildren,
  HasBlockChildren,
  Block,
  Para,
  Heading,
  ThematicBreak,
  Section,
  Div,
  CodeBlock,
  RawBlock,
  BlockQuote,
  List,
  Table,
  Caption,
  TablePart,
  Row,
  Inline,
  Str,
  SoftBreak,
  HardBreak,
  Nbsp,
  Emoji,
  Verbatim,
  RawInline,
  Math,
  Url,
  Email,
  FootnoteReference,
  RightSingleQuote,
  LeftDoubleQuote,
  Ellipses,
  EmDash,
  EnDash,
  Emph,
  Strong,
  Link,
  Image,
  Span,
  Mark,
  Superscript,
  Subscript,
  Insert,
  Delete,
  DoubleQuoted,
  SingleQuoted,
  CheckboxStatus,
  ListItem,
  DefinitionListItem,
  Term,
  Definition,
  Cell,
  Alignment,
  Node,
  Doc,
  Reference,
  Footnote
}
