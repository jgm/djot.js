import { parse, renderAST, Str } from "./ast";
import { Filter, applyFilter } from "./filter";

const ignoreWarnings = () => { /* do nothing */ };

const capitalizeFilter : Filter = () => [
  { str: (node : any) => {
     node.text = node.text.toUpperCase();
  }}];

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
});
