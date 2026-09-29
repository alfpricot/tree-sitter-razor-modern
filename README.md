# tree-sitter-razor-modern

A [tree-sitter](https://tree-sitter.github.io/tree-sitter/) grammar for ASP.NET Core Razor markup (`.cshtml` and `.razor`).

This project is a maintained fork of
[`tris203/tree-sitter-razor`](https://github.com/tris203/tree-sitter-razor), licensed under MIT. Embedded C# is
parsed by the C# grammar's own rules, so node kinds inside code blocks match `tree-sitter-c-sharp`.

## Using it

```sh
cargo add tree-sitter tree-sitter-razor-modern
```

```rust
let mut parser = tree_sitter::Parser::new();
let language = tree_sitter_razor::LANGUAGE;
parser
    .set_language(&language.into())
    .expect("Error loading ASP.NET Core Razor markup (`.cshtml` and `.razor`) parser");
```

```sh
npm install tree-sitter-razor-modern
```

```js
import Parser from 'tree-sitter';
import Language from 'tree-sitter-razor-modern';

const parser = new Parser();
parser.setLanguage(Language);
```

A GitHub Packages copy is also published as `@meloncholera/tree-sitter-razor-modern`.

## Building

```sh
npm install --ignore-scripts
npx --yes --package=tree-sitter-cli@0.27.0 -- tree-sitter generate
cargo build
```

The generated parser (`src/parser.c`, `src/grammar.json`, and `src/node-types.json`) is committed.
Regenerate and commit the diff after every `grammar.js` change.

## Testing

```sh
CC=gcc CXX=g++ npx --yes --package=tree-sitter-cli@0.27.0 -- tree-sitter test
cargo test
```

On Windows without MSVC, set `CC` and `CXX` to an installed GCC-compatible toolchain.

## License

MIT. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
