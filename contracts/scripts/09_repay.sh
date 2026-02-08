#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"

AMOUNT="${1:-50000000}"

sui_bin
require_vars PKG LOAN LOAN_CONFIG CLOCK
print_network

sui client ptb \
  --split-coins gas "[$AMOUNT]" \
  --assign repay_coin \
  --move-call "$PKG::loan::repay" @$LOAN @$LOAN_CONFIG repay_coin @$CLOCK \
  --gas-budget 120000000
