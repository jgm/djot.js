Release checklist

_ update CHANGELOG.md
_ update version in package.json
_ git push
_ make dist
_ npm publish --access public
_ git tag @djot/djot@version
_ git push --tags
_ make update-playground
