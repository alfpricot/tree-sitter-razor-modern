# Contributing

## Build

```sh
npx --yes --package=tree-sitter-cli@0.27.0 -- tree-sitter generate
cargo build
```

The generated parser (`src/parser.c`, `src/grammar.json`, and `src/node-types.json`) is committed.
Regenerate and commit its diff after every `grammar.js` change.

## Test

```sh
CC=gcc CXX=g++ npx --yes --package=tree-sitter-cli@0.27.0 -- tree-sitter test
cargo test
```

`test/corpus/` contains tree assertions, including strict CSS behavior for line comments and URL
forms. Regenerate the node-kind snapshot after a node-kind or field-name change:

```sh
node test/generate-node-kinds.mjs
```

## Lint and format

```sh
npm install --ignore-scripts
npm run lint
npm run format:check
```

Use `npm run format` to apply formatting. The generated parser under `src/` is excluded.

## Pull requests

- Regenerate and commit parser files and `test/node-kinds.txt` with grammar changes.
- Add a corpus test for every grammar change.
- Run `cargo fmt`, `cargo clippy --all-targets -- -D warnings`, `npm run lint`, and
  `npm run format:check`.
