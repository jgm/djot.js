import fs from "node:fs";
import path from "node:path";

const override = "OVERRIDE" in process.env;

/// In `inline.spec.ts` and `block.spec.ts` we have code like:
///
/// ```
/// const parser = new InlineParser('{=hello=}');
/// //                               012345678
/// ```
///
/// This function checks that the comments are aligned with the strings they are annotating.
function checkNumberComments(filename: string) {
  const lines = fs.readFileSync(path.resolve(__dirname, filename), "utf-8").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const match = /^( +)\/\/  +(\d[\d ]*\d)( *)$/.exec(lines[i]);
    if (match) {
      const prevLine = lines[i - 1];
      const quoteIdx = prevLine.search(/'|"/);
      const expectedStartIdx = quoteIdx + 1;

      let annotation = "";
      let num = 0;
      for (let j = quoteIdx + 1; j < prevLine.lastIndexOf(prevLine[quoteIdx]); j++) {
        if (prevLine[j - 1] == "\\") annotation += " ";
        else {
          annotation += num;
          num = (num + 1) % 10;
        }
      }
      const expectedComment = match[1] + "//" + " ".repeat(expectedStartIdx - match[1].length - "//".length) + annotation.trimEnd();

      if (override) {
        lines[i] = expectedComment;
      } else if (lines[i] != expectedComment) {
        throw new Error(
          `unexpected comment at line ${i + 1}\n` +
            `expected: ${expectedComment}\n` +
            `received: ${lines[i]}\n`,
        );
      }
    }
  }
  if (override)
    fs.writeFileSync(path.resolve(__dirname, filename), lines.join("\n"));
}

it("number comments in inline.spec.ts are aligned", () => {
  checkNumberComments("inline.spec.ts");
});

it("number comments in block.spec.ts are aligned", () => {
  checkNumberComments("block.spec.ts");
});
