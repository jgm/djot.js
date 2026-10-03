import { parse } from "./parse";
import { renderHTML, HTMLRenderer } from "./html";
import { AstNode, HasChildren } from "./ast";

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

// The block and inline parsers are iterative, so they happily build ASTs
// far deeper than the JS call stack can hold.  The renderer must be able
// to render them back: a recursive renderer overflows at around a
// thousand levels of nesting.
describe("Deeply nested content", () => {
  const depth = 20000;
  const html = (s : string) : string => renderHTML(parse(s), { warn: () => {} });

  it("renders deeply nested block quotes", () => {
    expect(html("> ".repeat(depth) + "a\n")).toEqual(
      "<blockquote>\n".repeat(depth) +
      "<p>a</p>\n" +
      "</blockquote>\n".repeat(depth));
  });

  it("renders deeply nested spans", () => {
    expect(html("[".repeat(depth) + "a" + "]{.x}".repeat(depth) + "\n")).toEqual(
      "<p>" + '<span class="x">'.repeat(depth) +
      "a" + "</span>".repeat(depth) + "</p>\n");
  });

  it("renders deeply nested emphasis", () => {
    expect(html("_".repeat(depth) + "a" + "_".repeat(depth) + "\n")).toEqual(
      "<p>" + "<em>".repeat(depth) + "a" + "</em>".repeat(depth) + "</p>\n");
  });

  it("renders a deeply nested footnote", () => {
    expect(html("x[^1]\n\n[^1]: " + "> ".repeat(depth) + "a\n")).toEqual(
      '<p>x<a id="fnref1" href="#fn1" role="doc-noteref"><sup>1</sup></a></p>\n' +
      '<section role="doc-endnotes">\n<hr>\n<ol>\n<li id="fn1">\n' +
      "<blockquote>\n".repeat(depth) +
      "<p>a</p>\n" +
      "</blockquote>\n".repeat(depth) +
      // the note does not end in </p>, so the backlink gets its own
      // paragraph rather than being tucked into the last one
      '<p><a href="#fnref1" role="doc-backlink">\u21A9\uFE0E</a></p>\n' +
      "</li>\n</ol>\n</section>\n");
  });

  // Alt text and heading ids are gathered by getStringContent, which
  // walks the same deeply nested children:
  it("renders deeply nested image alt text", () => {
    expect(html("![" + "[".repeat(depth) + "a" + "]{.x}".repeat(depth) + "](u)\n"))
      .toEqual('<p><img alt="a" src="u"></p>\n');
  });

  it("derives a heading id from deeply nested content", () => {
    expect(html("# " + "[".repeat(depth) + "a" + "]{.x}".repeat(depth) + "\n"))
      .toEqual('<section id="a">\n<h1>' +
        '<span class="x">'.repeat(depth) + "a" + "</span>".repeat(depth) +
        "</h1>\n</section>\n");
  });
});

// The renderer no longer uses inTags itself -- it splits each node into
// the text before and after its children, so the walk can stay iterative
// -- but overrides may still call it, so its contract is pinned here.
describe("inTags", () => {
  const withOverride = (src: string,
    f: (node: AstNode & HasChildren<AstNode>, r: HTMLRenderer) => string,
    tag = "emph") =>
    renderHTML(parse(src), { warn: () => {}, overrides: { [tag]: f } });

  it("places newlines according to its third argument", () => {
    // 0: no newline either side; 1: after the close tag; 2: both
    expect(withOverride("_a_", (n, r) => r.inTags("em", n, 0)))
      .toEqual("<p><em>a</em></p>\n");
    expect(withOverride("_a_", (n, r) => r.inTags("em", n, 1)))
      .toEqual("<p><em>a</em>\n</p>\n");
    expect(withOverride("_a_", (n, r) => r.inTags("em", n, 2)))
      .toEqual("<p><em>\na</em>\n</p>\n");
  });

  it("renders the node's own attributes", () => {
    expect(withOverride("_a_{#i .c k=v}", (n, r) => r.inTags("em", n, 0)))
      .toEqual('<p><em id="i" class="c" k="v">a</em></p>\n');
  });

  it("merges an extra class with the node's own", () => {
    expect(withOverride("_a_{.c}",
      (n, r) => r.inTags("em", n, 0, { class: "extra" })))
      .toEqual('<p><em class="extra c">a</em></p>\n');
  });

  it("reproduces the default rendering of a block tag", () => {
    const src = "> - a\n  - b\n";
    expect(withOverride(src,
      (n, r) => r.inTags("blockquote", n, 2), "block_quote"))
      .toEqual(renderHTML(parse(src), { warn: () => {} }));
  });

  it("renders children that are deeper than the call stack", () => {
    // inTags goes through renderChildren, so only the node it is called
    // on costs stack: its subtree is walked iteratively.
    const depth = 20000;
    const src = "> " + "_".repeat(depth) + "a" + "_".repeat(depth) + "\n";
    expect(withOverride(src,
      (n, r) => r.inTags("blockquote", n, 2), "block_quote"))
      .toEqual("<blockquote>\n<p>" + "<em>".repeat(depth) + "a" +
        "</em>".repeat(depth) + "</p>\n</blockquote>\n");
  });
});
