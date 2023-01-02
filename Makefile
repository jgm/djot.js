VERSION=$(shell grep '\"version\":' package.json | sed -e 's/.*: \"\([^"]*\)".*/\1/')

test: build
	npm test --noStackTrace
.PHONY: test

build:
	tsc
.PHONY: build

dist/djot.js:
	npm run build

playground/djot.js: dist/djot.js
	cp $< playground/djot.js

update-playground: playground/djot.js
	rsync -a --delete playground website:djot.net/
.PHONY: update-playground

doc/djot.1: doc/djot.md
	pandoc \
	  --metadata title="DJOT(1)" \
	  --metadata author="" \
	  --variable footer="djot $(VERSION)" \
	  $< -s -o $@

clean:
	rm -rf dist
.PHONY: clean
