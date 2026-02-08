module contracts::whitelist_operator {
    use std::string::String;
    use sui::table::{Self, Table};
    use sui::event;
    use sui::clock::Clock;
    use sui::coin::{Self, TreasuryCap, Coin};
    use sui::sui::SUI;
    use contracts::loan::{Self, Loan};
    use contracts::tranche_pool::{Self, TranchePool};
    use contracts::token::TOKEN;
    use contracts::math;
    use contracts::interest;

    public struct PoolPosition has copy, store, drop {
        pool_id: u64,
        token_received_junior: u64,
        token_redeemed_junior: u64,
        currency_redeemed_junior: u64,
        principal_redeemed_junior: u64,
        is_junior_investor: bool,
        token_received_senior: u64,
        token_redeemed_senior: u64,
        currency_redeemed_senior: u64,
        principal_redeemed_senior: u64,
        is_senior_investor: bool,
    }

    public struct WhitelistOperator has key {
        id: UID,
        member_list: address,
        state: u8,
        total_deposit_currency_senior: u64,
        total_deposit_currency_junior: u64,
        total_redeemed_currency_senior: u64,
        total_redeemed_currency_junior: u64,
        total_redeemed_tokens_senior: u64,
        total_redeemed_tokens_junior: u64,
        supply_allowed: bool,
        threshold: u64,
        junior_investors: Table<address, bool>,
        senior_investors: Table<address, bool>,
        junior_tranche_ceiling: u64,
        senior_tranche_ceiling: u64,
        capital_formation_period: u64,
        capital_formation_end: u64,
        senior_interest_rate: u64,
        current: u8,
        pool_id: u64,
        positions: Table<address, PoolPosition>,
    }

    public struct OperatorAdminCap has key, store {
        id: UID,
    }

    public struct OperatorConfig has key {
        id: UID,
        invest_paused: bool,
        redeem_paused: bool,
    }

    public struct SupplyEvent has copy, drop {
        pool_id: u64,
        tranche: vector<u8>,
        supplier: address,
        amount: u64,
        total_pool_balance: u64,
        junior_pool_balance: u64,
        senior_pool_balance: u64,
    }

    public struct RedeemEvent has copy, drop {
        pool_id: u64,
        tranche: vector<u8>,
        receiver: address,
        token_amount: u64,
        currency_amount: u64,
        total_pool_balance: u64,
        junior_pool_balance: u64,
        senior_pool_balance: u64,
    }

    public struct WhitelistedInvestorEvent has copy, drop {
        pool_id: u64,
        investor: address,
        tranche: vector<u8>,
    }

    const ERR_NOT_AUTHORIZED: u64 = 1;
    const ERR_CAPITAL_FORMATION_ENDED: u64 = 2;
    const ERR_TRANCHE_FULL: u64 = 3;
    const ERR_INSUFFICIENT_AMOUNT: u64 = 4;
    const ERR_UNKNOWN_TRANCHE: u64 = 5;
    const ERR_SUPPLY_AMOUNT_ZERO: u64 = 6;
    const ERR_JUNIOR_NOT_FULL: u64 = 7;
    const ERR_AMOUNT_TOO_SMALL: u64 = 8;
    const ERR_INVEST_PAUSED: u64 = 9;
    const ERR_REDEEM_PAUSED: u64 = 10;
    const ERR_INVALID_PRICE: u64 = 11;

    const STATE_CAPITAL_FORMATION: u8 = 0;
    const STATE_PENDING: u8 = 1;
    const STATE_ACTIVE: u8 = 2;
    const STATE_REVOKED: u8 = 3;
    const STATE_PARTIAL_REDEEM: u8 = 4;
    const STATE_REDEEM: u8 = 5;
    const STATE_ENDED: u8 = 6;

    fun init(ctx: &mut TxContext) {
        transfer::transfer(OperatorAdminCap {
            id: object::new(ctx),
        }, ctx.sender());

        transfer::share_object(OperatorConfig {
            id: object::new(ctx),
            invest_paused: false,
            redeem_paused: false,
        });
    }

    public fun create_operator(
        _admin: &OperatorAdminCap,
        capital_formation_period: u64,
        member_list: address,
        senior_interest_rate: u64,
        pool_id: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ): WhitelistOperator {
        let now = clock.timestamp_ms() / 1000;
        WhitelistOperator {
            id: object::new(ctx),
            member_list,
            state: STATE_CAPITAL_FORMATION,
            total_deposit_currency_senior: 0,
            total_deposit_currency_junior: 0,
            total_redeemed_currency_senior: 0,
            total_redeemed_currency_junior: 0,
            total_redeemed_tokens_senior: 0,
            total_redeemed_tokens_junior: 0,
            supply_allowed: true,
            threshold: 100,
            junior_investors: table::new(ctx),
            senior_investors: table::new(ctx),
            junior_tranche_ceiling: 0,
            senior_tranche_ceiling: 0,
            capital_formation_period,
            capital_formation_end: now + capital_formation_period,
            senior_interest_rate,
            current: 1,
            pool_id,
            positions: table::new(ctx),
        }
    }

    public entry fun create_and_share_operator(
        admin: &OperatorAdminCap,
        capital_formation_period: u64,
        member_list: address,
        senior_interest_rate: u64,
        pool_id: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let op = create_operator(
            admin, capital_formation_period, member_list,
            senior_interest_rate, pool_id, clock, ctx,
        );
        transfer::share_object(op);
    }

    public entry fun set_tranche_ceilings(
        _admin: &OperatorAdminCap,
        operator: &mut WhitelistOperator,
        amount: u64,
        tranche: vector<u8>,
    ) {
        if (tranche == b"junior") {
            operator.junior_tranche_ceiling = amount;
        } else if (tranche == b"senior") {
            operator.senior_tranche_ceiling = amount;
        } else {
            abort ERR_UNKNOWN_TRANCHE
        };
    }

    public entry fun rely_investor(
        _admin: &OperatorAdminCap,
        operator: &mut WhitelistOperator,
        investor: address,
        tranche: vector<u8>,
    ) {
        if (tranche == b"junior") {
            if (operator.junior_investors.contains(investor)) {
                *operator.junior_investors.borrow_mut(investor) = true;
            } else {
                operator.junior_investors.add(investor, true);
            };
        } else if (tranche == b"senior") {
            if (operator.senior_investors.contains(investor)) {
                *operator.senior_investors.borrow_mut(investor) = true;
            } else {
                operator.senior_investors.add(investor, true);
            };
        } else {
            abort ERR_UNKNOWN_TRANCHE
        };

        event::emit(WhitelistedInvestorEvent {
            pool_id: operator.pool_id,
            investor,
            tranche,
        });
    }

    public entry fun deny_investor(
        _admin: &OperatorAdminCap,
        operator: &mut WhitelistOperator,
        investor: address,
        tranche: vector<u8>,
    ) {
        if (tranche == b"junior") {
            operator.junior_investors.remove(investor);
        } else if (tranche == b"senior") {
            operator.senior_investors.remove(investor);
        } else {
            abort ERR_UNKNOWN_TRANCHE
        };
    }

    // ===== Supply =====

    public entry fun supply(
        operator: &mut WhitelistOperator,
        junior_pool: &mut TranchePool,
        senior_pool: &mut TranchePool,
        treasury: &mut TreasuryCap<TOKEN>,
        currency: Coin<SUI>,
        loan: &Loan,
        config: &OperatorConfig,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(!config.invest_paused, ERR_INVEST_PAUSED);
        assert!(operator.state == STATE_CAPITAL_FORMATION, ERR_CAPITAL_FORMATION_ENDED);

        let currency_amount = coin::value(&currency);

        if (tranche_pool::get_supplied_currency(junior_pool) + currency_amount
                <= operator.junior_tranche_ceiling) {
            supply_junior_internal(
                operator, junior_pool, senior_pool, treasury, currency, loan, clock, ctx,
            );
        } else {
            if (operator.current == 1) {
                operator.current = 2;
            };
            supply_senior_internal(
                operator, junior_pool, senior_pool, treasury, currency, loan, clock, ctx,
            );
        }
    }

    fun supply_junior_internal(
        operator: &mut WhitelistOperator,
        junior_pool: &mut TranchePool,
        senior_pool: &mut TranchePool,
        treasury: &mut TreasuryCap<TOKEN>,
        currency: Coin<SUI>,
        loan: &Loan,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let currency_amount = coin::value(&currency);
        let sender = ctx.sender();

        assert!(operator.state == STATE_CAPITAL_FORMATION, ERR_CAPITAL_FORMATION_ENDED);
        assert!(currency_amount > 0, ERR_SUPPLY_AMOUNT_ZERO);

        let junior_supplied = tranche_pool::get_supplied_currency(junior_pool);
        assert!(
            junior_supplied + currency_amount <= operator.junior_tranche_ceiling,
            ERR_TRANCHE_FULL,
        );

        tranche_pool::supply(junior_pool, treasury, currency, currency_amount, ctx);

        if (junior_supplied + currency_amount == operator.junior_tranche_ceiling
                && operator.current == 1) {
            operator.current = 2;
        };

        ensure_position_exists(operator, sender);
        {
            let position = operator.positions.borrow_mut(sender);
            position.token_received_junior = position.token_received_junior + currency_amount;
        };

        let senior_supplied = tranche_pool::get_supplied_currency(senior_pool);

        event::emit(SupplyEvent {
            pool_id: loan::get_pool_id(loan),
            tranche: b"junior",
            supplier: sender,
            amount: currency_amount,
            total_pool_balance: junior_supplied + senior_supplied,
            junior_pool_balance: junior_supplied,
            senior_pool_balance: senior_supplied,
        });

        operator.total_deposit_currency_junior =
            operator.total_deposit_currency_junior + currency_amount;

        let now = clock.timestamp_ms() / 1000;
        update_state_internal(operator, loan, now);
    }

    fun supply_senior_internal(
        operator: &mut WhitelistOperator,
        junior_pool: &mut TranchePool,
        senior_pool: &mut TranchePool,
        treasury: &mut TreasuryCap<TOKEN>,
        currency: Coin<SUI>,
        loan: &Loan,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let currency_amount = coin::value(&currency);
        let sender = ctx.sender();

        assert!(operator.state == STATE_CAPITAL_FORMATION, ERR_CAPITAL_FORMATION_ENDED);
        assert!(currency_amount > 0, ERR_SUPPLY_AMOUNT_ZERO);

        let junior_supplied = tranche_pool::get_supplied_currency(junior_pool);
        assert!(
            junior_supplied >= operator.junior_tranche_ceiling && currency_amount >= 1000,
            ERR_JUNIOR_NOT_FULL,
        );

        ensure_position_exists(operator, sender);
        {
            let position = operator.positions.borrow_mut(sender);
            position.token_received_senior = position.token_received_senior + currency_amount;
        };

        tranche_pool::supply(senior_pool, treasury, currency, currency_amount, ctx);

        let senior_supplied = tranche_pool::get_supplied_currency(senior_pool);

        event::emit(SupplyEvent {
            pool_id: loan::get_pool_id(loan),
            tranche: b"senior",
            supplier: sender,
            amount: currency_amount,
            total_pool_balance: junior_supplied + senior_supplied,
            junior_pool_balance: junior_supplied,
            senior_pool_balance: senior_supplied,
        });

        operator.total_deposit_currency_senior =
            operator.total_deposit_currency_senior + currency_amount;

        let now = clock.timestamp_ms() / 1000;
        update_state_internal(operator, loan, now);
    }

    // ===== Redeem =====

    public entry fun redeem_junior(
        operator: &mut WhitelistOperator,
        junior_pool: &mut TranchePool,
        senior_pool: &mut TranchePool,
        treasury: &mut TreasuryCap<TOKEN>,
        tranche_token: Coin<TOKEN>,
        loan: &Loan,
        config: &OperatorConfig,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let sender = ctx.sender();
        let token_amount = coin::value(&tranche_token);
        assert!(token_amount > 0, ERR_AMOUNT_TOO_SMALL);
        assert!(!config.redeem_paused, ERR_REDEEM_PAUSED);

        let max_token_amount = calc_max_redeem_token_junior(
            operator, junior_pool, senior_pool, loan, sender,
        );
        assert!((token_amount as u256) <= max_token_amount, ERR_INSUFFICIENT_AMOUNT);

        let currency_amount = token_amount;

        let now = clock.timestamp_ms() / 1000;
        update_state_internal(operator, loan, now);

        assert!(
            operator.state == STATE_REVOKED ||
            operator.state == STATE_REDEEM ||
            operator.state == STATE_PARTIAL_REDEEM ||
            operator.state == STATE_ENDED ||
            tranche_pool::get_supplied_currency(junior_pool) < operator.junior_tranche_ceiling,
            ERR_CAPITAL_FORMATION_ENDED,
        );

        ensure_position_exists(operator, sender);
        {
            let position = operator.positions.borrow_mut(sender);
            position.token_redeemed_junior = position.token_redeemed_junior + token_amount;
        };

        tranche_pool::redeem(junior_pool, treasury, tranche_token, currency_amount, ctx);

        event::emit(RedeemEvent {
            pool_id: loan::get_pool_id(loan),
            tranche: b"junior",
            receiver: sender,
            token_amount,
            currency_amount,
            total_pool_balance: tranche_pool::get_supplied_currency(junior_pool) +
                tranche_pool::get_supplied_currency(senior_pool),
            junior_pool_balance: tranche_pool::get_supplied_currency(junior_pool),
            senior_pool_balance: tranche_pool::get_supplied_currency(senior_pool),
        });

        operator.total_redeemed_currency_junior =
            operator.total_redeemed_currency_junior + currency_amount;
        operator.total_redeemed_tokens_junior =
            operator.total_redeemed_tokens_junior + token_amount;
        assert!(
            operator.total_deposit_currency_junior >= currency_amount,
            ERR_INSUFFICIENT_AMOUNT,
        );
        operator.total_deposit_currency_junior =
            operator.total_deposit_currency_junior - currency_amount;
    }

    public entry fun redeem_senior(
        operator: &mut WhitelistOperator,
        junior_pool: &mut TranchePool,
        senior_pool: &mut TranchePool,
        treasury: &mut TreasuryCap<TOKEN>,
        tranche_token: Coin<TOKEN>,
        loan: &Loan,
        config: &OperatorConfig,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let sender = ctx.sender();
        let token_amount = coin::value(&tranche_token);
        assert!(token_amount > 0, ERR_AMOUNT_TOO_SMALL);
        assert!(!config.redeem_paused, ERR_REDEEM_PAUSED);

        let max_token_amount = calc_max_redeem_token_senior(
            operator, junior_pool, senior_pool, loan, sender,
        );
        assert!((token_amount as u256) <= max_token_amount, ERR_INSUFFICIENT_AMOUNT);

        let currency_amount = calc_redeem_currency_senior(
            operator, senior_pool, loan, sender, token_amount, max_token_amount,
        );

        let now = clock.timestamp_ms() / 1000;
        update_state_internal(operator, loan, now);

        ensure_position_exists(operator, sender);
        {
            let position = operator.positions.borrow_mut(sender);
            position.token_redeemed_senior = position.token_redeemed_senior + token_amount;
        };

        assert!(
            tranche_pool::get_supplied_currency(senior_pool) >= (currency_amount as u64),
            ERR_INSUFFICIENT_AMOUNT,
        );

        tranche_pool::redeem(
            senior_pool, treasury, tranche_token, (currency_amount as u64), ctx,
        );

        event::emit(RedeemEvent {
            pool_id: loan::get_pool_id(loan),
            tranche: b"senior",
            receiver: sender,
            token_amount,
            currency_amount: (currency_amount as u64),
            total_pool_balance: tranche_pool::get_supplied_currency(junior_pool) +
                tranche_pool::get_supplied_currency(senior_pool),
            junior_pool_balance: tranche_pool::get_supplied_currency(junior_pool),
            senior_pool_balance: tranche_pool::get_supplied_currency(senior_pool),
        });

        operator.total_redeemed_currency_senior =
            operator.total_redeemed_currency_senior + (currency_amount as u64);
        operator.total_redeemed_tokens_senior =
            operator.total_redeemed_tokens_senior + token_amount;
        assert!(
            operator.total_deposit_currency_senior >= token_amount,
            ERR_INSUFFICIENT_AMOUNT,
        );
        operator.total_deposit_currency_senior =
            operator.total_deposit_currency_senior - token_amount;
    }

    // ===== Calc helpers =====

    public fun calc_max_redeem_token_junior(
        operator: &WhitelistOperator,
        junior_pool: &TranchePool,
        senior_pool: &TranchePool,
        loan: &Loan,
        usr: address,
    ): u256 {
        let user_position = get_position(operator, usr);
        let token_received = user_position.token_received_junior;
        let token_redeemed = user_position.token_redeemed_junior;

        if (loan::get_loan_start_timestamp(loan) == 0) {
            if (token_received > token_redeemed) {
                return ((token_received - token_redeemed) as u256)
            } else {
                return 0
            }
        };

        let senior_principal = (tranche_pool::get_principal(senior_pool) as u256);
        let senior_total_repayed = (tranche_pool::get_total_repayed(senior_pool) as u256);
        let senior_interest_rate = (operator.senior_interest_rate as u256);
        let senior_interest = math::rmul(senior_principal, senior_interest_rate);
        let senior_debt = math::safe_add(senior_principal, senior_interest);

        if (senior_total_repayed < senior_debt) {
            return 0
        };

        let total_repayed = (tranche_pool::get_total_repayed(junior_pool) as u256);
        let excess_for_junior = if (total_repayed > senior_debt) {
            math::safe_sub(total_repayed, senior_debt)
        } else {
            0
        };

        let junior_principal = (tranche_pool::get_principal(junior_pool) as u256);
        if (junior_principal == 0) {
            return 0
        };

        let max_redeemable = math::safe_div(
            math::safe_mul(excess_for_junior, (token_received as u256)),
            junior_principal,
        );

        if (max_redeemable > (token_redeemed as u256)) {
            math::safe_sub(max_redeemable, (token_redeemed as u256))
        } else {
            0
        }
    }

    public fun calc_max_redeem_token_senior(
        operator: &WhitelistOperator,
        _junior_pool: &TranchePool,
        senior_pool: &TranchePool,
        loan: &Loan,
        usr: address,
    ): u256 {
        let user_position = get_position(operator, usr);
        let token_received = user_position.token_received_senior;
        let token_redeemed = user_position.token_redeemed_senior;

        if (loan::get_loan_start_timestamp(loan) == 0) {
            if (token_received > token_redeemed) {
                return ((token_received - token_redeemed) as u256)
            } else {
                return 0
            }
        };

        let senior_principal = (tranche_pool::get_principal(senior_pool) as u256);
        let senior_interest_rate = (operator.senior_interest_rate as u256);
        let senior_interest = interest::get_amortized_interest(
            senior_principal, senior_interest_rate,
        );
        let senior_pool_value = math::safe_add(senior_principal, senior_interest);

        if (senior_pool_value == 0) {
            return 0
        };

        let total_repayed = (tranche_pool::get_total_repayed(senior_pool) as u256);

        let repayment_ratio = math::safe_div(
            math::safe_mul(total_repayed, math::get_one()),
            senior_pool_value,
        );

        let max_redeemable = math::safe_div(
            math::safe_mul((token_received as u256), repayment_ratio),
            math::get_one(),
        );

        if (max_redeemable > (token_redeemed as u256)) {
            math::safe_sub(max_redeemable, (token_redeemed as u256))
        } else {
            0
        }
    }

    fun calc_redeem_currency_senior(
        operator: &mut WhitelistOperator,
        senior_pool: &TranchePool,
        loan: &Loan,
        usr: address,
        token_amount: u64,
        max_token_amount: u256,
    ): u256 {
        assert!(max_token_amount != 0, ERR_AMOUNT_TOO_SMALL);

        if (loan::get_loan_start_timestamp(loan) == 0) {
            return (token_amount as u256)
        };

        let senior_principal = (tranche_pool::get_principal(senior_pool) as u256);
        let senior_total_repayed = (tranche_pool::get_total_repayed(senior_pool) as u256);

        let is_senior_should_update_price =
            senior_principal > 0 && senior_total_repayed >= senior_principal;

        let currency_amount = if (is_senior_should_update_price) {
            let price_result = calc_token_price_internal(senior_pool);
            assert!(price_result != 0, ERR_INVALID_PRICE);
            math::rmul((token_amount as u256), price_result)
        } else {
            (token_amount as u256)
        };

        let redeem_ratio = math::rdiv((token_amount as u256), max_token_amount);

        let mut total_repayed = (tranche_pool::get_total_repayed(senior_pool) as u256);
        let principal = (tranche_pool::get_principal(senior_pool) as u256);
        if (total_repayed > principal) {
            total_repayed = principal;
        };

        ensure_position_exists(operator, usr);
        let user_position_data = get_position(operator, usr);

        let current_redeemed = (user_position_data.currency_redeemed_senior as u256);
        let sub_amount = math::safe_sub(total_repayed, current_redeemed);
        let interim_amount = math::rmul(sub_amount, redeem_ratio);
        let new_redeemed = math::safe_add(interim_amount, current_redeemed);

        let current_principal = (user_position_data.principal_redeemed_senior as u256);
        let sub_principal = math::safe_sub(total_repayed, current_principal);
        let interim_principal = math::rmul(sub_principal, redeem_ratio);
        let new_principal = math::safe_add(interim_principal, current_principal);

        {
            let position = operator.positions.borrow_mut(usr);
            position.currency_redeemed_senior = (new_redeemed as u64);
            position.principal_redeemed_senior = (new_principal as u64);
        };

        currency_amount
    }

    fun calc_token_price_internal(pool: &TranchePool): u256 {
        let principal = (tranche_pool::get_principal(pool) as u256);
        let total_repayed = (tranche_pool::get_total_repayed(pool) as u256);
        if (principal == 0) return math::get_one();
        math::rdiv(total_repayed, principal)
    }

    // ===== State management =====

    fun update_state_internal(
        operator: &mut WhitelistOperator,
        loan: &Loan,
        current_time: u64,
    ) {
        if (operator.state == STATE_CAPITAL_FORMATION &&
            current_time > operator.capital_formation_end &&
            operator.total_deposit_currency_junior + operator.total_deposit_currency_senior <=
            operator.senior_tranche_ceiling + operator.junior_tranche_ceiling) {
            operator.state = STATE_REVOKED;
        };

        if (operator.state == STATE_CAPITAL_FORMATION &&
            loan::get_loan_start_timestamp(loan) == 0 &&
            current_time < operator.capital_formation_end &&
            operator.total_deposit_currency_junior + operator.total_deposit_currency_senior >=
            operator.senior_tranche_ceiling + operator.junior_tranche_ceiling) {
            operator.state = STATE_PENDING;
        };

        if (loan::get_loan_start_timestamp(loan) != 0 && operator.state == STATE_PENDING) {
            operator.state = STATE_ACTIVE;
        };

        if (loan::loan_ended(loan) &&
            (operator.state == STATE_ACTIVE || operator.state == STATE_PENDING)) {
            operator.state = STATE_ENDED;
        };
    }

    // ===== Admin setters =====

    public entry fun set_threshold(
        _admin: &OperatorAdminCap,
        operator: &mut WhitelistOperator,
        threshold: u64,
    ) {
        operator.threshold = threshold;
    }

    public entry fun set_supply_allowed(
        _admin: &OperatorAdminCap,
        operator: &mut WhitelistOperator,
        allowed: bool,
    ) {
        operator.supply_allowed = allowed;
    }

    public entry fun pause_invest(
        _admin: &OperatorAdminCap,
        config: &mut OperatorConfig,
    ) {
        config.invest_paused = true;
    }

    public entry fun unpause_invest(
        _admin: &OperatorAdminCap,
        config: &mut OperatorConfig,
    ) {
        config.invest_paused = false;
    }

    public entry fun pause_redeem(
        _admin: &OperatorAdminCap,
        config: &mut OperatorConfig,
    ) {
        config.redeem_paused = true;
    }

    public entry fun unpause_redeem(
        _admin: &OperatorAdminCap,
        config: &mut OperatorConfig,
    ) {
        config.redeem_paused = false;
    }

    // ===== View functions =====

    public fun get_current_state(operator: &WhitelistOperator): u8 {
        operator.state
    }

    public fun get_max_redeemable_token(operator: &WhitelistOperator): u64 {
        operator.total_deposit_currency_junior + operator.total_deposit_currency_senior
    }

    public fun get_senior_pool_value(
        operator: &WhitelistOperator,
        senior_pool: &TranchePool,
    ): u256 {
        let senior_principal = (tranche_pool::get_principal(senior_pool) as u256);
        let senior_interest_rate = (operator.senior_interest_rate as u256);
        let senior_interest = math::rmul(senior_principal, senior_interest_rate);
        math::safe_add(senior_principal, senior_interest)
    }

    public fun get_pool_id(operator: &WhitelistOperator): u64 {
        operator.pool_id
    }

    // ===== Internal helpers =====

    fun ensure_position_exists(operator: &mut WhitelistOperator, user: address) {
        if (!operator.positions.contains(user)) {
            operator.positions.add(user, PoolPosition {
                pool_id: operator.pool_id,
                token_received_junior: 0,
                token_redeemed_junior: 0,
                currency_redeemed_junior: 0,
                principal_redeemed_junior: 0,
                is_junior_investor: false,
                token_received_senior: 0,
                token_redeemed_senior: 0,
                currency_redeemed_senior: 0,
                principal_redeemed_senior: 0,
                is_senior_investor: false,
            });
        };
    }

    fun get_position(operator: &WhitelistOperator, user: address): PoolPosition {
        if (!operator.positions.contains(user)) {
            return PoolPosition {
                pool_id: operator.pool_id,
                token_received_junior: 0,
                token_redeemed_junior: 0,
                currency_redeemed_junior: 0,
                principal_redeemed_junior: 0,
                is_junior_investor: false,
                token_received_senior: 0,
                token_redeemed_senior: 0,
                currency_redeemed_senior: 0,
                principal_redeemed_senior: 0,
                is_senior_investor: false,
            }
        };
        *operator.positions.borrow(user)
    }

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }
}
