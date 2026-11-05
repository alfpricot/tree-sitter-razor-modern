import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { scannerDrift, tokenTypes } from './scanner-drift.mjs';

const source = (tokens, header = '// Upstream: tree-sitter-c-sharp 1.2.3\n') =>
  `${header}enum TokenType {\n${tokens.map((t) => `    ${t},`).join('\n')}\n};\n`;

test('tokenTypes lists enum entries and ignores comments', () => {
  assert.deepEqual(tokenTypes('enum TokenType {\n A, // first\n B,\n};'), ['A', 'B']);
  assert.throws(() => tokenTypes('int x;'));
});

test('appending Razor tokens after the upstream order is not drift', () => {
  const upstream = source(['A', 'B'], '');
  assert.deepEqual(scannerDrift(source(['A', 'B', 'IMPLICIT_DOT']), upstream, '1.2.3'), []);
});

test('a reordered, missing, or new upstream token is reported', () => {
  const upstream = source(['A', 'B', 'C'], '');
  assert.equal(scannerDrift(source(['B', 'A', 'C']), upstream, '1.2.3').length, 2);
  assert.equal(scannerDrift(source(['A', 'B']), upstream, '1.2.3').length, 1);
  assert.equal(scannerDrift(source(['A', 'NEW', 'B', 'C']), upstream, '1.2.3').length, 2);
});

test('the copy must name the installed upstream version', () => {
  const upstream = source(['A'], '');
  assert.equal(scannerDrift(source(['A']), upstream, '1.2.4').length, 1);
  assert.equal(scannerDrift(source(['A'], ''), upstream, '1.2.3').length, 1);
});

test('the check runs when the script is reached through a symlink', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'razor-modern-drift-'));
  try {
    const link = join(root, 'scanner-drift.mjs');
    try {
      symlinkSync(fileURLToPath(new URL('./scanner-drift.mjs', import.meta.url)), link);
    } catch {
      t.skip('symbolic links are not available here');
      return;
    }
    const output = execFileSync(process.execPath, [link], { encoding: 'utf8' });
    assert.match(output, /token order/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
