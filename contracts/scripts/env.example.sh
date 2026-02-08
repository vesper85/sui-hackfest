# Copy this file to env.sh and fill values.
# cp scripts/env.example.sh scripts/env.sh

export PKG="0xc99f9bad7408019819650e30c953f9c1a7d82fa9cbc14827e06e76d1019d9174"
export CLOCK="0x6"

# Core shared/admin objects from package publish
export FACTORY_ADMIN="<FactoryAdminCap_ID>"
export FACTORY_CONFIG="<FactoryConfig_shared_ID>"
export NFT_ADMIN="<NftAdminCap_ID>"
export NFT_CONFIG="<NftConfig_shared_ID>"
export APPROVED_MINTERS="<ApprovedMinters_shared_ID>"
export TRANCHE_ADMIN="<TrancheAdminCap_ID>"
export LOAN_ADMIN="<LoanAdminCap_ID>"
export LOAN_CONFIG="<LoanConfig_shared_ID>"
export OP_ADMIN="<OperatorAdminCap_ID>"
export OP_CONFIG="<OperatorConfig_shared_ID>"
export TREASURY="<TreasuryCap_TOKEN_ID>"

# Created per pool after create_pool
export OPERATOR="<WhitelistOperator_shared_ID>"
export JUNIOR_POOL="<JuniorTranchePool_shared_ID>"
export SENIOR_POOL="<SeniorTranchePool_shared_ID>"
export LOAN="<Loan_shared_ID>"
export NFT="<NFT_object_ID_owned_by_borrower>"

# Addresses
export BORROWER_ADDRESS="<borrower_wallet_address>"
export INVESTOR_ADDRESS="<investor_wallet_address>"
