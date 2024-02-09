import { AstNode, Doc, Block, Caption, Row, Cell, Alignment,
         TaskListItem, OrderedListStyle, ListItem, Inline, Reference,
         Span, Verbatim, Image, Link,
         Attributes, CodeBlock, Heading, Div, Table, CheckboxStatus,
         DefinitionListItem, Footnote } from "./ast";
import { Options, Warning } from "./options";

interface Pandoc {
  ["pandoc-api-version"]: number[],
  meta: PandocMeta,
  blocks: PandocElt[],
}

type PandocMeta = Record<string,PandocElt>

interface PandocElt {
  t: string,
  c?: any;
}

type PandocAttr = [ id : string, classes : string[], kvs: (string[])[] ];

const styleMap : Record<string,Record<string,OrderedListStyle>> =
  { Decimal:    { Period: "1.",
                  OneParen: "1)",
                  TwoParens: "(1)" },
    LowerAlpha: { Period: "a.",
                  OneParen: "a)",
                  TwoParens: "(a)" },
    UpperAlpha: { Period: "A.",
                  OneParen: "A)",
                  TwoParens: "(A)" },
    LowerRoman: { Period: "i.",
                  OneParen: "i)",
                  TwoParens: "(i)" },
    UpperRoman: { Period: "I.",
                  OneParen: "I)",
                  TwoParens: "(I)" } };

const reverseStyleMap : Record<string, [string,string]> = {};
for (const i in styleMap) {
  for (const j in styleMap[i]) {
    reverseStyleMap[styleMap[i][j]] = [i,j];
  }
}

const paraToPlain = function(elt : PandocElt) : PandocElt {
  if (elt.t === "Para") {
    elt.t = "Plain"
  }
  return elt;
}

const toPandocAttr = function(node : AstNode) : PandocAttr {
  const attributes = {
    ...node.autoAttributes,
    ...node.attributes,
  }
  if (attributes) {
    const id = attributes.id || "";
    const classes =
         (attributes.class && attributes.class.split(" ")) || [];
    const kvs = [];
    for (const k in attributes) {
      if (k !== id && k !== "class") {
       kvs.push([k, attributes[k]]);
      }
    }
    return [id, classes, kvs];
  } else {
    return ["",[],[]];
  }
}

interface PandocRenderOptions extends Options {
  smartPunctuationMap ?: Record<string, string>;
}

class PandocRenderer {
  references : Record<string, Reference> = {};
  footnotes : Record<string, Footnote> = {};
  options : PandocRenderOptions;
  warn : (warning : Warning) => void;
  smartPunctuationMap : Record<string, string>

  constructor(options : Options = {}) {
    this.options = options;
    this.smartPunctuationMap = this.options.smartPunctuationMap ||
      { right_single_quote: "’",
        left_single_quote: "‘",
        right_double_quote: "”",
        left_double_quote: "“",
        ellipses: "…",
        em_dash: "—",
        en_dash: "–"
      };
    this.warn ||= (() => {});
  }

  toPandocChildren (node : AstNode) : PandocElt[] {
    if ("children" in node) {
        const children : PandocElt[] = [];
        node.children.forEach((child : AstNode) => {
          this.addToPandocElts(children, child);
        });
        return children;
    } else {
      return [];
    }
  }

  toPandocDefinitionListItem (list : AstNode) : ((item : AstNode) => any[]) {
    const self = this;
    return function(item : AstNode) : any[] {
      if (!("children" in item)) {
        return [];
      }
      const [term, definition] = item.children;
      return [
        self.toPandocChildren(term),
        [self.toPandocChildren(definition)],
      ];
    };
  }

  toPandocListItem (list : AstNode) :
          ((item : AstNode) => PandocElt[]) {
      const self = this;
    return function(item : AstNode) : PandocElt[] {
      let elts = self.toPandocChildren(item);
      if ("checkbox" in item && item.checkbox && elts[0].t === "Para") {
        if (item.checkbox === "checked") {
          elts[0].c.unshift({t: "Str", c: "☒"}, {t: "Space"});
        } else {
          elts[0].c.unshift({t: "Str", c: "☐"}, {t: "Space"});
        }
      }
      if ("tight" in list && list.tight) {
        elts = elts.map(paraToPlain);
      }
      return elts;
    };
  }

