# Sui Credit Pool Flow (End-to-End)

This document shows the exact call flow from **NFT principal creation** to **pool invest** to **loan start (init borrow)** to **borrower withdraw/repay**.

## Deployed Package (Testnet)
- Package ID: `0xc99f9bad7408019819650e30c953f9c1a7d82fa9cbc14827e06e76d1019d9174`

## Modules
- `pool_factory` (`/Users/nisargthakkar/Projects/hackthemoney/sui-hackfest/contracts/sources/factory.move`)
- `nft_nisarg` (`/Users/nisargthakkar/Projects/hackthemoney/sui-hackfest/contracts/sources/nft.move`)
- `whitelist_operator` (`/Users/nisargthakkar/Projects/hackthemoney/sui-hackfest/contracts/sources/operator.move`)
- `tranche_pool` (`/Users/nisargthakkar/Projects/hackthemoney/sui-hackfest/contracts/sources/tranche.move`)
- `loan` (`/Users/nisargthakkar/Projects/hackthemoney/sui-hackfest/contracts/sources/loan.move`)
- `token` (`/Users/nisargthakkar/Projects/hackthemoney/sui-hackfest/contracts/sources/token.move`)

## What gets created at publish
At package publish, each module `init` creates admin/config objects.
You will use these objects in the calls below:

- `pool_factory::FactoryAdminCap`
- `pool_factory::FactoryConfig` (shared)
- `nft_nisarg::AdminCap`
- `nft_nisarg::Config` (shared)
- `whitelist_operator::OperatorAdminCap`
- `whitelist_operator::OperatorConfig` (shared)
- `tranche_pool::TrancheAdminCap`
- `loan::LoanAdminCap`
- `loan::LoanConfig` (shared)
- `token::TokenAdminCap`
- `0x2::coin::TreasuryCap<TOKEN>`

## Core flow (who calls what)

### 1) Factory/Admin creates pool (NFT + pools + loan + operator)
Caller: protocol admin

Call:
- `pool_factory::create_pool(...)`

This does all of the following in one transaction:
- Mints NFT for borrower using `nft_nisarg::create_nft_for_pool`.
- NFT `total_principal_amount = principal_amount`.
- Creates junior and senior tranche pools.
- Creates loan linked to NFT ID.
- Creates operator and sets junior/senior tranche ceilings.
- Shares pool/loan/operator objects.

Important checks in factory:
- `junior_ceiling + senior_ceiling == principal_amount`

### 2) Admin whitelists investors
Caller: protocol admin

Call:
- `whitelist_operator::rely_investor(operator, investor, b"junior")`
- `whitelist_operator::rely_investor(operator, investor, b"senior")`

### 3) Investor supplies funds to pool
Caller: investor

Call:
- `whitelist_operator::supply(operator, junior_pool, senior_pool, treasury_cap, investor_sui_coin, loan, operator_config, clock, ctx)`

Behavior:
- Supply goes junior first until junior ceiling is full.
- Then supply goes to senior tranche.
- Investor receives tranche token (`TOKEN`) from treasury cap.

### 4) Admin funds loan and opens init borrow
Caller: protocol admin

Call:
- `pool_factory::fund_and_start_loan(factory_admin, tranche_admin, loan_admin, junior_pool, senior_pool, loan, nft, junior_amount, senior_amount, require_origination_fee, clock, ctx)`

Behavior:
- Borrows SUI from tranche pools (`borrow_coin`).
- Deposits borrowed SUI into loan pool balance.
- Calls `loan::init_borrow(...)` to start loan.

Important checks:
- `junior_amount + senior_amount == nft.total_principal_amount`
- Borrower must own NFT.

### 5) Borrower withdraws from loan
Caller: borrower wallet

Call:
- `loan::withdraw(loan, loan_config, amount, clock, ctx)`

Checks:
- Caller must be loan borrower.
- Loan must be initialized (`init_borrow` already done).
- Sufficient loan pool balance.

### 6) Borrower repays
Caller: borrower wallet

Call:
- `loan::repay(loan, loan_config, payment_coin, clock, ctx)`

Behavior:
- Accepts repayment coin.
- Applies late fees and period logic.
- Updates interest/principal repaid state.
- Marks loan ended when principal+interest are fully repaid.

## Single-line lifecycle summary
1. Admin calls `create_pool`.
2. Admin whitelists investors.
3. Investors call `supply`.
4. Admin calls `fund_and_start_loan` (this performs `init_borrow`).
5. Borrower calls `withdraw`.
6. Borrower calls `repay` until complete.

