import { parse, renderAST, ParseOptions, Doc } from "./ast.js";

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
              "line": 1,
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
          "line": 1,
          "col": 20,
          "offset": 19
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
      "line": 1,
      "col": 20,
      "offset": 19
    }
  }
}
    );
  });

  it("renders pretty", () => {
    let ast = parse("hi there\nfriend\n\nnew para\n", {sourcePositions: true});
    expect(renderAST(ast)).toEqual(
`doc (0:0:0-5:1:25)
  para (1:1:0-3:1:15)
    str (1:1:0-1:8:7) text="hi there"
    softbreak (2:1:8-2:1:8)
    str (2:2:9-2:7:14) text="friend"
  para (4:2:17-5:1:25)
    str (4:2:17-4:9:24) text="new para"
`);
  });



});
