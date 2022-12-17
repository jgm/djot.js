import { parse, ParseOptions, Doc } from "./ast.js";

const ignoreWarnings = () => { /* do nothing */ };

describe("Parser", () => {
  it("does nothing", () => {
    console.log(parse("hello", {}));
  });
});
