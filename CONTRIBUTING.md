# Contributing to tree-sitter-razor-modern

A tree-sitter grammar for ASP.NET Core Razor markup, written in JavaScript (`grammar.js`) with a C parser generated from it and Rust and Node bindings.

## Before you start

1. Branch from **`dev`**. `main` is the production branch: a promotion pull request from `dev` lands on it, and the gala release workflow then cuts the release and fast-forwards `dev` to the release commit.
2. Read [ARCHITECTURE.md](ARCHITECTURE.md) for how the repository is laid out and [docs/SYNTAX.md](docs/SYNTAX.md) for the Razor constructs the grammar covers.

## Local setup

```sh
npm install --ignore-scripts
npx --yes --package=tree-sitter-cli@0.27.1 -- tree-sitter generate
cargo build
```

`--ignore-scripts` installs the development dependencies without running the package's own `node-gyp-build` install script, which needs a C toolchain. `grammar.js` imports `tree-sitter-c-sharp` from `node_modules`, so install first, then generate. The generated parser (`src/parser.c`, `src/grammar.json`, and `src/node-types.json`) is committed: regenerate it and commit the diff after every `grammar.js` change. On Windows without MSVC, set `CC` and `CXX` to an installed GCC-compatible toolchain.

## Validation before a pull request

```sh
npx --yes --package=tree-sitter-cli@0.27.1 -- tree-sitter generate
node test/generate-node-kinds.mjs
npm run lint
npm run format:check
node --test tools/*.test.mjs
npx --yes --package=tree-sitter-cli@0.27.1 -- tree-sitter test
TREE_SITTER=tree-sitter bash test/check-examples.sh
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
```

The `Verify` workflow runs these steps, plus `npm install` and `npm test` for the Node binding, a package-contents check, secret scanning, and workflow linting. After the first two commands, `git diff` should show no change to the generated parser or to `test/node-kinds.txt`; CI fails when either is out of date.

- `test/corpus/` holds tree assertions for each Razor construct, and `test/highlight/` holds highlight assertions. Add a corpus test for every grammar change.
- `examples/*.cshtml` holds sanitized real pages that must parse with no `ERROR`, `MISSING`, or zero-width nodes. `test/check-examples.sh` runs the same per-file check as CI; set `TREE_SITTER` to the CLI to use.
- Run `npm run format` to apply formatting. The generated parser under `src/` is excluded.

## Pull requests

- Open pull requests against **`dev`**.
- Use a Conventional Commit title (`feat:`, `fix:`, `docs:`, `chore:`, `test:`, and so on); CI validates it.
- Keep each pull request to one change, and link the issue it resolves in the body.
- Commit regenerated parser files and `test/node-kinds.txt` together with the grammar change that produced them.

## Documentation

| Document | Covers |
| --- | --- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Components, build and release flow, and where things live |
| [docs/SYNTAX.md](docs/SYNTAX.md) | Razor constructs the grammar covers |
| [SECURITY.md](SECURITY.md) | Reporting problems and supported versions |
