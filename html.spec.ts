import { parse, ParseOptions, Doc } from "./ast";
import { renderHTML } from "./html";

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
