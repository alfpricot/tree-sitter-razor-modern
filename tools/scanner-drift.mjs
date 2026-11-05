import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const MARKER = /^\/\/ Upstream: tree-sitter-c-sharp (\d+\.\d+\.\d+)$/m;

/** Names listed in the `enum TokenType { ... }` block of a scanner source. */
export function tokenTypes(source) {
  const body = /enum TokenType\s*\{([^}]*)\}/.exec(source);
  if (!body) throw new Error('No enum TokenType found in scanner source');
  return body[1]
    .replace(/\/\/.*$/gm, '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
}

/**
 * Returns the problems found when comparing the vendored scanner with the upstream scanner shipped
 * in the installed tree-sitter-c-sharp package. The generated parser numbers external tokens in
 * the order the imported grammar declares them, so the vendored enum must begin with the upstream
 * enum, unchanged, and only append Razor tokens after it.
 */
export function scannerDrift(ours, upstream, upstreamVersion) {
  const problems = [];
  const marker = MARKER.exec(ours);
  if (!marker) {
    problems.push('src/scanner.c has no "// Upstream: tree-sitter-c-sharp X.Y.Z" header');
  } else if (marker[1] !== upstreamVersion) {
    problems.push(
      `src/scanner.c is marked as copied from tree-sitter-c-sharp ${marker[1]} but ${upstreamVersion} is installed`,
    );
  }
  const ourTokens = tokenTypes(ours);
  const upstreamTokens = tokenTypes(upstream);
  upstreamTokens.forEach((name, index) => {
    if (ourTokens[index] !== name) {
      problems.push(
        `TokenType entry ${index} is ${ourTokens[index] ?? '(missing)'} but upstream has ${name}`,
      );
    }
  });
  return problems;
}

// Compare real paths: import.meta.url is already resolved, argv[1] is not, so a symlinked
// invocation would otherwise skip the body and exit 0 without checking anything.
if (
  process.argv[1] !== undefined &&
  realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])
) {
  const upstreamDir = 'node_modules/tree-sitter-c-sharp';
  const { version } = JSON.parse(readFileSync(`${upstreamDir}/package.json`, 'utf8'));
  const problems = scannerDrift(
    readFileSync('src/scanner.c', 'utf8'),
    readFileSync(`${upstreamDir}/src/scanner.c`, 'utf8'),
    version,
  );
  for (const problem of problems) console.error(`::error::${problem}`);
  if (problems.length > 0) process.exit(1);
  console.log(`src/scanner.c matches the tree-sitter-c-sharp ${version} token order.`);
}
