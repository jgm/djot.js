import { parse, ParseOptions } from "./ast";
import { renderHTML } from "./html";
const fs = require('fs');

const ignoreWarnings = () => { /* do nothing */ };

const testcases = [
  "attributes.test",
  "blockquote.test",
  "code_blocks.test",
  "definition_lists.test",
  "emoji.test",
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
  var lines = require('fs').readFileSync(fp, 'utf-8').split('\n');
  let idx: number = 0;
  const getLine = function(): string | null {
    if (idx < lines.length) {
      let line = lines[idx];
      idx++;
      return line;
    } else {
      return null;
    }
  }

  let tests: Test[] = [];
  let line: string | null;
  while (true) {
    let inp: string = "";
    let out: string = "";
    let pretext: string[] = [];
    line = getLine();
    while (line !== null && !line.match(/^```/)) {
      pretext.push(line);
      line = getLine();
    }
    let testlinenum = idx;
    if (line === null) {
      break;
    }
    let m = line.match(/^(`+)\s*(.*)/);
    if (!m) {
      throw ("Test start line did not have expected form.");
    }
    let ticks = new RegExp("^" + m[1]);
    let options = m[2];

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

describe("experimenting...", () => {
  it("reads line by line spans.test", () => {
    console.log(parseTests("test/spans.test"));
  });
});