## Notes
- Use PTBs to chain object references cleanly.
- Keep object IDs from `PoolCreatedEvent` (or object query output) to drive later calls.
- `loan_models` module exists to keep loan logic deployable under Sui verifier limits while preserving core behavior.

## PTB command templates (`sui client ptb`)

Set these once in your shell:

```bash
export PKG=0xc99f9bad7408019819650e30c953f9c1a7d82fa9cbc14827e06e76d1019d9174
export CLOCK=0x6
```

Also set your object IDs from publish/query:

```bash
export FACTORY_ADMIN=<FactoryAdminCap_ID>
export FACTORY_CONFIG=<FactoryConfig_shared_ID>
export NFT_ADMIN=<NftAdminCap_ID>
export NFT_CONFIG=<NftConfig_shared_ID>
export TRANCHE_ADMIN=<TrancheAdminCap_ID>
export LOAN_ADMIN=<LoanAdminCap_ID>
export OP_ADMIN=<OperatorAdminCap_ID>
export OP_CONFIG=<OperatorConfig_shared_ID>
export LOAN_CONFIG=<LoanConfig_shared_ID>
export TREASURY=<TreasuryCap_TOKEN_ID>
```

### 1) Create pool (admin)

```bash
sui client ptb \
  --move-call "$PKG::pool_factory::create_pool" \
    @$FACTORY_CONFIG @$FACTORY_ADMIN @$TRANCHE_ADMIN @$LOAN_ADMIN @$OP_ADMIN @$NFT_ADMIN @$NFT_CONFIG \
    1 \
    @<BORROWER_ADDRESS> \
    "vector<u8>:Borrower NFT" \
    "vector<u8>:Pool principal NFT" \
    1000000000 \
    400000000 \
    600000000 \
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
  --gas-budget 200000000
```

Notes:
- `principal_amount` must equal `junior_ceiling + senior_ceiling`.
- Save created object IDs: `junior_pool`, `senior_pool`, `loan`, `operator`, `nft`.

### 2) Whitelist investor (admin)

```bash
export OPERATOR=<WhitelistOperator_shared_ID>
export INVESTOR=<INVESTOR_ADDRESS>

sui client ptb \
  --move-call "$PKG::whitelist_operator::rely_investor" @$OP_ADMIN @$OPERATOR @$INVESTOR "vector<u8>:junior" \
  --gas-budget 50000000

sui client ptb \
  --move-call "$PKG::whitelist_operator::rely_investor" @$OP_ADMIN @$OPERATOR @$INVESTOR "vector<u8>:senior" \
  --gas-budget 50000000
```

### 3) Investor supply (investor wallet)

```bash
export JUNIOR_POOL=<TranchePool_junior_shared_ID>
export SENIOR_POOL=<TranchePool_senior_shared_ID>
export LOAN=<Loan_shared_ID>

sui client ptb \
  --split-coins gas "[200000000]" \
  --assign invest_coin \
  --move-call "$PKG::whitelist_operator::supply" \
    @$OPERATOR @$JUNIOR_POOL @$SENIOR_POOL @$TREASURY invest_coin @$LOAN @$OP_CONFIG @$CLOCK \
  --gas-budget 120000000
```

### 4) Fund and start loan (`init_borrow`) (admin)

```bash
export NFT=<NFT_OBJECT_ID_OWNED_BY_BORROWER>

sui client ptb \
  --move-call "$PKG::pool_factory::fund_and_start_loan" \
    @$FACTORY_ADMIN @$TRANCHE_ADMIN @$LOAN_ADMIN @$JUNIOR_POOL @$SENIOR_POOL @$LOAN @$NFT \
    400000000 \
    600000000 \
    false \
    @$CLOCK \
  --gas-budget 150000000
```

Notes:
- `junior_amount + senior_amount` must match NFT principal.

### 5) Borrower withdraw

```bash
sui client ptb \
  --move-call "$PKG::loan::withdraw" @$LOAN @$LOAN_CONFIG 300000000 @$CLOCK \
  --gas-budget 80000000
```

### 6) Borrower repay

```bash
sui client ptb \
  --split-coins gas "[50000000]" \
  --assign repay_coin \
  --move-call "$PKG::loan::repay" @$LOAN @$LOAN_CONFIG repay_coin @$CLOCK \
  --gas-budget 100000000
```

Repeat repay until loan ends.

## Quick object discovery tips

- Get owned objects:

```bash
sui client objects
```

- Get shared/package objects by type:

```bash
sui client object <OBJECT_ID>
sui client dynamic-field <PARENT_ID> <NAME> <TYPE>
```

- Use explorer for tx outputs:

```text
https://suiexplorer.com/txblock/<TX_DIGEST>?network=testnet
```
