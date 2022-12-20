import { Event } from "./event.js";
import { EventParser } from "./block.js";

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

interface List extends HasAttributes {
  tag: "list";
  children: ListItem[];
  // TODO
}

interface Table extends HasAttributes {
  tag: "table";
  children: Row[];
  // TODO
}

type Inline = Str
            | SoftBreak
            | HardBreak
            | Emoji
            | Verbatim
            | InlineMath
            | DisplayMath
            | Url
            | Email
            | FootnoteReference
            | RightSingleQuote
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

interface Emoji extends HasAttributes {
  tag: "emoji";
  alias: string;
}

interface Verbatim extends HasAttributes {
  tag: "verbatim";
  text: string;
}

interface InlineMath extends HasAttributes {
  tag: "inline_math";
  text: string;
}

interface DisplayMath extends HasAttributes {
  tag: "display_math";
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
  tag: "table_row";
  children: Cell[];
  // TODO
}

interface Cell extends HasAttributes, HasBlockChildren {
  tag: "table_cell";
  // TODO
}

type Node = Doc | Block | Inline | ListItem | Row | Cell ;

interface Reference {

}

interface Footnote {

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

const addStringContent = function(node : Inline, buffer : string[]) : void {
  if ("text" in node) {
    buffer.push(node.text);
  } else if (node.tag === "softbreak") {
    buffer.push("\n");
  } else if ("children" in node) {
    node.children.forEach(child => {
      addStringContent(child, buffer);
    });
  }
}

const getStringContent = function(node : Inline) : string {
  let buffer : string[] = [];
  addStringContent(node, buffer);
  return buffer.join('');
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
  const getTip = function() : Container {
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
          let tip = getTip();
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
        break;

      case "-linktext":
        // we don't pop yet, but wait for -destination
        break;

      case "+imagetext":
        pushContainer(sp);
        break;

      case "-imagetext":
        // we don't pop yet, but wait for -destination
        break;

      case "+destination":
        context = Context.Literal;
        break;

      case "-destination":
        node = popContainer(ep);  // the container added by +linktext/+imagetext
        addChildToTip({tag: "link",
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
        addChildToTip({tag: "link",
                       reference: accumulatedText.join(""),
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
        addChildToTip({tag: "verbatim", text: accumulatedText.join("")}, node.pos);
        context = Context.Normal;
        accumulatedText = [];
        break;

      case "+inline_math":
        context = Context.Verbatim;
        pushContainer(sp);
        break;

      case "-inline_math":
        node = popContainer(ep);
        addChildToTip({tag: "inline_math", text: accumulatedText.join("")}, node.pos);
        context = Context.Normal;
        accumulatedText = [];
        break;

      case "+display_math":
        context = Context.Verbatim;
        pushContainer(sp);
        break;

      case "-display_math":
        node = popContainer(ep);
        addChildToTip({tag: "display_math", text: accumulatedText.join("")}, node.pos);
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

      case "+code_block":
        pushContainer(sp);
        context = Context.Verbatim;
        break;

      case "-code_block":
        node = popContainer(ep);
        addChildToTip({tag: "code_block",
                       text: accumulatedText.join(""),
                       lang:  node.data.lang,
                       attributes: node.attributes }, node.pos);

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
  Doc,
  renderAST
}
