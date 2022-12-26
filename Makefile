test: build
	yarn test --noStackTrace
.PHONY: test

build:
	tsc
.PHONY: build

dist/bundle.js:
	yarn run webpack

clean:
	rm -rf dist
.PHONY: clean
