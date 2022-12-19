# djot.js

This aspires to be a typescript rewrite of [djot's
lua implementation](https://github.com/jgm/djot).

Use `tsc` to compile the ts files to js.

`yarn test` runs some tests.

Road map:

- [X] attribute parsing (attribute.ts)
- [X] inline parsing (inline.ts)
- [X] block parsing (block.ts)
- [o] parsing to an ast (ast.ts)
  - [X] para
  - [X] block quote
  - [X] heading
  - [X] thematic break
  - [X] div
  - [X] code block
  - [X] str
  - [X] smart quotes, ellipses, dashes
  - [X] softbreak
  - [X] hardbreak
  - [X] emoji
  - [X] verbatim
  - [X] link
  - [X] image
  - [X] emph
  - [X] strong
  - [X] span
  - [X] mark
  - [X] delete
  - [X] insert
  - [X] attributes (block and inline)
  - [ ] pretty renderer
  - [ ] auto identifiers on headings
  - [X] superscript, subscript
  - [ ] autolink
  - [X] math
  - [ ] footnote reference
  - [ ] raw inline
  - [ ] sections
  - [ ] raw block
  - [ ] footnote
  - [ ] reference definitions
  - [ ] list items/lists, inc. def lists and task lists
  - [ ] tables, captions
  - [ ] source positions
  - [ ] unit tests
- [ ] html renderer (consume ast, produce DOM?)
- [ ] filter API
- [ ] full-featured cli
- [ ] functional tests (from lua implementation)
- [ ] pathological tests
- [ ] benchmarks
- [ ] node module
- [ ] replace current wasm in djot sandbox

