import { AstNode, Doc } from "./ast";

interface Pandoc {
  ["pandoc-api-version"]: number[],
  meta: PandocMeta,
  blocks: PandocElt[],
}

type PandocMeta = Record<string,PandocElt>

interface PandocElt {
  t: string,
  c?: PandocElt[]
}

const toPandoc = function(ast : Doc) : Pandoc {
  let blocks : PandocElt[] = [];
  let meta = {};
  return { ["pandoc-api-version"]: [1,22,2,1],
           meta: meta,
           blocks: blocks };
}

export { toPandoc, Pandoc, PandocMeta, PandocElt };

