#!/usr/bin/env bash
set -euo pipefail

PROJECT_REPO="adam-paterson/codex-opencode-notifier"
DEFAULT_DEST="${HOME}/.config/opencode/plugin/discord-bridge.ts"
BASE_URL="https://raw.githubusercontent.com/${PROJECT_REPO}/main"
SOURCE_PATH="integrations/opencode-plugin/index.ts"
README_PATH="integrations/opencode-plugin/README.md"

if [ "${1:-}" = "--help" ]; then
  cat <<'USAGE'
Install the OpenCode Discord bridge plugin.

Usage:
  curl -fsSL https://raw.githubusercontent.com/adam-paterson/codex-opencode-notifier/main/scripts/install-opencode-plugin.sh | bash

Environment variables:
  DEST=...    Custom destination (default: ~/.config/opencode/plugin/discord-bridge.ts)
USAGE
  exit 0
fi

DEST_PATH="${DEST:-$DEFAULT_DEST}"
README_DEST="$(dirname "$DEST_PATH")/discord-bridge.README.md"

printf '\nOpenCode Plugin Installer\n'
printf '=========================\n'
printf 'Repository : %s\n' "$PROJECT_REPO"
printf 'Source     : %s\n' "$SOURCE_PATH"
printf 'Destination: %s\n' "$DEST_PATH"

if [ -t 0 ]; then
  printf 'Proceed with installation? [y/N] '
  read -r response || response=""
  printf '\n'
  case "$response" in
    [yY][eE][sS]|[yY]) ;;
    *)
      printf 'Installation cancelled.\n'
      exit 1
      ;;
  esac
else
  if [ "${ASSUME_YES:-}" = "1" ]; then
    printf 'Non-interactive shell detected; proceeding with ASSUME_YES=1.\n\n'
  else
    printf 'Non-interactive shell detected. Re-run with ASSUME_YES=1 to proceed automatically.\n'
    exit 1
  fi
fi

mkdir -p "$(dirname "$DEST_PATH")"

TMP_MAIN="$(mktemp)"
TMP_README="$(mktemp)"
cleanup() { rm -f "$TMP_MAIN" "$TMP_README"; }
trap cleanup EXIT

download() {
  src="$1"
  dest="$2"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "${BASE_URL}/${src}" -o "$dest"
  elif command -v wget >/dev/null 2>&1; then
    wget -q "${BASE_URL}/${src}" -O "$dest"
  else
    printf 'Error: Neither curl nor wget is available.\n' >&2
    exit 1
  fi
}

download "$SOURCE_PATH" "$TMP_MAIN"
download "$README_PATH" "$TMP_README"

install -m 0644 "$TMP_MAIN" "$DEST_PATH"
install -m 0644 "$TMP_README" "$README_DEST"

printf 'Installed OpenCode plugin to %s\n' "$DEST_PATH"
printf 'Documentation copied to %s\n' "$README_DEST"
printf '\nNext steps:\n'
printf '  1. Ensure these environment variables are set before launching OpenCode:\n'
printf '     export DISCORD_BRIDGE_URL="https://your-bridge.example.com"\n'
printf '     export DISCORD_BRIDGE_TOKEN="shared-token"\n'
printf '  2. Restart opencode.\n'
printf '\nDone.\n'
