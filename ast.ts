import { Event } from "./event.js";
import { EventParser } from "./block.js";

// Types for the AST

type Attributes = Record<string, string>;

interface HasAttributes {
  attributes?: Attributes;
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

interface BlockQuote extends HasAttributes, HasBlockChildren {
  tag: "block_quote";
  children: Block[];
}

interface List extends HasAttributes {
  tag: "list";
  children: ListItem[];
  // TODO
}

interface Table extends HasAttributes {
  tag: "table";
  children: TableRow[];
  // TODO
}

type Inline = Str
            | SoftBreak
            | HardBreak
            | Emoji
            | Emph
            | Strong
            | Link
            | Image
            | Span
            | Mark
            | Insert
            | Delete
            ;

interface Str {
  tag: "str";
  text: string;
}

interface SoftBreak {
  tag: "softbreak";
}

interface HardBreak {
  tag: "hardbreak";
}

interface Emoji extends HasAttributes {
  tag: "emoji";
  alias: string;
}

interface Link extends HasAttributes, HasInlineChildren {
  tag: "link";
  destination: string;
}

interface Image extends HasAttributes, HasInlineChildren {
  tag: "image";
  destination: string;
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

interface Delete extends HasAttributes, HasInlineChildren {
  tag: "delete";
}

interface Insert extends HasAttributes, HasInlineChildren {
  tag: "insert";
}

interface ListItem extends HasAttributes, HasBlockChildren {
  tag: "list_item";
  // TODO
}

interface TableRow {
  tag: "table_row";
  children: TableCell[];
  // TODO
}

interface TableCell extends HasBlockChildren {
  tag: "table_cell";
  // TODO
}

type Node = Doc | Block | Inline | ListItem | TableRow | TableCell;

interface Reference {

}

interface Footnote {

}

interface Doc extends HasBlockChildren, HasAttributes {
  tag: "doc";
  references: Record<string, Reference>;
  footnotes: Record<string, Footnote>;
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

const addChildToTip = function(containers : any[], child : any) : void {
  /*
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
  let tip = containers[containers.length - 1];
  if (!tip) {
    throw("Container stack is empty!");
  }
  tip.children.push(child);
}

interface ParseOptions {
  sourcePositions?: boolean;
  warn?: (message : string, pos : number) => void;
}

const parse = function(input : string, options : ParseOptions) : Doc {
  const references : Record<string, Reference> = {};
  const footnotes : Record<string, Footnote> = {};
  const identifiers : Record<string, boolean> = {}; // identifiers used
  const attributes : Attributes = {}; // accumulated block attributes
  const defaultWarnings = function(message : string, pos : number) {
    process.stderr.write(message + (pos ? " at " + pos : "") + "\n");
  }
  const warn = options.warn || defaultWarnings;
  const parser = new EventParser(input, warn);
  const pushContainer = function(container : any) {
      containers.push(container);
  };
  const popContainer = function() {
      let node = containers.pop();
      if (node) {
        addChildToTip(containers, node);
      }
    };

  const handleEvent = function(containers : any[], event : Event) : void {
    switch (event.annot) {
      case "str":
        let txt = input.substring(event.startpos, event.endpos + 1);
        addChildToTip(containers, {tag: "str", text: txt});
        break;
      case "softbreak":
        addChildToTip(containers, {tag: "softbreak"});
        break;
      case "escape":
        break;
      case "hardbreak":
        addChildToTip(containers, {tag: "hardbreak"});
        break;
      case "emoji":
        let alias = input.substring(event.startpos + 1, event.endpos);
        addChildToTip(containers, {tag: "emoji", alias: alias});
        break;
      case "+emph":
        pushContainer({tag: "emph", children: []});
        break;
      case "-emph":
        popContainer();
        break;
      case "+strong":
        pushContainer({tag: "strong", children: []});
        break;
      case "-strong":
        popContainer();
        break;
      case "+span":
        pushContainer({tag: "span", children: []});
        break;
      case "-span":
        popContainer();
        break;
      case "+mark":
        pushContainer({tag: "mark", children: []});
        break;
      case "-mark":
        popContainer();
        break;
      case "+delete":
        pushContainer({tag: "delete", children: []});
        break;
      case "-delete":
        popContainer();
        break;
      case "+insert":
        pushContainer({tag: "insert", children: []});
        break;
      case "-insert":
        popContainer();
        break;
      case "+linktext":
        pushContainer({tag: "link", destination: "", children: []});
        break;
      case "-linktext":
        // leave on container stack and await destination
        break;
      case "+destination":
        pushContainer({tag: "destination", destination: "", children: []});
        break;
      case "-destination":
        let dest = containers.pop();
        if (dest) {
          containers[containers.length - 1].destination = getStringContent(dest);
          popContainer();
        }
        break;
      case "+linktext": // can just ignore this, children go to link container
        break;
      case "-linktext":
        break;
      case "+para":
        pushContainer({tag: "para", children: []});
        break;
      case "-para":
        popContainer();
        break;
      case "+heading":
        pushContainer({tag: "heading",
                       level: 1 + event.endpos - event.startpos,
                       children: []});
        break;
      case "-heading":
        popContainer();
        break;
      case "+blockquote":
        pushContainer({tag: "blockquote", children: []});
        break;
      case "-blockquote":
        popContainer();
        break;
      case "thematic_break":
        addChildToTip(containers, {tag: "thematic_break"});
        break;
      case "right_single_quote":
        addChildToTip(containers, {tag: "right_single_quote", str: "'"});
        break;
      case "blankline":
        break;
      default:
        throw("Unknown event " + event.annot);
    }
  }

  const doc : Doc =
              { tag: "doc",
                references: references,
                footnotes: footnotes,
                children: []
              };

  let containers : any[] = [doc];

  for (const event of parser) {
    handleEvent(containers, event);
  }

  // close any open containers
  while (containers.length > 1) {
    let node = containers.pop();
    // addChildToTip(containers, node);
    // note: doc container doesn't have pos, so we check: // TODO
    // if (sourceposmap && containers[containers.length - 1].pos) {
    //   containers[#containers].pos[2] = node.pos[2]
    // }
  }
  // doc = addSections(doc); // TODO

  return doc;
}

export {
  parse,
  ParseOptions,
  Doc
}
