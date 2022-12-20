import { parse, ParseOptions, Doc } from "./ast.js";
import { renderHTML } from "./html.js";

const ignoreWarnings = () => { /* do nothing */ };

describe("Parser", () => {
  it("parses paragraphs", () => {
    let ast = parse("hi there\nfriend\n\nnew para", {});
    expect(renderHTML(ast)).toEqual(
`<p>hi there
friend</p>
<p>new para</p>
`
    );
  });

});
