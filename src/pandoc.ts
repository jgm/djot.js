import { AstNode, Doc, Block, Caption, Row, Cell, Alignment,
         ListItem, Inline, Span, Verbatim, Image, Link,
         Attributes, CodeBlock, Heading, Div, Table, CheckboxStatus,
         DefinitionListItem, Term, Definition, Footnote } from "./ast";

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

const paraToPlain = function(elt : PandocElt) : PandocElt {
  if (elt.t === "Para") {
    elt.t = "Plain"
  }
  return elt;
}

const toPandocAttr = function(node : AstNode) : PandocAttr {
  if ("attributes" in node && node.attributes) {
    let id = node.attributes.id || "";
    let classes =
         (node.attributes.class && node.attributes.class.split(" ")) || [];
    let kvs = [];
    for (let k in node.attributes) {
      if (k !== id && k !== "class") {
       kvs.push([k, node.attributes[k]]);
      }
    }
    return [id, classes, kvs];
  } else {
    return ["",[],[]];
  }
}

class PandocRenderer {
  doc : Doc;
  warn : (msg : string) => void;
  symbols : Record<string, string> =
    { nbsp: " ",
      ellipses: "⋯",
      em_dash: "-",
      en_dash: "-",
      left_single_quote: "‘",
      right_single_quote: "’",
      left_double_quote: "“",
      right_double_quote: "”" };


  constructor(doc : Doc, warn ?: (msg : string) => void) {
    this.doc = doc;
    this.warn = warn || (() => {});
  }

  toPandocChildren (node : AstNode) : PandocElt[] {
    if ("children" in node) {
        let children : PandocElt[] = [];
        node.children.forEach((child : AstNode) => {
          this.addToPandocElts(children, child);
        });
        return children;
    } else {
      return [];
    }
  }

  toPandocDefinitionListItem (list : AstNode) : ((item : AstNode) => any[]) {
    let self = this;
    return function(item : AstNode) : any[] {
      if (!("children" in item)) {
        return [];
      }
      let [x, y] = item.children;
      let term : Term = { tag: "term", children: [] };
      let definition : Definition = { tag: "definition", children: [] };;
      if (x.tag === "term") {
        term = x;
        if (y.tag === "definition") {
          definition = y;
        }
      } else if (x.tag === "definition") {
        definition = x;
      }
      let result = [];
      if (term) {
        result.push(self.toPandocChildren(term));
      }
      if (definition) {
        result.push([self.toPandocChildren(definition)]);
      }
      return result;
    };
  }

  toPandocListItem (list : AstNode) :
          ((item : AstNode) => PandocElt[]) {
      let self = this;
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
        let attrs = toPandocAttr(node);
        if (node.tag === "section") {
          attrs[1].unshift("section");
        }
        elts.push({ t: "Div", c: [attrs, this.toPandocChildren(node)] });
        break;
      }

      case "blockquote":
        elts.push({ t: "BlockQuote", c: this.toPandocChildren(node) });
        break;

