import assert from 'node:assert';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import Parser from 'tree-sitter';

const root = fileURLToPath(new URL('../..', import.meta.url));
const queriesDir = `${root}/queries`;

test('every queries/*.scm file compiles against the grammar', async () => {
  const { default: language } = await import('./index.js');
  const files = readdirSync(queriesDir).filter((name) => name.endsWith('.scm'));
  assert.ok(files.length > 0, 'expected at least one query file under queries/');

  for (const file of files) {
    const source = readFileSync(`${queriesDir}/${file}`, 'utf8');
    assert.doesNotThrow(
      () => new Parser.Query(language, source),
      (error) => {
        error.message = `${file}: ${error.message}`;
        return true;
      },
    );
  }
});
