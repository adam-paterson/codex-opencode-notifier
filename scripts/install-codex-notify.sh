#!/usr/bin/env bash
set -euo pipefail

PROJECT_REPO="adam-paterson/codex-opencode-notifier"
DEFAULT_DEST="${HOME}/.codex/notify.mjs"
BASE_URL="https://raw.githubusercontent.com/${PROJECT_REPO}/main"
SOURCE_PATH="integrations/codex-notify/notify.mjs"

if [ "${1:-}" = "--help" ]; then
  cat <<'USAGE'
Install the Codex notify bridge script.

Usage:
  curl -fsSL https://raw.githubusercontent.com/adam-paterson/codex-opencode-notifier/main/scripts/install-codex-notify.sh | bash

Environment variables:
  DEST=...    Custom destination (default: ~/.codex/notify.mjs)
USAGE
  exit 0
fi

DEST_PATH="${DEST:-$DEFAULT_DEST}"

printf '\nCodex Notify Installer\n'
printf '=======================\n'
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
  if [ "${ASSUME_NO:-}" = "1" ]; then
    printf 'Non-interactive shell detected; ASSUME_NO=1 prevents installation.\n'
    exit 1
  fi
  if [ "${ASSUME_YES:-1}" = "1" ]; then
    printf 'Non-interactive shell detected; proceeding (set ASSUME_NO=1 to abort).\n\n'
  else
    printf 'Non-interactive shell detected. Set ASSUME_YES=1 to proceed automatically.\n'
    exit 1
  fi
fi

mkdir -p "$(dirname "$DEST_PATH")"

TMP_FILE="$(mktemp)"
cleanup() { rm -f "$TMP_FILE"; }
trap cleanup EXIT

if command -v curl >/dev/null 2>&1; then
  curl -fsSL "${BASE_URL}/${SOURCE_PATH}" -o "$TMP_FILE"
elif command -v wget >/dev/null 2>&1; then
  wget -q "${BASE_URL}/${SOURCE_PATH}" -O "$TMP_FILE"
else
  printf 'Error: Neither curl nor wget is available.\n' >&2
  exit 1
fi

install -m 0755 "$TMP_FILE" "$DEST_PATH"
printf 'Installed Codex notify script to %s\n' "$DEST_PATH"
printf '\nNext steps:\n'
printf '  1. Update ~/.codex/config.toml with:\n'
printf "     notify = [\"node\", \"%s\", \"https://your-bridge.example.com\", \"shared-token\"]\n" "$DEST_PATH"
printf '  2. Restart codex-cli if running.\n'
printf '\nDone.\n'