  addToPandocElts (elts : PandocElt[], node : any, ) : void {
    switch (node.tag) {
      case "section":
      case "div": {
        const attrs = toPandocAttr(node);
        if (node.tag === "section") {
          attrs[1].unshift("section");
        }
        elts.push({ t: "Div", c: [attrs, this.toPandocChildren(node)] });
        break;
      }

      case "block_quote":
        elts.push({ t: "BlockQuote", c: this.toPandocChildren(node) });
        break;

      case "definition_list": {
        const items : DefinitionListItem[] =
                     node.children.map(this.toPandocDefinitionListItem(node));
        elts.push({ t: "DefinitionList", c: items } );
        break;
      }

      case "task_list":
      case "bullet_list": {
        let items : PandocElt[][];
        items = node.children.map(this.toPandocListItem(node));
        elts.push({ t: "BulletList", c: items } );
        break;
      }

      case "ordered_list": {
        const items = node.children.map(this.toPandocListItem(node));
        const [style, delim] = reverseStyleMap[node.style as string];
        const start : number = node.start || 1;
        elts.push({ t: "OrderedList", c: [[start, {t: style}, {t: delim}],
                                          items] } );
        break;
      }

      case "task_list_item": // should be handled at "list" above
      case "list_item": // should be handled at "list" above
        break;

      case "para":
        elts.push({ t: "Para", c: this.toPandocChildren(node) });
        break;

      case "heading":
        elts.push({ t: "Header", c: [node.level, toPandocAttr(node),
                                     this.toPandocChildren(node)] });
        break;

      case "code_block": {
        const attrs = toPandocAttr(node);
        if (node.lang) {
          attrs[1].unshift(node.lang);
        }
        elts.push({ t: "CodeBlock", c: [attrs, node.text] });
        break;
      }

      case "raw_block":
        elts.push({ t: "RawBlock", c: [node.format, node.text] });
        break;

      case "thematic_break":
        elts.push({ t: "HorizontalRule" });
        break;

      case "table": {
        const attrs = toPandocAttr(node);
        const nullattr = ["",[],[]];
        let caption : PandocElt[] = [];
        let colspecs : any = [];
        let theadrows : any = [];
        const tbodies : any = [];
        const tfoot = [nullattr, []];
        let curheads : any = [];
        let currows : any = [];
        const alignMap : Record<string, string> =
                       { left: "AlignLeft",
                         right: "AlignRight",
                         center: "AlignCenter",
                         default: "AlignDefault" };
        const toColSpec = function(cell : Cell) {
          return [{t: alignMap[cell.align] || "AlignDefault"},
                  {t: "ColWidthDefault"}];
        }
        const self = this;
        const toPandocCell = function(cell : AstNode) {
          if ("children" in cell) {
            return [ toPandocAttr(cell),
                     {t: ("align" in cell && alignMap[cell.align]) ||
                          "AlignDefault"},
                     1,
                     1,
                     [{t: "Plain", c: self.toPandocChildren(cell)}] ]
          }
        }
        const toPandocRow = function(row : AstNode) {
          if ("children" in row) {
            return [toPandocAttr(row), row.children.map(toPandocCell)];
          }
        }
        for (let i=0; i<node.children.length; i++) {
          const row = node.children[i];
          if (!("children" in row)) {
            break;
          }
          if (colspecs.length === 0) {
            colspecs = row.children.map(toColSpec);
          }
          if (row.tag === "caption") {
            if (row.children.length) {
              caption = this.toPandocChildren(row);
            }
          } else if (row.head) {
            if (currows.length === 0) {
              curheads.push(toPandocRow(row));
            } else {
              tbodies.push([nullattr, 0, curheads, currows]);
              currows = [];
              curheads = [toPandocRow(row)];
            }
          } else {
            if (tbodies.length === 0 && currows.length === 0) {
                theadrows = curheads;
                curheads = [];
            }
            currows.push(toPandocRow(row));
          }
        }
        if (curheads.length > 0 || currows.length > 0) {
          tbodies.push([nullattr, 0, curheads, currows]);
        }

        elts.push({ t: "Table", c: [attrs,
                                    [null, [{t: "Plain",
                                             c: caption}]],
                                    colspecs,
                                    [nullattr, theadrows],
                                    tbodies,
                                    tfoot] });
        break;
      }

      case "raw_inline":
        elts.push({ t: "RawInline", c: [node.format, node.text] });
        break;

      case "soft_break":
        elts.push({ t: "SoftBreak" });
        break;

      case "hard_break":
        elts.push({ t: "LineBreak" });
        break;

      case "str":
        node.text.split(/ +/).forEach( (s : string, i : number) => {
          if (i > 0) {
            elts.push({ t: "Space" });
          }
          if (s.length > 0) {
            elts.push({ t: "Str", c: s });
          }
        });
        break;

      case "verbatim":
        elts.push({ t: "Code", c: [toPandocAttr(node), node.text] });
        break;

      case "inline_math":
        elts.push({ t: "Math",
                    c: [{t: "InlineMath"}, node.text] });
        break;

      case "display_math":
        elts.push({ t: "Math",
                    c: [{t: "DisplayMath"}, node.text] });
        break;

      case "non_breaking_space":
        elts.push({ t: "Str", c: "\u00A0" });
        break;

      case "smart_punctuation":
        elts.push({ t: "Str", c: this.smartPunctuationMap[node.type] ||
                                 node.text });
        break;

      case "symb":
        elts.push({ t: "Span", c: [["",["symbol"],[["alias",node.alias]]],
                    [{t: "Str", c: ":" + node.alias + ":"}]]});
        break;

      case "single_quoted":
      case "double_quoted": {
        const quoteType = {t: node.tag === "single_quoted" ? "SingleQuote"
                                                        : "DoubleQuote"};
        elts.push({ t: "Quoted", c: [quoteType, this.toPandocChildren(node)]});
        break;
      }

      case "email":
      case "url": {
        let url = node.text;
        if (node.tag === "email") {
          url = "mailto:" + url;
        }
        const attr = toPandocAttr(node);
        attr[1].unshift(node.tag === "email" ? "email" : "uri");
        elts.push({ t: "Link",
                     c: [attr,
                         [{t: "Str", c: node.text}],
                         [url, ""]] });

        break;
      }

      case "image":
      case "link": {
        let destination = node.destination || "";
        const linkAttrs : Record<string,any> = {};
        if (node.reference) {
          const ref = this.references[node.reference];
          if (ref) {
            destination = ref.destination || "";
            const attributes = {
              ...ref.autoAttributes,
              ...ref.attributes,
            }
            if (attributes) {
              for (const k in attributes) {
                linkAttrs[k] = attributes[k];
              }
            }
          } else {
            this.warn(new Warning("Reference " + node.reference + " not found."));
          }
        }
        const attributes = {
          ...node.autoAttributes,
          ...node.attributes,
        }
        if (attributes) {
          for (const k in attributes) {
            if (linkAttrs[k] && k === "class") {
              linkAttrs[k] += " " + attributes[k];
            } else if (!linkAttrs[k]) {
              linkAttrs[k] = attributes[k];
            }
          }
        }
        const attrs = toPandocAttr({tag: "link", attributes: linkAttrs,
                                      children: []});
        const url = destination || "";
        const title = (node.attributes && node.attributes.title) || (node.autoAttributes && node.autoAttributes.title) || "";
        if (title) {
          attrs[2] = attrs[2].filter(([k,v]) => k !== "title");
        }
        elts.push({ t: node.tag === "link" ? "Link" : "Image",
                     c: [attrs, this.toPandocChildren(node), [url, title]] });
        break;
      }

      case "emph":
        elts.push({ t: "Emph", c: this.toPandocChildren(node) });
        break;

      case "strong":
        elts.push({ t: "Strong", c: this.toPandocChildren(node) });
        break;

      case "superscript":
        elts.push({ t: "Superscript", c: this.toPandocChildren(node) });
        break;

      case "subscript":
        elts.push({ t: "Subscript", c: this.toPandocChildren(node) });
        break;

      case "span":
        elts.push({ t: "Span", c: [toPandocAttr(node),
                                   this.toPandocChildren(node)] });
        break;

      case "mark":
        elts.push({ t: "Span", c: [["",["mark"],[]], this.toPandocChildren(node)] });
        break;

      case "insert":
        elts.push({ t: "Underline", c: this.toPandocChildren(node) });
        break;

      case "delete":
        elts.push({ t: "Strikeout", c: this.toPandocChildren(node) });
        break;

      case "footnote_reference": {
        const note = this.footnotes[node.text];
        if (note) {
          elts.push({ t: "Note", c: this.toPandocChildren(note) });
        } else {
          elts.push({ t: "Superscript", c: [{ t: "Str", c: node.text }]});
        }
        break;
      }

      default:
        this.warn(new Warning("Skipping unhandled node " + node.tag));
    }
  }

