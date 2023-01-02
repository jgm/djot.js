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

});

