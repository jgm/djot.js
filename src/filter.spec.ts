import { parse, renderAST } from "./parse";
import { Action, Filter, applyFilter } from "./filter";

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

const deleteEmph : Filter = () => {
  return {
    emph: (e) => []
  }
}

const deleteEmphAndCapitalize : Filter = () => {
  return {
    emph: () => [],
    str: (e) => {
      e.text = e.text.toUpperCase();
    }
  }
}

const deleteEmphOnEnterAndCapitalize : Filter = () => {
  return {
    emph: { enter: () => [] },
    str: (e) => {
      e.text = e.text.toUpperCase();
    }
  }
}

// Returning null isn't part of the Transform type, but untyped JS
// filters (e.g. loaded by the CLI) may do it; it should be a no-op:
const nullFilter : Filter = () => {
  return {
    str: (() => null) as unknown as Action
  }
}

const loopyFilter : Filter = () => {
  return {
    emph: (e) => [{tag: "str", text: "hi"},e]
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

const countSpanRuns : Filter = () => {
  let count = 0;
  return {
    span: (e) => {
      ++count;
      return {
        tag: "span",
        children: [{tag: "str", text: String(count)}]
      };
    }
  }
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

  it("deletes nodes", () => {
    const ast = parse("Hello _there_ friend");
    applyFilter(ast, deleteEmph);
    expect(renderAST(ast)).toEqual(
`doc
  para
    str text="Hello "
    str text=" friend"
`);
  });

  it("visits the sibling after a deleted node", () => {
    const ast = parse("Hello _x_ there _y_ friend");
    applyFilter(ast, deleteEmphAndCapitalize);
    expect(renderAST(ast)).toEqual(
`doc
  para
    str text="HELLO "
    str text=" THERE "
    str text=" FRIEND"
`);
  });

  it("visits the sibling after a node deleted on enter", () => {
    const ast = parse("Hello _x_ there");
    applyFilter(ast, deleteEmphOnEnterAndCapitalize);
    expect(renderAST(ast)).toEqual(
`doc
  para
    str text="HELLO "
    str text=" THERE"
`);
  });

  it("exits the parent after deleting its last child", () => {
    const ast = parse("Hello _x_");
    applyFilter(ast, deleteEmphAndCapitalize);
    expect(renderAST(ast)).toEqual(
`doc
  para
    str text="HELLO "
`);
  });

  it("treats a null return value as a no-op", () => {
    const ast = parse("hi");
    expect(() => applyFilter(ast, nullFilter)).not.toThrow();
    expect(renderAST(ast)).toEqual(
`doc
  para
    str text="hi"
`);
  });

  it("doesn't run exit filters twice", () => {
    const ast = parse("[count goes here]{.span}");
    applyFilter(ast, countSpanRuns);
    expect(renderAST(ast)).toEqual(
`doc
  para
    span
      str text="1"
`);
  });

  it("doesn't loop", () => {
    const ast = parse("Hello _there_ friend");
    applyFilter(ast, loopyFilter);
    expect(renderAST(ast)).toEqual(
`doc
  para
    str text="Hello "
    str text="hi"
    emph
      str text="there"
    str text=" friend"
`);
  });


});
