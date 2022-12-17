import { Event } from "./event.js";
import { EventParser } from "./block.js";

// Types for the AST

type Block = Para
//           | BlockQuote
//           | ThematicBreak
//           | List
//           | Table
           | Heading ;

type Inline = Str
//            | SoftBreak
//            | HardBreak
//            | Emph
//            | Strong
//            | Link
//            | Image
//            | Span
//            | Mark
//            | Insert
//            | Delete
//            | Strikeout
            | Emoji ;

interface Doc {
  tag: "doc";
  children: Block[];
  references: Record<string, Reference>;
  footnotes: Record<string, Footnote>;
}

interface Para {
  tag: "para";
  children: Inline[];
}

interface Heading {
  tag: "heading";
  children: Inline[];
}


interface Str {
  tag: "str";
  text: string;
}

interface Emoji {
  tag: "emoji";
  text: string;
}

interface Reference {

}

interface Footnote {

}

class Parser {

}

export { Parser }
