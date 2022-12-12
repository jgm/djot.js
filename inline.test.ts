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

  it("parses super/subscript", () => {
    let parser = new InlineParser('H~2~O e=mc^2^ test{^two words^}', () => {});
    //                             0123456789012345678901234567890
    parser.feed(0,30);
    expect(parser.getMatches()).toStrictEqual([
      { annot: "str", startpos: 0, endpos: 0 },
      { annot: "+subscript", startpos: 1, endpos: 1 },
      { annot: "str", startpos: 2, endpos: 2 },
      { annot: "-subscript", startpos: 3, endpos: 3 },
      { annot: "str", startpos: 4, endpos: 9 },
      { annot: "+superscript", startpos: 10, endpos: 10 },
      { annot: "str", startpos: 11, endpos: 11 },
      { annot: "-superscript", startpos: 12, endpos: 12 },
      { annot: "str", startpos: 13, endpos: 17 },
      { annot: "+superscript", startpos: 18, endpos: 19 },
      { annot: "str", startpos: 20, endpos: 28 },
      { annot: "-superscript", startpos: 29, endpos: 30 }
    ]);
  });

  it("parses emphasis", () => {
    let parser = new InlineParser('_hello *there*_ world', () => {});
    //                             012345678901234567890
    parser.feed(0,20);
    expect(parser.getMatches()).toStrictEqual([
      { annot: "+emph", startpos: 0, endpos: 0 },
      { annot: "str", startpos: 1, endpos: 6 },
      { annot: "+strong", startpos: 7, endpos: 7 },
      { annot: "str", startpos: 8, endpos: 12 },
      { annot: "-strong", startpos: 13, endpos: 13 },
      { annot: "-emph", startpos: 14, endpos: 14 },
      { annot: "str", startpos: 15, endpos: 20 }
    ]);
  });

  it("parses mark", () => {
    let parser = new InlineParser('{=hello=}', () => {});
    //                             012345678
    parser.feed(0,8);
    expect(parser.getMatches()).toStrictEqual([
      { annot: "+mark", startpos: 0, endpos: 1 },
      { annot: "str", startpos: 2, endpos: 6 },
      { annot: "-mark", startpos: 7, endpos: 8 },
    ]);
  });

  it("parses inserted", () => {
    let parser = new InlineParser('{+hello+}', () => {});
    //                             012345678
    parser.feed(0,8);
    expect(parser.getMatches()).toStrictEqual([
      { annot: "+insert", startpos: 0, endpos: 1 },
      { annot: "str", startpos: 2, endpos: 6 },
      { annot: "-insert", startpos: 7, endpos: 8 },
    ]);
  });

  it("parses quoted", () => {
    let parser = new InlineParser('"dog\'s breakfast"', () => {});
    //                             0123 4567890123456
    parser.feed(0,16);
    expect(parser.getMatches()).toStrictEqual([
      { annot: "+double_quoted", startpos: 0, endpos: 0 },
      { annot: "str", startpos: 1, endpos: 3 },
      { annot: "right_single_quote", startpos: 4, endpos: 4 },
      { annot: "str", startpos: 5, endpos: 15 },
      { annot: "-double_quoted", startpos: 16, endpos: 16 },
    ]);
  });

  it("parses attributes", () => {
    let parser = new InlineParser('{#foo .bar baz="bim"}', () => {});
    //                             012345678901234567890
    parser.feed(0,20);
    expect(parser.getMatches()).toStrictEqual([
      { annot: "+attributes", startpos: 0, endpos: 0 },
      { annot: "id", startpos: 2, endpos: 4 },
      { annot: "class", startpos: 7, endpos: 9 },
      { annot: "key", startpos: 11, endpos: 13 },
      { annot: "value", startpos: 16, endpos: 18 },
      { annot: "-attributes", startpos: 20, endpos: 20 }
    ]);
  });

  it("parses emojis", () => {
    let parser = new InlineParser(':+1:', () => {});
    //                             0123
    parser.feed(0,3);
    expect(parser.getMatches()).toStrictEqual([
      { annot: "emoji", startpos: 0, endpos: 3 }
    ]);
  });

  it("parses ellipses", () => {
    let parser = new InlineParser('...', () => {});
    //                             0123
    parser.feed(0,2);
    expect(parser.getMatches()).toStrictEqual([
      { annot: "ellipses", startpos: 0, endpos: 2 }
    ]);
  });


})
