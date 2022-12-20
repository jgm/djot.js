test: build
	yarn test
.PHONY: test

build:
	tsc

clean:
	rm -rf dist
.PHONY: clean