      case "list": {
        let items : PandocElt[][];
        if (node.style &&
            node.style === "-" || node.style === "+" || node.style === "*" ||
            node.style === "X") {
          items = node.children.map(this.toPandocListItem(node));
          elts.push({ t: "BulletList", c: items } );
        } else if (node.style === ":") {
          items = node.children.map(this.toPandocDefinitionListItem(node));
          elts.push({ t: "DefinitionList", c: items } );
        } else {
          items = node.children.map(this.toPandocListItem(node));
          const number = node.style.replace(/[().]/g,"");
          let style : string;
          if (number === "1") {
            style = "Decimal";
          } else if (number === "a") {
            style = "LowerAlpha";
          } else if (number === "A") {
            style = "UpperAlpha";
          } else if (number === "i") {
            style = "LowerRoman";
          } else if (number === "I") {
            style = "UpperRoman";
          } else {
            style = "DefaultStyle";
          }
          let delim : string;
          const hasLeftParen = /^[(]/.test(node.style);
          const hasRightParen = /[)]$/.test(node.style);
          if (hasRightParen) {
            delim = hasLeftParen ? "TwoParens" : "OneParen";
          } else {
            delim = "Period";
          }
          let start : number = node.start || 1;
          elts.push({ t: "OrderedList", c: [[start, {t: style}, {t: delim}],
                                            items] } );
        }
        break;
      }

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
        let attrs = toPandocAttr(node);
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
        let attrs = toPandocAttr(node);
        let nullattr = ["",[],[]];
        let caption : PandocElt[] = [];
        let colspecs : any = [];
        let theadrows : any = [];
        let tbodies : any = [];
        let tfoot = [nullattr, []];
        let curheads : any = [];
        let currows : any = [];
        let alignMap : Record<string, string> =
                       { left: "AlignLeft",
                         right: "AlignRight",
                         center: "AlignCenter",
                         default: "AlignDefault" };
        let toColSpec = function(cell : AstNode) {
          if ("align" in cell) {
            return [{t: alignMap[cell.align] || "AlignDefault"},
                    {t: "ColWidthDefault"}];
          }
        }
        let self = this;
        let toPandocCell = function(cell : AstNode) {
          if ("children" in cell) {
            return [ toPandocAttr(cell),
                     {t: ("align" in cell && alignMap[cell.align]) ||
                          "AlignDefault"},
                     1,
                     1,
                     [{t: "Plain", c: self.toPandocChildren(cell)}] ]
          }
        }
        let toPandocRow = function(row : AstNode) {
          if ("children" in row) {
            return [toPandocAttr(row), row.children.map(toPandocCell)];
          }
        }
        for (let i=0; i<node.children.length; i++) {
          let row = node.children[i];
          if (!("children" in row)) {
            break;
          }
          if (colspecs.length === 0) {
            colspecs = row.children.map(toColSpec);
          }
          if (row.tag === "caption") {
            caption = this.toPandocChildren(row);
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
                                    [null, caption],
                                    colspecs,
                                    [nullattr, theadrows],
                                    tbodies,
                                    tfoot] });
        break;
      }

      case "raw_inline":
        elts.push({ t: "RawInline", c: [node.format, node.text] });
        break;

      case "softbreak":
        elts.push({ t: "SoftBreak" });
        break;

      case "hardbreak":
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

      case "math":
        elts.push({ t: "Math",
                    c: [{t: node.display ? "DisplayMath" : "InlineMath"},
                         node.text] });
        break;

      case "nbsp":
      case "ellipses":
      case "em_dash":
      case "en_dash":
      case "left_single_quote":
      case "right_single_quote":
      case "left_double_quote":
      case "right_double_quote":
        elts.push({ t: "Str", c: this.symbols[node.tag] || "" });
        break;

      case "symbol":
        elts.push({ t: "Span", c: [["",["symbol"],[["alias",node.alias]]],
                    [{t: "Str", c: ":" + node.alias + ":"}]]});
        break;

      case "single_quoted":
      case "double_quoted": {
        let quoteType = {t: node.tag === "single_quoted" ? "SingleQuote"
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
        let attr = toPandocAttr(node);
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
        let linkAttrs : Record<string,any> = {};
        if (node.reference) {
          let ref = this.doc.references[node.reference];
          if (ref) {
            destination = ref.destination || "";
            if (ref.attributes) {
              for (let k in ref.attributes) {
                linkAttrs[k] = ref.attributes[k];
              }
            }
          } else {
            this.warn("Reference " + node.reference + " not found.");
          }
        }
        if (node.attributes) {
          for (let k in node.attributes) {
            if (linkAttrs[k] && k === "class") {
              linkAttrs[k] += " " + node.attributes[k];
            } else if (!linkAttrs[k]) {
              linkAttrs[k] = node.attributes[k];
            }
          }
        }
       let attrs = toPandocAttr({tag: "link", attributes: linkAttrs,
                                      children: []});
        let url = destination || "";
        let title = (node.attributes && node.attributes.title) || "";
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
        let note = this.doc.footnotes[node.text];
        if (note) {
          elts.push({ t: "Note", c: this.toPandocChildren(note) });
        } else {
          elts.push({ t: "Superscript", c: [{ t: "Str", c: node.text }]});
        }
        break;
      }

      default:
        this.warn("Skipping unhandled node " + node.tag);
    }
  }

  toPandoc() : Pandoc {
    return { ["pandoc-api-version"]: [1,22,2,1],
             meta: {},
             blocks: this.toPandocChildren(this.doc) };
  }
}

