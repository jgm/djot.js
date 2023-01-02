import { parse, renderAST } from "./parse";
import { renderHTML } from "./html";

const ignoreWarnings = () => { /* do nothing */ };

const testfiles = [
  "attributes.test",
  "blockquote.test",
  "code_blocks.test",
  "definition_lists.test",
  "symbol.test",
  "emphasis.test",
  "escapes.test",
  "fenced_divs.test",
  "footnotes.test",
  "headings.test",
  "insert_delete_mark.test",
  "links_and_images.test",
  "lists.test",
  "math.test",
  "para.test",
  "raw.test",
  "regression.test",
  "smart.test",
  "spans.test",
  "sourcepos.test",
  "super_subscript.test",
  "tables.test",
  "task_lists.test",
  "thematic_breaks.test",
  "verbatim.test"
];

type Filter = string;

interface Test {
  file: string;
  linenum: number;
  pretext: string;
  options: string;
  filters: Filter[];
  input: string;
  output: string;
}


const parseTests = function(fp: string): Test[] {
  const lines = require('fs').readFileSync(fp, 'utf-8').split('\n');
  let idx = 0;
  const getLine = function(): string | null {
    if (idx < lines.length) {
      const line = lines[idx];
      idx++;
      return line;
    } else {
      return null;
    }
  }

  const tests: Test[] = [];
  let line: string | null;
  while (true) {
    let inp = "";
    let out = "";
    const pretext: string[] = [];
    line = getLine();
    while (line !== null && !line.match(/^```/)) {
      pretext.push(line);
      line = getLine();
    }
    const testlinenum = idx;
    if (line === null) {
      break;
    }
    const m = line.match(/^(`+)\s*(.*)/);
    if (!m) {
      throw (new Error("Test start line did not have expected form."));
    }
    const ticks = new RegExp("^" + m[1]);
    const options = m[2];

    // parse input
    line = getLine();
    while (line !== null && !line.match(/^[.!]$/)) {
      inp = inp + line + "\n";
      line = getLine();
    }

    // parse filters (TODO)

    // parse expected output
    line = getLine();
    while (line !== null && !line.match(ticks)) {
      out = out + line + "\n";
      line = getLine();
    }

    tests.push({
      file: fp,
      linenum: testlinenum,
      pretext: pretext.join("\n"),
      options: options,
      filters: [],
      input: inp,
      output: out,
    });
  }
  return tests;
}

testfiles.forEach((file: string) => {

  const fp = "test/" + file;
  describe(fp, () => {
    const tests = parseTests(fp);
    tests.forEach((test: Test) => {
      it("line " + test.linenum, () => {
        const options = { sourcePositions: false,
                        warn: ignoreWarnings };
        if (test.options.match(/p/)) {
          options.sourcePositions = true;
        }
        const ast = parse(test.input, options);
        let result;
        if (test.options.match(/a/)) {
          result = renderAST(ast);
        } else {
          result = renderHTML(ast, { warn: ignoreWarnings });
        }
        expect(result).toStrictEqual(test.output);
      });
    });
  });

});

