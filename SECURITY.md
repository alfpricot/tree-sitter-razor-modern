# Security policy

## Reporting a problem

A parser crash or hang on some input is a normal GitHub issue: include the input, or a minimized version, and the binding you used (Rust or Node).

Do not open a public issue for a vulnerability that could affect downstream consumers before a fix is available.

## Scope

This policy covers the grammar, the generated parser, the external scanner, and the Rust and Node bindings in this repository. Problems in `tree-sitter` itself or in `tree-sitter-c-sharp` belong in those projects.

## Practices

- Keep credentials out of the repository; CI scans the working tree and history for secrets.
- Example pages under `examples/` are sanitized; do not add real customer data.
- Keep dependencies current; Dependabot opens updates weekly.