const fromPandocAttr = function(pattr : any[]) : Attributes | null {
  let attr : Attributes = {};
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
  let x = elt[0];
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
  footnoteIndex : number = 0;
  warn : (msg : string) => void;

  constructor(warn ?: (msg : string) => void) {
    this.warn = warn || (() => {});
  }

  fromPandocInlines (elts : PandocElt[]) : Inline[] {
    let accum : string[] = [];
    let inlines : Inline[] = [];
    for (let i=0; i < elts.length; i++) {
      let elt = elts[i];
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
            inlines.push({tag: "softbreak"});
            break;

          case "LineBreak":
            inlines.push({tag: "hardbreak"});
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
            let span : Span =
                       {tag: "span",
                        children: this.fromPandocInlines(elt.c[1])};
            let attr = fromPandocAttr(elt.c[0]);
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
            inlines.push({tag: "math", display: elt.c[0].t === "DisplayMath",
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
            let attr = fromPandocAttr(elt.c[0]);
            let code : Verbatim =
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
            let dest = elt.c[2][0];
            let children = this.fromPandocInlines(elt.c[1]);
            if (elt.t === "Image") {
              let img : Image =
                    {tag: "image",
                     destination: dest,
                     children: children };
              if (attr) {
                img.attributes = attr;
              }
              inlines.push(img);
            } else {
              let link : Link =
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
            let label = this.footnoteIndex.toString();
            let note = elt.c.map((b : PandocElt) => {
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
        return {tag: "blockquote",
                children: block.c.map((b : PandocElt) => {
                  return this.fromPandocBlock(b)
                })};

      case "Div": {
        let attr = fromPandocAttr(block.c[0]);
        let tag = /\bsection\b/.test((attr && attr.class) || "")
                    ? "section" : "div";
        let blocks = block.c[1].map((b : PandocElt) => {
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
          let div : Div = {tag: "div", children: blocks};
          if (attr) {
            div.attributes = attr;
          }
          return div;
        }
      }

      case "Header": {
        let attr = fromPandocAttr(block.c[1]);
        let heading : Heading =
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
        let attr = fromPandocAttr(block.c[0]);
        let lang;
        if (attr && attr.class) {
          let classes = attr.class.split(/  */);
          lang = classes[0];
          classes.shift();
          if (classes.length > 0) {
            attr.class = classes.join(" ");
          } else {
            delete attr.class;
          }
        }
        let res : CodeBlock =
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
        let items : DefinitionListItem[] = [];
        let tight = false;
        for (let i=0; i<block.c.length; i++) {
          let rawterm = block.c[i][0];
          let rawdefs = block.c[i][1];
          let term : Inline[] = this.fromPandocInlines(rawterm);
          let def : Block[] = [];
          for (let j=0; j<rawdefs.length; j++) {
            rawdefs[j].map((b : PandocElt) => {
              if (b.t === "Plain") {
                tight = true;
              } else if (b.t === "Para") {
                tight = false;
              }
              def.push(this.fromPandocBlock(b));
            });
          }
          items.push({tag: "definition_list_item",
                      children: [{tag: "term", children: term},
                                 {tag: "definition", children: def}]});
        }

        return {tag: "list", style: ":", tight: tight, children: items};
      }

      case "OrderedList":
      case "BulletList": {
        let items : ListItem[] = [];
        let tight = false;
        let rawitems;
        if (block.t === "BulletList") {
          rawitems = block.c;
        } else {
          rawitems = block.c[1];
        }
        for (let i=0; i<rawitems.length; i++) {
          let checkbox = hasCheckbox(rawitems[i]);
          let listItem : ListItem =
                  {tag: "list_item",
                   children: rawitems[i].map((b : PandocElt) => {
                                   if (b.t === "Plain") {
                                     tight = true;
                                   } else if (b.t === "Para") {
                                     tight = false;
                                   }
                                   return this.fromPandocBlock(b);
                              })};
          if (checkbox !== null) {
            listItem.checkbox = checkbox;
          }
          items.push(listItem);
        }
        if (block.t === "BulletList") {
          return {tag: "list", style: "-", tight: tight, children: items};
        } else if (block.t === "OrderedList") {
          let start = block.c[0][0];
          let style : string;
          switch (block.c[0][1].t) {
            case "Decimal": style = "1"; break;
            case "LowerAlpha": style = "a"; break;
            case "UpperAlpha": style = "A"; break;
            case "LowerRoman": style = "i"; break;
            case "UpperRoman": style = "I"; break;
            default: style = "1";
          }
          switch (block.c[0][2].t) {
            case "Period": style = style + "."; break;
            case "OneParen": style = style + ")"; break;
            case "TwoParens": style = "(" + style + ")"; break;
            default: style = style + ".";
          }
          return {tag: "list", style: style, tight: tight, children: items};
        }
      }

      case "Table": {
        let attr = fromPandocAttr(block.c[0]);
        let rawcaption = block.c[1][1];
        let caption : Inline[] = [];
        if (rawcaption.length > 1 ||
            (rawcaption.length === 1 && !isPlainOrPara(rawcaption[0]))) {
          this.warn("Skipping block-level content in table caption.");
        } else if (rawcaption[0] && "c" in rawcaption[0]) {
          caption = this.fromPandocInlines(rawcaption[0].c);
        }

        let rawcolspecs = block.c[2];
        let aligns : Alignment[] = [];
        for (let i in rawcolspecs) {
          aligns.push(rawcolspecs[i][0].t.slice(5).toLowerCase());
        }

        let rows : Row[] = [];
        let rawtheadrows = block.c[3][1];
        for (let i in rawtheadrows) {
          rows.push(this.fromPandocRow(rawtheadrows[i], true, 0, aligns));
        }

        let tbodies = block.c[4];
        for (let i in tbodies) {
          let rowheadcolumns : number = tbodies[i][1];
          let rawsubheadrows = tbodies[i][2];
          for (let i in rawsubheadrows) {
            rows.push(this.fromPandocRow(rawsubheadrows[i], true,
                                          rowheadcolumns, aligns));
          }
          let rawbodyrows = tbodies[i][3];
          for (let i in rawbodyrows) {
            rows.push(this.fromPandocRow(rawbodyrows[i], false,
                                          rowheadcolumns, aligns));
          }
        }

        let rawfootrows = block.c[5][1];
        for (let i in rawfootrows) {
          rows.push(this.fromPandocRow(rawfootrows[i], false, 0, aligns));
        }

        let children : (Row | Caption)[] = rows;
        if (caption.length > 0) {
          children.unshift({tag: "caption", children: caption});
        }
        let table : Table = {tag: "table", children: children};
        if (attr) {
          table.attributes = attr;
        }
        return table;
      }

      case "LineBlock": {
        let ils : Inline[] = [];
        for (let i=0; i<block.c.length; i++) {
          if (i > 0) {
            ils.push({tag: "hardbreak"});
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
    let attr = fromPandocAttr(rawrow[0]);
    let rawcells = rawrow[1];
    let cells : Cell[] = [];
    for (let i=0; i < rawcells.length; i++) {
      cells.push(this.fromPandocCell(rawcells[i],
                          head || i < rowheadcols, aligns[i]));
    }
    let row : Row = {tag: "row", head: head, children: cells};
    if (attr) {
      row.attributes = attr;
    }
    return row;
  }

  fromPandocCell(rawcell : any, head : boolean, defaultAlign : Alignment) : Cell {
    let cs : Inline[] = [];
    let attr = fromPandocAttr(rawcell[0]);
    let align = rawcell[1].t.slice(5).toLowerCase();
    if (align === "default") {
      align = defaultAlign;
    }
    let rawblocks = rawcell[4];
    if (rawblocks.length > 1 || (rawblocks.length === 1 &&
          !isPlainOrPara(rawblocks[0]))) {
      this.warn("Skipping table cell with block-level content.");
    } else if (rawblocks[0]) {
      cs = this.fromPandocInlines(rawblocks[0].c);
    }
    let cell : Cell = {tag: "cell", head: head, align: align, children: cs};
    if (attr) {
      cell.attributes = attr;
    }
    return cell;
  }

  fromPandoc (pandoc : Pandoc) : Doc | null {
    if (!pandoc) {
      return null;
    }
    let blocks = pandoc.blocks;
    let docblocks : Block[] = blocks.map((b : PandocElt) => {
      return this.fromPandocBlock(b)
    });

    return { tag: "doc",
            children: docblocks,
            footnotes: this.footnotes,
            references: {} };
  }

  parseJSON (json : string) : Doc | null {
    let pandoc = JSON.parse(json);
    return this.fromPandoc(pandoc);
  }
}

export { PandocRenderer, PandocParser };

