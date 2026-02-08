#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"

sui_bin
require_vars PKG APPROVED_MINTERS
print_network

sui client ptb \
  --move-call "$PKG::nft_nisarg::request_mint_approval" @$APPROVED_MINTERS \
  --gas-budget 50000000
