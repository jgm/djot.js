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
  });
  it("parses verbatim", () => {
    let parser = new InlineParser("x ``` hello ``there ``` x", () => {});
    //                             0123456789012345678901234
    parser.feed(0,24);
    expect(parser.getMatches()).toStrictEqual([
      { annot: "str", startpos: 0, endpos: 1 },
      { annot: "+verbatim", startpos: 2, endpos: 4 },
      { annot: "str", startpos: 5, endpos: 19 },
      { annot: "-verbatim", startpos: 20, endpos: 22 },
      { annot: "str", startpos: 23, endpos: 24 }
    ]);
  })
})
