import { parseEvents } from "./block";

describe("EventParser", () => {
  it("parses paragraphs", () => {
    const events = [];
    for (const event of parseEvents("hello *world*\n\nfoo")) {
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

  it("parses block quotes", () => {
    const events = [];
    for (const event of parseEvents("> hello\n> there\nlazy\n>\n> hi\n")) {
      //                            01234567 89012345 67890 12 345678
      events.push(event);
    }
    expect(events).toStrictEqual([
      { startpos: 0, endpos: 0, annot: "+block_quote" },
      { startpos: 2, endpos: 2, annot: "+para" },
      { startpos: 2, endpos: 6, annot: "str" },
      { startpos: 7, endpos: 7, annot: "soft_break" },
      { startpos: 10, endpos: 14, annot: "str" },
      { startpos: 15, endpos: 15, annot: "soft_break" },
      { startpos: 16, endpos: 19, annot: "str" },
      { startpos: 20, endpos: 20, annot: "-para" },
      { startpos: 22, endpos: 22, annot: "blankline" },
      { startpos: 25, endpos: 25, annot: "+para" },
      { startpos: 25, endpos: 26, annot: "str" },
      { startpos: 27, endpos: 27, annot: "-para" },
      { startpos: 27, endpos: 27, annot: "-block_quote" }
    ]);
  });

  it("parses headings", () => {
    const events = [];
    for (const event of parseEvents("## hello\n## there\nlazy\n")) {
      //                            012345678 901234567 89012
      events.push(event);
    }
    expect(events).toStrictEqual([
      { startpos: 0, endpos: 1, annot: "+heading" },
      { startpos: 3, endpos: 7, annot: "str" },
      { startpos: 8, endpos: 8, annot: "soft_break" },
      { startpos: 12, endpos: 16, annot: "str" },
      { startpos: 17, endpos: 17, annot: "soft_break" },
      { startpos: 18, endpos: 21, annot: "str" },
      { startpos: 22, endpos: 22, annot: "-heading" }
    ]);
  });

  it("parses reference definitions", () => {
    const events = [];
    for (const event of parseEvents("[foo]: bar\n baz\n")) {
      //                            0123456789 01234 5
      events.push(event);
    }
    expect(events).toStrictEqual([
      { startpos: 0, endpos: 0, annot: "+reference_definition" },
      { startpos: 0, endpos: 4, annot: "reference_key" },
      { startpos: 7, endpos: 9, annot: "reference_value" },
      { startpos: 12, endpos: 14, annot: "reference_value" },
      { startpos: 15, endpos: 15, annot: "-reference_definition" }
    ]);
  });

  it("parses tables", () => {
    const events = [];
    for (const event of parseEvents("| a | b |\n|--|--:|\n|33|2| ")) {
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
      {startpos: 26, endpos: 26, annot: "-table"}
    ]);
  });


  it("parses code blocks", () => {
    const events = [];
    for (const event of parseEvents("```` python\nif x == 3:\n  y = 4\n````\n")) {
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

  it("parses list items", () => {
    const events = [];
    for (const event of parseEvents("- one\n- two\n1. three\n(iv) four\n\n - sub\n\n   two\n")) {
      //                             012345 678901 234567890 1234567890 1 2345678 9  123456
      events.push(event);
    }
    expect(events).toStrictEqual([
 { startpos: 0, endpos: 0, annot: "+list|-" },
 { startpos: 0, endpos: 0, annot: "+list_item|-" },
 { startpos: 2, endpos: 2, annot: "+para" },
 { startpos: 2, endpos: 4, annot: "str" },
 { startpos: 5, endpos: 5, annot: "-para" },
 { startpos: 5, endpos: 5, annot: "-list_item" },
 { startpos: 6, endpos: 6, annot: "+list_item|-" },
 { startpos: 8, endpos: 8, annot: "+para" },
 { startpos: 8, endpos: 10, annot: "str" },
 { startpos: 11, endpos: 11, annot: "-para" },
 { startpos: 11, endpos: 11, annot: "-list_item" },
 { startpos: 12, endpos: 12, annot: "-list" },
 { startpos: 12, endpos: 13, annot: "+list|1." },
 { startpos: 12, endpos: 13, annot: "+list_item|1." },
 { startpos: 15, endpos: 15, annot: "+para" },
 { startpos: 15, endpos: 19, annot: "str" },
 { startpos: 20, endpos: 20, annot: "-para" },
 { startpos: 20, endpos: 20, annot: "-list_item" },
 { startpos: 21, endpos: 21, annot: "-list" },
 { startpos: 21, endpos: 24, annot: "+list|(i)" },
 { startpos: 21, endpos: 24, annot: "+list_item|(i)" },
 { startpos: 26, endpos: 26, annot: "+para" },
 { startpos: 26, endpos: 29, annot: "str" },
 { startpos: 30, endpos: 30, annot: "-para" },
 { startpos: 31, endpos: 31, annot: "blankline" },
 { startpos: 33, endpos: 33, annot: "+list|-" },
 { startpos: 33, endpos: 33, annot: "+list_item|-" },
 { startpos: 35, endpos: 35, annot: "+para" },
 { startpos: 35, endpos: 37, annot: "str" },
 { startpos: 38, endpos: 38, annot: "-para" },
 { startpos: 39, endpos: 39, annot: "blankline" },
 { startpos: 43, endpos: 43, annot: "+para" },
 { startpos: 43, endpos: 45, annot: "str" },
 { startpos: 46, endpos: 46, annot: "-para" },
 { startpos: 46, endpos: 46, annot: "-list_item" },
 { startpos: 46, endpos: 46, annot: "-list" },
 { startpos: 46, endpos: 46, annot: "-list_item" },
 { startpos: 46, endpos: 46, annot: "-list" }]);
  });

  it("parses captions", () => {
    const events = [];
    for (const event of parseEvents(" ^ This is a\n*capt*\n\n")) {
      //                            012345678901 2345678 9 0
      events.push(event);
    }
    expect(events).toStrictEqual([
      { startpos: 3, endpos: 3, annot: "+caption" },
      { startpos: 3, endpos: 11, annot: "str" },
      { startpos: 12, endpos: 12, annot: "soft_break" },
      { startpos: 13, endpos: 13, annot: "+strong" },
      { startpos: 14, endpos: 17, annot: "str" },
      { startpos: 18, endpos: 18, annot: "-strong" },
      { startpos: 19, endpos: 19, annot: "-caption" },
      { startpos: 20, endpos: 20, annot: "blankline" }
    ]);
  });

  it("parses thematic breaks", () => {
    const events = [];
    for (const event of parseEvents(" - - - -\n")) {
      //                            012345678901 2345678 9 0
      events.push(event);
    }
    expect(events).toStrictEqual([
      { startpos: 1, endpos: 8, annot: "thematic_break" },
    ]);
  });

  it("parses fenced divs", () => {
    const events = [];
    for (const event of parseEvents(":::: foo \nhello\n\nhi\n::::")) {
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
    for (const event of parseEvents(
          "[^note]: This is a\nnote\n\n  second par\n\nafter note\n")) {
      //   012345678901234567 89012 3 4567890123456 7 89012345678 9
      events.push(event);
    }
    expect(events).toStrictEqual([
      { startpos: 0, endpos: 0, annot: "+footnote" },
      { startpos: 2, endpos: 5, annot: "note_label" },
      { startpos: 9, endpos: 9, annot: "+para" },
      { startpos: 9, endpos: 17, annot: "str" },
      { startpos: 18, endpos: 18, annot: "soft_break" },
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

  it("parses block attributes", () => {
    const events = [];
    for (const event of parseEvents(
          "{.foo}\n{#bar\n .baz}\nHello")) {
      //   012345 678901 2345678 901234
      events.push(event);
    }
    expect(events).toStrictEqual([
      { startpos: 0, endpos: 0, annot: "+block_attributes" },
      { startpos: 1, endpos: 1, annot: "attr_class_marker" },
      { startpos: 2, endpos: 4, annot: "class" },
      { startpos: 7, endpos: 7, annot: "-block_attributes" },
      { startpos: 7, endpos: 7, annot: "+block_attributes" },
      { startpos: 8, endpos: 8, annot: "attr_id_marker" },
      { startpos: 9, endpos: 11, annot: "id" },
      { startpos: 14, endpos: 14, annot: "attr_class_marker" },
      { startpos: 15, endpos: 17, annot: "class" },
      { startpos: 20, endpos: 20, annot: "-block_attributes" },
      { startpos: 20, endpos: 20, annot: "+para" },
      { startpos: 20, endpos: 24, annot: "str" },
      { startpos: 25, endpos: 25, annot: "-para" }
    ]);
  });

  it("parses failed block attributes as para", () => {
    const events = [];
    for (const event of parseEvents("{.foo\nbar *baz*\n\n")) {
      //   012345 678901234 5 6
      events.push(event);
    }
    expect(events).toStrictEqual([
      { startpos: 0, endpos: 0, annot: "+para" },
      { startpos: 0, endpos: 4, annot: "str" },
      { startpos: 5, endpos: 5, annot: "soft_break" },
      { startpos: 6, endpos: 9, annot: "str" },
      { startpos: 10, endpos: 10, annot: "+strong" },
      { startpos: 11, endpos: 13, annot: "str" },
      { startpos: 14, endpos: 14, annot: "-strong" },
      { startpos: 15, endpos: 15, annot: "-para" },
      { startpos: 16, endpos: 16, annot: "blankline" }
    ]);
  });

});

