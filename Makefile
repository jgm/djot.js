MODULES=attributes.js event.js inline.js block.js find.js

test:
	tsc && yarn test
.PHONY: test

clean:
	-rm $(MODULES)
.PHONY: clean
