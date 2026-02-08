#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/env.sh"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

require_vars() {
  for v in "$@"; do
    if [[ -z "${!v:-}" ]]; then
      echo "Missing required env var: $v" >&2
      exit 1
    fi
  done
}

sui_bin() {
  command -v sui >/dev/null 2>&1 || {
    echo "sui CLI not found in PATH" >&2
    exit 1
  }
}

print_network() {
  echo "Network: $(sui client active-env)"
  echo "Sender:  $(sui client active-address)"
}
