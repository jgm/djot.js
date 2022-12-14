import { Parser } from "./block.js";

describe("Parser", () => {
  it("parses events", () => {
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
});

