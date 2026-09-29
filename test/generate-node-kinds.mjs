// Extracts the sorted list of named node kinds from src/node-types.json and
// writes it to test/node-kinds.txt, alongside each kind's field names, e.g.
// `create_trigger{body,name}`. This snapshot is this grammar's public API
// surface: consumers match against node kind names and field names both, so
// a rename or removal of either is meant to be an explicit, reviewable diff
// rather than a silent break that only surfaces downstream. A kind with no
// fields is written bare, with no `{}` suffix.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const nodeTypes = JSON.parse(readFileSync(`${repoRoot}src/node-types.json`, 'utf8'));

const fieldsByKind = new Map();
for (const node of nodeTypes) {
  if (!node.named || !node.fields) continue;
  const fieldNames = Object.keys(node.fields);
  if (fieldNames.length === 0) continue;
  const existing = fieldsByKind.get(node.type) ?? new Set();
  for (const name of fieldNames) existing.add(name);
  fieldsByKind.set(node.type, existing);
}

const kinds = [...new Set(nodeTypes.filter((node) => node.named).map((node) => node.type))]
  .sort()
  .map((kind) => {
    const fields = fieldsByKind.get(kind);
    return fields ? `${kind}{${[...fields].sort().join(',')}}` : kind;
  });

writeFileSync(`${repoRoot}test/node-kinds.txt`, `${kinds.join('\n')}\n`);
