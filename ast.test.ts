import { parse, ParseOptions, Doc } from "./ast.js";

const ignoreWarnings = () => { /* do nothing */ };

describe("Parser", () => {
  it("parses paragraphs", () => {
    let ast = parse("hi there\nfriend\n\nnew para", {});
    expect(ast).toEqual(
{
  "tag": "doc",
  "references": {},
  "footnotes": {},
  "children": [
    {
      "tag": "para",
      "children": [
        {
          "tag": "str",
          "text": "hi there"
        },
        {
          "tag": "softbreak"
        },
        {
          "tag": "str",
          "text": "friend"
        }
      ]
    },
    {
      "tag": "para",
      "children": [
        {
          "tag": "str",
          "text": "new para"
        }
      ]
    }
  ]
}
    );
  });



});
