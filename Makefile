VERSION=$(shell grep '\"version\":' package.json | sed -e 's/.*: \"\([^"]*\)".*/\1/')

test: build
	npm test --noStackTrace
.PHONY: test

src/version.ts: package.json
	grep '^ *"version":' $< | \
	  sed 's/^ *"version": "*\([^"]*\)",/export const version = "\1";/' > $@

build: src/version.ts
	npx tsc
.PHONY: build

dist: src/version.ts dist/djot.js doc/djot.1 djot-schema.json
	npm run build
	npm publish --dry-run
.PHONY: dist

publish:
	npm publish
.PHONY: publish

bench: build
	npm run bench
.PHONY: bench

dist/djot.js: build
	npm run build

playground/djot.js: dist/djot.js
	cp $< playground/djot.js

pm.dj:
	curl https://raw.githubusercontent.com/jgm/pandoc/master/MANUAL.txt \
		| pandoc -t json | ./djot -f pandoc -t djot > $@

check-optimization: pm.dj
	rm isolate*v8.log
	node --log-all ./lib/cli.js pm.dj >/dev/null
	npx v8-deopt-viewer -i isolate*v8.log
	open ./v8-deopt-viewer/index.html
.PHONY: check-optimization

update-playground: playground/djot.js
	rsync -a --delete playground website:djot.net/
	ssh website 'sed -i.bkp -e "s/__DATE__/$$(date -Iseconds)/" djot.net/playground/index.html'
.PHONY: update-playground

doc/djot.1: doc/djot.md package.json
	pandoc \
	  --metadata title="DJOT(1)" \
	  --metadata author="" \
	  --variable footer="djot $(VERSION)" \
	  $< -s -o $@

djot-schema.json: src/ast.ts
	# npm install -g typescript-json-schema
	typescript-json-schema --required --noExtraProps $< Doc -o $@

clean:
	rm -rf dist
.PHONY: clean
