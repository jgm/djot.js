import { Event } from "./event.js";
import { EventParser } from "./block.js";

// Types for the AST

interface HasAttributes {
  attributes: Record<string, string>;
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

interface Reference {

}

interface Footnote {

}

interface Doc {
  tag: "doc";
  children: Block[];
  references: Record<string, Reference>;
  footnotes: Record<string, Footnote>;
}

class Parser {

}

export { Parser }
