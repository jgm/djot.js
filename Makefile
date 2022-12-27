test: build
	npm test --noStackTrace
.PHONY: test

build:
	tsc
.PHONY: build

dist/bundle.js:
	npm run build

clean:
	rm -rf dist
.PHONY: clean
