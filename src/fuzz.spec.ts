import { parse } from "./parse";

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
  it("does not exhibit pathological behavior on random input", () => {
    for (let i=1; i <= NUMTESTS; i++) {
      let s = randomstring();
      const ast = parse(s, {warn: (() => {})});
      expect(ast).toBeTruthy();
    }
  }, 10);
});

