"use strict";

const djot = require("../dist/djot.js");
const benchmark = require("benchmark");
const fs = require("fs");

const suite = new benchmark.Suite();

const nowarning = () => {};
const options = { warn: nowarning };
const djotparser = (contents) => djot.parse(contents, {warn: () => {}});
const djotrenderer = (ast) => djot.renderHTML(ast, {warn: () => {}});
const convert = (contents) => djot.renderHTML(djot.parse(contents, options), options);

const files = [
  "block-bq-flat.dj",
  "block-bq-nested.dj",
  "block-code.dj",
  "block-fences.dj",
  "block-heading.dj",
  "block-hr.dj",
  "block-list-flat.dj",
  "block-list-nested.dj",
  "block-ref-flat.dj",
  "block-ref-nested.dj",
  "inline-autolink.dj",
  "inline-backticks.dj",
  "inline-em-flat.dj",
  "inline-em-nested.dj",
  "inline-em-worst.dj",
  "inline-escape.dj",
  "inline-links-flat.dj",
  "inline-links-nested.dj",
  "lorem1.dj",
  "readme.dj" ];

var pattern = process.argv[2];

let match = () => { return true; };

if (pattern) {
  match = (f) => { return (new RegExp(pattern).exec(f)) && true; };
}

files.filter(match).forEach((f) => {
  const contents = fs.readFileSync(__dirname + "/" + f, "utf8");
  suite.add("parse " + f, () => { djotparser(contents) });
});

let readme = djotparser(fs.readFileSync(__dirname + "/readme.dj", "utf8"));

suite.add("renderHTML readme", () => { djotrenderer(readme) });

suite
    .on("cycle", function(event) {
        console.log(String(event.target));
    })
    .run({async: true});
