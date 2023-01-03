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
    Para
  | Heading
  | ThematicBreak
  | Section
  | Div
  | CodeBlock
  | RawBlock
  | BlockQuote
  | List
  | Table
  ;

interface Para extends HasAttributes, HasChildren<Inline> {
  tag: "para";
}

interface Heading extends HasAttributes, HasChildren<Inline> {
  tag: "heading";
  level: number;
}

interface ThematicBreak extends HasAttributes {
  tag: "thematic_break";
}

interface Section extends HasAttributes, HasChildren<Block> {
  tag: "section";
}

interface Div extends HasAttributes, HasChildren<Block> {
  tag: "div";
}

interface BlockQuote extends HasAttributes, HasChildren<Block> {
  tag: "blockquote";
}

interface CodeBlock extends HasAttributes, HasText {
  tag: "code_block";
  lang?: string;
}

interface RawBlock extends HasAttributes, HasText {
  tag: "raw_block";
  format: string;
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

interface Table extends HasAttributes {
  tag: "table";
  children: [Caption, ...Row[]];
}

type Inline =
    Str
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


interface Str extends HasAttributes, HasText {
  tag: "str";
}

interface FootnoteReference extends HasAttributes, HasText {
  tag: "footnote_reference";
}

interface LeftSingleQuote extends HasAttributes, HasText {
  tag: "left_single_quote";
}

interface RightSingleQuote extends HasAttributes, HasText {
  tag: "right_single_quote";
}

interface LeftDoubleQuote extends HasAttributes, HasText {
  tag: "left_double_quote";
}

interface RightDoubleQuote extends HasAttributes, HasText {
  tag: "right_double_quote";
}

interface Ellipses extends HasAttributes, HasText {
  tag: "ellipses";
}

interface EmDash extends HasAttributes, HasText {
  tag: "em_dash";
}

interface EnDash extends HasAttributes, HasText {
  tag: "en_dash";
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

interface Verbatim extends HasAttributes, HasText {
  tag: "verbatim";
}

interface RawInline extends HasAttributes, HasText {
  tag: "raw_inline";
  format: string;
}

interface Math extends HasAttributes, HasText {
  tag: "math";
  display: boolean;
}

interface Url extends HasAttributes, HasText {
  tag: "url";
}

interface Email extends HasAttributes, HasText {
  tag: "email";
}

interface Link extends HasAttributes, HasChildren<Inline> {
  tag: "link";
  destination?: string;
  reference?: string;
}

interface Image extends HasAttributes, HasChildren<Inline> {
  tag: "image";
  destination?: string;
  reference?: string;
}

interface Emph extends HasAttributes, HasChildren<Inline> {
  tag: "emph";
}

interface Strong extends HasAttributes, HasChildren<Inline> {
  tag: "strong";
}

interface Span extends HasAttributes, HasChildren<Inline> {
  tag: "span";
}

interface Mark extends HasAttributes, HasChildren<Inline> {
  tag: "mark";
}

interface Superscript extends HasAttributes, HasChildren<Inline> {
  tag: "superscript";
}

interface Subscript extends HasAttributes, HasChildren<Inline> {
  tag: "subscript";
}

interface Delete extends HasAttributes, HasChildren<Inline> {
  tag: "delete";
}

interface Insert extends HasAttributes, HasChildren<Inline> {
  tag: "insert";
}

interface DoubleQuoted extends HasAttributes, HasChildren<Inline> {
  tag: "double_quoted";
}

interface SingleQuoted extends HasAttributes, HasChildren<Inline> {
  tag: "single_quoted";
}

type CheckboxStatus = "checked" | "unchecked";

interface ListItem extends HasAttributes, HasChildren<Block> {
  tag: "list_item";
  checkbox?: CheckboxStatus;
}

interface DefinitionListItem extends HasAttributes {
  tag: "definition_list_item";
  children: [Term, Definition];
}

interface Term extends HasAttributes, HasChildren<Inline> {
  tag: "term";
}

interface Definition extends HasAttributes, HasChildren<Block> {
  tag: "definition";
}

interface Row extends HasAttributes {
  tag: "row";
  children: Cell[];
  head: boolean;
}

interface Cell extends HasAttributes, HasChildren<Inline> {
  tag: "cell";
  align: Alignment;
  head: boolean;
}

type Alignment = "default" | "left" | "right" | "center";

type AstNode = Doc | Block | Inline | ListItem
  | DefinitionListItem | Term | Definition
  | Row | Cell | Caption | Footnote | Reference ;

interface Reference extends HasAttributes {
  tag: "reference";
  label: string;
  destination: string;
}

interface Footnote extends HasAttributes, HasChildren<Block> {
  tag: "footnote";
  label: string;
}

interface Doc extends HasChildren<Block>, HasAttributes {
  tag: "doc";
  references: Record<string, Reference>;
  footnotes: Record<string, Footnote>;
}

/* Type predicates */

const blockTags : Record<string, boolean> = {
  para: true,
  heading: true,
  thematic_break: true,
  section: true,
  div: true,
  code_block: true,
  raw_block: true,
  list: true,
  table: true,
  reference: true,
  footnote: true
};

function isBlock(node : AstNode) : node is Block {
  return blockTags[node.tag] || false;
}

const inlineTags : Record<string, boolean> = {
  str: true,
  softbreak: true,
  hardbreak: true,
  nbsp: true,
  symb: true,
  verbatim: true,
  raw_inline: true,
  math: true,
  url: true,
  email: true,
  footnote_reference: true,
  left_single_quote: true,
  right_single_quote: true,
  left_double_quote: true,
  right_double_quote: true,
  ellipses: true,
  em_dash: true,
  en_dash: true,
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



export {
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
  List,
  Table,
  Caption,
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
  Footnote,
  isInline,
  isBlock,
  isRow,
  isCaption
}
