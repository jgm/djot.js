import { EventParser } from "./block.js";
import { parse } from "./ast.js";
import fs from "fs";

const input = fs.readFileSync("/dev/stdin", "utf8");

const warn = function(msg, pos) {
//  process.stderr.write(msg + (pos ? " at " + pos : "") + "\n");
}

let start = true;

try {
  for (const event of new EventParser(input, warn)) {
    let pref;
    if (start) {
      pref = "[";
      start = false;
    } else {
      pref = ",";
    }
    process.stdout.write(pref + '["' + event.annot + '",' + event.startpos +
                           ',' + event.endpos + ']\n');
  }
  console.log("]");

  console.time("parse AST");
  let ast = parse(input, {sourcePositions: true});
  console.timeEnd("parse AST");

  process.stdout.write(JSON.stringify(ast, null, 2));
  process.stdout.write("\n");
} catch(err) {
    console.log(err + "\n");
    if (err.stack) {
      console.log(err.stack.split("\n"));
    }
    process.exit(1);
}
