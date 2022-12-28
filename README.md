# djot.js

This aspires to be a typescript rewrite of [djot's
lua implementation](https://github.com/jgm/djot).

Use `tsc` to compile the ts files to js.

`npm test` runs some tests.

Road map:

- [X] attribute parsing (attribute.ts)
- [X] inline parsing (inline.ts)
- [X] block parsing (block.ts)
- [X] parsing to an ast (ast.ts)
- [X] html renderer (html.ts)
- [X] functional tests (from lua implementation)
- [X] pathological tests
- [X] filter API
- [ ] replace current wasm in djot sandbox
- [ ] full-featured cli
- [ ] benchmarks
- [ ] node module

