import { Doc } from "./ast.js";

const renderDOM = function(doc : Doc) : HTMLElement {
  return document.createElement("p");
}

export { renderDOM }

