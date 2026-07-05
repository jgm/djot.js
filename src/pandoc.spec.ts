import { parse } from "./parse";
import { fromPandoc, toPandoc, Pandoc, PandocElt } from "./pandoc";

const mkpandoc = function(blocks : PandocElt[]) : Pandoc {
  return { ["pandoc-api-version"]: [1,23], meta: {}, blocks: blocks };
}

describe("PandocParser", () => {
  it("parses some things", () => {
    const json =
      {
        "pandoc-api-version": [
          1,
          23,
        ],
        "meta": {},
        "blocks": [
          {
            "t": "Para",
            "c": [
              {
                "t": "Strong",
                "c": [
                  {
                    "t": "Str",
                    "c": "hello"
                  }
                ]
              },
              {
                "t": "Space"
              },
              {
                "t": "Link",
                "c": [
                  [
                    "",
                    [
                      "foo"
                    ],
                    []
                  ],
                  [
                    {
                      "t": "Str",
                      "c": "a"
                    },
                    {
                      "t": "Space"
                    },
                    {
                      "t": "Str",
                      "c": "link"
                    }
                  ],
                  [
                    "url",
                    ""
                  ]
                ]
              }
            ]
          },
          {
            "t": "Div",
            "c": [
              [
                "heading",
                [
                  "section"
                ],
                [
                  [
                    "id",
                    "heading"
                  ]
                ]
              ],
              [
                {
                  "t": "Header",
                  "c": [
                    2,
                    [
                      "",
                      [],
                      []
                    ],
                    [
                      {
                        "t": "Str",
                        "c": "heading"
                      }
                    ]
                  ]
                },
                {
                  "t": "BlockQuote",
                  "c": [
                    {
                      "t": "BlockQuote",
                      "c": [
                        {
                          "t": "Para",
                          "c": [
                            {
                              "t": "Str",
                              "c": "block"
                            },
                            {
                              "t": "Space"
                            },
                            {
                              "t": "Str",
                              "c": "quote"
                            }
                          ]
                        }
                      ]
                    }
                  ]
                },
                {
                  "t": "Table",
                  "c": [
                    [
                      "",
                      [],
                      []
                    ],
                    [
                      null,
                      [
                        {
                          "t": "Plain",
                          "c": [
                            {
                              "t": "Str",
                              "c": "A"
                            },
                            {
                              "t": "Space"
                            },
                            {
                              "t": "Str",
                              "c": "caption"
                            },
                            {
                              "t": "Space"
                            },
                            {
                              "t": "Emph",
                              "c": [
                                {
                                  "t": "Str",
                                  "c": "with"
                                },
                                {
                                  "t": "Space"
                                },
                                {
                                  "t": "Str",
                                  "c": "emph"
                                }
                              ]
                            }
                          ]
                        }
                      ]
                    ],
                    [
                      [
                        {
                          "t": "AlignRight"
                        },
                        {
                          "t": "ColWidthDefault"
                        }
                      ],
                      [
                        {
                          "t": "AlignDefault"
                        },
                        {
                          "t": "ColWidthDefault"
                        }
                      ]
                    ],
                    [
                      [
                        "",
                        [],
                        []
                      ],
                      [
                        [
                          [
                            "",
                            [],
                            []
                          ],
                          [
                            [
                              [
                                "",
                                [],
                                []
                              ],
                              {
                                "t": "AlignRight"
                              },
                              1,
                              1,
                              [
                                {
                                  "t": "Plain",
                                  "c": [
                                    {
                                      "t": "Str",
                                      "c": "table"
                                    }
                                  ]
                                }
                              ]
                            ],
                            [
                              [
                                "",
                                [],
                                []
                              ],
                              {
                                "t": "AlignDefault"
                              },
                              1,
                              1,
                              [
                                {
                                  "t": "Plain",
                                  "c": [
                                    {
                                      "t": "Str",
                                      "c": "cell"
                                    }
                                  ]
                                }
                              ]
                            ]
                          ]
                        ]
                      ]
                    ],
                    [
                      [
                        [
                          "",
                          [],
                          []
                        ],
                        0,
                        [],
                        [
                          [
                            [
                              "",
                              [],
                              []
                            ],
                            [
                              [
                                [
                                  "",
                                  [],
                                  []
                                ],
                                {
                                  "t": "AlignRight"
                                },
                                1,
                                1,
                                [
                                  {
                                    "t": "Plain",
                                    "c": [
                                      {
                                        "t": "Str",
                                        "c": "123"
                                      }
                                    ]
                                  }
                                ]
                              ],
                              [
                                [
                                  "",
                                  [],
                                  []
                                ],
                                {
                                  "t": "AlignDefault"
                                },
                                1,
                                1,
                                [
                                  {
                                    "t": "Plain",
                                    "c": []
                                  }
                                ]
                              ]
                            ]
                          ]
                        ]
                      ]
                    ],
                    [
                      [
                        "",
                        [],
                        []
                      ],
                      []
                    ]
                  ]
                },
                {
                  "t": "OrderedList",
                  "c": [
                    [
                      1,
                      {
                        "t": "Decimal"
                      },
                      {
                        "t": "Period"
                      }
                    ],
                    [
                      [
                        {
                          "t": "Plain",
                          "c": [
                            {
                              "t": "Str",
                              "c": "one"
                            }
                          ]
                        },
                        {
                          "t": "OrderedList",
                          "c": [
                            [
                              2,
                              {
                                "t": "LowerRoman"
                              },
                              {
                                "t": "Period"
                              }
                            ],
                            [
                              [
                                {
                                  "t": "Plain",
                                  "c": [
                                    {
                                      "t": "Str",
                                      "c": "two"
                                    }
                                  ]
                                }
                              ]
                            ]
                          ]
                        }
                      ]
                    ]
                  ]
                },
                {
                  "t": "DefinitionList",
                  "c": [
                    [
                      [
                        {
                          "t": "Str",
                          "c": "def"
                        }
                      ],
                      [
                        [
                          {
                            "t": "Para",
                            "c": [
                              {
                                "t": "Str",
                                "c": "list"
                              }
                            ]
                          }
                        ]
                      ]
                    ]
                  ]
                }
              ]
            ]
          }
        ]
      };
    const ast = fromPandoc(json);
    expect(ast).toStrictEqual(
      {
        "tag": "doc",
        "references": {},
        "autoReferences": {},
        "footnotes": {},
        "children": [
          {
            "tag": "para",
            "children": [
              {
                "tag": "strong",
                "children": [
                  {
                    "tag": "str",
                    "text": "hello"
                  }
                ]
              },
              {
                "tag": "str",
                "text": " "
              },
              {
                "tag": "link",
                "destination": "url",
                "children": [
                  {
                    "tag": "str",
                    "text": "a link"
                  }
                ],
                "attributes": {
                  "class": "foo"
                }
              }
            ]
          },
          {
            "tag": "section",
            "children": [
              {
                "tag": "heading",
                "level": 2,
                "children": [
                  {
                    "tag": "str",
                    "text": "heading"
                  }
                ]
              },
              {
                "tag": "block_quote",
                "children": [
                  {
                    "tag": "block_quote",
                    "children": [
                      {
                        "tag": "para",
                        "children": [
                          {
                            "tag": "str",
                            "text": "block quote"
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              {
                "tag": "table",
                "children": [
                  {
                    "tag": "caption",
                    "children": [
                      {
                        "tag": "str",
                        "text": "A caption "
                      },
                      {
                        "tag": "emph",
                        "children": [
                          {
                            "tag": "str",
                            "text": "with emph"
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "row",
                    "children": [
                      {
                        "tag": "cell",
                        "children": [
                          {
                            "tag": "str",
                            "text": "table"
                          }
                        ],
                        "head": true,
                        "align": "right"
                      },
                      {
                        "tag": "cell",
                        "children": [
                          {
                            "tag": "str",
                            "text": "cell"
                          }
                        ],
                        "head": true,
                        "align": "default"
                      }
                    ],
                    "head": true
                  },
                  {
                    "tag": "row",
                    "children": [
                      {
                        "tag": "cell",
                        "children": [
                          {
                            "tag": "str",
                            "text": "123"
                          }
                        ],
                        "head": false,
                        "align": "right"
                      },
                      {
                        "tag": "cell",
                        "children": [],
                        "head": false,
                        "align": "default"
                      }
                    ],
                    "head": false
                  }
                ]
              },
              {
                "tag": "ordered_list",
                "style": "1.",
                "children": [
                  {
                    "tag": "list_item",
                    "children": [
                      {
                        "tag": "para",
                        "children": [
                          {
                            "tag": "str",
                            "text": "one"
                          }
                        ]
                      },
                      {
                        "tag": "ordered_list",
                        "style": "i.",
                        "children": [
                          {
                            "tag": "list_item",
                            "children": [
                              {
                                "tag": "para",
                                "children": [
                                  {
                                    "tag": "str",
                                    "text": "two"
                                  }
                                ]
                              }
                            ]
                          }
                        ],
                        "start": 2,
                        "tight": true
                      }
                    ]
                  }
                ],
                "start": 1,
                "tight": true
              },
              {
                "tag": "definition_list",
                "children": [
                  {
                    "tag": "definition_list_item",
                    "children": [
                      {
                        "tag": "term",
                        "children": [
                          {
                            "tag": "str",
                            "text": "def"
                          }
                        ]
                      },
                      {
                        "tag": "definition",
                        "children": [
                          {
                            "tag": "para",
                            "children": [
                              {
                                "tag": "str",
                                "text": "list"
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ],
            "attributes": {
              "id": "heading"
            }
          }
        ]
      }

    );

  });

  it("handles Example list style without crashing", () => {
    const pd = mkpandoc([
      {t: "OrderedList",
       c: [[1, {t: "Example"}, {t: "TwoParens"}],
           [[{t: "Para", c: [{t: "Str", c: "hi"}]}]]]}]);
    const ast = fromPandoc(pd);
    expect(ast.children[0]).toStrictEqual(
      {tag: "ordered_list",
       style: "(1)",
       start: 1,
       tight: false,
       children: [
         {tag: "list_item",
          children: [{tag: "para", children: [{tag: "str", text: "hi"}]}]}]});
  });

  it("keeps all items of a mixed bullet list", () => {
    const pd = mkpandoc([
      {t: "BulletList",
       c: [[{t: "Para", c: [{t: "Str", c: "☒"}, {t: "Space"},
                            {t: "Str", c: "done"}]}],
           [{t: "Para", c: [{t: "Str", c: "plain"}]}]]}]);
    const ast = fromPandoc(pd);
    expect(ast.children[0]).toStrictEqual(
      {tag: "bullet_list",
       style: "-",
       tight: false,
       children: [
         {tag: "list_item",
          children: [{tag: "para",
                      children: [{tag: "str", text: "☒ done"}]}]},
         {tag: "list_item",
          children: [{tag: "para",
                      children: [{tag: "str", text: "plain"}]}]}]});
  });

  it("does not mutate its input when detecting checkboxes", () => {
    const pd = mkpandoc([
      {t: "BulletList",
       c: [[{t: "Para", c: [{t: "Str", c: "☒"}, {t: "Space"},
                            {t: "Str", c: "done"}]}]]}]);
    const before = JSON.stringify(pd);
    const ast = fromPandoc(pd);
    expect(ast.children[0]).toStrictEqual(
      {tag: "task_list",
       tight: false,
       children: [
         {tag: "task_list_item",
          checkbox: "checked",
          children: [{tag: "para",
                      children: [{tag: "str", text: "done"}]}]}]});
    expect(JSON.stringify(pd)).toEqual(before);
  });

  it("only treats a whole class token 'section' as a section", () => {
    const pd = mkpandoc([
      {t: "Div",
       c: [["", ["main-section"], []],
           [{t: "Para", c: [{t: "Str", c: "x"}]}]]}]);
    const ast = fromPandoc(pd);
    expect(ast.children[0]).toStrictEqual(
      {tag: "div",
       attributes: {class: "main-section"},
       children: [{tag: "para", children: [{tag: "str", text: "x"}]}]});
  });

  it("preserves a __proto__ attribute key without polluting prototypes", () => {
    const pd = mkpandoc([
      {t: "Div",
       c: [["", [], [["__proto__", "evil"]]],
           [{t: "Para", c: [{t: "Str", c: "x"}]}]]}]);
    const ast : any = fromPandoc(pd);
    const attrs = ast.children[0].attributes;
    expect(Object.prototype.hasOwnProperty.call(attrs, "__proto__"))
      .toBe(true);
    expect(attrs["__proto__"]).toEqual("evil");
    expect(({} as any)["__proto__"]).toEqual(Object.prototype);
  });
});
describe("PandocRenderer", () => {
  it("renders some things", () => {
    const inp = `*hello* [a link](url){.foo}

## heading

> > block quote

| table | cell |
|------:|------|
| 123   | |
^ A caption _with emph_

1. one

   ii. two

: def

  list
`;
    const ast = parse(inp, {});
    expect(toPandoc(ast)).toStrictEqual(
      {
        "pandoc-api-version": [
          1,
          23,
        ],
        "meta": {},
        "blocks": [
          {
            "t": "Para",
            "c": [
              {
                "t": "Strong",
                "c": [
                  {
                    "t": "Str",
                    "c": "hello"
                  }
                ]
              },
              {
                "t": "Space"
              },
              {
                "t": "Link",
                "c": [
                  [
                    "",
                    [
                      "foo"
                    ],
                    []
                  ],
                  [
                    {
                      "t": "Str",
                      "c": "a"
                    },
                    {
                      "t": "Space"
                    },
                    {
                      "t": "Str",
                      "c": "link"
                    }
                  ],
                  [
                    "url",
                    ""
                  ]
                ]
              }
            ]
          },
          {
            "t": "Div",
            "c": [
              [
                "heading",
                [
                  "section"
                ],
                []
              ],
              [
                {
                  "t": "Header",
                  "c": [
                    2,
                    [
                      "",
                      [],
                      []
                    ],
                    [
                      {
                        "t": "Str",
                        "c": "heading"
                      }
                    ]
                  ]
                },
                {
                  "t": "BlockQuote",
                  "c": [
                    {
                      "t": "BlockQuote",
                      "c": [
                        {
                          "t": "Para",
                          "c": [
                            {
                              "t": "Str",
                              "c": "block"
                            },
                            {
                              "t": "Space"
                            },
                            {
                              "t": "Str",
                              "c": "quote"
                            }
                          ]
                        }
                      ]
                    }
                  ]
                },
                {
                  "t": "Table",
                  "c": [
                    [
                      "",
                      [],
                      []
                    ],
                    [
                      null,
                      [
                        {
                          "t": "Plain",
                          "c": [
                            {
                              "t": "Str",
                              "c": "A"
                            },
                            {
                              "t": "Space"
                            },
                            {
                              "t": "Str",
                              "c": "caption"
                            },
                            {
                              "t": "Space"
                            },
                            {
                              "t": "Emph",
                              "c": [
                                {
                                  "t": "Str",
                                  "c": "with"
                                },
                                {
                                  "t": "Space"
                                },
                                {
                                  "t": "Str",
                                  "c": "emph"
                                }
                              ]
                            }
                          ]
                        }
                      ]
                    ],
                    [
                      [
                        {
                          "t": "AlignRight"
                        },
                        {
                          "t": "ColWidthDefault"
                        }
                      ],
                      [
                        {
                          "t": "AlignDefault"
                        },
                        {
                          "t": "ColWidthDefault"
                        }
                      ]
                    ],
                    [
                      [
                        "",
                        [],
                        []
                      ],
                      [
                        [
                          [
                            "",
                            [],
                            []
                          ],
                          [
                            [
                              [
                                "",
                                [],
                                []
                              ],
                              {
                                "t": "AlignRight"
                              },
                              1,
                              1,
                              [
                                {
                                  "t": "Plain",
                                  "c": [
                                    {
                                      "t": "Str",
                                      "c": "table"
                                    }
                                  ]
                                }
                              ]
                            ],
                            [
                              [
                                "",
                                [],
                                []
                              ],
                              {
                                "t": "AlignDefault"
                              },
                              1,
                              1,
                              [
                                {
                                  "t": "Plain",
                                  "c": [
                                    {
                                      "t": "Str",
                                      "c": "cell"
                                    }
                                  ]
                                }
                              ]
                            ]
                          ]
                        ]
                      ]
                    ],
                    [
                      [
                        [
                          "",
                          [],
                          []
                        ],
                        0,
                        [],
                        [
                          [
                            [
                              "",
                              [],
                              []
                            ],
                            [
                              [
                                [
                                  "",
                                  [],
                                  []
                                ],
                                {
                                  "t": "AlignRight"
                                },
                                1,
                                1,
                                [
                                  {
                                    "t": "Plain",
                                    "c": [
                                      {
                                        "t": "Str",
                                        "c": "123"
                                      }
                                    ]
                                  }
                                ]
                              ],
                              [
                                [
                                  "",
                                  [],
                                  []
                                ],
                                {
                                  "t": "AlignDefault"
                                },
                                1,
                                1,
                                [
                                  {
                                    "t": "Plain",
                                    "c": []
                                  }
                                ]
                              ]
                            ]
                          ]
                        ]
                      ]
                    ],
                    [
                      [
                        "",
                        [],
                        []
                      ],
                      []
                    ]
                  ]
                },
                {
                  "t": "OrderedList",
                  "c": [
                    [
                      1,
                      {
                        "t": "Decimal"
                      },
                      {
                        "t": "Period"
                      }
                    ],
                    [
                      [
                        {
                          "t": "Plain",
                          "c": [
                            {
                              "t": "Str",
                              "c": "one"
                            }
                          ]
                        },
                        {
                          "t": "OrderedList",
                          "c": [
                            [
                              2,
                              {
                                "t": "LowerRoman"
                              },
                              {
                                "t": "Period"
                              }
                            ],
                            [
                              [
                                {
                                  "t": "Plain",
                                  "c": [
                                    {
                                      "t": "Str",
                                      "c": "two"
                                    }
                                  ]
                                }
                              ]
                            ]
                          ]
                        }
                      ]
                    ]
                  ]
                },
                {
                  "t": "DefinitionList",
                  "c": [
                    [
                      [
                        {
                          "t": "Str",
                          "c": "def"
                        }
                      ],
                      [
                        [
                          {
                            "t": "Para",
                            "c": [
                              {
                                "t": "Str",
                                "c": "list"
                              }
                            ]
                          }
                        ]
                      ]
                    ]
                  ]
                }
              ]
            ]
          }
        ]
      }

    );

  });

  it("renders task list items with empty content", () => {
    const ast = parse("- [x]\n- [ ] done\n", {});
    expect(toPandoc(ast)).toStrictEqual(
      {
        "pandoc-api-version": [
          1,
          23,
        ],
        "meta": {},
        "blocks": [
          {
            "t": "BulletList",
            "c": [
              [
                {
                  "t": "Plain",
                  "c": [
                    {
                      "t": "Str",
                      "c": "☒"
                    }
                  ]
                }
              ],
              [
                {
                  "t": "Plain",
                  "c": [
                    {
                      "t": "Str",
                      "c": "☐"
                    },
                    {
                      "t": "Space"
                    },
                    {
                      "t": "Str",
                      "c": "done"
                    }
                  ]
                }
              ]
            ]
          }
        ]
      }
    );
  });

  it("computes colspecs from rows, not from the caption", () => {
    const ast = parse("|a|b|\n^ my table caption\n", {});
    const table : any = toPandoc(ast).blocks[0];
    expect(table.c[2]).toStrictEqual(
      [[{t: "AlignDefault"}, {t: "ColWidthDefault"}],
       [{t: "AlignDefault"}, {t: "ColWidthDefault"}]]);
  });

  it("issues warnings for missing references", () => {
    const warnings : string[] = [];
    const ast = parse("[a][missing]\n", {});
    toPandoc(ast, {warn: (w) => warnings.push(w.message)});
    expect(warnings).toEqual(["Reference missing not found."]);
  });
});
