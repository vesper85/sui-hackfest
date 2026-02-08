#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"

INVESTOR="${1:-${INVESTOR_ADDRESS:-}}"
TRANCHE="${2:-junior}"

if [[ -z "$INVESTOR" ]]; then
  echo "Usage: $0 <investor_address> [junior|senior]" >&2
  exit 1
fi
if [[ "$TRANCHE" != "junior" && "$TRANCHE" != "senior" ]]; then
  echo "Tranche must be junior or senior" >&2
  exit 1
fi

sui_bin
require_vars PKG OP_ADMIN OPERATOR
print_network

sui client ptb \
  --move-call "$PKG::whitelist_operator::rely_investor" @$OP_ADMIN @$OPERATOR @$INVESTOR "vector<u8>:$TRANCHE" \
  --gas-budget 50000000
