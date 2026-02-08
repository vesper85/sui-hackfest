#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"

NAME="${1:-Borrower NFT}"
DESC="${2:-Manual minted NFT}"
PORTFOLIO_ID="${3:-POOL-001}"
NO_OF_LOANS="${4:-1}"
TOTAL_PRINCIPAL="${5:-1000}"
AVG_INTEREST="${6:-1200}"
PORTFOLIO_TERM="${7:-12M}"
PORTFOLIO_STATUS="${8:-active}"
MATURITY_DATE="${9:-2027-12-31}"

sui_bin
require_vars PKG NFT_CONFIG APPROVED_MINTERS
print_network

sui client ptb \
  --move-call "$PKG::nft_nisarg::mint_nft" \
  @$NFT_CONFIG @$APPROVED_MINTERS \
  "$NAME" "$DESC" "$PORTFOLIO_ID" \
  "$NO_OF_LOANS" "$TOTAL_PRINCIPAL" "$AVG_INTEREST" \
  "$PORTFOLIO_TERM" "$PORTFOLIO_STATUS" "$MATURITY_DATE" \
  --gas-budget 100000000
