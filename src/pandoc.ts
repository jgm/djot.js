import { AstNode, Doc, Term, Definition, Reference, Footnote } from "./ast";

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

class PandocRenderer {
  doc : Doc;
  warn : (msg : string) => void;

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

  toPandocAttr = function(node : AstNode) : PandocAttr {
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
        let attrs = this.toPandocAttr(node);
        if (node.tag === "section") {
          attrs[1].unshift("section");
        }
        elts.push({ t: "Div", c: [attrs, this.toPandocChildren(node)] });
        break;
      }

      case "blockquote":
        elts.push({ t: "BlockQuote", c: this.toPandocChildren(node) });
        break;

      case "list": { // TODO list styles etc.
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
        elts.push({ t: "Header", c: [node.level, this.toPandocAttr(node),
                                     this.toPandocChildren(node)] });
        break;

      case "code_block": {
        let attrs = this.toPandocAttr(node);
        if (node.lang) {
          attrs[1].unshift(node.lang);
        }
        elts.push({ t: "CodeBlock", c: [attrs, node.text] });
        break;
      }

      case "thematic_break":
        elts.push({ t: "HorizontalRule" });
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
        elts.push({ t: "Code", c: [this.toPandocAttr(node), node.text] });
        break;

      case "math":
        elts.push({ t: "Math",
                    c: [{t: node.display ? "DisplayMath" : "InlineMath"}, 
                         node.text] });
        break;

      case "left_single_quote":
        elts.push({ t: "Str", c: "‘" });
        break;

      case "right_single_quote":
        elts.push({ t: "Str", c: "’" });
        break;

      case "left_double_quote":
        elts.push({ t: "Str", c: "“" });
        break;

      case "right_double_quote":
        elts.push({ t: "Str", c: "”" });
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
       let attrs = this.toPandocAttr({tag: "link", attributes: linkAttrs,
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
        let note = this.doc.footnotes[node.text]; // TODO make an object
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

export { PandocRenderer, Pandoc, PandocMeta, PandocElt };

