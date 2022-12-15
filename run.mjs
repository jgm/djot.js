import { Parser } from "./block.js";
import fs from "fs";

const input = fs.readFileSync("/dev/stdin", "utf8");

const warn = function(msg, pos) {
  process.stderr.write(msg + (pos ? " at " + pos : "") + "\n");
}

let start = true;
for (const event of new Parser(input, warn)) {
  let pref;
  if (start) {
    pref = "[ ";
    start = false;
  } else {
    pref = ", ";
  }
  console.log(pref, event);
}
console.log("]");
