# tree-sitter-razor-modern

[![Verify](https://github.com/alfpricot/tree-sitter-razor-modern/actions/workflows/verify.yml/badge.svg?branch=dev)](https://github.com/alfpricot/tree-sitter-razor-modern/actions/workflows/verify.yml)
[![crates.io](https://img.shields.io/crates/v/tree-sitter-razor-modern.svg)](https://crates.io/crates/tree-sitter-razor-modern)

A [tree-sitter](https://tree-sitter.github.io/tree-sitter/) grammar for ASP.NET Core Razor markup (`.cshtml` and `.razor`), with Rust and Node bindings. It is a maintained fork of [`tris203/tree-sitter-razor`](https://github.com/tris203/tree-sitter-razor), licensed under MIT. Embedded C# is parsed by the C# grammar's own rules, so node kinds inside code blocks match `tree-sitter-c-sharp`.

## Installation

Rust:

```sh
cargo add tree-sitter tree-sitter-razor-modern
```

Node:

```sh
npm install tree-sitter-razor-modern
```

A GitHub Packages copy of the npm package is also published as `@alfpricot/tree-sitter-razor-modern`. Prebuilt native addons ship for Linux and Windows, so an install on those platforms needs no C toolchain. Other platforms compile the committed parser from source.

### Requirements

- Node.js 24 for building and testing from a checkout (`.nvmrc`).
- Rust 1.85 or newer (`rust-version` in `Cargo.toml`).
- A C compiler. The Rust build script and `node-gyp` both compile `src/parser.c`.

## Usage

Rust:

```rust
let mut parser = tree_sitter::Parser::new();
parser
    .set_language(&tree_sitter_razor_modern::LANGUAGE.into())
    .expect("Error loading the Razor grammar");
let tree = parser.parse("<p>@DateTime.Now</p>", None).unwrap();
```

Node:

```js
import Parser from 'tree-sitter';
import Language from 'tree-sitter-razor-modern';

const parser = new Parser();
parser.setLanguage(Language);
const tree = parser.parse('<p>@DateTime.Now</p>');
```

The Rust crate also exports `NODE_TYPES`, `HIGHLIGHTS_QUERY`, and `INJECTIONS_QUERY`. [docs/SYNTAX.md](docs/SYNTAX.md) lists the Razor constructs the grammar covers, and [ARCHITECTURE.md](ARCHITECTURE.md) describes how the repository is laid out.

## How to contribute

Branch from `dev` and open pull requests against it. After any change to `grammar.js`, regenerate the parser and commit the result, then run the corpus tests and the checks CI runs. [CONTRIBUTING.md](CONTRIBUTING.md) has the exact commands.

## License

MIT. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
