Release checklist

_ update CHANGELOG.md
_ update version in package.json, src/version.ts
_ git push
_ make dist
_ npm login
_ npm publish --access public
_ git tag @djot/djot@version
_ git push --tags
_ make update-playground
