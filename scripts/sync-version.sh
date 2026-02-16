#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

VERSION=$(cat "$ROOT_DIR/VERSION" | tr -d '[:space:]')

if [ -z "$VERSION" ]; then
  echo "Error: VERSION file is empty"
  exit 1
fi

echo "Syncing version: $VERSION"

# Update Cargo workspace version
sed -i '' "s/^version = \".*\"/version = \"$VERSION\"/" "$ROOT_DIR/Cargo.toml"

# Update package.json
for pkg in "$ROOT_DIR"/packages/*/package.json; do
  if [ -f "$pkg" ]; then
    # Use a temp file for portable sed
    tmp=$(mktemp)
    sed "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" "$pkg" > "$tmp"
    mv "$tmp" "$pkg"
    echo "  Updated $pkg"
  fi
done

echo "Version sync complete: $VERSION"
