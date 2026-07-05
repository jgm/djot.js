import { parse } from "./parse";
import { renderHTML } from "./html";
import { performance } from "perf_hooks";

const n = 500;

const deeplynested : string[] = [];
for (let i=0; i < n; i++) {
  deeplynested[i] = " ".repeat(i+1) + "* a\n";
}

const backticks : string[] = [];
for (let i=0; i < 5 * n; i++) {
  backticks[i] = "e" + "`".repeat(i+1);
}

const tests : Record<string, string> = {
  ["nested strong emph"]:
    "_a *a ".repeat(65*n) + "b" + " a* a_".repeat(65*n),
  ["many emph closers with no openers"]:
    "a_ ".repeat(65*n),
  ["many emph openers with no closers"]:
    "_a ".repeat(65*n),
  ["many link closers with no openers"]:
    "a]".repeat(65*n),
  ["many link openers with no closers"]:
    "[a".repeat(65*n),
  ["mismatched openers and closers"]:
    "*a_ ".repeat(50*n),
  ["issue cmark#389"]:
    "*a ".repeat(20*n) + "_a*_ ".repeat(20*n),
  ["openers and closers multiple of 3"]:
    "a**b" + "8* ".repeat(50 * n),
  ["link openers and emph closers"]:
    "[ a_".repeat(50 * n),
  ["pattern [ (]( repeated"]:
    "[ (](".repeat(80 * n),
  ["nested brackets"]:
    "[".repeat(50 * n) + "a" + "]".repeat(50*n),
  ["nested block quotes"]:
    "> ".repeat(50*n) + "a",
  ["deeply nested lists"]:
    deeplynested.join(""),
  ["backticks"]:
    backticks.join(""),
  ["unclosed links"]:
    "[a](<b".repeat(30 * n),
  ["unclosed attributes"]:
    "a{#id k=".repeat(30 * n),
  ["unclosed link destinations"]:
    "[label](blah  ".repeat(30 * n),
  ["unbalanced paren in link label"]:
    "[label)](foo ".repeat(30 * n),
  ["balanced nested parens in destinations"]:
    "[label](foo (bar (baz)) ".repeat(30 * n),
  ["footnote reference starts"]:
    "[^".repeat(200 * n),
};

describe("Pathological tests", () => {
  for (const testname in tests) {
    it("does not exhibit pathological behavior on " + testname, () => {
      const test : string = tests[testname];
      const start = performance.now();
      const ast = parse(test);
      const end = performance.now();
      expect(ast).toBeTruthy();
      expect(end - start).toBeLessThan(1000);
    });
  }
});

// Labels that collide with Object.prototype properties must behave
// exactly like any other undefined label:
describe("Labels inherited from Object.prototype", () => {
  const badLabels = ["constructor", "toString", "hasOwnProperty", "__proto__"];

  const html = (s : string) : string => renderHTML(parse(s));

  it("treats undefined footnote labels like any other label", () => {
    for (const label of badLabels) {
      expect(html(`hi[^${label}]\n`)).toEqual(html("hi[^zzz]\n"));
    }
  });

  it("treats undefined reference labels like any other label", () => {
    for (const label of badLabels) {
      expect(html(`[x][${label}]\n`)).toEqual(html("[x][zzz]\n"));
    }
  });

  it("resolves defined references with prototype-colliding labels", () => {
    for (const label of badLabels) {
      expect(html(`[x][${label}]\n\n[${label}]: /url\n`))
        .toEqual("<p><a href=\"/url\">x</a></p>\n");
    }
  });

  it("resolves defined footnotes with prototype-colliding labels", () => {
    for (const label of badLabels) {
      expect(html(`hi[^${label}]\n\n[^${label}]: note\n`))
        .toEqual(html("hi[^zzz]\n\n[^zzz]: note\n"));
    }
  });

  it("does not treat prototype-colliding heading ids as duplicates", () => {
    expect(html("# constructor\n"))
      .toEqual("<section id=\"constructor\">\n<h1>constructor</h1>\n</section>\n");
  });
});
