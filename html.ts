import { Doc } from "./ast.js";

const blockTag : Record<string, boolean> = {
  para: true,
  blockquote: true,
  thematic_break: true,
  list_item: true,
  list: true,
  code_block: true,
  heading: true,
  table: true
}

const renderHTML = function(doc : Doc) : string {
  return "";
}

export { renderHTML }