  toPandoc(doc : Doc) : Pandoc {
    this.references = doc.references;
    this.footnotes = doc.footnotes;
    return { ["pandoc-api-version"]: [1,23],
             meta: {},
             blocks: this.toPandocChildren(doc) };
  }
}

const fromPandocAttr = function(pattr : any[]) : Attributes | null {
  const attr : Attributes = {};
  if (pattr[0]) {
    attr.id = pattr[0];
  }
  if (pattr[1].length > 0) {
    attr.class = pattr[1].join(" ");
  }
  for (let i=0; i<pattr[2].length; i++) {
    attr[pattr[2][i][0].toString()] = pattr[2][i][1];
  }
  if (Object.keys(attr).length === 0) {
    return null;
  } else {
    return attr;
  }
}

const isPlainOrPara = function(x : PandocElt) : boolean {
  return (x.t === "Plain" || x.t === "Para");
}

const hasCheckbox = function(elt : PandocElt[]) : CheckboxStatus | null {
  if (!elt[0]) {
    return null;
  }
  const x = elt[0];
  if (!isPlainOrPara(x)) {
    return null;
  }
  if (x.c.length >= 2 && x.c[0].t === "Str" && x.c[1].t === "Space") {
    if (x.c[0].c === "☒") {
      x.c.shift(); // remove the checkbox
      x.c.shift();
      return "checked";
    } else if (x.c[0].c === "☐") {
      x.c.shift(); // remove the checkbox
      x.c.shift();
      return "unchecked";
    } else {
      return null;
    }
  } else {
    return null;
  }
}

