test: build
	yarn test
.PHONY: test

build:
	tsc
.PHONY: build

dist/bundle.js:
	yarn run webpack

clean:
	rm -rf dist
.PHONY: clean
