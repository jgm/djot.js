test: build
	yarn test
.PHONY: test

build:
	tsc
.PHONY: build

dist/bundle.js:
	gulp

clean:
	rm -rf dist
.PHONY: clean
