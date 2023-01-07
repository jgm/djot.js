// Types defining the AST

type Attributes = Record<string, string>;

type SourceLoc = {
  line: number,
  col: number,
  offset: number }

type Pos = {
  start: SourceLoc,
  end: SourceLoc
}

interface HasAttributes {
  attributes?: Attributes;
  pos?: Pos;
}

interface HasChildren<A> {
  children: A[];
}

interface HasText {
  text: string;
}

type Block =
  | Para
  | Heading
  | ThematicBreak
  | Section
  | Div
  | CodeBlock
  | RawBlock
  | BlockQuote
  | OrderedList
  | BulletList
  | TaskList
  | DefinitionList
  | Table
  ;

interface Para extends HasAttributes {
  tag: "para";
  children: Inline[];
}

interface Heading extends HasAttributes {
  tag: "heading";
  level: number;
  children: Inline[];
}

interface ThematicBreak extends HasAttributes {
  tag: "thematic_break";
}

interface Section extends HasAttributes {
  tag: "section";
  children: Block[];
}

interface Div extends HasAttributes {
  tag: "div";
  children: Block[];
}

interface BlockQuote extends HasAttributes {
  tag: "block_quote";
  children: Block[];
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

interface BulletList extends HasAttributes {
  tag: "bullet_list";
  tight: boolean;
  style: BulletListStyle;
  children: ListItem[];
}

type BulletListStyle =
  "+" | "-" | "*" ;

interface ListItem extends HasAttributes {
  tag: "list_item";
  children: Block[];
}

interface TaskList extends HasAttributes {
  tag: "task_list";
  tight: boolean;
  children: TaskListItem[];
}

interface TaskListItem extends HasAttributes {
  tag: "task_list_item";
  checkbox: CheckboxStatus;
  children: Block[];
}

type CheckboxStatus = "checked" | "unchecked";

interface OrderedList extends HasAttributes {
  tag: "ordered_list";
  style: OrderedListStyle;
  tight: boolean;
  start?: number;
  children: ListItem[];
}

type OrderedListStyle =
  | "1." | "1)" | "(1)"
  | "a." | "a)" | "(a)"
  | "A." | "A)" | "(A)"
  | "i." | "i)" | "(i)"
  | "I." | "I)" | "(I)";

interface Caption extends HasAttributes {
  tag: "caption";
  children: Inline[];
}

interface Table extends HasAttributes {
  tag: "table";
  children: [Caption, ...Row[]];
}

type Inline =
  | Str
  | SoftBreak
  | HardBreak
  | NonBreakingSpace
  | Symb
  | Verbatim
  | RawInline
  | InlineMath
  | DisplayMath
  | Url
  | Email
  | FootnoteReference
  | SmartPunctuation
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


type SmartPunctuationType =
  | "left_single_quote"
  |  "right_single_quote"
  | "left_double_quote"
  | "right_double_quote"
  | "ellipses"
  | "em_dash"
  | "en_dash"
  ;

interface SmartPunctuation extends HasAttributes {
  tag: "smart_punctuation";
  type: SmartPunctuationType;
  text: string;
}

interface SoftBreak extends HasAttributes {
  tag: "soft_break";
}

interface HardBreak extends HasAttributes {
  tag: "hard_break";
}

interface NonBreakingSpace extends HasAttributes {
  tag: "non_breaking_space";
}

interface Symb extends HasAttributes {
  tag: "symb";
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

interface Link extends HasAttributes {
  tag: "link";
  destination?: string;
  reference?: string;
  children: Inline[];
}

interface Image extends HasAttributes {
  tag: "image";
  destination?: string;
  reference?: string;
  children: Inline[];
}

interface Emph extends HasAttributes {
  tag: "emph";
  children: Inline[];
}

interface Strong extends HasAttributes {
  tag: "strong";
  children: Inline[];
}

interface Span extends HasAttributes {
  tag: "span";
  children: Inline[];
}

interface Mark extends HasAttributes {
  tag: "mark";
  children: Inline[];
}

interface Superscript extends HasAttributes {
  tag: "superscript";
  children: Inline[];
}

interface Subscript extends HasAttributes {
  tag: "subscript";
  children: Inline[];
}

interface Delete extends HasAttributes {
  tag: "delete";
  children: Inline[];
}

interface Insert extends HasAttributes {
  tag: "insert";
  children: Inline[];
}

interface DoubleQuoted extends HasAttributes {
  tag: "double_quoted";
  children: Inline[];
}

interface SingleQuoted extends HasAttributes {
  tag: "single_quoted";
  children: Inline[];
}

interface DefinitionList extends HasAttributes {
  tag: "definition_list";
  children: DefinitionListItem[];
}

interface DefinitionListItem extends HasAttributes {
  tag: "definition_list_item";
  children: [Term, Definition];
}

interface Term extends HasAttributes {
  tag: "term";
  children: Inline[];
}

interface Definition extends HasAttributes {
  tag: "definition";
  children: Block[];
}

interface Row extends HasAttributes {
  tag: "row";
  head: boolean;
  children: Cell[];
}

interface Cell extends HasAttributes {
  tag: "cell";
  head: boolean;
  align: Alignment;
  children: Inline[];
}

type Alignment =
  | "default"
  | "left"
  | "right"
  | "center"
  ;

interface Reference extends HasAttributes {
  tag: "reference";
  label: string;
  destination: string;
}

interface Footnote extends HasAttributes {
  tag: "footnote";
  label: string;
  children: Block[];
}

interface Doc extends HasAttributes {
  tag: "doc";
  references: Record<string, Reference>;
  footnotes: Record<string, Footnote>;
  children: Block[];
}

type AstNode = Doc
  | Block
  | Inline
  | ListItem
  | TaskListItem
  | DefinitionListItem
  | Term
  | Definition
  | Row
  | Cell
  | Caption
  | Footnote
  | Reference 
  ;

type Visitor<C, R> = {
  doc?: (node: Doc, context: C) => R;
  para?: (node: Para, context: C) => R;
  heading?: (node: Heading, context: C) => R;
  thematic_break?: (node: ThematicBreak, context: C) => R;
  section?: (node: Section, context: C) => R;
  div?: (node: Div, context: C) => R;
  code_block?: (node: CodeBlock, context: C) => R;
  raw_block?: (node: RawBlock, context: C) => R;
  block_quote?: (node: BlockQuote, context: C) => R;
  ordered_list?: (node: OrderedList, context: C) => R;
  bullet_list?: (node: BulletList, context: C) => R;
  task_list?: (node: TaskList, context: C) => R;
  definition_list?: (node: DefinitionList, context: C) => R;
  table?: (node: Table, context: C) => R;
  str?: (node: Str, context: C) => R;
  soft_break?: (node: SoftBreak, context: C) => R;
  hard_break?: (node: HardBreak, context: C) => R;
  non_breaking_space?: (node: NonBreakingSpace, context: C) => R;
  symb?: (node: Symb, context: C) => R;
  verbatim?: (node: Verbatim, context: C) => R;
  raw_inline?: (node: RawInline, context: C) => R;
  inline_math?: (node: InlineMath, context: C) => R;
  display_math?: (node: DisplayMath, context: C) => R;
  url?: (node: Url, context: C) => R;
  email?: (node: Email, context: C) => R;
  footnote_reference?: (node: FootnoteReference, context: C) => R;
  smart_punctuation?: (node: SmartPunctuation, context: C) => R;
  emph?: (node: Emph, context: C) => R;
  strong?: (node: Strong, context: C) => R;
  link?: (node: Link, context: C) => R;
  image?: (node: Image, context: C) => R;
  span?: (node: Span, context: C) => R;
  mark?: (node: Mark, context: C) => R;
  superscript?: (node: Superscript, context: C) => R;
  subscript?: (node: Subscript, context: C) => R;
  insert?: (node: Insert, context: C) => R;
  delete?: (node: Delete, context: C) => R;
  double_quoted?: (node: DoubleQuoted, context: C) => R;
  single_quoted?: (node: SingleQuoted, context: C) => R;
  list_item?: (node: ListItem, context: C) => R;
  task_list_item?: (node: TaskListItem, context: C) => R;
  definition_list_item?: (node: DefinitionListItem, context: C) => R;
  term?: (node: Term, context: C) => R;
  definition?: (node: Definition, context: C) => R;
  row?: (node: Row, context: C) => R;
  cell?: (node: Cell, context: C) => R;
  caption?: (node: Caption, context: C) => R;
  footnote?: (node: Footnote, context: C) => R;
  reference?: (node: Reference, context: C) => R;
};

/* Type predicates */

const blockTags : Record<string, boolean> = {
  para: true,
  heading: true,
  block_quote: true,
  thematic_break: true,
  section: true,
  div: true,
  code_block: true,
  raw_block: true,
  bullet_list: true,
  ordered_list: true,
  task_list: true,
  definition_list: true,
  table: true,
  reference: true,
  footnote: true
};

function isBlock(node : AstNode) : node is Block {
  return blockTags[node.tag] || false;
}

const inlineTags : Record<string, boolean> = {
  str: true,
  soft_break: true,
  hard_break: true,
  non_breaking_space: true,
  symb: true,
  verbatim: true,
  raw_inline: true,
  inline_math: true,
  display_math: true,
  url: true,
  email: true,
  footnote_reference: true,
  smart_punctuation: true,
  emph: true,
  strong: true,
  link: true,
  image: true,
  span: true,
  mark: true,
  superscript: true,
  subscript: true,
  insert: true,
  delete: true,
  double_quoted: true,
  single_quoted: true,
};

function isInline(node : AstNode) : node is Inline {
  return inlineTags[node.tag] || false;
}

function isRow(node : Row | Caption) : node is Row {
  return ("head" in node);
}

function isCaption(node : Row | Caption) : node is Caption {
  return (!("head" in node));
}


export type {
  Attributes,
  SourceLoc,
  Pos,
  HasAttributes,
  HasChildren,
  HasText,
  Block,
  Para,
  Heading,
  ThematicBreak,
  Section,
  Div,
  CodeBlock,
  RawBlock,
  BlockQuote,
  BulletList,
  BulletListStyle,
  OrderedList,
  OrderedListStyle,
  ListItem,
  TaskList,
  TaskListItem,
  CheckboxStatus,
  DefinitionList,
  DefinitionListItem,
  Term,
  Definition,
  Table,
  Caption,
  Row,
  Cell,
  Alignment,
  Inline,
  Str,
  SoftBreak,
  HardBreak,
  NonBreakingSpace,
  Symb,
  Verbatim,
  RawInline,
  InlineMath,
  DisplayMath,
  Url,
  Email,
  FootnoteReference,
  SmartPunctuationType,
  SmartPunctuation,
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
  AstNode,
  Doc,
  Reference,
  Footnote,
  Visitor,
}
export {
  isInline,
  isBlock,
  isRow,
  isCaption
}
