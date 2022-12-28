import { parse, ParseOptions, Doc } from "./ast";
import { renderHTML } from "./html";

const ignoreWarnings = () => { /* do nothing */ };

describe("Parser", () => {
  it("parses paragraphs", () => {
    const ast = parse("hi there\nfriend\n\nnew para", { warn: ignoreWarnings });
    expect(renderHTML(ast, { warn: ignoreWarnings })).toEqual(
`<p>hi there
friend</p>
<p>new para</p>
`
    );
  });

});
