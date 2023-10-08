import { InlineParser } from "./inline";

describe("InlineParser", () => {
  it("does basic parsing", () => {
    const parser = new InlineParser("hello there");
    parser.feed(0,6);
    parser.feed(8,10);
    expect(parser.getMatches()).toStrictEqual([
      { annot: "str", startpos: 0, endpos: 6 },
      { annot: "str", startpos: 8, endpos: 10 }
    ]);
  });

  it("parses verbatim", () => {
    const parser = new InlineParser("x ``` hello ``there ``` x");
    //                             0123456789012345678901234
    parser.feed(0,24);
    expect(parser.getMatches()).toStrictEqual([
      { annot: "str", startpos: 0, endpos: 1 },
      { annot: "+verbatim", startpos: 2, endpos: 4 },
      { annot: "str", startpos: 5, endpos: 11 },
      { annot: "str", startpos: 12, endpos: 13 },
      { annot: "str", startpos: 14, endpos: 19 },
      { annot: "-verbatim", startpos: 20, endpos: 22 },
      { annot: "str", startpos: 23, endpos: 24 }
    ]);
  });

  it("parses escapes", () => {
    const parser = new InlineParser('\\"\\*\\ \\a \\\n');
    parser.feed(0,10);
    expect(parser.getMatches()).toStrictEqual([
      { annot: "escape", startpos: 0, endpos: 0 },
      { annot: "str", startpos: 1, endpos: 1 },
      { annot: "escape", startpos: 2, endpos: 2 },
      { annot: "str", startpos: 3, endpos: 3 },
      { annot: "escape", startpos: 4, endpos: 4 },
      { annot: "non_breaking_space", startpos: 5, endpos: 5 },
      { annot: "str", startpos: 6, endpos: 6 },
      { annot: "str", startpos: 7, endpos: 7 },
      { annot: "escape", startpos: 9, endpos: 9 },
      { annot: "hard_break", startpos: 10, endpos: 10 }
    ]);
  });

  it("parses autolinks", () => {
    const parser = new InlineParser('<http://example.com?foo=bar&baz=&amp;x2>');
    //                             0123456789012345678901234567890123456789
    parser.feed(0,39);
    expect(parser.getMatches()).toStrictEqual([
      { annot: "+url", startpos: 0, endpos: 0 },
      { annot: "str", startpos: 1, endpos: 38 },
      { annot: "-url", startpos: 39, endpos: 39 }
    ]);
  });

  it("parses email autolinks", () => {
    const parser = new InlineParser('<me@example.com>');
    //                             0123456789012345
    parser.feed(0,15);
    expect(parser.getMatches()).toStrictEqual([
      { annot: "+email", startpos: 0, endpos: 0 },
      { annot: "str", startpos: 1, endpos: 14 },
      { annot: "-email", startpos: 15, endpos: 15 }
    ]);
  });

  it("parses super/subscript", () => {
    const parser = new InlineParser('H~2~O e=mc^2^ test{^two words^}');
    //                             0123456789012345678901234567890
    parser.feed(0,30);
    expect(parser.getMatches()).toStrictEqual([
      { annot: "str", startpos: 0, endpos: 0 },
      { annot: "+subscript", startpos: 1, endpos: 1 },
      { annot: "str", startpos: 2, endpos: 2 },
      { annot: "-subscript", startpos: 3, endpos: 3 },
      { annot: "str", startpos: 4, endpos: 6 },
      { annot: "str", startpos: 7, endpos: 7 },
      { annot: "str", startpos: 8, endpos: 9 },
      { annot: "+superscript", startpos: 10, endpos: 10 },
      { annot: "str", startpos: 11, endpos: 11 },
      { annot: "-superscript", startpos: 12, endpos: 12 },
      { annot: "str", startpos: 13, endpos: 17 },
      { annot: "open_marker", startpos: 18, endpos: 18 },
      { annot: "+superscript", startpos: 18, endpos: 19 },
      { annot: "str", startpos: 20, endpos: 28 },
      { annot: "-superscript", startpos: 29, endpos: 30 }
    ]);
  });

  it("parses emphasis", () => {
    const parser = new InlineParser('_hello *there*_ world');
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
    const parser = new InlineParser('{=hello=}');
    //                             012345678
    parser.feed(0,8);
    expect(parser.getMatches()).toStrictEqual([
      { annot: "open_marker", startpos: 0, endpos: 0 },
      { annot: "+mark", startpos: 0, endpos: 1 },
      { annot: "str", startpos: 2, endpos: 6 },
      { annot: "-mark", startpos: 7, endpos: 8 },
    ]);
  });

  it("parses inserted", () => {
    const parser = new InlineParser('{+hello+}');
    //                             012345678
    parser.feed(0,8);
    expect(parser.getMatches()).toStrictEqual([
      { annot: "open_marker", startpos: 0, endpos: 0 },
      { annot: "+insert", startpos: 0, endpos: 1 },
      { annot: "str", startpos: 2, endpos: 6 },
      { annot: "-insert", startpos: 7, endpos: 8 },
    ]);
  });

  it("parses quoted", () => {
    const parser = new InlineParser('"dog\'s breakfast"');
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
    const parser = new InlineParser('{#foo .bar baz="bim"}');
    //                               012345678901234567890
    parser.feed(0,20);
    expect(parser.getMatches()).toStrictEqual([
      { annot: "+attributes", startpos: 0, endpos: 0 },
      { annot: "attr_id_marker", startpos: 1, endpos: 1 },
      { annot: "id", startpos: 2, endpos: 4 },
      { annot: "attr_space", startpos: 5, endpos: 5 },
      { annot: "attr_class_marker", startpos: 6, endpos: 6 },
      { annot: "class", startpos: 7, endpos: 9 },
      { annot: "attr_space", startpos: 10, endpos: 10 },
      { annot: "key", startpos: 11, endpos: 13 },
      { annot: "attr_equal_marker", startpos: 14, endpos: 14 },
      { annot: "attr_quote_marker", startpos: 15, endpos: 15 },
      { annot: "value", startpos: 16, endpos: 18 },
      { annot: "attr_quote_marker", startpos: 19, endpos: 19 },
      { annot: "-attributes", startpos: 20, endpos: 20 }
    ]);
  });

  it("parses spans", () => {
    const parser = new InlineParser('[hi]{#foo .bar baz="bim"}');
      //                             0123456789012345678901234
    parser.feed(0,24);
    expect(parser.getMatches()).toStrictEqual([
      { annot: "+span", startpos: 0, endpos: 0 },
      { annot: "str", startpos: 1, endpos: 2 },
      { annot: "-span", startpos: 3, endpos: 3 },
      { annot: "+attributes", startpos: 4, endpos: 4 },
      { annot: "attr_id_marker", startpos: 5, endpos: 5 },
      { annot: "id", startpos: 6, endpos: 8 },
      { annot: "attr_space", startpos: 9, endpos: 9 },
      { annot: "attr_class_marker", startpos: 10, endpos: 10 },
      { annot: "class", startpos: 11, endpos: 13 },
      { annot: "attr_space", startpos: 14, endpos: 14 },
      { annot: "key", startpos: 15, endpos: 17 },
      { annot: "attr_equal_marker", startpos: 18, endpos: 18 },
      { annot: "attr_quote_marker", startpos: 19, endpos: 19 },
      { annot: "value", startpos: 20, endpos: 22 },
      { annot: "attr_quote_marker", startpos: 23, endpos: 23 },
      { annot: "-attributes", startpos: 24, endpos: 24 }
    ]);
  });

  it("parses inline links", () => {
    const parser = new InlineParser('[foobar](url)');
    //                             0123456789012
    parser.feed(0,12);
    expect(parser.getMatches()).toStrictEqual([
      { annot: "+linktext", startpos: 0, endpos: 0 },
      { annot: "str", startpos: 1, endpos: 6 },
      { annot: "-linktext", startpos: 7, endpos: 7 },
      { annot: "+destination", startpos: 8, endpos: 8 },
      { annot: "str", startpos: 9, endpos: 11 },
      { annot: "-destination", startpos: 12, endpos: 12 }
    ]);
  });

  it("parses reference links", () => {
    const parser = new InlineParser('[foobar][1]');
    //                             01234567890
    parser.feed(0,10);
    expect(parser.getMatches()).toStrictEqual([
      { annot: "+linktext", startpos: 0, endpos: 0 },
      { annot: "str", startpos: 1, endpos: 6 },
      { annot: "-linktext", startpos: 7, endpos: 7 },
      { annot: "+reference", startpos: 8, endpos: 8 },
      { annot: "str", startpos: 9, endpos: 9 },
      { annot: "-reference", startpos: 10, endpos: 10 }
    ]);
  });

  it("parses inline images", () => {
    const parser = new InlineParser('![foobar](url)');
    //                             01234567890123
    parser.feed(0,13);
    expect(parser.getMatches()).toStrictEqual([
      { annot: "image_marker", startpos: 0, endpos: 0 },
      { annot: "+imagetext", startpos: 1, endpos: 1 },
      { annot: "str", startpos: 2, endpos: 7 },
      { annot: "-imagetext", startpos: 8, endpos: 8 },
      { annot: "+destination", startpos: 9, endpos: 9 },
      { annot: "str", startpos: 10, endpos: 12 },
      { annot: "-destination", startpos: 13, endpos: 13 }
    ]);
  });

  it("parses symbs", () => {
    const parser = new InlineParser(':+1:');
    //                             0123
    parser.feed(0,3);
    expect(parser.getMatches()).toStrictEqual([
      { annot: "symb", startpos: 0, endpos: 3 }
    ]);
  });

  it("parses ellipses", () => {
    const parser = new InlineParser('...');
    //                             0123
    parser.feed(0,2);
    expect(parser.getMatches()).toStrictEqual([
      { annot: "ellipses", startpos: 0, endpos: 2 }
    ]);
  });

  it("parses dashes", () => {
    const parser = new InlineParser('a---b--c');
    //                             01234567
    parser.feed(0,7);
    expect(parser.getMatches()).toStrictEqual([
      { annot: "str", startpos: 0, endpos: 0 },
      { annot: "em_dash", startpos: 1, endpos: 3 },
      { annot: "str", startpos: 4, endpos: 4 },
      { annot: "en_dash", startpos: 5, endpos: 6 },
      { annot: "str", startpos: 7, endpos: 7 }
    ]);
  });

  it("parses note references", () => {
    const parser = new InlineParser('[^ref]');
    //                               012345
    parser.feed(0,5);
    expect(parser.getMatches()).toStrictEqual([
      { annot: "footnote_reference", startpos: 0, endpos: 5 }
    ]);
  });

})
