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
                "start": {
                  "line": 1,
                  "col": 3,
                  "offset": 2
                },
                "end": {
                  "line": 1,
                  "col": 10,
                  "offset": 9
                }
              }
            },
            {
              "tag": "emph",
              "children": [
                {
                  "tag": "str",
                  "text": "testing",
                  "pos": {
                    "start": {
                      "line": 1,
                      "col": 12,
                      "offset": 11
                    },
                    "end": {
                      "line": 1,
                      "col": 18,
                      "offset": 17
                    }
                  }
                }
              ],
              "pos": {
                "start": {
                  "line": 1,
                  "col": 11,
                  "offset": 10
                },
                "end": {
                  "line": 1,
                  "col": 19,
                  "offset": 18
                }
              }
            }
          ],
          "pos": {
            "start": {
              "line": 1,
              "col": 3,
              "offset": 2
            },
            "end": {
              "line": 2,
              "col": 20,
              "offset": 19
            }
          }
        }
      ],
      "pos": {
        "start": {
          "line": 1,
          "col": 1,
          "offset": 0
        },
        "end": {
          "line": 2,
          "col": 1,
          "offset": 20
        }
      }
    }
  ],
  "pos": {
    "start": {
      "line": 0,
      "col": 0,
      "offset": 0
    },
    "end": {
      "line": 2,
      "col": 1,
      "offset": 20
    }
  }
}

    );
  });


});
