import { parse } from "./parse";
import { renderHTML } from "./html";
import { Warning } from "./options";

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

  it("renders deeply nested content without exhausting the stack", () => {
    const warnings : Warning[] = [];
    const warn = (w : Warning) => { warnings.push(w); };
    const quotes = renderHTML(parse("> ".repeat(25000) + "a *b* <c>\n"), { warn });
    expect(quotes).toContain("<blockquote>\na b &lt;c&gt;</blockquote>");
    expect(quotes.split("<blockquote>").length - 1).toEqual(256);
    expect(warnings.length).toEqual(1);
    expect(renderHTML(parse("- ".repeat(1024) + "x\n"), { warn })).toContain("x");
    expect(renderHTML(parse("> ".repeat(300) + "a\\ b :foo:\n"), { warn }))
      .toContain("a\u00A0b :foo:</blockquote>");
  });

  it("does not flatten ordinary nesting", () => {
    expect(renderHTML(parse("> ".repeat(200) + "*a*\n"))).toContain("<strong>a</strong>");
  });

});
