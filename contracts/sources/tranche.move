module contracts::tranche_pool {
    use sui::coin::{Self, TreasuryCap, Coin};
    use sui::balance::{Self, Balance};
    use sui::sui::SUI;
    use sui::event;
    use contracts::token::TOKEN;
    use contracts::token;

    const ERR_INSUFFICIENT_BALANCE: u64 = 3;
    const ERR_ZERO_AMOUNT: u64 = 4;

    public struct TranchePool has key {
        id: UID,
        currency_balance: Balance<SUI>,
        borrowed: u64,
        principal: u64,
        total_repayed_amount: u64,
        supplied_currency: u64,
    }

    public struct TrancheAdminCap has key, store {
        id: UID,
    }

    public struct SupplyEvent has copy, drop {
        currency_amount: u64,
        token_amount: u64,
        supplier: address,
    }

    public struct RedeemEvent has copy, drop {
        currency_amount: u64,
        token_amount: u64,
        redeemer: address,
    }

    public struct BorrowEvent has copy, drop {
        recipient: address,
        amount: u64,
    }

    public struct RepayEvent has copy, drop {
        amount: u64,
        payer: address,
    }

    public struct AuthTransferEvent has copy, drop {
        recipient: address,
        amount: u64,
    }

    fun init(ctx: &mut TxContext) {
        transfer::transfer(TrancheAdminCap {
            id: object::new(ctx),
        }, ctx.sender());
    }

    public fun create_tranche_pool(
        _admin: &TrancheAdminCap,
        ctx: &mut TxContext,
    ): TranchePool {
        TranchePool {
            id: object::new(ctx),
            currency_balance: balance::zero(),
            borrowed: 0,
            principal: 0,
            total_repayed_amount: 0,
            supplied_currency: 0,
        }
    }

    public entry fun create_and_share_pool(
        admin: &TrancheAdminCap,
        ctx: &mut TxContext,
    ) {
        let pool = create_tranche_pool(admin, ctx);
        transfer::share_object(pool);
    }

    public entry fun supply(
        pool: &mut TranchePool,
        treasury: &mut TreasuryCap<TOKEN>,
        currency: Coin<SUI>,
        token_amount: u64,
        ctx: &mut TxContext,
    ) {
        let currency_amount = coin::value(&currency);
        assert!(currency_amount > 0, ERR_ZERO_AMOUNT);

        let supplier = ctx.sender();

        coin::put(&mut pool.currency_balance, currency);
        pool.supplied_currency = pool.supplied_currency + currency_amount;

        token::mint(treasury, token_amount, supplier, ctx);

        event::emit(SupplyEvent { currency_amount, token_amount, supplier });
    }

    public entry fun redeem(
        pool: &mut TranchePool,
        treasury: &mut TreasuryCap<TOKEN>,
        tranche_token: Coin<TOKEN>,
        currency_amount: u64,
        ctx: &mut TxContext,
    ) {
        let token_amount = coin::value(&tranche_token);
        assert!(token_amount > 0, ERR_ZERO_AMOUNT);
        assert!(balance::value(&pool.currency_balance) >= currency_amount, ERR_INSUFFICIENT_BALANCE);

        let redeemer = ctx.sender();

        token::burn(treasury, tranche_token);

        pool.supplied_currency = pool.supplied_currency - currency_amount;
        let withdrawn = coin::take(&mut pool.currency_balance, currency_amount, ctx);
        transfer::public_transfer(withdrawn, redeemer);

        event::emit(RedeemEvent { currency_amount, token_amount, redeemer });
    }

    public entry fun repay_to_pool(
        pool: &mut TranchePool,
        payment: Coin<SUI>,
        ctx: &mut TxContext,
    ) {
        let amount = coin::value(&payment);
        assert!(amount > 0, ERR_ZERO_AMOUNT);

        coin::put(&mut pool.currency_balance, payment);
        pool.total_repayed_amount = pool.total_repayed_amount + amount;

        event::emit(RepayEvent { amount, payer: ctx.sender() });
    }

    public fun borrow_from_pool(
        _admin: &TrancheAdminCap,
        pool: &mut TranchePool,
        recipient: address,
        amount: u64,
        ctx: &mut TxContext,
    ) {
        assert!(balance::value(&pool.currency_balance) >= amount, ERR_INSUFFICIENT_BALANCE);

        let withdrawn = coin::take(&mut pool.currency_balance, amount, ctx);
        transfer::public_transfer(withdrawn, recipient);

        pool.borrowed = pool.borrowed + amount;
        pool.principal = pool.principal + amount;

        event::emit(BorrowEvent { recipient, amount });
    }

    public fun borrow_coin(
        _admin: &TrancheAdminCap,
        pool: &mut TranchePool,
        amount: u64,
        ctx: &mut TxContext,
    ): Coin<SUI> {
        assert!(balance::value(&pool.currency_balance) >= amount, ERR_INSUFFICIENT_BALANCE);

        let withdrawn = coin::take(&mut pool.currency_balance, amount, ctx);
        pool.borrowed = pool.borrowed + amount;
        pool.principal = pool.principal + amount;

        event::emit(BorrowEvent { recipient: ctx.sender(), amount });
        withdrawn
    }

    public entry fun auth_transfer(
        _admin: &TrancheAdminCap,
        pool: &mut TranchePool,
        recipient: address,
        amount: u64,
        ctx: &mut TxContext,
    ) {
        assert!(balance::value(&pool.currency_balance) >= amount, ERR_INSUFFICIENT_BALANCE);

        let withdrawn = coin::take(&mut pool.currency_balance, amount, ctx);
        transfer::public_transfer(withdrawn, recipient);

        event::emit(AuthTransferEvent { recipient, amount });
    }

    public fun pool_balance(pool: &TranchePool): u64 {
        balance::value(&pool.currency_balance)
    }

    public fun borrowed(pool: &TranchePool): u64 { pool.borrowed }
    public fun get_principal(pool: &TranchePool): u64 { pool.principal }
    public fun get_total_repayed(pool: &TranchePool): u64 { pool.total_repayed_amount }
    public fun get_supplied_currency(pool: &TranchePool): u64 { pool.supplied_currency }

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }
}
