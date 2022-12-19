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

  it("includes source positions", () => {
    let ast = parse("> testing _testing_", {sourcePositions: true});
    expect(ast).toEqual(
{
  "tag": "doc",
  "references": {},
  "footnotes": {},
  "children": [
    {
      "tag": "blockquote",
      "children": [
        {
          "tag": "para",
          "children": [
            {
              "tag": "str",
              "text": "testing ",
              "pos": {
                "start": 2,
                "end": 9
              }
            },
            {
              "tag": "emph",
              "children": [
                {
                  "tag": "str",
                  "text": "testing",
                  "pos": {
                    "start": 11,
                    "end": 17
                  }
                }
              ],
              "pos": {
                "start": 10,
                "end": 18
              }
            }
          ],
          "pos": {
            "start": 2,
            "end": 19
          }
        }
      ],
      "pos": {
        "start": 0,
        "end": 20
      }
    }
  ],
  "pos": {
    "start": 0,
    "end": 20
  }
}
    );
  });


});
