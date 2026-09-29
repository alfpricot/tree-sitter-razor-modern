import js from '@eslint/js';

// grammar.js and grammar/**/*.js call tree-sitter DSL functions (seq, choice,
// field, alias, prec, optional, repeat, repeat1, token, blank, reserved) as implicit
// globals — the tree-sitter CLI evaluates grammar.js in a context that
// provides them, so they are declared as read-only globals here rather than
// imported.
const treeSitterDslGlobals = {
  grammar: 'readonly',
  seq: 'readonly',
  choice: 'readonly',
  optional: 'readonly',
  repeat: 'readonly',
  repeat1: 'readonly',
  prec: 'readonly',
  field: 'readonly',
  alias: 'readonly',
  token: 'readonly',
  blank: 'readonly',
  reserved: 'readonly',
};

export default [
  js.configs.recommended,
  {
    rules: {
      // `(_) => ...` is this grammar's own convention for "the tree-sitter
      // $ param is unused in this rule" — see grammar/keywords.js.
      'no-unused-vars': ['error', { argsIgnorePattern: '^_$' }],
    },
  },
  {
    files: ['grammar.js', 'grammar/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: treeSitterDslGlobals,
    },
  },
  {
    files: ['test/*.mjs', 'bindings/node/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { URL: 'readonly', console: 'readonly', process: 'readonly' },
    },
  },
  {
    ignores: ['src/**', 'node_modules/**', '.worktrees/**'],
  },
];
