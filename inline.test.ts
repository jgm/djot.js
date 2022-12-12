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
  });

  it("parses escapes", () => {
    let parser = new InlineParser('\\"\\*\\ \\a \\\n', () => {});
    parser.feed(0,10);
    expect(parser.getMatches()).toStrictEqual([
      { annot: "escape", startpos: 0, endpos: 0 },
      { annot: "str", startpos: 1, endpos: 1 },
      { annot: "escape", startpos: 2, endpos: 2 },
      { annot: "str", startpos: 3, endpos: 3 },
      { annot: "escape", startpos: 4, endpos: 4 },
      { annot: "nbsp", startpos: 5, endpos: 5 },
      { annot: "str", startpos: 6, endpos: 7 },
      { annot: "escape", startpos: 9, endpos: 9 },
      { annot: "hardbreak", startpos: 10, endpos: 10 }
    ]);
  });

  it("parses autolinks", () => {
    let parser = new InlineParser('<http://example.com?foo=bar&baz=&amp;x2>', () => {});
    //                             0123456789012345678901234567890123456789
    parser.feed(0,39);
    expect(parser.getMatches()).toStrictEqual([
      { annot: "+url", startpos: 0, endpos: 0 },
      { annot: "str", startpos: 1, endpos: 38 },
      { annot: "-url", startpos: 39, endpos: 39 }
    ]);
  });

  it("parses email autolinks", () => {
    let parser = new InlineParser('<me@example.com>', () => {});
    //                             0123456789012345
    parser.feed(0,15);
    expect(parser.getMatches()).toStrictEqual([
      { annot: "+email", startpos: 0, endpos: 0 },
      { annot: "str", startpos: 1, endpos: 14 },
      { annot: "-email", startpos: 15, endpos: 15 }
    ]);
  });


})
