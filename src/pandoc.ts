import { AstNode, Doc } from "./ast";

interface Pandoc {
  ["pandoc-api-version"]: number[],
  meta: PandocMeta,
  blocks: PandocElt[],
}

type PandocMeta = Record<string,PandocElt>

interface PandocElt {
  t: string,
  c?: PandocElt[] | string;
}

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

const addToPandocElts = function(elts : PandocElt[], node : any, ) : void {
  switch (node.tag) {
    case "para":
      elts.push({ t: "Para", c: toPandocChildren(node) });
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

    case "emph":
      elts.push({ t: "Emph", c: toPandocChildren(node) });
      break;

    default:
      throw("Unknown node " + node.tag);
  }
}

const toPandoc = function(doc : Doc) : Pandoc {
  return { ["pandoc-api-version"]: [1,22,2,1],
           meta: {},
           blocks: toPandocChildren(doc) };
}

export { toPandoc, Pandoc, PandocMeta, PandocElt };

