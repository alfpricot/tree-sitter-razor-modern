#!/usr/bin/env bash
# Parses every examples/*.cshtml page and fails on any ERROR node, MISSING node, or zero-width
# node, the same check the verify workflow runs. A zero-width node (equal start and end position)
# is how the parser fabricates a required child without reporting an error.
#
# Set TREE_SITTER to the CLI to use (default: tree-sitter on PATH). Run from the repository root.
set -euo pipefail

ts="${TREE_SITTER:-tree-sitter}"
fail=0

for f in examples/*.cshtml; do
  if ! output=$("$ts" parse "$f" 2>&1); then
    parse_failed=1
  else
    parse_failed=0
  fi
  # The final summary line repeats the first error, so drop it before counting.
  body=$(printf '%s\n' "$output" | grep -v 'Parse:' || true)
  error_count=$(printf '%s\n' "$body" | grep -c 'ERROR\|MISSING' || true)
  zero_width_count=$(printf '%s\n' "$body" | grep -cE '\[([0-9]+), ([0-9]+)\] - \[\1, \2\]' || true)
  if [ "$parse_failed" -eq 1 ] && [ "$error_count" -eq 0 ]; then
    echo "FAIL $f: tree-sitter parse exited non-zero with no ERROR/MISSING node (possible crash)"
    fail=1
  elif [ "$error_count" -ne 0 ] || [ "$zero_width_count" -ne 0 ]; then
    echo "FAIL $f: $error_count ERROR/MISSING line(s), $zero_width_count zero-width node(s)"
    fail=1
  else
    echo "ok   $f"
  fi
done

exit "$fail"
