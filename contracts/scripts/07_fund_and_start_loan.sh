#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"

JUNIOR_AMOUNT="${1:-400000000}"
SENIOR_AMOUNT="${2:-600000000}"
REQUIRE_ORIG_FEE="${3:-false}"

sui_bin
require_vars PKG FACTORY_ADMIN TRANCHE_ADMIN LOAN_ADMIN JUNIOR_POOL SENIOR_POOL LOAN NFT CLOCK
print_network

sui client ptb \
  --move-call "$PKG::pool_factory::fund_and_start_loan" \
  @$FACTORY_ADMIN @$TRANCHE_ADMIN @$LOAN_ADMIN @$JUNIOR_POOL @$SENIOR_POOL @$LOAN @$NFT \
  "$JUNIOR_AMOUNT" "$SENIOR_AMOUNT" "$REQUIRE_ORIG_FEE" @$CLOCK \
  --gas-budget 200000000
