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

  it("render auto genreated references and attributes",()=>{
    expect(renderHTML(parse(readme))).toEqual(
`<section id="djot-js">
<h1>djot.js</h1>
<p>A library and command-line tool for parsing and
rendering the light markup format <a href="https://djot.net">djot</a>.</p>
</section>
`
    )

  })

});
