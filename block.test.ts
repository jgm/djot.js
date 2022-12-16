import { Parser } from "./block.js";

const ignoreWarnings = () => { /* do nothing */ };

describe("Parser", () => {
  it("parses paragraphs", () => {
    const events = [];
    for (const event of new Parser("hello *world*\n\nfoo", ignoreWarnings)) {
      events.push(event);
    }
    expect(events).toStrictEqual([
      { startpos: 0, endpos: 0, annot: "+para" },
      { startpos: 0, endpos: 5, annot: "str" },
      { startpos: 6, endpos: 6, annot: "+strong" },
      { startpos: 7, endpos: 11, annot: "str" },
      { startpos: 12, endpos: 12, annot: "-strong" },
      { startpos: 13, endpos: 13, annot: "-para" },
      { startpos: 14, endpos: 14, annot: "blankline" },
      { startpos: 15, endpos: 15, annot: "+para" },
      { startpos: 15, endpos: 17, annot: "str" },
      { startpos: 18, endpos: 18, annot: "-para" }
    ]);
  });

  it("parses blockquotes", () => {
    const events = [];
    for (const event of new Parser("> hello\n> there\nlazy\n>\n> hi\n", ignoreWarnings)) {
      //                            01234567 89012345 67890 12 345678
      events.push(event);
    }
    expect(events).toStrictEqual([
      { startpos: 0, endpos: 0, annot: "+blockquote" },
      { startpos: 2, endpos: 2, annot: "+para" },
      { startpos: 2, endpos: 6, annot: "str" },
      { startpos: 7, endpos: 7, annot: "softbreak" },
      { startpos: 10, endpos: 14, annot: "str" },
      { startpos: 15, endpos: 15, annot: "softbreak" },
      { startpos: 16, endpos: 19, annot: "str" },
      { startpos: 20, endpos: 20, annot: "-para" },
      { startpos: 22, endpos: 22, annot: "blankline" },
      { startpos: 25, endpos: 25, annot: "+para" },
      { startpos: 25, endpos: 26, annot: "str" },
      { startpos: 27, endpos: 27, annot: "-para" },
      { startpos: 28, endpos: 28, annot: "-blockquote" }
    ]);
  });

  it("parses headings", () => {
    const events = [];
    for (const event of new Parser("## hello\n## there\nlazy\n", ignoreWarnings)) {
      //                            012345678 901234567 89012
      events.push(event);
    }
    expect(events).toStrictEqual([
      { startpos: 0, endpos: 1, annot: "+heading" },
      { startpos: 3, endpos: 7, annot: "str" },
      { startpos: 8, endpos: 8, annot: "softbreak" },
      { startpos: 12, endpos: 16, annot: "str" },
      { startpos: 17, endpos: 17, annot: "softbreak" },
      { startpos: 18, endpos: 21, annot: "str" },
      { startpos: 22, endpos: 22, annot: "-heading" }
    ]);
  });

  it("parses reference definitions", () => {
    const events = [];
    for (const event of new Parser("[foo]: bar\n baz\n", ignoreWarnings)) {
      //                            0123456789 01234 5
      events.push(event);
    }
    expect(events).toStrictEqual([
      { startpos: 0, endpos: 0, annot: "+reference_definition" },
      { startpos: 0, endpos: 4, annot: "reference_key" },
      { startpos: 7, endpos: 9, annot: "reference_value" },
      { startpos: 12, endpos: 14, annot: "reference_value" },
      { startpos: 16, endpos: 16, annot: "-reference_definition" }
    ]);
  });

  it("parses tables", () => {
    const events = [];
    for (const event of new Parser("| a | b |\n|--|--:|\n|33|2| ", ignoreWarnings)) {
      //                            012345678 901234567 8901234
      events.push(event);
    }
    expect(events).toStrictEqual([
      {startpos: 0, endpos: 0, annot: "+table"},
      {startpos: 0, endpos: 0, annot: "+row"},
      {startpos: 0, endpos: 0, annot: "+cell"},
      {startpos: 2, endpos: 2, annot: "str"},
      {startpos: 4, endpos: 4, annot: "-cell"},
      {startpos: 4, endpos: 4, annot: "+cell"},
      {startpos: 6, endpos: 6, annot: "str"},
      {startpos: 8, endpos: 8, annot: "-cell"},
      {startpos: 9, endpos: 9, annot: "-row"},
      {startpos: 10, endpos: 10, annot: "+row"},
      {startpos: 11, endpos: 12, annot: "separator_default"},
      {startpos: 14, endpos: 16, annot: "separator_right"},
      {startpos: 17, endpos: 17, annot: "-row"},
      {startpos: 19, endpos: 19, annot: "+row"},
      {startpos: 19, endpos: 19, annot: "+cell"},
      {startpos: 20, endpos: 21, annot: "str"},
      {startpos: 22, endpos: 22, annot: "-cell"},
      {startpos: 22, endpos: 22, annot: "+cell"},
      {startpos: 23, endpos: 23, annot: "str"},
      {startpos: 24, endpos: 24, annot: "-cell"},
      {startpos: 25, endpos: 25, annot: "-row"},
      {startpos: 27, endpos: 27, annot: "-table"}
    ]);
  });


  it("parses code blocks", () => {
    const events = [];
    for (const event of new Parser("```` python\nif x == 3:\n  y = 4\n````\n", ignoreWarnings)) {
      //                            01234567890 12345678901 23456789 01234 5
      events.push(event);
    }
    expect(events).toStrictEqual([
      { startpos: 0, endpos: 3, annot: "+code_block" },
      { startpos: 5, endpos: 10, annot: "code_language" },
      { startpos: 12, endpos: 22, annot: "str" },
      { startpos: 23, endpos: 30, annot: "str" },
      { startpos: 31, endpos: 34, annot: "-code_block" }
    ]);
  });

  it("parses captions", () => {
    const events = [];
    for (const event of new Parser(" ^ This is a\n*capt*\n\n", ignoreWarnings)) {
      //                            012345678901 2345678 9 0
      events.push(event);
    }
    expect(events).toStrictEqual([
      { startpos: 3, endpos: 3, annot: "+caption" },
      { startpos: 3, endpos: 11, annot: "str" },
      { startpos: 12, endpos: 12, annot: "softbreak" },
      { startpos: 13, endpos: 13, annot: "+strong" },
      { startpos: 14, endpos: 17, annot: "str" },
      { startpos: 18, endpos: 18, annot: "-strong" },
      { startpos: 19, endpos: 19, annot: "-caption" },
      { startpos: 20, endpos: 20, annot: "blankline" }
    ]);
  });

  it("parses thematic breaks", () => {
    const events = [];
    for (const event of new Parser(" - - - -\n", ignoreWarnings)) {
      //                            012345678901 2345678 9 0
      events.push(event);
    }
    expect(events).toStrictEqual([
      { startpos: 1, endpos: 8, annot: "thematic_break" },
    ]);
  });

  it("parses fenced divs", () => {
    const events = [];
    for (const event of new Parser(":::: foo \nhello\n\nhi\n::::", ignoreWarnings)) {
      //                            012345678 901234 5 6789 01234 56789
      events.push(event);
    }
    expect(events).toStrictEqual([
      { startpos: 0, endpos: 4, annot: "+div" },
      { startpos: 5, endpos: 7, annot: "class" },
      { startpos: 10, endpos: 10, annot: "+para" },
      { startpos: 10, endpos: 14, annot: "str" },
      { startpos: 15, endpos: 15, annot: "-para" },
      { startpos: 16, endpos: 16, annot: "blankline" },
      { startpos: 17, endpos: 17, annot: "+para" },
      { startpos: 17, endpos: 18, annot: "str" },
      { startpos: 19, endpos: 19, annot: "-para" },
      { startpos: 20, endpos: 23, annot: "-div" },
      { startpos: 24, endpos: 24, annot: "blankline" }
    ]);
  });

  it("parses footnotes", () => {
    const events = [];
    for (const event of new Parser(
          "[^note]: This is a\nnote\n\n  second par\n\nafter note\n", ignoreWarnings)) {
      //   012345678901234567 89012 3 4567890123456 7 89012345678 9
      events.push(event);
    }
    expect(events).toStrictEqual([
      { startpos: 0, endpos: 0, annot: "+footnote" },
      { startpos: 2, endpos: 5, annot: "note_label" },
      { startpos: 9, endpos: 9, annot: "+para" },
      { startpos: 9, endpos: 17, annot: "str" },
      { startpos: 18, endpos: 18, annot: "softbreak" },
      { startpos: 19, endpos: 22, annot: "str" },
      { startpos: 23, endpos: 23, annot: "-para" },
      { startpos: 24, endpos: 24, annot: "blankline" },
      { startpos: 27, endpos: 27, annot: "+para" },
      { startpos: 27, endpos: 36, annot: "str" },
      { startpos: 37, endpos: 37, annot: "-para" },
      { startpos: 38, endpos: 38, annot: "blankline" },
      { startpos: 39, endpos: 39, annot: "-footnote" },
      { startpos: 39, endpos: 39, annot: "+para" },
      { startpos: 39, endpos: 48, annot: "str" },
      { startpos: 49, endpos: 49, annot: "-para" },
    ]);
  });

});
