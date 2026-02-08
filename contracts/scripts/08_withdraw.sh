#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"

AMOUNT="${1:-300000000}"

sui_bin
require_vars PKG LOAN LOAN_CONFIG CLOCK
print_network

sui client ptb \
  --move-call "$PKG::loan::withdraw" @$LOAN @$LOAN_CONFIG "$AMOUNT" @$CLOCK \
  --gas-budget 100000000
