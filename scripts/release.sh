#!/usr/bin/env bash
set -euo pipefail

# Release @claritylabs/cl-pipelines + @claritylabs/cl-pipelines-docs
# Run from repo root. Ensure working tree is clean and on main first.

echo "==> Checking git status"
test -z "$(git status --porcelain)" || { echo "Working tree not clean"; exit 1; }
test "$(git branch --show-current)" = "main" || { echo "Not on main"; exit 1; }

echo "==> Building"
npm run build

echo "==> Typechecking"
npm run typecheck

echo "==> Testing"
npm test

echo "==> Publishing @claritylabs/cl-pipelines"
npm publish

echo "==> Publishing @claritylabs/cl-pipelines-docs"
( cd docs-pkg && npm publish )

echo "==> Done. Remember to push the tag:"
echo "    git push origin \$(git describe --tags --abbrev=0)"
