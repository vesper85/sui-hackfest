module contracts::pool_factory {
    use sui::table::{Self, Table};
    use sui::event;
    use sui::clock::Clock;
    use sui::coin::{Self, TreasuryCap, Coin};
    use sui::sui::SUI;
    use contracts::nft_nisarg::{Self, NFTNisarg, AdminCap as NftAdminCap, Config as NftConfig};
    use contracts::tranche_pool::{Self, TranchePool, TrancheAdminCap};
    use contracts::loan::{Self, Loan, LoanAdminCap};
    use contracts::whitelist_operator::{Self, WhitelistOperator, OperatorAdminCap};
    use contracts::token::TOKEN;

    const ERR_POOL_EXISTS: u64 = 1;
    const ERR_POOL_NOT_FOUND: u64 = 2;

    public struct FactoryConfig has key {
        id: UID,
        pool_count: u64,
        fee_collector: address,
        member_list: Table<address, bool>,
        pools: Table<u64, PoolInfo>,
    }

    public struct FactoryAdminCap has key, store {
        id: UID,
    }

    public struct PoolInfo has store, drop, copy {
        pool_id: u64,
        nft_id: ID,
        loan_id: ID,
        junior_pool_id: ID,
        senior_pool_id: ID,
        operator_id: ID,
        borrower: address,
        principal_amount: u64,
    }

    public struct PoolCreatedEvent has copy, drop {
        pool_id: u64,
        nft_id: ID,
        loan_id: ID,
        junior_pool_id: ID,
        senior_pool_id: ID,
        operator_id: ID,
        borrower: address,
        principal_amount: u64,
    }

    public struct LoanFundedEvent has copy, drop {
        pool_id: u64,
        junior_amount: u64,
        senior_amount: u64,
        total_funded: u64,
    }

    fun init(ctx: &mut TxContext) {
        transfer::transfer(FactoryAdminCap {
            id: object::new(ctx),
        }, ctx.sender());

        transfer::share_object(FactoryConfig {
            id: object::new(ctx),
            pool_count: 0,
            fee_collector: ctx.sender(),
            member_list: table::new(ctx),
            pools: table::new(ctx),
        });
    }

    public entry fun set_fee_collector(
        _admin: &FactoryAdminCap,
        factory: &mut FactoryConfig,
        fee_collector: address,
    ) {
        factory.fee_collector = fee_collector;
    }

    /// Creates a full pool: NFT + junior pool + senior pool + loan + operator
    /// NFT holds the principal amount, loan is configured with it,
    /// operator manages investor supply/redeem with tranche ceilings
    public entry fun create_pool(
        factory: &mut FactoryConfig,
        _factory_admin: &FactoryAdminCap,
        tranche_admin: &TrancheAdminCap,
        loan_admin: &LoanAdminCap,
        operator_admin: &OperatorAdminCap,
        nft_admin: &NftAdminCap,
        nft_config: &mut NftConfig,
        pool_id: u64,
        borrower_address: address,
        nft_name: vector<u8>,
        nft_description: vector<u8>,
        principal_amount: u64,
        junior_ceiling: u64,
        senior_ceiling: u64,
        annual_interest_rate_bps: u256,
        period_length: u256,
        period_count: u256,
        grace_period: u256,
        late_fee_interest_per_second: u256,
        is_bullet_repay: bool,
        performance_fee: u16,
        originator_fee: u16,
        p_start_from: u64,
        p_repay_frequency: u64,
        capital_formation_period: u64,
        senior_interest_rate: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(!factory.pools.contains(pool_id), ERR_POOL_EXISTS);

        // 1. Create NFT with principal amount for the borrower
        let nft = nft_nisarg::create_nft_for_pool(
            nft_admin,
            nft_config,
            nft_name.to_string(),
            nft_description.to_string(),
            principal_amount,
            borrower_address,
            ctx,
        );
        let nft_id = object::id(&nft);

        // 2. Create junior tranche pool
        let junior_pool = tranche_pool::create_tranche_pool(tranche_admin, ctx);
        let junior_pool_id = object::id(&junior_pool);

        // 3. Create senior tranche pool
        let senior_pool = tranche_pool::create_tranche_pool(tranche_admin, ctx);
        let senior_pool_id = object::id(&senior_pool);

        // 4. Create loan linked to the NFT
        let loan = loan::create_loan(
            loan_admin,
            pool_id,
            borrower_address,
            nft_id,
            factory.fee_collector,
            annual_interest_rate_bps,
            period_length,
            period_count,
            grace_period,
            late_fee_interest_per_second,
            is_bullet_repay,
            performance_fee,
            originator_fee,
            p_start_from,
            p_repay_frequency,
            ctx,
        );
        let loan_id = object::id(&loan);

        // 5. Create operator with tranche ceilings
        let mut operator = whitelist_operator::create_operator(
            operator_admin,
            capital_formation_period,
            ctx.sender(),
            senior_interest_rate,
            pool_id,
            clock,
            ctx,
        );
        whitelist_operator::set_tranche_ceilings(
            operator_admin, &mut operator, junior_ceiling, b"junior",
        );
        whitelist_operator::set_tranche_ceilings(
            operator_admin, &mut operator, senior_ceiling, b"senior",
        );
        let operator_id = object::id(&operator);

        // 6. Store pool info
        factory.pools.add(pool_id, PoolInfo {
            pool_id,
            nft_id,
            loan_id,
            junior_pool_id,
            senior_pool_id,
            operator_id,
            borrower: borrower_address,
            principal_amount,
        });
        factory.pool_count = factory.pool_count + 1;

        event::emit(PoolCreatedEvent {
            pool_id,
            nft_id,
            loan_id,
            junior_pool_id,
            senior_pool_id,
            operator_id,
            borrower: borrower_address,
            principal_amount,
        });

        // 7. Transfer NFT to borrower, share all pool objects
        transfer::public_transfer(nft, borrower_address);
        transfer::share_object(junior_pool);
        transfer::share_object(senior_pool);
        transfer::share_object(loan);
        transfer::share_object(operator);
    }

    /// Funds a loan from junior and senior tranche pools, then starts the loan.
    /// Called after investors have supplied to the pools via the operator.
    /// Flow: borrow from pools → deposit to loan → init_borrow
    public entry fun fund_and_start_loan(
        _factory_admin: &FactoryAdminCap,
        tranche_admin: &TrancheAdminCap,
        loan_admin: &LoanAdminCap,
        junior_pool: &mut TranchePool,
        senior_pool: &mut TranchePool,
        loan: &mut Loan,
        nft: &NFTNisarg,
        borrower: address,
        principal_amount: u64,
        junior_amount: u64,
        senior_amount: u64,
        require_origination_fee: bool,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        // Borrow from junior pool
        let mut funding = tranche_pool::borrow_coin(
            tranche_admin, junior_pool, junior_amount, ctx,
        );

        // Borrow from senior pool and merge
        if (senior_amount > 0) {
            let senior_funding = tranche_pool::borrow_coin(
                tranche_admin, senior_pool, senior_amount, ctx,
            );
            funding.join(senior_funding);
        };

        let pool_id = loan::get_pool_id(loan);

        // Deposit all funds to loan
        loan::deposit_to_pool(loan, funding);

        // Start the loan
        loan::init_borrow(
            loan_admin,
            loan,
            nft,
            borrower,
            (principal_amount as u256),
            require_origination_fee,
            clock,
            ctx,
        );

        event::emit(LoanFundedEvent {
            pool_id,
            junior_amount,
            senior_amount,
            total_funded: junior_amount + senior_amount,
        });
    }

    // ===== Member management =====

    public entry fun add_member(
        _admin: &FactoryAdminCap,
        factory: &mut FactoryConfig,
        member: address,
    ) {
        if (!factory.member_list.contains(member)) {
            factory.member_list.add(member, true);
        };
    }

    public entry fun remove_member(
        _admin: &FactoryAdminCap,
        factory: &mut FactoryConfig,
        member: address,
    ) {
        if (factory.member_list.contains(member)) {
            factory.member_list.remove(member);
        };
    }

    // ===== View functions =====

    public fun is_member(factory: &FactoryConfig, member: address): bool {
        factory.member_list.contains(member)
    }

    public fun get_pool_info(factory: &FactoryConfig, pool_id: u64): PoolInfo {
        assert!(factory.pools.contains(pool_id), ERR_POOL_NOT_FOUND);
        *factory.pools.borrow(pool_id)
    }

    public fun get_pool_count(factory: &FactoryConfig): u64 {
        factory.pool_count
    }

    public fun get_pool_nft_id(info: &PoolInfo): ID { info.nft_id }
    public fun get_pool_loan_id(info: &PoolInfo): ID { info.loan_id }
    public fun get_pool_junior_id(info: &PoolInfo): ID { info.junior_pool_id }
    public fun get_pool_senior_id(info: &PoolInfo): ID { info.senior_pool_id }
    public fun get_pool_operator_id(info: &PoolInfo): ID { info.operator_id }
    public fun get_pool_borrower(info: &PoolInfo): address { info.borrower }
    public fun get_pool_principal(info: &PoolInfo): u64 { info.principal_amount }

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }
}
