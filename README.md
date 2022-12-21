# djot.js

This aspires to be a typescript rewrite of [djot's
lua implementation](https://github.com/jgm/djot).

Use `tsc` to compile the ts files to js.

`yarn test` runs some tests.

Road map:

- [X] attribute parsing (attribute.ts)
- [X] inline parsing (inline.ts)
- [X] block parsing (block.ts)
- [ ] parsing to an ast (ast.ts)
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
  - [X] superscript, subscript
  - [X] autolink
  - [X] math
  - [X] footnote reference
  - [X] source positions
  - [X] pretty renderer
  - [X] raw inline
  - [X] raw block
  - [ ] reference definitions
  - [ ] footnote
  - [ ] sections
  - [ ] auto identifiers on headings/sections
  - [ ] list items/lists
  - [ ] definition lists
  - [ ] task lists
  - [ ] tables
  - [ ] captions
  - [ ] unit tests
- [ ] html renderer
- [ ] filter API
- [ ] full-featured cli
- [ ] functional tests (from lua implementation)
- [ ] pathological tests
- [ ] benchmarks
- [ ] node module
- [ ] replace current wasm in djot sandbox

