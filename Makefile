test: build
	npm test --noStackTrace
.PHONY: test

build:
	tsc
.PHONY: build

dist/bundle.js: index.ts block.ts inline.ts find.ts attributes.ts ast.ts html.ts
	npm run build

playground/djot.js: dist/bundle.js
	cp $< playground/djot.js

update-playground: playground/djot.js
	rsync -a --delete playground website:djot.net/
.PHONY: update-playground

clean:
	rm -rf dist
.PHONY: clean
