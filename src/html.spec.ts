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

   const readme = `# djot.js

A library and command-line tool for parsing and
rendering the light markup format [djot](https://djot.net).`

  it("render auto generated references and attributes",()=>{
    expect(renderHTML(parse(readme))).toEqual(
`<section id="djot-js">
<h1>djot.js</h1>
<p>A library and command-line tool for parsing and
rendering the light markup format <a href="https://djot.net">djot</a>.</p>
</section>
`
    )

  })

  it("preserves text before inline image", () => {
    expect(renderHTML(parse('hello ![alt](img.png) world'))).toEqual(
`<p>hello <img alt="alt" src="img.png"> world</p>
`
    );
  });

  it("closes a fenced div with CRLF line endings", () => {
    // Regression test for issue #113: with CRLF line endings the closing
    // ::: fence must close the div, so following content ("after") lands
    // outside the div rather than being swallowed inside an unclosed div.
    const expected =
`<div>
<p>hello</p>
</div>
<p>after</p>
`;
    expect(renderHTML(parse(":::\r\nhello\r\n:::\r\nafter\r\n"))).toEqual(expected);
    // The LF equivalent is unchanged and produces byte-identical HTML.
    expect(renderHTML(parse(":::\nhello\n:::\nafter\n"))).toEqual(expected);
  });

});
