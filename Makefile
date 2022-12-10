MODULES=attributes.js

%.js: %.ts
	tsc $<

test: $(MODULES)
	yarn test
.PHONY: test

clean:
	-rm $(MODULES)
.PHONY: clean
