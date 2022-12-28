import { parse, renderAST, Str } from "./ast";
import { Filter, applyFilter } from "./filter";

const ignoreWarnings = () => { /* do nothing */ };

const capitalizeFilter : Filter = () => {
  return {
           str: (e) => {
             e.text = e.text.toUpperCase();
           }
  };
};

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
            enter: () => {
              return true; // stop traversal (don't process inside notes)
            },
            exit: () => {}
          }
        };
};

describe("applyFilter", () => {
  it("capitalizes text", () => {
    let ast = parse("Hello *there* `code`", { warn: ignoreWarnings });
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

  it("capitalizes text within emphasis only", () => {
    let ast = parse("Hello _*there*_ `code`[^1]\n\n[^1]: _emph_", { warn: ignoreWarnings });
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
footnotes
  ["1"] =
    footnote label="1"
      para
        emph
          str text="emph"
`);
  });

});
