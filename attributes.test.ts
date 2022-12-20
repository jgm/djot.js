import { AttributeParser } from "./attributes";

describe("AttributeParser", () => {
  it("properly parses attributes", () => {
    const x = `{a=b #ident
.class
key=val1
.class key2="val two \\" ok"}abc`;
    const parser = new AttributeParser(x);
    const result = parser.feed(0,x.length - 1);
    expect(result.position).toBe(55);
    expect(result.status).toBe("done");
    expect(parser.matches).toStrictEqual(
[
  { startpos: 1, endpos: 1, annot: 'key' },
  { startpos: 3, endpos: 3, annot: 'value' },
  { startpos: 6, endpos: 10, annot: 'id' },
  { startpos: 13, endpos: 17, annot: 'class' },
  { startpos: 19, endpos: 21, annot: 'key' },
  { startpos: 23, endpos: 26, annot: 'value' },
  { startpos: 29, endpos: 33, annot: 'class' },
  { startpos: 35, endpos: 38, annot: 'key' },
  { startpos: 41, endpos: 53, annot: 'value' }
]);
  })
})