class PandocParser {

  footnotes : Record<string, Footnote> = {};
  footnoteIndex  = 0;
  options : Options;
  warn : (warning : Warning) => void;

  constructor(options : Options = {}) {
    this.options = options;
    this.warn = options.warn || (() => {});
  }

  fromPandocInlines (elts : PandocElt[]) : Inline[] {
    let accum : string[] = [];
    const inlines : Inline[] = [];
    for (let i=0; i < elts.length; i++) {
      const elt = elts[i];
      if (elt.t === "Str") {
        accum.push(elt.c);
      } else if (elt.t === "Space") {
        accum.push(" ");
      } else {
        if (accum.length > 0) {
          inlines.push({tag: "str", text: accum.join("")});
          accum = [];
        }
        switch (elt.t) {
          case "SoftBreak":
            inlines.push({tag: "soft_break"});
            break;

          case "LineBreak":
            inlines.push({tag: "hard_break"});
            break;

          case "Emph":
            inlines.push({tag: "emph", children: this.fromPandocInlines(elt.c)});
            break;

          case "Strong":
            inlines.push({tag: "strong", children: this.fromPandocInlines(elt.c)});
            break;

          case "Superscript":
            inlines.push({tag: "superscript", children: this.fromPandocInlines(elt.c)});
            break;

          case "Subscript":
            inlines.push({tag: "subscript", children: this.fromPandocInlines(elt.c)});
            break;

          case "Strikeout":
            inlines.push({tag: "delete", children: this.fromPandocInlines(elt.c)});
            break;

          case "Span": {
            const span : Span =
                       {tag: "span",
                        children: this.fromPandocInlines(elt.c[1])};
            const attr = fromPandocAttr(elt.c[0]);
            if (attr) {
              span.attributes = attr;
            }
            inlines.push(span);
            break;
          }

          case "Underline":
            inlines.push({tag: "span",
                          attributes: {class: "underline"},
                          children: this.fromPandocInlines(elt.c)});
            break;

          case "SmallCaps":
            inlines.push({tag: "span",
                          attributes: {class: "smallcaps"},
                          children: this.fromPandocInlines(elt.c)});
            break;

          case "Math":
            inlines.push({tag: elt.c[0].t === "DisplayMath"
                               ? "display_math" : "inline_math",
                          text: elt.c[1]});
            break;

          case "Quoted":
            if (elt.c[0].t === "SingleQuote") {
              inlines.push({tag: "single_quoted",
                            children: this.fromPandocInlines(elt.c[1])});
            } else {
               inlines.push({tag: "double_quoted",
                            children: this.fromPandocInlines(elt.c[1])});
            }
            break;

          case "RawInline":
            inlines.push({tag: "raw_inline", format: elt.c[0], text: elt.c[1]});
            break;

          case "Code": {
            const attr = fromPandocAttr(elt.c[0]);
            const code : Verbatim =
                        ({tag: "verbatim",
                          text: elt.c[1]});
            if (attr) {
              code.attributes = attr;
            }
            inlines.push(code);
            break;
          }

          case "Image":
          case "Link": {
            let attr = fromPandocAttr(elt.c[0]);
            if (elt.c[2][1]) {
              attr = attr || {};
              attr.title = elt.c[2][1];
            }
            const dest = elt.c[2][0];
            const children = this.fromPandocInlines(elt.c[1]);
            if (elt.t === "Image") {
              const img : Image =
                    {tag: "image",
                     destination: dest,
                     children: children };
              if (attr) {
                img.attributes = attr;
              }
              inlines.push(img);
            } else {
              const link : Link =
                    {tag: "link",
                     destination: dest,
                     children: children };
              if (attr) {
                link.attributes = attr;
              }
              inlines.push(link);
            }
            break;
          }

          case "Cite":
            inlines.push({tag: "span",
                          attributes: {class: "cite"},
                          children: this.fromPandocInlines(elt.c[1])});

            break;

          case "Note": {
            this.footnoteIndex++;
            const label = this.footnoteIndex.toString();
            const note = elt.c.map((b : PandocElt) => {
              return this.fromPandocBlock(b);
            });
            this.footnotes[this.footnoteIndex.toString()] =
                     {tag: "footnote", label: label, children: note};
            inlines.push({tag: "footnote_reference",
                          text: label});
            break;
          }

          default:
        }
      }
    }
    if (accum.length > 0) {
      inlines.push({tag: "str", text: accum.join("")});
    }
    return inlines;
  }

