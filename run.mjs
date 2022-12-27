import { EventParser } from "./dist/block.js";
import { parse, renderAST } from "./dist/ast.js";
import { renderHTML } from "./dist/html.js";
import fs from "fs";
import { performance } from "perf_hooks";

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

let args = process.argv;
for (let i=2; i < args.length; i++) {
  let arg = args[i];
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
      if (/^-[a-z]{2,}/.test(arg)) { // -ap = -a -p
        for (let i=1; i < arg.length; i++) {
          args.push("-" + arg.substring(i,i+1));
        }
      } else if (/^-/.test(arg)) {
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
      if (start) {
        process.stdout.write("[");
        start = false;
      } else {
        process.stdout.write(",\n ");
      }
      process.stdout.write(`{ startpos: ${event.startpos}, endpos: ${event.endpos}, annot: "${event.annot}" }`);
    }
    console.log("]");
  } else {
    let startTime = performance.now();
    let ast = parse(input, options);
    let endTime = performance.now();
    let parseTime = (endTime - startTime).toFixed(1);

    startTime = performance.now();
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
    endTime = performance.now();
    let renderTime = (endTime - startTime).toFixed(1);

    if (timing) {
      process.stderr.write(`Timings: parse ${parseTime} ms, render ${renderTime} ms\n`);
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
