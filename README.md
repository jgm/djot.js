# djot.js

This aspires to be a typescript rewrite of [djot's
lua implementation](https://github.com/jgm/djot).

Use `tsc` to compile the ts files to js.

`yarn test` runs some tests.

Road map:

- [X] attribute parsing (attribute.ts)
- [X] inline parsing (inline.ts)
- [X] block parsing (block.ts)
- [X] parsing to an ast (ast.ts)
- [ ] html renderer
  - [ ] footnotes and note references
- [ ] more unit tests for ast, html
- [ ] filter API
- [ ] full-featured cli
- [ ] functional tests (from lua implementation)
- [ ] pathological tests
- [ ] benchmarks
- [ ] node module
- [ ] replace current wasm in djot sandbox

