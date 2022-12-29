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

clean:
	rm -rf dist
.PHONY: clean
