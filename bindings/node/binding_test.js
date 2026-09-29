import assert from 'node:assert';
import { test } from 'node:test';
import Parser from 'tree-sitter';

test('can load grammar', async () => {
  const parser = new Parser();
  const { default: language } = await import('./index.js');
  assert.doesNotThrow(() => {
    parser.setLanguage(language);
  });
});
