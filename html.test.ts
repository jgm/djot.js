import { parse, ParseOptions, Doc } from "./ast.js";
import { HTMLRenderer } from "./html.js";

const ignoreWarnings = () => { /* do nothing */ };

describe("Parser", () => {
  it("parses paragraphs", () => {
    let ast = parse("hi there\nfriend\n\nnew para", {});
    let renderer = new HTMLRenderer();
    expect(renderer.render(ast)).toEqual(
`<p>hi there
friend</p>
<p>new para</p>
`
    );
  });

});
