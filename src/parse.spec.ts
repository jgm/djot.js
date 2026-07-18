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
    const ast = parse("# testing\n\n> testing _testing_", {sourcePositions: true});
    expect(ast).toEqual(
{
  "tag": "doc",
  "autoReferences": {
    "testing": {
      "tag": "reference",
      "destination": "#testing",
      "label": "testing",
    },
  },
  "references": {},
  "footnotes": {},
  "children": [
    {
      "tag": "section",
      "autoAttributes": {
        "id": "testing",
      },
      "pos": {
        "start": {
          "line": 1,
          "col": 1,
          "offset": 0
        },
        "end": {
          "line": 3,
          "col": 20,
          "offset": 30
        }
      },
      "children": [
        {
          "tag": "heading",
          "level": 1,
          "pos": {
            "start": {
              "col": 1,
              "line": 1,
              "offset": 0,
            },
            "end": {
              "col": 0,
              "line": 2,
              "offset": 9,
            },
          },
          "children": [
            {
              "tag": "str",
              "text": "testing",
              "pos": {
                "start":{
                  "col": 3,
                  "line": 1,
                  "offset": 2
                },
                "end": {
                  "col": 9,
                  "line": 1,
                  "offset": 8
                }
              }
            }
          ],
        },
        {
          "tag": "block_quote",
          "pos": {
            "start": {
              "line": 3,
              "col": 1,
              "offset": 11,
            },
            "end": {
              "line": 3,
              "col": 20,
              "offset": 30,
            }
          },
          "children": [
            {
              "tag": "para",
              "pos": {
                "start": {
                  "line": 3,
                  "col": 3,
                  "offset": 13,
                },
                "end": {
                  "line": 3,
                  "col": 20,
                  "offset": 30,
                }
              },
              "children": [
                {
                  "tag": "str",
                  "text": "testing ",
                  "pos": {
                    "start": {
                      "line": 3,
                      "col": 3,
                       "offset": 13,
                     },
                     "end": {
                       "line": 3,
                       "col": 10,
                       "offset": 20,
                     }
                   }
                },
                {
                  "tag": "emph",
                  "pos": {
                    "start": {
                      "line": 3,
                      "col": 11,
                      "offset": 21,
                    },
                    "end": {
                      "line": 3,
                      "col": 19,
                      "offset": 29,
                    }
                  },
                  "children": [
                    {
                      "tag": "str",
                      "text": "testing",
                      "pos": {
                        "start": {
                          "line": 3,
                          "col": 12,
                          "offset": 22,
                        },
                        "end": {
                          "line": 3,
                          "col": 18,
                          "offset": 28,
                        }
                      }
                    }
                  ],
                }
              ],
            },
          ],
        }
      ],
    }
  ]
}
    );
  });

  it("uses tight source position ends for lazy-closing block quotes", () => {
    const ast = parse("> q\n\nAfter.\n", {sourcePositions: true}) as any;
    const blockQuote = ast.children[0];
    const para = ast.children[1];
    expect(blockQuote.pos).toEqual({
      "start": { "line": 1, "col": 1, "offset": 0 },
      "end": { "line": 2, "col": 0, "offset": 3 }
    });
    expect(para.pos).toEqual({
      "start": { "line": 3, "col": 1, "offset": 5 },
      "end": { "line": 4, "col": 0, "offset": 11 }
    });
    expect(blockQuote.pos.end.offset).toBeLessThan(para.pos.start.offset);
  });

  it("uses tight source position ends for lazy-closing tables", () => {
    const ast = parse("| a |\n| --- |\n| 1 |\n\nAfter.\n",
      {sourcePositions: true}) as any;
    const table = ast.children[0];
    const para = ast.children[1];
    expect(table.pos).toEqual({
      "start": { "line": 1, "col": 1, "offset": 0 },
      "end": { "line": 4, "col": 0, "offset": 19 }
    });
    expect(para.pos).toEqual({
      "start": { "line": 5, "col": 1, "offset": 21 },
      "end": { "line": 6, "col": 0, "offset": 27 }
    });
    expect(table.pos.end.offset).toBeLessThan(para.pos.start.offset);
  });

  it("uses tight source position ends for lazy-closing lists", () => {
    const ast = parse("- a\n- b\n\nAfter.\n",
      {sourcePositions: true}) as any;
    const list = ast.children[0];
    const para = ast.children[1];
    expect(list.pos).toEqual({
      "start": { "line": 1, "col": 1, "offset": 0 },
      "end": { "line": 3, "col": 0, "offset": 7 }
    });
    expect(para.pos).toEqual({
      "start": { "line": 4, "col": 1, "offset": 9 },
      "end": { "line": 5, "col": 0, "offset": 15 }
    });
    expect(list.pos.end.offset).toBeLessThan(para.pos.start.offset);
    // The lazily closed last item must stay contained in the list's range.
    const lastItem = list.children[list.children.length - 1];
    expect(lastItem.pos.end.offset).toBeLessThanOrEqual(list.pos.end.offset);
  });

  it("uses tight source position ends for lazy-closing definition lists", () => {
    const ast = parse(": term\n  def\n\nAfter.\n",
      {sourcePositions: true}) as any;
    const list = ast.children[0];
    const para = ast.children[1];
    expect(list.pos).toEqual({
      "start": { "line": 1, "col": 1, "offset": 0 },
      "end": { "line": 3, "col": 0, "offset": 12 }
    });
    expect(para.pos).toEqual({
      "start": { "line": 4, "col": 1, "offset": 14 },
      "end": { "line": 5, "col": 0, "offset": 20 }
    });
    expect(list.pos.end.offset).toBeLessThan(para.pos.start.offset);
  });

  it("uses tight source position ends for lazy-closing footnotes", () => {
    const ast = parse("[^a]: note\n\nAfter.\n",
      {sourcePositions: true}) as any;
    const footnote = ast.footnotes.a;
    const para = ast.children[0];
    expect(footnote.pos).toEqual({
      "start": { "line": 1, "col": 1, "offset": 0 },
      "end": { "line": 2, "col": 0, "offset": 10 }
    });
    expect(para.pos).toEqual({
      "start": { "line": 3, "col": 1, "offset": 12 },
      "end": { "line": 4, "col": 0, "offset": 18 }
    });
    expect(footnote.pos.end.offset).toBeLessThan(para.pos.start.offset);
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