  fromPandocBlock (block : PandocElt) : Block {
    switch (block.t) {
      case "Plain":
      case "Para":
        return {tag: "para", children: this.fromPandocInlines(block.c)};

      case "BlockQuote":
        return {tag: "block_quote",
                children: block.c.map((b : PandocElt) => {
                  return this.fromPandocBlock(b)
                })};

      case "Div": {
        let attr = fromPandocAttr(block.c[0]);
        const tag = /\bsection\b/.test((attr && attr.class) || "")
                    ? "section" : "div";
        const blocks = block.c[1].map((b : PandocElt) => {
                      return this.fromPandocBlock(b);
                    });
        if (tag === "section") {
          attr = attr || {};
          attr.class = attr.class.replace(/section */, "");
          if (!attr.class) {
            delete attr.class;
          }
          return {tag: "section", attributes: attr, children: blocks};
        } else {
          const div : Div = {tag: "div", children: blocks};
          if (attr) {
            div.attributes = attr;
          }
          return div;
        }
      }

      case "Header": {
        const attr = fromPandocAttr(block.c[1]);
        const heading : Heading =
               {tag: "heading",
                level: block.c[0],
                children: this.fromPandocInlines(block.c[2])};
        if (attr) {
          heading.attributes = attr;
        }
        return heading;
      }

      case "HorizontalRule":
        return {tag: "thematic_break"};

      case "RawBlock":
        return {tag: "raw_block", format: block.c[0], text: block.c[1]};

      case "CodeBlock": {
        const attr = fromPandocAttr(block.c[0]);
        let lang;
        if (attr && attr.class) {
          const classes = attr.class.split(/  */);
          lang = classes[0];
          classes.shift();
          if (classes.length > 0) {
            attr.class = classes.join(" ");
          } else {
            delete attr.class;
          }
        }
        const res : CodeBlock =
                  {tag: "code_block",
                  lang: lang,
                  text: block.c[1]};
        if (attr) {
          res.attributes = attr;
        }
        if (!lang) {
          delete res.lang;
        }
        return res;
      }

      case "DefinitionList": {
        const items : DefinitionListItem[] = [];
        const tight = false;
        for (let i=0; i<block.c.length; i++) {
          const rawterm = block.c[i][0];
          const rawdefs = block.c[i][1];
          const term : Inline[] = this.fromPandocInlines(rawterm);
          const def : Block[] = [];
          for (let j=0; j<rawdefs.length; j++) {
            rawdefs[j].map((b : PandocElt) => {
              def.push(this.fromPandocBlock(b));
            });
          }
          items.push({tag: "definition_list_item",
                      children: [{tag: "term", children: term},
                                 {tag: "definition", children: def}]});
        }

        return {tag: "definition_list", children: items};
      }

      case "OrderedList":
      case "BulletList": {
        const items : ListItem[] = [];
        const taskListItems : TaskListItem[] = [];
        let tight = false;
        let rawitems;
        if (block.t === "BulletList") {
          rawitems = block.c;
        } else {
          rawitems = block.c[1];
        }
        for (let i=0; i<rawitems.length; i++) {
          const checkbox = hasCheckbox(rawitems[i]);
          const children = rawitems[i].map((b : PandocElt) => {
                                   if (b.t === "Plain") {
                                     tight = true;
                                   } else if (b.t === "Para") {
                                     tight = false;
                                   }
                                   return this.fromPandocBlock(b);
                                });
          if (checkbox !== null) {
            taskListItems.push( { tag: "task_list_item",
                                  checkbox: checkbox,
                                  children: children });
          } else {
            items.push( { tag: "list_item",
                          children: children });
          }
        }
        if (block.t === "BulletList") {
          if (taskListItems.length > 0) {
            return {tag: "task_list",
                    tight: tight,
                    children: taskListItems};
          } else {
            return {tag: "bullet_list",
                    style: "-",
                    tight: tight,
                    children: items};
          }
        } else if (block.t === "OrderedList") {
          const start = block.c[0][0];
          let pandocStyle = block.c[0][1].t;
          if (pandocStyle === "DefaultStyle") {
            pandocStyle = "Decimal";
          }
          let pandocDelim = block.c[0][2].t;
          if (pandocDelim === "DefaultDelim") {
            pandocDelim = "Period";
          }
          const style : OrderedListStyle = styleMap[pandocStyle][pandocDelim];
          return {tag: "ordered_list",
                  style: style,
                  start: start,
                  tight: tight,
                  children: items};
        }
      }

      case "Table": {
        const attr = fromPandocAttr(block.c[0]);
        const rawcaption = block.c[1][1];
        const caption : Caption = { tag: "caption", children: []};
        if (rawcaption.length > 1 ||
            (rawcaption.length === 1 && !isPlainOrPara(rawcaption[0]))) {
          this.warn(new Warning("Skipping block-level content in table caption."));
        } else if (rawcaption[0] && "c" in rawcaption[0]) {
          caption.children = this.fromPandocInlines(rawcaption[0].c);
        }

        const rawcolspecs = block.c[2];
        const aligns : Alignment[] = [];
        for (const i in rawcolspecs) {
          aligns.push(rawcolspecs[i][0].t.slice(5).toLowerCase());
        }

        const rows : Row[] = [];
        const rawtheadrows = block.c[3][1];
        for (const i in rawtheadrows) {
          rows.push(this.fromPandocRow(rawtheadrows[i], true, 0, aligns));
        }

        const tbodies = block.c[4];
        for (const i in tbodies) {
          const rowheadcolumns : number = tbodies[i][1];
          const rawsubheadrows = tbodies[i][2];
          for (const i in rawsubheadrows) {
            rows.push(this.fromPandocRow(rawsubheadrows[i], true,
                                          rowheadcolumns, aligns));
          }
          const rawbodyrows = tbodies[i][3];
          for (const i in rawbodyrows) {
            rows.push(this.fromPandocRow(rawbodyrows[i], false,
                                          rowheadcolumns, aligns));
          }
        }

        const rawfootrows = block.c[5][1];
        for (const i in rawfootrows) {
          rows.push(this.fromPandocRow(rawfootrows[i], false, 0, aligns));
        }

        const table : Table = {tag: "table", children: [caption, ...rows] };
        if (attr) {
          table.attributes = attr;
        }
        return table;
      }

      case "Figure": {
        const attr = fromPandocAttr(block.c[0]);
        const tag = /\bsection\b/.test((attr && attr.class) || "")
                    ? "section" : "div";
        const blocks = block.c[2].map((b : PandocElt) => {
                      return this.fromPandocBlock(b);
                    });
        const rawcapt = block.c[1][1];
        if (rawcapt.length > 0) {
          const capt = rawcapt.map((b : PandocElt) => {
                  return this.fromPandocBlock(b)
                });
          blocks.push(...capt);
        }

        const div : Div = {tag: "div", children: blocks};
        if (attr) {
          div.attributes = attr;
        }
        return div;
      }



      case "LineBlock": {
        const ils : Inline[] = [];
        for (let i=0; i<block.c.length; i++) {
          if (i > 0) {
            ils.push({tag: "hard_break"});
          }
          ils.push(...this.fromPandocInlines(block.c[i]));
        }
        return {tag: "para", children: ils};
      }

      case "Null": // better options?
        return {tag: "raw_block", format: "none", text: ""};

      default:
    }
    return {tag: "raw_block", format: "error",
            text: "Could not convert " + block.t};
  }

