#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"

MINTER_ADDR="${1:-${INVESTOR_ADDRESS:-}}"
if [[ -z "$MINTER_ADDR" ]]; then
  echo "Usage: $0 <minter_address>" >&2
  exit 1
fi

sui_bin
require_vars PKG NFT_ADMIN APPROVED_MINTERS
print_network

sui client ptb \
  --move-call "$PKG::nft_nisarg::approve_mint_request" @$NFT_ADMIN @$APPROVED_MINTERS @$MINTER_ADDR \
  --gas-budget 50000000
