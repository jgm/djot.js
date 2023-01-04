"use strict";

const djot = require("../dist/djot");
const benchmark = require("benchmark");
const fs = require("fs");

const suite = new benchmark.Suite();

const nowarning = () => {};
const options = { warn: nowarning };
const djotparser = (contents) => djot.parse(contents, {warn: () => {}});
const djotrenderer = (ast) => djot.renderHTML(ast, {warn: () => {}});
const convert = (contents) => djot.renderHTML(djot.parse(contents, options), options);

const files = [
  "block-list-flat.dj",
  "inline-entity.dj",
  "block-bq-flat.dj",
  "block-list-nested.dj",
  "inline-escape.dj",
  "block-bq-nested.dj",
  "block-ref-flat.dj",
  "inline-html.dj",
  "block-code.dj",
  "block-ref-nested.dj",
  "inline-links-flat.dj",
  "block-fences.dj",
  "inline-autolink.dj",
  "inline-links-nested.dj",
  "block-heading.dj",
  "inline-backticks.dj",
  "inline-newlines.dj",
  "block-hr.dj",
  "inline-em-flat.dj",
  "lorem1.dj",
  "block-html.dj",
  "inline-em-nested.dj",
  "rawtabs.dj",
  "block-lheading.dj",
  "inline-em-worst.dj",
  "readme.dj" ];

var pattern = process.argv[2];

let match = () => { return true; };

if (pattern) {
  match = (f) => { return (new RegExp(pattern).exec(f)) && true; };
}

files.filter(match).forEach((f) => {
  const contents = fs.readFileSync(__dirname + "/" + f, "utf8");
  suite.add(f, () => { convert(contents) });
});


suite
    .on("cycle", function(event) {
        console.log(String(event.target));
    })
    .run({async: true});
