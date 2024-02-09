import { Doc, Block } from "./ast";
import { parse } from "./parse";
import { renderDjot } from "./djot-renderer";

const cicero  = "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis superlongunbreakablewordthatwontfitononeline."

const mkdoc = function(children : Block[]) : Doc {
  return {tag: "doc",
          references: {},
          autoReferences: {},
          footnotes: {},
          children: children};
}

describe("DjotRenderer", () => {
  const cicero1 : Doc = mkdoc([
      { tag: "para",
        children: [ { tag: "str", text: cicero } ] }]);

  it("breaks lines properly", () => {
    expect(renderDjot(cicero1, {wrapWidth: 30})).toEqual(
`Sed ut perspiciatis unde omnis
iste natus error sit
voluptatem accusantium
doloremque laudantium, totam
rem aperiam, eaque ipsa quae
ab illo inventore veritatis
superlongunbreakablewordthatwontfitononeline.
`
    );
  });

  const cicero2 : Doc = mkdoc([
      { tag: "para",
        children: [ { tag: "str", text: "Quoth Cicero:" } ] },
      { tag: "block_quote",
        children: [
          { tag: "para", children: [ { tag: "str", text: cicero } ]},
          { tag: "para", children: [ { tag: "str", text: cicero } ]}
        ]},
      { tag: "para",
        children: [ { tag: "str", text: "Thus Cicero." } ] },
      ]);

  it("handles block quotes properly", () => {
    expect(renderDjot(cicero2, {wrapWidth: 40})).toEqual(
`Quoth Cicero:

> Sed ut perspiciatis unde omnis iste
> natus error sit voluptatem accusantium
> doloremque laudantium, totam rem
> aperiam, eaque ipsa quae ab illo
> inventore veritatis
> superlongunbreakablewordthatwontfitononeline.
>
> Sed ut perspiciatis unde omnis iste
> natus error sit voluptatem accusantium
> doloremque laudantium, totam rem
> aperiam, eaque ipsa quae ab illo
> inventore veritatis
> superlongunbreakablewordthatwontfitononeline.

Thus Cicero.
`);
  });

  it("handles footnotes", () => {
    const fn : Doc =
      {
        "tag": "doc",
        "references": {},
        "autoReferences": {},
        "footnotes": {
          "1": {
            "tag": "footnote",
            "label": "1",
            "children": [
              {
                "tag": "para",
                "children": [
                  {
                    "tag": "str",
                    "text": "This is the note."
                  }
                ]
              },
              {
                "tag": "para",
                "children": [
                  {
                    "tag": "str",
                    "text": "Par 2."
                  }
                ]
              }
            ]
          }
        },
        "children": [
          {
            "tag": "para",
            "children": [
              {
                "tag": "str",
                "text": "hi"
              },
              {
                "tag": "footnote_reference",
                "text": "1"
              }
            ]
          }
        ]
      };
    expect(renderDjot(fn, {wrapWidth: 30})).toEqual(
`hi[^1]

[^1]: This is the note.

  Par 2.
`);
   });


  it("handles lists properly", () => {
    const lst : Doc = mkdoc([
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
            }
          ]
        },
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
            },
            {
              "tag": "bullet_list",
              "style": "-",
              "children": [
                {
                  "tag": "list_item",
                  "children": [
                    {
                      "tag": "para",
                      "children": [
                        {
                          "tag": "str",
                          "text": "a"
                        }
                      ]
                    }
                  ]
                },
                {
                  "tag": "list_item",
                  "children": [
                    {
                      "tag": "para",
                      "children": [
                        {
                          "tag": "str",
                          "text": "b"
                        }
                      ]
                    }
                  ]
                }
              ],
              "tight": true
            }
          ]
        },
        {
          "tag": "list_item",
          "children": [
            {
              "tag": "para",
              "children": [
                {
                  "tag": "str",
                  "text": "three"
                }
              ]
            },
            {
              "tag": "ordered_list",
              "style": "(i)",
              "children": [
                {
                  "tag": "list_item",
                  "children": [
                    {
                      "tag": "para",
                      "children": [
                        {
                          "tag": "str",
                          "text": "four"
                        }
                      ]
                    },
                    {
                      "tag": "para",
                      "children": [
                        {
                          "tag": "str",
                          "text": "subparagraph"
                        }
                      ]
                    }
                  ]
                }
              ],
              "start": 4,
              "tight": false
            }
          ]
        }
      ],
      "start": 1,
      "tight": false
    }]);
    expect(renderDjot(lst, {wrapWidth: 30})).toEqual(
`1. one

2. two

   - a
   - b

3. three

   (iv) four

        subparagraph
`);
   });

  it("handles block quotes properly", () => {
    const cicero3 : Doc = mkdoc([
        { tag: "para",
          children: [ { tag: "str", text: "Test." }] },
        { tag: "heading", level: 3,
          children: [ { tag: "str", text: cicero.substring(1,50) } ] },
        { tag: "para",
          children: [ { tag: "str", text: "etc." }] }
        ]);
    expect(renderDjot(cicero3, {wrapWidth: 30})).toEqual(
`Test.

### ed ut perspiciatis unde
### omnis iste natus error si

etc.
`);
   });

  it("does tables", () => {
    const tbl : Doc = mkdoc([
    {
      "tag": "table",
      "children": [
        {
          "tag": "caption",
          "children": []
        },
        {
          "tag": "row",
          "children": [
            {
              "tag": "cell",
              "children": [
                {
                  "tag": "str",
                  "text": "a"
                }
              ],
              "head": true,
              "align": "left"
            },
            {
              "tag": "cell",
              "children": [
                {
                  "tag": "str",
                  "text": "b"
                }
              ],
              "head": true,
              "align": "right"
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
                  "text": "c"
                }
              ],
              "head": false,
              "align": "left"
            },
            {
              "tag": "cell",
              "children": [
                {
                  "tag": "str",
                  "text": "d"
                }
              ],
              "head": false,
              "align": "right"
            }
          ],
          "head": false
        },
        {
          "tag": "row",
          "children": [
            {
              "tag": "cell",
              "children": [
                {
                  "tag": "str",
                  "text": "cc"
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
                  "text": "dd"
                }
              ],
              "head": true,
              "align": "center"
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
                  "text": "e"
                }
              ],
              "head": false,
              "align": "right"
            },
            {
              "tag": "cell",
              "children": [
                {
                  "tag": "str",
                  "text": "f"
                }
              ],
              "head": false,
              "align": "center"
            }
          ],
          "head": false
        },
        {
          "tag": "row",
          "children": [
            {
              "tag": "cell",
              "children": [
                {
                  "tag": "str",
                  "text": "g"
                }
              ],
              "head": false,
              "align": "right"
            },
            {
              "tag": "cell",
              "children": [
                {
                  "tag": "str",
                  "text": "h"
                }
              ],
              "head": false,
              "align": "center"
            }
          ],
          "head": false
        }
      ]
    }]);
    expect(renderDjot(tbl, {wrapWidth: 30})).toEqual(
`|a|b|
|:--|--:|
|c|d|
|cc|dd|
|--:|:-:|
|e|f|
|g|h|
`);
   });

   const readme = `# djot.js

A library and command-line tool for parsing and
rendering the light markup format [djot](https://djot.net).\n`

   it("omit auto generated attributes and references",()=>{
    expect(renderDjot(parse(readme))).toEqual(readme)
   })

   it("keep original attributes and references",()=>{
    expect(renderDjot(parse(
            `{#djot-js}\n`+readme+`\n\n[djot.js]: #djot-js\n`
    ))).toEqual(`{#djot-js}\n`+readme+`\n\n[djot.js]: #djot-js\n`)
   })

});
