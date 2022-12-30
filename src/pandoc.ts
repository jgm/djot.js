import { AstNode, Doc, Block, Inline, Attributes,
         Term, Definition, Footnote } from "./ast";

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

  toPandocChildren = function(this : PandocRenderer, node : AstNode) : PandocElt[] {
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

  toPandocDefinitionListItem = function(this : PandocRenderer, list : AstNode) : ((item : AstNode) => any[]) {
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

  toPandocListItem = function(this : PandocRenderer, list : AstNode) :
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

  addToPandocElts = function(this : PandocRenderer, elts : PandocElt[], node : any, ) : void {
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
        node.text.split(/\b/).forEach( (s : string) => {
          if (s.codePointAt(0) === 32) {
            elts.push({ t: "Space" });
          } else {
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

const fromPandocAttr = function(pattr : any[]) : Attributes {
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
  return attr;
}

const fromPandocInlines = function(elts : PandocElt[]) : Inline[] {
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
          inlines.push({tag: "emph", children: fromPandocInlines(elt.c)});
          break;
        case "Strong":
          inlines.push({tag: "strong", children: fromPandocInlines(elt.c)});
          break;
        case "Superscript":
          inlines.push({tag: "superscript", children: fromPandocInlines(elt.c)});
          break;
        case "Subscript":
          inlines.push({tag: "subscript", children: fromPandocInlines(elt.c)});
          break;
        case "Strikeout":
          inlines.push({tag: "delete", children: fromPandocInlines(elt.c)});
          break;
        case "Span":
          inlines.push({tag: "span",
                        attributes: fromPandocAttr(elt.c[0]),
                        children: fromPandocInlines(elt.c[1])});
          break;
        case "Underline":
          inlines.push({tag: "span",
                        attributes: {class: "underline"},
                        children: fromPandocInlines(elt.c)});
          break;
        case "SmallCaps":
          inlines.push({tag: "span",
                        attributes: {class: "smallcaps"},
                        children: fromPandocInlines(elt.c)});
          break;
        case "Math":
          // TODO
          break;
        case "Quoted":
          // TODO
          break;
        case "RawInline":
          // TODO
          break;
        case "Code":
          // TODO
          break;
        case "Link":
        case "Image":
          // TODO
         break;
        case "Note":
          // TODO; console.log(elt.c.map(fromPandocBlock));
          break;

        default:
      }
    }
  }
  if (accum.length > 0) {
    inlines.push({tag: "str", text: accum.join("")});
  }
  return inlines;
}

const fromPandocBlock = function(block : PandocElt) : Block {
  switch (block.t) {
    case "Para":
      return {tag: "para", children: fromPandocInlines(block.c)};
    case "BlockQuote":
      return {tag: "blockquote", children: block.c.map(fromPandocBlock)};
    case "Div": {
      let attr : Attributes = fromPandocAttr(block.c[0]);
      let tag = attr.class.includes("section") ? "section" : "div";
      let blocks = block.c[1].map(fromPandocBlock);
      if (tag === "section") {
        attr.class = attr.class.replace(/section */, "");
        if (!attr.class) {
          delete attr.class;
        }
        return {tag: "section", attributes: attr, children: blocks};
      } else {
        return {tag: "div", attributes: attr, children: blocks};
      }
    }
    case "Plain": // TODO
    case "Header": // TODO
    case "HorizontalRule": // TODO
    case "CodeBlock": // TODO
    case "RawBlock": // TODO
    case "DefinitionList": // TODO
    case "OrderedList": // TODO
    case "BulletList": // TODO
    case "Table": // TODO
    case "Null": // TODO
    case "LineBlock": // TODO
    default:
  }
  return {tag: "raw_block", format: "error",
          text: "Could not convert " + block.t};
}

const parsePandocJSON = function(json : string) : Doc | null {
  const footnotes : Record<string, Footnote> = {};
  let pandoc = JSON.parse(json);
  if (!pandoc) {
    return null;
  }
  let blocks = pandoc.blocks;
  let docblocks : Block[] = blocks.map(fromPandocBlock);

  return { tag: "doc",
           children: docblocks,
           footnotes: footnotes,
           references: {} };
}

export { PandocRenderer, parsePandocJSON };

