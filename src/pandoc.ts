import { AstNode, Doc } from "./ast";

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

const toPandocChildren = function(node : AstNode) : PandocElt[] {
  if ("children" in node) {
      let children : PandocElt[] = [];
      node.children.forEach((child : AstNode) => {
        addToPandocElts(children, child);
      });
      return children;
  } else {
    return [];
  }
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

const fixTight = function(elt : PandocElt) : PandocElt {
  if (elt.t === "Para") {
    elt.t = "Plain"
  }
  return elt;
}

const addToPandocElts = function(elts : PandocElt[], node : any, ) : void {
  switch (node.tag) {
    case "section":
    case "div": {
      let attrs = toPandocAttr(node);
      if (node.tag === "section") {
        attrs[1].unshift("section");
      }
      elts.push({ t: "Div", c: [attrs, toPandocChildren(node)] });
      break;
    }

    case "blockquote":
      elts.push({ t: "BlockQuote", c: toPandocChildren(node) });
      break;

    case "list": { // TODO list styles etc.
      let items : PandocElt[][];
      if (node.tight) {
        items = node.children.map((item : AstNode) => {
                            return toPandocChildren(item).map(fixTight)
        });
      } else {
        items = node.children.map(toPandocChildren);
      }
      if (node.style &&
          node.style === "-" || node.style === "+" || node.style === "*") {
        elts.push({ t: "BulletList", c: items } );
      } else { // TODO other styles
        process.stderr.write("Skipping unhandled list style " + node.style + "\n");
      }
      break;
    }

    case "list_item": // should be handled at "list" above
      break;

    case "para":
      elts.push({ t: "Para", c: toPandocChildren(node) });
      break;

    case "heading":
      elts.push({ t: "Header", c: [node.level, toPandocAttr(node),
                                   toPandocChildren(node)] });
      break;

    case "code_block": {
      let attrs = toPandocAttr(node);
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
      elts.push({ t: "Code", c: [toPandocAttr(node), node.text] });
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

    case "link": {
      let attrs = toPandocAttr(node);
      let url = node.destination || "";
      let title = (node.attributes && node.attributes.title) || "";
      if (title) {
        attrs[2] = attrs[2].filter(([k,v]) => k !== "title");
      }
      elts.push({ t: "Link", c: [attrs, toPandocChildren(node),
                                  [url, title]] });
      break;
    }

    case "image": {
      let attrs = toPandocAttr(node);
      let url = node.destination || "";
      let title = (node.attributes && node.attributes.title) || "";
      if (title) {
        attrs[2] = attrs[2].filter(([k,v]) => k !== "title");
      }
      elts.push({ t: "Image", c: [attrs, toPandocChildren(node),
                                  [url, title]] });
      break;
    }

    case "emph":
      elts.push({ t: "Emph", c: toPandocChildren(node) });
      break;

    default:
      process.stderr.write("Skipping unhandled node " + node.tag + "\n");
  }
}

const toPandoc = function(doc : Doc) : Pandoc {
  return { ["pandoc-api-version"]: [1,22,2,1],
           meta: {},
           blocks: toPandocChildren(doc) };
}

export { toPandoc, Pandoc, PandocMeta, PandocElt };

