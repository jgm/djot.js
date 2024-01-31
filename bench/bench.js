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
