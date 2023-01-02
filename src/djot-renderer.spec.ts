import { Doc, Block } from "./ast";
import { DjotRenderer } from "./djot-renderer";

const cicero  = "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis."

const mkdoc = function(children : Block[]) : Doc {
  return {tag: "doc",
          references: {},
          footnotes: {},
          children: children};
}

describe("DjotRenderer", () => {
  const cicero1 : Doc = mkdoc([
      { tag: "para",
        children: [ { tag: "str", text: cicero } ] }]);

  it("breaks lines properly", () => {
    expect(new DjotRenderer(cicero1, 30).render()).toStrictEqual(
`Sed ut perspiciatis unde omnis
iste natus error sit
voluptatem accusantium
doloremque laudantium, totam
rem aperiam, eaque ipsa quae
ab illo inventore veritatis.
`
    );
  });

  const cicero2 : Doc = mkdoc([
      { tag: "para",
        children: [ { tag: "str", text: "Quoth Cicero:" } ] },
      { tag: "blockquote",
        children: [
          { tag: "para", children: [ { tag: "str", text: cicero } ]},
          { tag: "para", children: [ { tag: "str", text: cicero } ]}
        ]},
      { tag: "para",
        children: [ { tag: "str", text: "Thus Cicero." } ] },
      ]);

  it("handles block quotes properly", () => {
    expect(new DjotRenderer(cicero2, 40).render()).toStrictEqual(
`Quoth Cicero:

> Sed ut perspiciatis unde omnis iste
> natus error sit voluptatem accusantium
> doloremque laudantium, totam rem
> aperiam, eaque ipsa quae ab illo
> inventore veritatis.
>
> Sed ut perspiciatis unde omnis iste
> natus error sit voluptatem accusantium
> doloremque laudantium, totam rem
> aperiam, eaque ipsa quae ab illo
> inventore veritatis.

Thus Cicero.
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
    expect(new DjotRenderer(cicero3, 30).render()).toStrictEqual(
`Test.

### ed ut perspiciatis unde
### omnis iste natus error si

etc.
`);
   });

  it("does tables", () => {
    const cicero3 : Doc = mkdoc([
    {
      "tag": "table",
      "children": [
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
    expect(new DjotRenderer(cicero3, 30).render()).toStrictEqual(
`|a|b|
|:--|--:|
|c|d|
|cc|dd|
|--:|:-:|
|e|f|
|g|h|
`);
   });

});

