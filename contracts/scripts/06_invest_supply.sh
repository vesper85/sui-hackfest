#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"

AMOUNT="${1:-200000000}"

sui_bin
require_vars PKG OPERATOR JUNIOR_POOL SENIOR_POOL TREASURY LOAN OP_CONFIG CLOCK
print_network

sui client ptb \
  --split-coins gas "[$AMOUNT]" \
  --assign invest_coin \
  --move-call "$PKG::whitelist_operator::supply" \
  @$OPERATOR @$JUNIOR_POOL @$SENIOR_POOL @$TREASURY invest_coin @$LOAN @$OP_CONFIG @$CLOCK \
  --gas-budget 150000000
