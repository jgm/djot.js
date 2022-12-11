import { InlineParser } from "./inline.js";

describe("InlineParser", () => {
  it("does basic parsing", () => {
    let parser = new InlineParser("hello there", () => {});
    parser.feed(0,6);
    parser.feed(8,10);
    expect(parser.getMatches()).toStrictEqual([
      { annot: "str", startpos: 0, endpos: 6 },
      { annot: "str", startpos: 8, endpos: 10 }
    ]);
  })
})
