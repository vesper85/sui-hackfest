#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"

POOL_ID="${1:-1}"
PRINCIPAL="${2:-1000000000}"
JUNIOR="${3:-400000000}"
SENIOR="${4:-600000000}"

if [[ $((JUNIOR + SENIOR)) -ne $PRINCIPAL ]]; then
  echo "Error: JUNIOR + SENIOR must equal PRINCIPAL" >&2
  exit 1
fi

sui_bin
require_vars PKG FACTORY_CONFIG FACTORY_ADMIN TRANCHE_ADMIN LOAN_ADMIN OP_ADMIN NFT_ADMIN NFT_CONFIG BORROWER_ADDRESS CLOCK
print_network

sui client ptb \
  --move-call "$PKG::pool_factory::create_pool" \
  @$FACTORY_CONFIG @$FACTORY_ADMIN @$TRANCHE_ADMIN @$LOAN_ADMIN @$OP_ADMIN @$NFT_ADMIN @$NFT_CONFIG \
  "$POOL_ID" \
  @$BORROWER_ADDRESS \
  "vector<u8>:Borrower NFT" \
  "vector<u8>:Pool principal NFT" \
  "$PRINCIPAL" \
  "$JUNIOR" \
  "$SENIOR" \
  1200 \
  2592000 \
  12 \
  604800 \
  1 \
  false \
  200 \
  100 \
  0 \
  1 \
  2592000 \
  800 \
  @$CLOCK \
  --gas-budget 250000000

cat <<MSG
Pool created. Next, fetch and set these env vars in scripts/env.sh:
- OPERATOR
- JUNIOR_POOL
- SENIOR_POOL
- LOAN
- NFT
MSG
