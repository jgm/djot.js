import { parse, renderAST } from "./parse";

describe("Parser", () => {
  it("parses paragraphs", () => {
    const ast = parse("hi there\nfriend\n\nnew para", {});
    expect(ast).toEqual(
{
  "tag": "doc",
  "autoReferences": {},
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
          "tag": "soft_break"
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
    const ast = parse("> testing _testing_", {sourcePositions: true});
    expect(ast).toEqual(
{
  "tag": "doc",
  "autoReferences": {},
  "references": {},
  "footnotes": {},
  "children": [
    {
      "tag": "block_quote",
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
  ]
}
    );
  });

  it("renders pretty", () => {
    const ast = parse("hi there\nfriend\n\nnew para\n", {sourcePositions: true});
    expect(renderAST(ast)).toEqual(
`doc
  para (1:1:0-3:0:15)
    str (1:1:0-1:8:7) text="hi there"
    soft_break (2:0:8-2:0:8)
    str (2:1:9-2:6:14) text="friend"
  para (4:1:17-5:0:25)
    str (4:1:17-4:8:24) text="new para"
`);
  });



});