  fromPandocRow(rawrow : any, head : boolean,
                 rowheadcols : number, aligns : Alignment[]) : Row {
    const attr = fromPandocAttr(rawrow[0]);
    const rawcells = rawrow[1];
    const cells : Cell[] = [];
    for (let i=0; i < rawcells.length; i++) {
      cells.push(this.fromPandocCell(rawcells[i],
                          head || i < rowheadcols, aligns[i]));
    }
    const row : Row = {tag: "row", head: head, children: cells};
    if (attr) {
      row.attributes = attr;
    }
    return row;
  }

  fromPandocCell(rawcell : any, head : boolean, defaultAlign : Alignment) : Cell {
    let cs : Inline[] = [];
    const attr = fromPandocAttr(rawcell[0]);
    let align = rawcell[1].t.slice(5).toLowerCase();
    if (align === "default") {
      align = defaultAlign;
    }
    const rawblocks = rawcell[4];
    if (rawblocks.length > 1 || (rawblocks.length === 1 &&
          !isPlainOrPara(rawblocks[0]))) {
      this.warn(new Warning("Skipping table cell with block-level content."));
      cs = [{tag: "str", text: "((content omitted))"}];
    } else if (rawblocks[0]) {
      cs = this.fromPandocInlines(rawblocks[0].c);
    }
    const cell : Cell = {tag: "cell", head: head, align: align, children: cs};
    if (attr) {
      cell.attributes = attr;
    }
    return cell;
  }

  fromPandoc (pandoc : Pandoc) : Doc {
    if (typeof pandoc !== "object") {
      throw(Error("Pandoc document must be an object"));
    } else if (!pandoc["pandoc-api-version"]) {
      throw(Error("Pandoc document lacks pandoc-api-version"));
    } else if (!pandoc.blocks) {
      throw(Error("Pandoc document lacks blocks"));
    } else if (!pandoc.meta) {
      throw(Error("Pandoc document lacks meta"));
    }
    const blocks = pandoc.blocks;
    const docblocks : Block[] = blocks.map((b : PandocElt) => {
      return this.fromPandocBlock(b)
    });

    return { tag: "doc",
            children: docblocks,
            footnotes: this.footnotes,
            references: {},
            autoReferences: {} };
  }
}

const toPandoc = function(doc : Doc, options ?: PandocRenderOptions) : Pandoc {
  return new PandocRenderer(options).toPandoc(doc);
}

const fromPandoc = function(pandoc : Pandoc, options ?: Options) : Doc {
  return new PandocParser(options).fromPandoc(pandoc);
}

export type {
  PandocRenderOptions,
  Pandoc,
  PandocElt,
  PandocMeta,
  PandocAttr,
}
export {
  toPandoc,
  fromPandoc
}
