import { Parser } from "./block.js";

describe("Parser", () => {
  it("parses paragraphs", () => {
    let events = [];
    for (const event of new Parser("hello *world*\n\nfoo", () => {})) {
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
    let events = [];
    for (const event of new Parser("> hello\n> there\nlazy\n>\n> hi\n", () => {})) {
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
      { startpos: 21, endpos: 21, annot: "-para" },
      { startpos: 22, endpos: 22, annot: "blankline" },
      { startpos: 25, endpos: 25, annot: "+para" },
      { startpos: 25, endpos: 26, annot: "str" },
      { startpos: 27, endpos: 27, annot: "-para" },
      { startpos: 28, endpos: 28, annot: "-blockquote" }
    ]);
  });

  it("parses headings", () => {
    let events = [];
    for (const event of new Parser("## hello\n## there\nlazy\n", () => {})) {
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

  it("parses code blocks", () => {
    let events = [];
    for (const event of new Parser("```` python\nif x == 3:\n  y = 4\n````\n", () => {})) {
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

});

