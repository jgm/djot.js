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
  { startpos: 2, endpos: 2, annot: 'attr_equal_marker' },
  { startpos: 3, endpos: 3, annot: 'value' },
  { startpos: 4, endpos: 4, annot: 'attr_space' },
  { startpos: 5, endpos: 5, annot: 'attr_id_marker' },
  { startpos: 6, endpos: 10, annot: 'id' },
  { startpos: 12, endpos: 12, annot: 'attr_class_marker' },
  { startpos: 13, endpos: 17, annot: 'class' },
  { startpos: 19, endpos: 21, annot: 'key' },
  { startpos: 22, endpos: 22, annot: 'attr_equal_marker' },
  { startpos: 23, endpos: 26, annot: 'value' },
  { startpos: 28, endpos: 28, annot: 'attr_class_marker' },
  { startpos: 29, endpos: 33, annot: 'class' },
  { startpos: 34, endpos: 34, annot: 'attr_space' },
  { startpos: 35, endpos: 38, annot: 'key' },
  { startpos: 39, endpos: 39, annot: 'attr_equal_marker' },
  { startpos: 40, endpos: 40, annot: 'attr_quote_marker' },
  { startpos: 41, endpos: 53, annot: 'value' },
  { startpos: 54, endpos: 54, annot: 'attr_quote_marker' },
]);
  })
})
