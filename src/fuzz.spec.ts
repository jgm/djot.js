import { parse } from "./parse";
import { performance } from "perf_hooks";

const MAXLINES = 5;
const MAXLENGTH = 5;
const NUMTESTS = 5000;

const activechars = [
  '\t', ' ', '[', ']', '1', '2', 'a', 'b',
  'A', 'B', 'I', 'V', 'i', 'v', '.', ')', '(',
  '{', '}', '=', '+', '_', '-', '*', '!', '>',
  '<', '`', '~'
];

const activecharslen : number = activechars.length;

const random = function(low : number, high : number) : number {
  return Math.floor(Math.random() * (high - low)) + low;
}

const randomstring = function() : string {
  let numlines = random(1, MAXLINES);
  let buffer : string[] = [];
  for (let j=1; j <= numlines; j++) {
    let res = "";
    // -1 to privilege blank lines
    let len = random(-1, MAXLENGTH);
    if (len < 0) { len = 0 }
    for (let i=1; i<=len; i++) {
      let charclass = random(1, 4);
      if (charclass < 4) {
        res = res + activechars[random(0, activecharslen - 1)];
      } else {
        res = res + String.fromCodePoint(random(1, 200));
      }
    }
    buffer.push(res);
  }
  return buffer.join("\n");
}

describe("Fuzz tests", () => {
  const timeout = 80;
  it("does not exhibit pathological behavior on random input", async () => {
    await new Promise(r => setTimeout(r,0)); // dummy sleep see #6
    for (let i=1; i <= NUMTESTS; i++) {
      let s = randomstring();
      let startTime = performance.now();
      const ast = parse(s, {warn: (() => {})});
      let endTime = performance.now();
      let elapsed = endTime - startTime;
      let status : string;
      if (!ast) {
        status = "Could not parse:\n" + s;
      } else if (elapsed > timeout) {
        status = "Parsing took too long (" + elapsed.toFixed(1) + " ms) for:\n" + s;
      } else {
        status = "OK";
      }
      expect(status).toBe("OK");
    }
  }, timeout * NUMTESTS);
});

