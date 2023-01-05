import { parse } from "./parse";
import { renderHTML } from "./html";

describe("Parser", () => {
  it("parses paragraphs", () => {
    const ast = parse("hi there\nfriend\n\nnew para");
    expect(renderHTML(ast)).toEqual(
`<p>hi there
friend</p>
<p>new para</p>
`
    );
  });

});
