import { Doc, AstNode } from "./ast";

class DjotRenderer {

  doc : Doc;
  wrapwidth ?: number;
  prefixes : string[] = [];

  constructor(doc : Doc, wrapwidth ?: number) {
    this.doc = doc;
    this.wrapwidth = wrapwidth;
  }

  renderNode(node : AstNode) {

  }

  render() : string {
    return "";
  }

}

export { DjotRenderer }
