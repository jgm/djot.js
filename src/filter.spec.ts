import { parse, renderAST } from "./parse";
import { Filter, applyFilter } from "./filter";

const capitalizeFilter : Filter = () => {
  return {
           str: (e) => {
             e.text = e.text.toUpperCase();
           }
  };
};

const tmFilter : Filter = () => {
  return {
           symb: (e) => {
             if (e.alias === "TM") {
               return [{tag: "str", text: "trade"},
                       {tag: "superscript", children: [
                         {tag: "str", text: "mark"}
                       ]}];
             }
           }
  };
};


const arrayFilter : Filter = () => {
  return [
    { str: (e) => {
        e.text = e.text.toUpperCase();
      }
    },
    { str: (e) => {
        if (e.text === "THERE") {
          e.attributes = { class: "location" };
        }
      }
    }
  ];
}

const imagesToDescriptions : Filter = () => {
  return {
    image: (e) => e.children
  }
}

const fancyFilter : Filter = () => {
  let capitalize = 0;
  return {
          emph: {
            enter: () => {
              capitalize = capitalize + 1;
            },
            exit: () => {
              capitalize = capitalize - 1
            },
          },
          str: (e) => {
            if (capitalize > 0) {
              e.text = e.text.toUpperCase();
             }
          },
          footnote: {
            enter: (e) => {
              return {stop: e}; // stop traversal (don't process inside notes)
            },
            exit: () => {}
          }
        };
};

describe("applyFilter", () => {
  it("capitalizes text", () => {
    const ast = parse("Hello *there* `code`");
    applyFilter(ast, capitalizeFilter);
    expect(renderAST(ast)).toEqual(
`doc
  para
    str text="HELLO "
    strong
      str text="THERE"
    str text=" "
    verbatim text="code"
`);
  });

  it("replaces images with descriptions", () => {
    const ast = parse("![Hello *there* `code`](url.jpg)");
    applyFilter(ast, imagesToDescriptions);
    expect(renderAST(ast)).toEqual(
`doc
  para
    str text="Hello "
    strong
      str text="there"
    str text=" "
    verbatim text="code"
`);
  });


  it("splices in text for symbols", () => {
    const ast = parse("Hello:TM:");
    applyFilter(ast, tmFilter);
    expect(renderAST(ast)).toEqual(
`doc
  para
    str text="Hello"
    str text="trade"
    superscript
      str text="mark"
`);
  });


  it("handles deeply-nested documents without stack overflow", () => {
    const ast = parse("*a _b ".repeat(60000) + " _c d*".repeat(60000));
    applyFilter(ast, capitalizeFilter);
    expect(renderAST(ast)).not.toThrow;
  });

  it("sequences filters", () => {
    const ast = parse("Hello *there* `code`");
    applyFilter(ast, arrayFilter);
    expect(renderAST(ast)).toEqual(
`doc
  para
    str text="HELLO "
    strong
      str text="THERE" class="location"
    str text=" "
    verbatim text="code"
`);
  });


  it("capitalizes text within emphasis only", () => {
    const ast = parse("Hello _*there*_ `code`[^1] and _more_\n\n[^1]: _emph_");
    applyFilter(ast, fancyFilter);
    expect(renderAST(ast)).toEqual(
`doc
  para
    str text="Hello "
    emph
      strong
        str text="THERE"
    str text=" "
    verbatim text="code"
    footnote_reference text="1"
    str text=" and "
    emph
      str text="MORE"
footnotes
  ["1"] =
    footnote label="1"
      para
        emph
          str text="emph"
`);
  });

});
