import { EventParser } from "./block.js";
import { parse, renderAST } from "./ast.js";
import { renderDOM } from "./html.js";
import fs from "fs";
import { performance } from "perf_hooks";
import { JSDOM } from "jsdom";

const { document } = (new JSDOM(`<!DOCTYPE html><p>hello</p>`)).window;

const warn = function(msg, pos) {
  process.stderr.write(msg + (pos ? " at " + pos : "") + "\n");
}

let timing = false;
let events = false;
let options = {sourcePositions: false, warn: warn};
let output = 'html';
let usage = `djot [OPTIONS] FILE*
Options:
  --sourcepos,-p       Include source positions
  --quiet,-q           Suppress warnings
  --time,-t            Print parse time to stderr
  --events,-e          Print events in JSON format
  --json,-j            Print AST in JSON format
  --ast,-a             Print AST in human-readable format
  --html               Print HTML (default)
  --help,-h            This usage message
`;
let files = [];

for (let i=2; i < process.argv.length; i++) {
  let arg = process.argv[i];
  switch (arg) {
    case "--sourcepos":
    case "-p":
      options.sourcePositions = true;
      break;
    case "--quiet":
    case "-q":
      options.warn = (msg, pos) => {};
      break;
    case "--time":
    case "-t":
      timing = true;
      break;
    case "--events":
    case "-e":
      events = true;
      break;
    case "--json":
    case "-j":
      output = 'json';
      break;
    case "--ast":
    case "-a":
      output = 'ast';
      break;
    case "--html":
      output = 'html';
      break;
    case "--help":
    case "-h":
      process.stdout.write(usage);
      process.exit(0);
      break;
    default:
      if (arg.charAt(0) === "-") {
        process.stderr.write("Unknown option " + arg + "\n");
        process.exit(1);
      } else {
        files.push(arg);
      }
  }
}

let input = "";
if (files.length === 0) {
  files = ["/dev/stdin"];
}
files.forEach(file => {
  try {
    input = input + fs.readFileSync(file, "utf8");
  } catch(err) {
    console.error(err);
    process.exit(1);
  }
});

try {
  if (events) {
    let start = true;
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
  } else {
    let startTime = performance.now();
    let ast = parse(input, options);
    let endTime = performance.now();
    let parseTime = (endTime - startTime).toFixed(2);

    switch (output) {
      case "html":
        process.stdout.write(renderHTML(ast));
        break;
      case "json":
        process.stdout.write(JSON.stringify(ast, null, 2));
        process.stdout.write("\n");
        break;
      case "ast":
        process.stdout.write(renderAST(ast));
        break;
      default:
    }

    if (timing) {
      process.stderr.write(`Parse time = ${parseTime} ms\n`);
    }
  }
} catch(err) {
    console.log(err + "\n");
    if (err.stack) {
      console.log(err.stack.split("\n"));
    }
    process.exit(1);
}


process.exit(0);
