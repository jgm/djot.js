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
  children: AstNode[];
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
  children: (ListItem | DefinitionListItem)[];
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
  | Symb
  | Verbatim
  | RawInline
  | Math
  | Url
  | Email
  | FootnoteReference
  | LeftSingleQuote
  | RightSingleQuote
  | LeftDoubleQuote
  | RightDoubleQuote
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

interface LeftSingleQuote extends HasAttributes {
  tag: "left_single_quote";
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

interface RightDoubleQuote extends HasAttributes {
  tag: "right_double_quote";
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

interface Symb extends HasAttributes {
  tag: "symbol";
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

type AstNode = Doc | Block | Inline | ListItem
  | DefinitionListItem | Term | Definition
  | Row | Cell | Caption | Footnote;

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
  data: Record<string,any>;
  pos?: Pos;
}

const getStringContent = function(node: (AstNode | Container)): string {
  const buffer: string[] = [];
  addStringContent(node, buffer);
  return buffer.join("");
}

const addStringContent = function(node: (AstNode | Container),
  buffer: string[]): void {
  if ("text" in node) {
    buffer.push(node.text);
  } else if ("tag" in node &&
    (node.tag === "softbreak" || node.tag === "hardbreak")) {
    buffer.push("\n");
  } else if ("children" in node) {
    node.children.forEach((child: AstNode) => {
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
    const c = s.charAt(i);
    const n = romanDigits[c];
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
  const numtype = style.replace(/[().]/g, "");
  const s = marker.replace(/[().]/g, "");
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

  const linestarts: number[] = [-1];

  if (options.sourcePositions) { // construct map of newline positions
    for (let i = 0; i < input.length; i++) {
      if (input[i] === "\n") {
        linestarts.push(i);
      }
    }
  }

  // use binary search on linestarts to find line number and col
  const getSourceLoc = function(pos: number): SourceLoc {
    const numlines = linestarts.length;
    let bottom = 0;
    let top = numlines - 1;
    let line = 0;
    let col = 0;
    while (!line) {
      const mid = bottom + ~~((top - bottom) / 2);
      if (linestarts[mid] > pos) {
        top = mid;
      } else if (linestarts[mid] <= pos) {
        if (mid === top || linestarts[mid + 1] > pos) {
          line = mid + 1;
          col = pos - linestarts[mid];
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
    console.log(message + (pos ? " at " + pos : "") + "\n");
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
    const base = s.trim()
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
  const pushContainer = function(pos?: Pos) {
    const container: Container = {
      children: [],
      data: {}
    };
    if (pos) {
      container.pos = { start: pos.start, end: pos.start };
    }
    addBlockAttributes(container);
    containers.push(container);
  };
  const popContainer = function(pos?: Pos) {
    const node = containers.pop();
    if (!node) {
      throw ("Container stack is empty (popContainer)");
    }
    if (pos && node.pos) {
      node.pos.end = pos.end;
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
  const getTip = function(): (Container | AstNode) {
    const top = topContainer();
    if (top.children.length > 0) {
      return top.children[top.children.length - 1];
    } else {
      return top;
    }
  }

  const addChildToTip = function(child: AstNode, pos?: Pos): void {
    if ("attributes" in child && !child.attributes) {
      delete child.attributes;
    }
    if (containers.length > 0) {
      const tip = containers[containers.length - 1];
      if (pos) {
        child.pos = pos;
      }
      tip.children.push(child);
    }
  }


  const handlers : Record<string, (suffixes : string[],
                                   startpos : number,
                                   endpos : number,
                                   pos : Pos | undefined) => void> =
   {  str: (suffixes, startpos, endpos, pos) => {
        const txt = input.substring(startpos, endpos + 1);
        if (context === Context.Normal) {
          addChildToTip({ tag: "str", text: txt }, pos);
        } else {
          accumulatedText.push(txt);
        }
      },
      softbreak: (suffixes, startpos, endpos, pos) => {
        if (context === Context.Normal) {
          addChildToTip({ tag: "softbreak" }, pos);
        } else {
          accumulatedText.push("\n");
        }
      },

      escape: (suffixes, startpos, endpos, pos) => {
        if (context === Context.Verbatim) {
          accumulatedText.push("\\");
        }
      },

      hardbreak: (suffixes, startpos, endpos, pos) => {
        if (context === Context.Normal) {
          addChildToTip({ tag: "hardbreak" }, pos);
        } else {
          accumulatedText.push("\n");
        }
      },

      nbsp: (suffixes, startpos, endpos, pos) => {
        if (context === Context.Verbatim) {
          accumulatedText.push("\\ ");
        } else {
          addChildToTip({ tag: "nbsp" }, pos);
        }
      },

      symbol: (suffixes, startpos, endpos, pos) => {
        if (context === Context.Normal) {
          const alias = input.substring(startpos + 1, endpos);
          addChildToTip({ tag: "symbol", alias: alias }, pos);
        } else {
          const txt = input.substring(startpos, endpos + 1);
          accumulatedText.push(txt);
        }
      },

      footnote_reference: (suffixes, startpos, endpos, pos) => {
        const fnref = input.substring(startpos + 2, endpos);
        addChildToTip({ tag: "footnote_reference", text: fnref }, pos);
      },

      ["+reference_definition"]: (suffixes, startpos, endpos, pos) => {
        pushContainer(pos);
      },

      ["-reference_definition"]: (suffixes, startpos, endpos, pos) => {
        const node = popContainer(pos);
        const r: Reference = {
          tag: "reference",
          destination: node.data.value || "",
          attributes: node.attributes
        };
        if (node.data.key) {
          references[node.data.key] = r;
        }
      },

      reference_key: (suffixes, startpos, endpos, pos) => {
        topContainer().data.key = input.substring(startpos + 1,
          endpos);
        topContainer().data.value = "";
      },

      reference_value: (suffixes, startpos, endpos, pos) => {
        topContainer().data.value =
          topContainer().data.value + input.substring(startpos,
            endpos + 1);
      },

      ["+emph"]: (suffixes, startpos, endpos, pos) => {
        pushContainer(pos);
      },

      ["-emph"]: (suffixes, startpos, endpos, pos) => {
        const node = popContainer(pos);
        addChildToTip({ tag: "emph", children: node.children }, node.pos);
      },

      ["+strong"]: (suffixes, startpos, endpos, pos) => {
        pushContainer(pos);
      },

      ["-strong"]: (suffixes, startpos, endpos, pos) => {
        const node = popContainer(pos);
        addChildToTip({ tag: "strong", children: node.children }, node.pos);
      },

      ["+span"]: (suffixes, startpos, endpos, pos) => {
        pushContainer(pos);
      },

      ["-span"]: (suffixes, startpos, endpos, pos) => {
        const node = popContainer(pos);
        addChildToTip({ tag: "span", children: node.children }, node.pos);
      },

      ["+mark"]: (suffixes, startpos, endpos, pos) => {
        pushContainer(pos);
      },

      ["-mark"]: (suffixes, startpos, endpos, pos) => {
        const node = popContainer(pos);
        addChildToTip({ tag: "mark", children: node.children }, node.pos);
      },

      ["+superscript"]: (suffixes, startpos, endpos, pos) => {
        pushContainer(pos);
      },

      ["-superscript"]: (suffixes, startpos, endpos, pos) => {
        const node = popContainer(pos);
        addChildToTip({ tag: "superscript", children: node.children }, node.pos);
      },

      ["+subscript"]: (suffixes, startpos, endpos, pos) => {
        pushContainer(pos);
      },

      ["-subscript"]: (suffixes, startpos, endpos, pos) => {
        const node = popContainer(pos);
        addChildToTip({ tag: "subscript", children: node.children }, node.pos);
      },

      ["+delete"]: (suffixes, startpos, endpos, pos) => {
        pushContainer(pos);
      },

      ["-delete"]: (suffixes, startpos, endpos, pos) => {
        const node = popContainer(pos);
        addChildToTip({ tag: "delete", children: node.children }, node.pos);
      },

      ["+insert"]: (suffixes, startpos, endpos, pos) => {
        pushContainer(pos);
      },

      ["-insert"]: (suffixes, startpos, endpos, pos) => {
        const node = popContainer(pos);
        addChildToTip({ tag: "insert", children: node.children }, node.pos);
      },

      ["+double_quoted"]: (suffixes, startpos, endpos, pos) => {
        pushContainer(pos);
      },

      ["-double_quoted"]: (suffixes, startpos, endpos, pos) => {
        const node = popContainer(pos);
        addChildToTip({ tag: "double_quoted", children: node.children }, node.pos);
      },

      ["+single_quoted"]: (suffixes, startpos, endpos, pos) => {
        pushContainer(pos);
      },

      ["-single_quoted"]: (suffixes, startpos, endpos, pos) => {
        const node = popContainer(pos);
        addChildToTip({ tag: "single_quoted", children: node.children }, node.pos);
      },

      ["+attributes"]: (suffixes, startpos, endpos, pos) => {
        pushContainer(pos);
      },

      ["-attributes"]: (suffixes, startpos, endpos, pos) => {
        const node = popContainer(pos);
        if (node.attributes && containers.length > 0) {
          if (node.attributes.id) {
            identifiers[node.attributes.id] = true;
          }
          let tip = getTip();
          if (tip === topContainer()) {
            // no inline children to add the attribute to...
            return;
          }
          let endsWithSpace = false;
          if ("tag" in tip && tip.tag === "str") { // bare word
            // split off last consecutive word of string
            // and attach attributes to it
            const m = tip.text.match(/[^\s]+$/);
            if (m && m.index && m.index > 0) {
              let wordpos;
              if (tip.pos) {
                const origend = tip.pos.end;
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
            warn("Ignoring unattached attribute", startpos);
            return;
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
      },

      ["+block_attributes"]: (suffixes, startpos, endpos, pos) => {
        pushContainer(pos);
      },

      ["-block_attributes"]: (suffixes, startpos, endpos, pos) => {
        const node = popContainer(pos);
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
      },

      class: (suffixes, startpos, endpos, pos) => {
        const top = topContainer();
        const cl = input.substring(startpos, endpos + 1);
        if (!top.attributes) {
          top.attributes = {};
        }
        if (top.attributes.class) {
          top.attributes.class = top.attributes.class + " " + cl;
        } else {
          top.attributes.class = cl;
        }
      },

      id: (suffixes, startpos, endpos, pos) => {
        const top = topContainer();
        const id = input.substring(startpos, endpos + 1);
        if (!top.attributes) {
          top.attributes = { id: id };
        } else {
          top.attributes.id = id;
        }
      },

      key: (suffixes, startpos, endpos, pos) => {
        const top = topContainer();
        const key = input.substring(startpos, endpos + 1);
        top.data.key = key;
        if (!top.attributes) {
          top.attributes = {};
        }
        top.attributes[top.data.key] = "";
      },

      value: (suffixes, startpos, endpos, pos) => {
        const top = topContainer();
        const val = input.substring(startpos, endpos + 1)
          .replace(/[ \r\n]+/g, " ")  // collapse interior whitespace
          .replace(/\\(?=[.,\\/#!$%^&*;:{}=\-_`~+[\]()'"?|])/g, "");
        // resolve backslash escapes
        if (!top.attributes) {
          top.attributes = {};
        }
        if (top.data.key) {
          top.attributes[top.data.key] = // append multiple values to key
            top.attributes[top.data.key] + val;
        } else {
          throw ("Encountered value without key");
        }
      },

      ["+linktext"]: (suffixes, startpos, endpos, pos) => {
        pushContainer(pos);
        topContainer().data.isimage = false;
      },

      ["-linktext"]: (suffixes, startpos, endpos, pos) => {
        // we don't pop yet, but wait for -destination
      },

      ["+imagetext"]: (suffixes, startpos, endpos, pos) => {
        pushContainer(pos);
        topContainer().data.isimage = true;
      },

      ["-imagetext"]: (suffixes, startpos, endpos, pos) => {
        // we don't pop yet, but wait for -destination
      },

      ["+destination"]: (suffixes, startpos, endpos, pos) => {
        context = Context.Literal;
      },

      ["-destination"]: (suffixes, startpos, endpos, pos) => {
        const node = popContainer(pos);  // the container added by +linktext/+imagetext
        addChildToTip({
          tag: node.data.isimage ? "image" : "link",
          destination: accumulatedText.join("").replace(/[\r\n]/g,""),
          children: node.children
        }, node.pos);
        context = Context.Normal;
        accumulatedText = [];
      },

      ["+reference"]: (suffixes, startpos, endpos, pos) => {
        context = Context.Literal;
      },

      ["-reference"]: (suffixes, startpos, endpos, pos) => {
        const node = popContainer(pos);  // the container added by +linktext
        let ref = accumulatedText.join("").replace(/\r?\n/g," ");
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
      },

      ["+verbatim"]: (suffixes, startpos, endpos, pos) => {
        context = Context.Verbatim;
        pushContainer(pos);
      },

      ["-verbatim"]: (suffixes, startpos, endpos, pos) => {
        const node = popContainer(pos);
        addChildToTip({
          tag: "verbatim",
          text: trimVerbatim(accumulatedText.join(""))
        },
          node.pos);
        context = Context.Normal;
        accumulatedText = [];
      },

      raw_format: (suffixes, startpos, endpos, pos) => {
        const format = input.substring(startpos, endpos + 1)
          .replace(/^\{?=/, "")
          .replace(/\}$/, "");
        const top = topContainer();
        if (context === Context.Verbatim) { // in a code block
          top.data.format = format;
        } else {
          const tip = top.children[top.children.length - 1];
          if (tip && "tag" in tip && tip.tag === "verbatim") {
            tip.tag = "raw_inline";
            tip.format = format;
          } else {
            throw ("raw_format is not after verbatim or code_block");
          }
        }
      },

      ["+display_math"]: (suffixes, startpos, endpos, pos) => {
        context = Context.Verbatim;
        pushContainer(pos);
      },

      ["+inline_math"]: (suffixes, startpos, endpos, pos) => {
        context = Context.Verbatim;
        pushContainer(pos);
      },

      ["-display_math"]: (suffixes, startpos, endpos, pos) => {
        const node = popContainer(pos);
        addChildToTip({
          tag: "math", display: true,
          text: trimVerbatim(accumulatedText.join(""))
        },
          node.pos);
        context = Context.Normal;
        accumulatedText = [];
      },

      ["-inline_math"]: (suffixes, startpos, endpos, pos) => {
        const node = popContainer(pos);
        addChildToTip({
          tag: "math", display: false,
          text: trimVerbatim(accumulatedText.join(""))
        },
          node.pos);
        context = Context.Normal;
        accumulatedText = [];
      },

      ["+url"]: (suffixes, startpos, endpos, pos) => {
        context = Context.Literal;
        pushContainer(pos);
      },

      ["-url"]: (suffixes, startpos, endpos, pos) => {
        const node = popContainer(pos);
        addChildToTip({ tag: "url",
                        text: accumulatedText.join("").replace(/[\r\n]/g,"")
                      }, node.pos);
        context = Context.Normal;
        accumulatedText = [];
      },

      ["+email"]: (suffixes, startpos, endpos, pos) => {
        context = Context.Literal;
        pushContainer(pos);
      },

      ["-email"]: (suffixes, startpos, endpos, pos) => {
        const node = popContainer(pos);
        addChildToTip({ tag: "email",
                        text: accumulatedText.join("").replace(/[\r\n]/g,"")
                      }, node.pos);
        context = Context.Normal;
        accumulatedText = [];
      },

      ["+para"]: (suffixes, startpos, endpos, pos) => {
        pushContainer(pos);
      },

      ["-para"]: (suffixes, startpos, endpos, pos) => {
        const node = popContainer(pos);
        addChildToTip({
          tag: "para",
          children: node.children,
          attributes: node.attributes
        }, node.pos);
      },

      ["+heading"]: (suffixes, startpos, endpos, pos) => {
        pushContainer(pos);
        topContainer().data.level = 1 + endpos - startpos;
      },

      ["-heading"]: (suffixes, startpos, endpos, pos) => {
        const node = popContainer(pos);
        if (!node.attributes) {
          node.attributes = {};
        }
        const headingStr = getStringContent(node).trim();

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
            pnode = popContainer(pos);
            addChildToTip({
              tag: "section",
              children: pnode.children,
              attributes: pnode.attributes
            }, pnode.pos);
            pnode = topContainer();
          }
          // now we know that pnode.data.headinglevel is either
          // undefined or < node.data.level
          pushContainer(pos);
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
      },

      ["+list"]: (suffixes, startpos, endpos, pos) => {
        pushContainer(pos);
        topContainer().data.styles = suffixes;
        topContainer().data.blanklines = false;
        topContainer().data.tight = true;
      },

      ["-list"]: (suffixes, startpos, endpos, pos) => {
        const node = popContainer(pos);
        // take first if ambiguous
        const listStyle = node.data.styles[0];
        if (!listStyle) {
          throw ("No style defined for list");
        }
        const listStart = getListStart(node.data.firstMarker, listStyle);
        addChildToTip({
          tag: "list",
          style: listStyle,
          children: node.children,
          start: listStart,
          tight: node.data.tight,
          attributes: node.attributes
        }, node.pos);
      },

      ["+list_item"]: (suffixes, startpos, endpos, pos) => {
        // narrow styles
        if (suffixes.length < topContainer().data.styles.length) {
          topContainer().data.styles = suffixes;
        }
        if (!topContainer().data.firstMarker) {
          topContainer().data.firstMarker =
            input.substring(startpos, endpos + 1);
        }
        pushContainer(pos);
        if (suffixes.length === 1 && suffixes[0] === ":") {
          topContainer().data.definitionList = true;
        }
      },

      ["-list_item"]: (suffixes, startpos, endpos, pos) => {
        const node = popContainer(pos);
        if (node.data.definitionList) {
          if (node.children[0] && node.children[0].tag === "para") {
            const term: Term =
            {
              tag: "term",
              children: node.children[0].children
            };
            node.children.shift();
            const definition: Definition =
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
            const term: Term = { tag: "term", children: [] };
            const definition: Definition =
            {
              tag: "definition",
              children: node.children
            };
            addChildToTip({
              tag: "definition_list_item",
              children: [term, definition],
              attributes: node.attributes
            }, node.pos);
          }
        } else {
          addChildToTip({
            tag: "list_item",
            children: node.children,
            attributes: node.attributes,
            checkbox: node.data.checkbox,
          }, node.pos);
        }
      },

      checkbox_checked: (suffixes, startpos, endpos, pos) => {
        topContainer().data.checkbox = "checked";
      },

      checkbox_unchecked: (suffixes, startpos, endpos, pos) => {
        topContainer().data.checkbox = "unchecked";
      },

      ["+blockquote"]: (suffixes, startpos, endpos, pos) => {
        pushContainer(pos);
      },

      ["-blockquote"]: (suffixes, startpos, endpos, pos) => {
        const node = popContainer(pos);
        addChildToTip({
          tag: "blockquote",
          children: node.children,
          attributes: node.attributes
        }, node.pos);
      },

      ["+table"]: (suffixes, startpos, endpos, pos) => {
        pushContainer(pos);
        topContainer().data.aligns = [];
      },

      ["-table"]: (suffixes, startpos, endpos, pos) => {
        const node = popContainer(pos);
        addChildToTip({
          tag: "table",
          children: node.children,
          attributes: node.attributes
        }, node.pos);
      },

      ["+row"]: (suffixes, startpos, endpos, pos) => {
        pushContainer(pos);
        topContainer().data.aligns = [];
      },

      ["-row"]: (suffixes, startpos, endpos, pos) => {
        const node = popContainer(pos);
        if (node.children.length === 0) { // a separator line
          // set table aligns, so they can be propagated to future rows
          topContainer().data.aligns = node.data.aligns;
          const tip = getTip();
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
      },

      separator_default: (suffixes, startpos, endpos, pos) => {
        topContainer().data.aligns.push("default");
      },

      separator_left: (suffixes, startpos, endpos, pos) => {
        topContainer().data.aligns.push("left");
      },

      separator_right: (suffixes, startpos, endpos, pos) => {
        topContainer().data.aligns.push("right");
      },

      separator_center: (suffixes, startpos, endpos, pos) => {
        topContainer().data.aligns.push("center");
      },

      ["+cell"]: (suffixes, startpos, endpos, pos) => {
        pushContainer(pos);
      },

      ["-cell"]: (suffixes, startpos, endpos, pos) => {
        const node = popContainer(pos);
        addChildToTip({
          tag: "cell",
          children: node.children,
          head: false, // gets set in "-row"
          align: "default", // set at "-row"
          attributes: node.attributes
        }, node.pos);
      },

      ["+caption"]: (suffixes, startpos, endpos, pos) => {
        pushContainer(pos);
      },

      ["-caption"]: (suffixes, startpos, endpos, pos) => {
        const node = popContainer(pos);
        const tip = getTip();
        if (!tip || ("tag" in tip && tip.tag !== "table")) {
          return;
        }
        tip.children.unshift( // add caption as first child of table
          {
            tag: "caption",
            children: node.children,
            attributes: node.attributes,
            pos: node.pos
          });
      },

      ["+footnote"]: (suffixes, startpos, endpos, pos) => {
        pushContainer(pos);
      },

      ["-footnote"]: (suffixes, startpos, endpos, pos) => {
        const node = popContainer(pos);
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
          warn("Ignoring footnote without a label.", endpos);
        }
      },

      note_label: (suffixes, startpos, endpos, pos) => {
        topContainer().data.label =
          input.substring(startpos, endpos + 1);
      },

      ["+code_block"]: (suffixes, startpos, endpos, pos) => {
        pushContainer(pos);
        context = Context.Verbatim;
      },

      ["-code_block"]: (suffixes, startpos, endpos, pos) => {
        const node = popContainer(pos);
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
      },

      code_language: (suffixes, startpos, endpos, pos) => {
        const top = topContainer();
        top.data.lang = input.substring(startpos, endpos + 1);
      },

      ["+div"]: (suffixes, startpos, endpos, pos) => {
        pushContainer(pos);
      },

      ["-div"]: (suffixes, startpos, endpos, pos) => {
        const node = popContainer(pos);
        addChildToTip({
          tag: "div",
          children: node.children,
          attributes: node.attributes
        }, node.pos);
      },

      thematic_break: (suffixes, startpos, endpos, pos) => {
        const tb: ThematicBreak = { tag: "thematic_break" };
        addBlockAttributes(tb);
        addChildToTip(tb, pos);
      },

      left_single_quote: (suffixes, startpos, endpos, pos) => {
        addChildToTip({ tag: "left_single_quote", text: "'" }, pos);
      },

      right_single_quote: (suffixes, startpos, endpos, pos) => {
        addChildToTip({ tag: "right_single_quote", text: "'" }, pos);
      },

      left_double_quote: (suffixes, startpos, endpos, pos) => {
        addChildToTip({ tag: "left_double_quote", text: '"' }, pos);
      },

      right_double_quote: (suffixes, startpos, endpos, pos) => {
        addChildToTip({ tag: "right_double_quote", text: '"' }, pos);
      },

      ellipses: (suffixes, startpos, endpos, pos) => {
        addChildToTip({ tag: "ellipses", text: "..." }, pos);
      },

      en_dash: (suffixes, startpos, endpos, pos) => {
        addChildToTip({ tag: "en_dash", text: "--" }, pos);
      },

      em_dash: (suffixes, startpos, endpos, pos) => {
        addChildToTip({ tag: "em_dash", text: "---" }, pos);
      },

      // We set the blanklines property of a parent list or
      // sublist to aid with tight/loose list determination.
      blankline: (suffixes, startpos, endpos, pos) => {
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
      }

    };

  const handleEvent = function(containers: Container[], event: Event): void {
    let sp ;
    let ep ;
    let pos ;
    if (options.sourcePositions) {
      sp = getSourceLoc(event.startpos);
      ep = getSourceLoc(event.endpos);
      pos = { start: sp, end: ep };
    }
    let annot = event.annot;
    let suffixes: string[] = [];
    if (event.annot.includes("|")) {
      const parts = event.annot.split("|");
      annot = parts[0];
      suffixes = parts.slice(1);
    }

    // The following is for tight/loose determination.
    // If blanklines have already been seen, and we're
    // about to process something other than a blankline,
    // the end of a list or list item, or the start of
    // a list, then it's a loose list.
    if (annot !== "blankline") {
      let ln;
      const top = topContainer();
      if (top) {
        if (top.data && "tight" in top.data) {
          ln = top;
        } else if (containers.length >= 2 &&
          "tight" in containers[containers.length - 2].data) {
          ln = containers[containers.length - 2];
        }
      }
      if (ln) {
        if (!/^[+-]list/.test(annot) && ln.data.blanklines) {
          ln.data.tight = false;
        }
        if (!/^[-+]list_item$/.test(annot)) {
          ln.data.blanklines = false;
        }
      }
    }

    const fn = handlers[annot];
    if (fn) {
      fn(suffixes, event.startpos, event.endpos, pos);
    }

  }

  const containers: Container[] =
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
    popContainer(lastloc && {start: lastloc, end: lastloc});
    addChildToTip({
      tag: "section",
      children: pnode.children,
      attributes: pnode.attributes
    }, pnode.pos);
    pnode = topContainer();
  }

  const doc: Doc =
  {
    tag: "doc",
    references: references,
    footnotes: footnotes,
    children: containers[0].children,
  };
  if (containers[0].attributes) {
    doc.attributes = containers[0].attributes;
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

const stringify = function(x : any) : string {
  return JSON.stringify(x).replace("\n","n");
}

const renderAstNode = function(node: Record<string, any>, buff: string[], indent: number): void {
  buff.push(" ".repeat(indent));
  if (indent > 128) {
    buff.push("(((DEEPLY NESTED CONTENT OMITTED)))\n");
    return;
  }

  buff.push(node.tag);
  if (node.pos) {
    buff.push(` (${node.pos.start.line}:${node.pos.start.col}:${node.pos.start.offset}-${node.pos.end.line}:${node.pos.end.col}:${node.pos.end.offset})`);
  }
  for (const k in node) {
    if (!omitFields[k]) {
      const v: AstNode = node[k];
      if (v !== undefined && v !== null) {
        buff.push(` ${k}=${stringify(v)}`);
      }
    }
  }
  if (node.attributes) {
    for (const k in node.attributes) {
      buff.push(` ${k}=${stringify(node.attributes[k])}`);
    }
  }
  buff.push("\n");
  if (node.children) {
    node.children.forEach((child: AstNode) => {
      renderAstNode(child, buff, indent + 2);
    });
  }
}

// Render an AST in human-readable form, with indentation
// showing the hierarchy.
const renderAST = function(doc: Doc): string {
  const buff: string[] = [];
  renderAstNode(doc, buff, 0)
  if (Object.keys(doc.references).length > 0) {
    buff.push("references\n");
    for (const k in doc.references) {
      buff.push(`  [${stringify(k)}] =\n`);
      renderAstNode(doc.references[k], buff, 4);
    }
  }
  if (Object.keys(doc.footnotes).length > 0) {
    buff.push("footnotes\n")
    for (const k in doc.footnotes) {
      buff.push(`  [${stringify(k)}] =\n`);
      renderAstNode(doc.footnotes[k], buff, 4)
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
  Symb,
  Verbatim,
  RawInline,
  Math,
  Url,
  Email,
  FootnoteReference,
  LeftSingleQuote,
  RightSingleQuote,
  LeftDoubleQuote,
  RightDoubleQuote,
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
  AstNode,
  Doc,
  Reference,
  Footnote
}
