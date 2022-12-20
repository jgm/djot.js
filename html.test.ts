import { parse, ParseOptions, Doc } from "./ast.js";
import { renderDOM } from "./html.js";

const ignoreWarnings = () => { /* do nothing */ };

describe("Parser", () => {
  it("parses paragraphs", () => {
    let ast = parse("hi there\nfriend\n\nnew para", {});
    expect(renderDOM(ast).outerHTML).toEqual("<p></p>"
    );
  });

});
