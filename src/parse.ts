import { Event } from "./event";
import { parseEvents } from "./block";
import { Options, Warning } from "./options";
import {
  Attributes,
  SourceLoc,
  Pos,
  HasAttributes,
  ThematicBreak,
  Term,
  Definition,
  AstNode,
  Doc,
  Reference,
  Footnote,
  isRow,
  isBlock,
  isCaption,
  isInline,
  Caption} from "./ast";

/* Types not used for defining the AST but for processing */

interface Container {
  children: any[];
  attributes?: Attributes;
  autoAttributes?: Attributes;
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
    (node.tag === "soft_break" || node.tag === "hard_break")) {
    buffer.push("\n");
  } else if ("children" in node) {
    for (const child of node.children) {
      addStringContent(child, buffer);
    }
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
      throw (new Error("Encountered bad character in roman numeral " + s));
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

interface ParseOptions extends Options {
  sourcePositions?: boolean;
}

// Parsing ocntext:
enum Context {
  Normal = 0,    // add str nodes as children of tip
  Verbatim = 1,  // gather str, escape, soft_break, hard_break in accumulatedText
  Literal = 2    // gather str, soft_break, hard_break in accumulatedText
}

const normalizeLabel = function(label : string): string {
  return label.trim().replace(/[ \t\r\n]+/g, " ")
}

const parse = function(input: string, options: ParseOptions = {}): Doc {

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
  let accumulatedText = "";
  const references: Record<string, Reference> = {};
  const autoReferences: Record<string, Reference> = {};
  const footnotes: Record<string, Footnote> = {};
  const identifiers: Record<string, boolean> = {}; // identifiers used
  const blockAttributes: Attributes = {}; // accumulated block attributes
  let listDepth = 0;
  const parser = parseEvents(input, options);
  const warn = options.warn || (() => {});
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
    const base =
      s.replace(/[\]\[~!@#$%^&*(){}`,.<>\\|=+/?\s]+/g, " ")
       .trim()
       .replace(/ +/g, "-");
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
      data: {},
      pos: pos,
      attributes: undefined
    };
    addBlockAttributes(container);
    containers.push(container);
  };
  const popContainer = function(pos?: Pos) {
    const node = containers.pop();
    if (!node) {
      throw (new Error("Container stack is empty (popContainer)"));
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
      throw (new Error("Container stack is empty (topContainer)"));
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

  const addChildToTip = function(child: AstNode) : void {
    if (containers.length > 0) {
      const tip = containers[containers.length - 1];
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
          addChildToTip({ tag: "str", text: txt, pos: pos});
        } else {
          accumulatedText += txt;
        }
      },
      soft_break: (suffixes, startpos, endpos, pos) => {
        if (context === Context.Normal) {
          addChildToTip({ tag: "soft_break", pos: pos});
        } else {
          accumulatedText += "\n";
        }
      },

      escape: (suffixes, startpos, endpos, pos) => {
        if (context === Context.Verbatim) {
          accumulatedText += "\\";
        }
      },

      hard_break: (suffixes, startpos, endpos, pos) => {
        if (context === Context.Normal) {
          addChildToTip({ tag: "hard_break", pos: pos});
        } else {
          accumulatedText += "\n";
        }
      },

      non_breaking_space: (suffixes, startpos, endpos, pos) => {
        if (context === Context.Verbatim) {
          accumulatedText += "\\ ";
        } else {
          addChildToTip({ tag: "non_breaking_space", pos: pos});
        }
      },

      symb: (suffixes, startpos, endpos, pos) => {
        if (context === Context.Normal) {
          const alias = input.substring(startpos + 1, endpos);
          addChildToTip({ tag: "symb", alias: alias, pos: pos});
        } else {
          const txt = input.substring(startpos, endpos + 1);
          accumulatedText += txt;
        }
      },

      footnote_reference: (suffixes, startpos, endpos, pos) => {
        const fnref = input.substring(startpos + 2, endpos);
        addChildToTip({ tag: "footnote_reference",
	  text: normalizeLabel(fnref), pos: pos});
      },

      ["+reference_definition"]: (suffixes, startpos, endpos, pos) => {
        pushContainer(pos);
      },

      ["-reference_definition"]: (suffixes, startpos, endpos, pos) => {
        const node = popContainer(pos);
	const lab = normalizeLabel(node.data.key);
        const r: Reference = {
          tag: "reference",
          label: lab,
          destination: node.data.value || "",
          attributes: node.attributes,
          pos: node.pos,
        };
        if (node.data.key) {
          references[lab] = r;
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
        addChildToTip({ tag: "emph", children: node.children, pos: node.pos});
      },

      ["+strong"]: (suffixes, startpos, endpos, pos) => {
        pushContainer(pos);
      },

      ["-strong"]: (suffixes, startpos, endpos, pos) => {
        const node = popContainer(pos);
        addChildToTip({ tag: "strong", children: node.children, pos: node.pos});
      },

      ["+span"]: (suffixes, startpos, endpos, pos) => {
        pushContainer(pos);
      },

      ["-span"]: (suffixes, startpos, endpos, pos) => {
        const node = popContainer(pos);
        addChildToTip({ tag: "span", children: node.children, pos: node.pos});
      },

      ["+mark"]: (suffixes, startpos, endpos, pos) => {
        pushContainer(pos);
      },

      ["-mark"]: (suffixes, startpos, endpos, pos) => {
        const node = popContainer(pos);
        addChildToTip({ tag: "mark", children: node.children, pos: node.pos});
      },

      ["+superscript"]: (suffixes, startpos, endpos, pos) => {
        pushContainer(pos);
      },

      ["-superscript"]: (suffixes, startpos, endpos, pos) => {
        const node = popContainer(pos);
        addChildToTip({ tag: "superscript", children: node.children, pos: node.pos});
      },

      ["+subscript"]: (suffixes, startpos, endpos, pos) => {
        pushContainer(pos);
      },

      ["-subscript"]: (suffixes, startpos, endpos, pos) => {
        const node = popContainer(pos);
        addChildToTip({ tag: "subscript", children: node.children, pos: node.pos});
      },

      ["+delete"]: (suffixes, startpos, endpos, pos) => {
        pushContainer(pos);
      },

      ["-delete"]: (suffixes, startpos, endpos, pos) => {
        const node = popContainer(pos);
        addChildToTip({ tag: "delete", children: node.children, pos: node.pos});
      },

      ["+insert"]: (suffixes, startpos, endpos, pos) => {
        pushContainer(pos);
      },

      ["-insert"]: (suffixes, startpos, endpos, pos) => {
        const node = popContainer(pos);
        addChildToTip({ tag: "insert", children: node.children, pos: node.pos});
      },

      ["+double_quoted"]: (suffixes, startpos, endpos, pos) => {
        pushContainer(pos);
      },

      ["-double_quoted"]: (suffixes, startpos, endpos, pos) => {
        const node = popContainer(pos);
        addChildToTip({ tag: "double_quoted", children: node.children, pos: node.pos});
      },

      ["+single_quoted"]: (suffixes, startpos, endpos, pos) => {
        pushContainer(pos);
      },

      ["-single_quoted"]: (suffixes, startpos, endpos, pos) => {
        const node = popContainer(pos);
        addChildToTip({ tag: "single_quoted", children: node.children, pos: node.pos});
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
              addChildToTip({ tag: "str", text: m[0], pos: wordpos});
            } else if (!m) {
              endsWithSpace = true;
            }
          }
          tip = getTip(); // get new tip, which may be the new element
          if (endsWithSpace) {
            warn(new Warning("Ignoring unattached attribute",
                          options.sourcePositions ?
                            getSourceLoc(startpos) : startpos));
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
          .replace(/\\([.,\\/#!$%^&*;:{}=\-_`~+[\]()'"?|])/g, "$1");
        // resolve backslash escapes
        if (!top.attributes) {
          top.attributes = {};
        }
        if (top.data.key) {
          top.attributes[top.data.key] = // append multiple values to key
            top.attributes[top.data.key] + val;
        } else {
          throw (new Error("Encountered value without key"));
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
          destination: accumulatedText.replace(/[\r\n]/g,""),
          children: node.children,
          pos: node.pos});
        context = Context.Normal;
        accumulatedText = "";
      },

      ["+reference"]: (suffixes, startpos, endpos, pos) => {
        context = Context.Literal;
      },

      ["-reference"]: (suffixes, startpos, endpos, pos) => {
        const node = popContainer(pos);  // the container added by +linktext
        let ref = accumulatedText;
        if (ref.length === 0) {
          ref = getStringContent(node);
        }
        addChildToTip({
          tag: node.data.isimage ? "image" : "link",
          reference: normalizeLabel(ref),
          children: node.children,
          pos: node.pos});
        context = Context.Normal;
        accumulatedText = "";
      },

      ["+verbatim"]: (suffixes, startpos, endpos, pos) => {
        context = Context.Verbatim;
        pushContainer(pos);
      },

      ["-verbatim"]: (suffixes, startpos, endpos, pos) => {
        const node = popContainer(pos);
        addChildToTip({
          tag: "verbatim",
          text: trimVerbatim(accumulatedText),
          pos: node.pos});
        context = Context.Normal;
        accumulatedText = "";
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
            throw (new Error("raw_format is not after verbatim or code_block."));
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
          tag: "display_math",
          text: trimVerbatim(accumulatedText),
          pos: node.pos});
        context = Context.Normal;
        accumulatedText = "";
      },

      ["-inline_math"]: (suffixes, startpos, endpos, pos) => {
        const node = popContainer(pos);
        addChildToTip({
          tag: "inline_math",
          text: trimVerbatim(accumulatedText),
          pos: node.pos});
        context = Context.Normal;
        accumulatedText = "";
      },

      ["+url"]: (suffixes, startpos, endpos, pos) => {
        context = Context.Literal;
        pushContainer(pos);
      },

      ["-url"]: (suffixes, startpos, endpos, pos) => {
        const node = popContainer(pos);
        addChildToTip({ tag: "url",
                        text: accumulatedText.replace(/[\r\n]/g,""),
                        pos: node.pos});
        context = Context.Normal;
        accumulatedText = "";
      },

      ["+email"]: (suffixes, startpos, endpos, pos) => {
        context = Context.Literal;
        pushContainer(pos);
      },

      ["-email"]: (suffixes, startpos, endpos, pos) => {
        const node = popContainer(pos);
        addChildToTip({ tag: "email",
                        text: accumulatedText.replace(/[\r\n]/g,""),
                        pos: node.pos});
        context = Context.Normal;
        accumulatedText = "";
      },

      ["+para"]: (suffixes, startpos, endpos, pos) => {
        pushContainer(pos);
      },

      ["-para"]: (suffixes, startpos, endpos, pos) => {
        const node = popContainer(pos);
        addChildToTip({
          tag: "para",
          children: node.children,
          attributes: node.attributes,
          pos: node.pos});
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

        if (!node.autoAttributes) {
          node.autoAttributes = {}
        }
        const headingStr = getStringContent(node).trim();

        if (!node.attributes.id) {
          node.autoAttributes.id = getUniqueIdentifier(headingStr);
          identifiers[node.autoAttributes.id] = true;
        }
        // add implicit heading reference
	const lab = normalizeLabel(headingStr);
        if (!references[lab] && !autoReferences[lab]) {
          autoReferences[lab] = {
            tag: "reference",
            label: lab,
            destination: "#" + (node.attributes.id||node.autoAttributes.id)
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
              attributes: pnode.attributes,
              autoAttributes: pnode.autoAttributes,
              pos: pnode.pos});
            pnode = topContainer();
          }
          // now we know that pnode.data.headinglevel is either
          // undefined or < node.data.level
          pushContainer(pos);
          topContainer().data.headinglevel = node.data.level;
          // move id attribute from heading to section
          if (node.autoAttributes && node.autoAttributes.id) {
            topContainer().autoAttributes = node.autoAttributes;
            delete node.autoAttributes;
          }
          if (node.attributes && node.attributes.id) {
            topContainer().attributes = node.attributes;
            delete node.attributes;
          }
        }
        addChildToTip({
          tag: "heading",
          level: node.data.level,
          children: node.children,
          attributes: node.attributes,
          autoAttributes: node.autoAttributes,
          pos: node.pos});
      },

      ["+list"]: (suffixes, startpos, endpos, pos) => {
        pushContainer(pos);
        topContainer().data.styles = suffixes;
        topContainer().data.blanklines = false;
        topContainer().data.tight = true;
        listDepth++;
      },

      ["-list"]: (suffixes, startpos, endpos, pos) => {
        const node = popContainer(pos);
        // take first if ambiguous
        const listStyle = node.data.styles[0];
        if (!listStyle) {
          throw (new Error("No style defined for list"));
        }
        const listStart = getListStart(node.data.firstMarker, listStyle);
        if (listStyle === ":") {
          addChildToTip({
            tag: "definition_list",
            children: node.children,
            attributes: node.attributes,
            autoAttributes: node.autoAttributes,
            pos: node.pos});
        } else if (listStyle === "X") {
          addChildToTip({
            tag: "task_list",
            tight: node.data.tight,
            children: node.children,
            attributes: node.attributes,
            autoAttributes: node.autoAttributes,
            pos: node.pos});
        } else if (listStyle === "+" || listStyle === "*" ||
                   listStyle === "-") {
          addChildToTip({
            tag: "bullet_list",
            tight: node.data.tight,
            style: listStyle,
            children: node.children,
            attributes: node.attributes,
            autoAttributes: node.autoAttributes,
            pos: node.pos});
        } else {
          addChildToTip({
            tag: "ordered_list",
            style: listStyle,
            children: node.children,
            start: listStart,
            tight: node.data.tight,
            attributes: node.attributes,
            autoAttributes: node.autoAttributes,
            pos: node.pos});
        }
        listDepth--;
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
              attributes: node.attributes,
              autoAttributes: node.autoAttributes,
              pos: node.pos});
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
              attributes: node.attributes,
              autoAttributes: node.autoAttributes,
              pos: node.pos});
          }
        } else if (node.data.checkbox) {
          addChildToTip({
            tag: "task_list_item",
            children: node.children,
            attributes: node.attributes,
            autoAttributes: node.autoAttributes,
            checkbox: node.data.checkbox,
            pos: node.pos});
        } else {
          addChildToTip({
            tag: "list_item",
            children: node.children,
            attributes: node.attributes,
            autoAttributes: node.autoAttributes,
            pos: node.pos});
        }
      },

      checkbox_checked: (suffixes, startpos, endpos, pos) => {
        topContainer().data.checkbox = "checked";
      },

      checkbox_unchecked: (suffixes, startpos, endpos, pos) => {
        topContainer().data.checkbox = "unchecked";
      },

      ["+block_quote"]: (suffixes, startpos, endpos, pos) => {
        pushContainer(pos);
      },

      ["-block_quote"]: (suffixes, startpos, endpos, pos) => {
        const node = popContainer(pos);
        addChildToTip({
          tag: "block_quote",
          children: node.children,
          attributes: node.attributes,
          autoAttributes: node.autoAttributes,
          pos: node.pos});
      },

      ["+table"]: (suffixes, startpos, endpos, pos) => {
        pushContainer(pos);
        topContainer().data.aligns = [];
      },

      ["-table"]: (suffixes, startpos, endpos, pos) => {
        const node = popContainer(pos);
        const rows = node.children;
        let caption: Caption = {
          tag: "caption",
          children: []
        };
        if (rows[0]?.tag === "caption") {
          caption = rows.shift();
        }
        addChildToTip({
          tag: "table",
          children: [caption, ...rows],
          attributes: node.attributes,
          autoAttributes: node.autoAttributes,
          pos: node.pos});
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
              tip.children[i].align = node.data.aligns[i] || "default";
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
            attributes: node.attributes,
            autoAttributes: node.autoAttributes,
            pos: node.pos});
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
          attributes: node.attributes,
          autoAttributes: node.autoAttributes,
          pos: node.pos});
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
        const capt =  {
            tag: "caption",
            children: node.children,
            attributes: node.attributes,
            autoAttributes: node.autoAttributes,
            pos: node.pos
          };
        if (tip.children[0]?.tag === "caption") {
          tip.children[0] = capt;
        }
      },

      ["+footnote"]: (suffixes, startpos, endpos, pos) => {
        pushContainer(pos);
      },

      ["-footnote"]: (suffixes, startpos, endpos, pos) => {
        const node = popContainer(pos);
        if (node.data.label) {
	  const lab = normalizeLabel(node.data.label);
          footnotes[lab] =
          {
            tag: "footnote",
            label: lab || "",
            children: node.children,
            attributes: node.attributes,
            autoAttributes: node.autoAttributes,
            pos: node.pos
          };
        } else {
          warn(new Warning("Ignoring footnote without a label.",
                          options.sourcePositions ?
                            getSourceLoc(endpos) : endpos));
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
            text: accumulatedText,
            attributes: node.attributes,
            autoAttributes: node.autoAttributes,
            pos: node.pos});
        } else {
          addChildToTip({
            tag: "code_block",
            text: accumulatedText,
            lang: node.data.lang,
            attributes: node.attributes,
            autoAttributes: node.autoAttributes,
            pos: node.pos});
        }
        context = Context.Normal;
        accumulatedText = "";
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
          attributes: node.attributes,
          autoAttributes: node.autoAttributes,
          pos: node.pos});
      },

      thematic_break: (suffixes, startpos, endpos, pos) => {
        const tb: ThematicBreak = { tag: "thematic_break", pos: pos };
        addBlockAttributes(tb);
        addChildToTip(tb);
      },

      left_single_quote: (suffixes, startpos, endpos, pos) => {
        addChildToTip({ tag: "smart_punctuation",
                        type: "left_single_quote",
                        text: "'", pos: pos});
      },

      right_single_quote: (suffixes, startpos, endpos, pos) => {
        addChildToTip({ tag: "smart_punctuation",
                        type: "right_single_quote",
                        text: "'", pos: pos});
      },

      left_double_quote: (suffixes, startpos, endpos, pos) => {
        addChildToTip({ tag: "smart_punctuation",
                        type: "left_double_quote",
                        text: '"', pos});
      },

      right_double_quote: (suffixes, startpos, endpos, pos) => {
        addChildToTip({ tag: "smart_punctuation",
                        type: "right_double_quote",
                        text: '"', pos});
      },

      ellipses: (suffixes, startpos, endpos, pos) => {
        addChildToTip({ tag: "smart_punctuation",
                        type: "ellipses",
                        text: "...", pos});
      },

      en_dash: (suffixes, startpos, endpos, pos) => {
        addChildToTip({ tag: "smart_punctuation",
                        type: "en_dash",
                        text: "--" , pos});
      },

      em_dash: (suffixes, startpos, endpos, pos) => {
        addChildToTip({ tag: "smart_punctuation",
                        type: "em_dash",
                        text: "---", pos});
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
    if (listDepth > 0 && annot !== "blankline") {
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
      attributes: pnode.attributes,
      autoAttributes: pnode.autoAttributes,
      pos: pnode.pos});
    pnode = topContainer();
  }

  const doc: Doc =
  {
    tag: "doc",
    references: references,
    autoReferences: autoReferences,
    footnotes: footnotes,
    children: containers[0].children,
  };
  if (containers[0].autoAttributes) {
    doc.autoAttributes = containers[0].autoAttributes;
  }
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
  autoAttributes: true,
  references: true,
  autoReferences: true,
  footnotes: true
};

const stringify = function(x : any) : string {
  return JSON.stringify(x).replace(/\\\n/g,"\\n");
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
    for (const child of node.children) {
      renderAstNode(child, buff, indent + 2);
    }
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


export type {
  ParseOptions,
}
export {
  parse,
  renderAST,
  getStringContent,
  isBlock,
  isRow,
  isCaption,
  isInline,
}
