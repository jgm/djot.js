import { Event } from "./event.js";
import { EventParser } from "./block.js";

// Types for the AST

interface HasAttributes {
  attributes?: Record<string, string>;
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
            | Strikeout ;

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

interface Strikeout extends HasAttributes, HasInlineChildren {
  tag: "strikeout";
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

interface ParseOptions {
  sourcePositions?: boolean;
  warn?: (message : string, pos : number) => void;
}

const parse = function(input : string, options : ParseOptions) : Doc {
  const references : Record<string, Reference> = {};
  const footnotes : Record<string, Footnote> = {};
  const identifiers : Record<string, boolean> = {}; // identifiers used
  const defaultWarnings = function(message : string, pos : number) {
    process.stderr.write(message + (pos ? " at " + pos : "") + "\n");
  }
  const warn = options.warn || defaultWarnings;
  const parser = new EventParser(input, warn);

  const handleEvent = function(containers : Node[], event : Event) : void {
    console.log(event); // TODO
  }

  const doc : Doc =
              { tag: "doc",
                references: references,
                footnotes: footnotes,
                children: []
              };

  let containers : Node[] = [doc];

  for (const event of parser) {
    handleEvent(containers, event);
  }

  // close any open containers
  while (containers.length > 1) {
    let node = containers.pop()
    // addChildToTip(containers, node) // TODO
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
