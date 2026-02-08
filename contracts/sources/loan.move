module contracts::loan {
    use std::string::String;
    use sui::table::{Self, Table};
    use sui::clock::Clock;
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::sui::SUI;
    use contracts::math;
    use contracts::interest;
    use contracts::nft_nisarg::NFTNisarg;
    use contracts::loan_models::{Self, Fees, LoanRepayment};

    const E_POOL_ALREADY_INITIALIZED: u64 = 1;
    const E_POOL_NOT_INITIALIZED: u64 = 2;
    const E_NOT_BORROWER: u64 = 3;
    const E_NOT_ADMIN: u64 = 4;
    const E_PRINCIPAL_TOO_LOW: u64 = 8;
    const E_NOT_ENOUGH_LIQUIDITY: u64 = 9;
    const E_REPAYMENT_AMOUNT_TOO_LOW: u64 = 12;
    const E_EXPECTED_REPAYMENT_TOO_LOW: u64 = 13;
    const E_LOAN_ENDED: u64 = 14;
    const E_LOAN_HAS_OUTSTANDING_DEBT: u64 = 15;
    const E_INVALID_AMOUNT: u64 = 29;
    const E_WITHDRAW_PAUSED: u64 = 30;
    const E_REPAY_PAUSED: u64 = 31;
    const E_REQUESTED_GT_PRINCIPAL: u64 = 32;
    const E_ORIGINATOR_FEE_NOT_PAID: u64 = 33;
    const E_RECOVERY_EXCEEDS_WRITEOFF: u64 = 34;
    const E_UNDERPAYMENT_NOT_ALLOWED_BULLET: u64 = 35;
    const E_PREPAYMENT_NOT_ALLOWED_BULLET: u64 = 36;
    const E_INSUFFICIENT_BALANCE: u64 = 28;
    const E_ORIGINATOR_FEE_PAID: u64 = 27;
    const E_INSUFFICIENT_REPAYMENT: u64 = 24;
    const E_NFT_NOT_LOCKED: u64 = 17;
    const E_NOT_AUTHORIZED: u64 = 22;

    public struct LoanAdminCap has key, store {
        id: UID,
    }

    public struct LoanConfig has key {
        id: UID,
        withdraw_paused: bool,
        repay_paused: bool,
    }

    public struct Loan has key, store {
        id: UID,
        pool_id: u64,
        asset_nft: ID,
        borrower: address,
        has_pool_borrowed: bool,
        pool_balance: Balance<SUI>,
        fee_collector: address,
        all_fees: vector<Fees>,
        annual_interest_rate_bps: u256,
        principal_amount: u256,
        period_length: u64,
        period_count: u64,
        loan_term: u64,
        current_period: u64,
        late_fee_interest_per_second: u256,
        grace_period: u64,
        is_bullet_repay: bool,
        p_start_from: u64,
        take_fee_from_principal: bool,
        originator_fee_paid: bool,
        risk_score: u256,
        p_repay_frequency: u64,
        repayments: Table<u64, LoanRepayment>,
        state: LoanState,
    }

    public struct LoanState has store {
        total: u256,
        total_repayed_amount: u256,
        total_principal_repayed: u256,
        total_interest_repayed: u256,
        total_interest_for_loan_term: u256,
        emi: u256,
        total_late_fee_remaining: u256,
        total_late_fee_paid: u256,
        loan_start_timestamp: u64,
        loan_next_period_end_timestamp: u64,
        loan_ended: bool,
        total_write_off_amount: u128,
        write_off_period: u64,
        total_write_off_principal: u128,
        total_write_off_interest: u128,
        shortfall_principal: u256,
        shortfall_interest: u256,
        partial_principal: u256,
        partial_interest: u256,
        interest_paid_this_period: u256,
        principal_paid_this_period: u256,
        last_full_payment_period: u64,
        period_required_update: bool,
        total_recovery_amount: u256,
        total_prepayment_amount: u256,
        writeoff_applied_period: u64,
    }

    fun init(ctx: &mut TxContext) {
        transfer::transfer(LoanAdminCap {
            id: object::new(ctx),
        }, ctx.sender());

        transfer::share_object(LoanConfig {
            id: object::new(ctx),
            withdraw_paused: false,
            repay_paused: false,
        });
    }

    public fun create_loan(
        _admin: &LoanAdminCap,
        pool_id: u64,
        borrower: address,
        asset_nft: ID,
        fee_collector: address,
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
        ctx: &mut TxContext,
    ): Loan {
        let mut all_fees = vector::empty<Fees>();
        all_fees.push_back(loan_models::new_fee(b"performanceFees".to_string(), performance_fee));
        all_fees.push_back(loan_models::new_fee(b"originatorFees".to_string(), originator_fee));

        Loan {
            id: object::new(ctx),
            pool_id,
            asset_nft,
            borrower,
            has_pool_borrowed: false,
            pool_balance: balance::zero(),
            fee_collector,
            all_fees,
            annual_interest_rate_bps,
            principal_amount: 0,
            period_length: (period_length as u64),
            period_count: (period_count as u64),
            loan_term: (period_count as u64) * (period_length as u64),
            current_period: 0,
            late_fee_interest_per_second,
            grace_period: (grace_period as u64),
            is_bullet_repay,
            p_start_from,
            take_fee_from_principal: true,
            originator_fee_paid: false,
            risk_score: math::get_one(),
            p_repay_frequency,
            repayments: table::new(ctx),
            state: LoanState {
                total: 0,
                total_repayed_amount: 0,
                total_principal_repayed: 0,
                total_interest_repayed: 0,
                total_interest_for_loan_term: 0,
                emi: 0,
                total_late_fee_remaining: 0,
                total_late_fee_paid: 0,
                loan_start_timestamp: 0,
                loan_next_period_end_timestamp: 0,
                loan_ended: false,
                total_write_off_amount: 0,
                write_off_period: 3600,
                total_write_off_principal: 0,
                total_write_off_interest: 0,
                shortfall_principal: 0,
                shortfall_interest: 0,
                partial_principal: 0,
                partial_interest: 0,
                interest_paid_this_period: 0,
                principal_paid_this_period: 0,
                last_full_payment_period: 0,
                period_required_update: false,
                total_recovery_amount: 0,
                total_prepayment_amount: 0,
                writeoff_applied_period: 0,
            },
        }
    }

    public entry fun create_and_share_loan(
        admin: &LoanAdminCap,
        pool_id: u64,
        borrower: address,
        asset_nft: ID,
        fee_collector: address,
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
        ctx: &mut TxContext,
    ) {
        let loan = create_loan(
            admin, pool_id, borrower, asset_nft, fee_collector,
            annual_interest_rate_bps, period_length, period_count,
            grace_period, late_fee_interest_per_second, is_bullet_repay,
            performance_fee, originator_fee, p_start_from, p_repay_frequency, ctx,
        );
        transfer::share_object(loan);
    }

    public entry fun deposit_to_pool(
        loan: &mut Loan,
        payment: Coin<SUI>,
    ) {
        coin::put(&mut loan.pool_balance, payment);
    }

    public entry fun init_borrow(
        _admin: &LoanAdminCap,
        loan: &mut Loan,
        nft: &NFTNisarg,
        borrower: address,
        principal_amount: u256,
        require_origination_fee: bool,
        clock: &Clock,
        _ctx: &mut TxContext,
    ) {
        assert!(!loan.has_pool_borrowed, E_POOL_ALREADY_INITIALIZED);
        if (require_origination_fee) {
            assert!(loan.originator_fee_paid, E_ORIGINATOR_FEE_NOT_PAID);
        };

        let pool_bal = (balance::value(&loan.pool_balance) as u256);
        assert!(principal_amount <= pool_bal, E_REQUESTED_GT_PRINCIPAL);

        loan.take_fee_from_principal = require_origination_fee;
        loan.has_pool_borrowed = true;
        loan.borrower = borrower;
        loan.principal_amount = principal_amount;

        loan.state.total = math::safe_add(loan.state.total, principal_amount);

        let now = clock.timestamp_ms() / 1000;
        let period_length = loan.period_length;
        let period_count = loan.period_count;

        let loan_term_u256 = math::safe_mul((period_length as u256), (period_count as u256));
        let extra_seconds = math::safe_div(math::safe_mul(loan_term_u256, 5), 360);
        let loan_term = ((math::safe_add(loan_term_u256, extra_seconds)) as u64);

        let emi = interest::calculate_emi(
            principal_amount,
            loan.annual_interest_rate_bps,
            period_length,
            period_count,
        );

        let total_interest = if (loan.is_bullet_repay) {
            interest::charge_interest_internal(
                principal_amount,
                loan.annual_interest_rate_bps,
                (loan_term as u256),
            ) - principal_amount
        } else {
            let total_paid = math::safe_mul(emi, (period_count as u256));
            math::safe_sub(total_paid, principal_amount)
        };

        loan.state.loan_start_timestamp = now;
        loan.current_period = 1;
        loan.loan_term = loan_term;
        loan.state.loan_next_period_end_timestamp = now + (period_length as u64);
        loan.state.total_interest_for_loan_term = total_interest;
        loan.state.emi = emi;

        let _ = nft;
    }

    public entry fun withdraw(
        loan: &mut Loan,
        config: &LoanConfig,
        amount: u64,
        _clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(!config.withdraw_paused, E_WITHDRAW_PAUSED);
        assert!((amount as u256) > 0, E_INVALID_AMOUNT);
        let sender = ctx.sender();
        assert!(sender == loan.borrower, E_NOT_BORROWER);
        assert!(loan.has_pool_borrowed, E_POOL_NOT_INITIALIZED);
        assert!(balance::value(&loan.pool_balance) >= amount, E_NOT_ENOUGH_LIQUIDITY);

        let withdrawn = coin::take(&mut loan.pool_balance, amount, ctx);
        transfer::public_transfer(withdrawn, sender);

    }

    public entry fun repay(
        loan: &mut Loan,
        config: &LoanConfig,
        payment: Coin<SUI>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let currency_amount = (coin::value(&payment) as u256);
        assert!(!config.repay_paused, E_REPAY_PAUSED);
        assert!(!loan.state.loan_ended, E_LOAN_ENDED);
        assert!(ctx.sender() == loan.borrower, E_NOT_BORROWER);

        loan.state.interest_paid_this_period = 0;
        loan.state.principal_paid_this_period = 0;

        let now = clock.timestamp_ms() / 1000;
        update_period_check_internal(loan, now);

        let (expected_repayment, principal_due, interest_due, _late_fee) =
            expected_repayment_amount_internal(loan, now);
        assert!(expected_repayment > 0, E_EXPECTED_REPAYMENT_TOO_LOW);

        if (loan.is_bullet_repay) {
            assert!(currency_amount >= expected_repayment, E_UNDERPAYMENT_NOT_ALLOWED_BULLET);
            assert!(currency_amount <= expected_repayment, E_PREPAYMENT_NOT_ALLOWED_BULLET);
        };

        coin::put(&mut loan.pool_balance, payment);

        let period = loan.current_period;
        let mut remaining_payment = currency_amount;

        let (rem, _late_fee_paid) = process_late_fees_internal(loan, remaining_payment, now);
        remaining_payment = rem;

        let mut repayment_type;
        let mut interest_paid: u256 = 0;
        let mut principal_paid: u256 = 0;
        let mut prepayment_paid: u256 = 0;

        if (remaining_payment >= (principal_due + interest_due)) {
            process_full_repayment_internal(loan);
            remaining_payment = remaining_payment - principal_due - interest_due;
            interest_paid = interest_due;
            principal_paid = principal_due;
            repayment_type = b"Full".to_string();
        } else {
            if (loan.is_bullet_repay) {
                if (loan.current_period < loan.period_count) {
                    process_bullet_non_final_partial(loan, remaining_payment);
                    interest_paid = remaining_payment;
                } else {
                    process_bullet_final_partial(loan, remaining_payment, interest_due);
                    if (remaining_payment <= interest_due) {
                        interest_paid = remaining_payment;
                    } else {
                        interest_paid = interest_due;
                        principal_paid = remaining_payment - interest_due;
                    };
                };
            } else {
                process_amortizing_partial(loan, remaining_payment, principal_due, interest_due);
                if (remaining_payment <= interest_due) {
                    interest_paid = remaining_payment;
                } else {
                    interest_paid = interest_due;
                    principal_paid = remaining_payment - interest_due;
                };
            };
            remaining_payment = 0;
            repayment_type = b"Partial".to_string();
        };

        if (remaining_payment > 0 && !loan.is_bullet_repay) {
            prepayment_paid = remaining_payment;
            loan.state.total_principal_repayed = loan.state.total_principal_repayed + prepayment_paid;
            loan.state.total_prepayment_amount = loan.state.total_prepayment_amount + prepayment_paid;
            loan.state.principal_paid_this_period = loan.state.principal_paid_this_period + prepayment_paid;
            repayment_type = b"Prepayment".to_string();
            recalculate_after_prepayment(loan);
        };

        loan.state.total_repayed_amount = loan.state.total_repayed_amount + currency_amount;
        loan.state.period_required_update = false;

        let total_remaining_principal = if (loan.principal_amount > loan.state.total_principal_repayed) {
            loan.principal_amount - loan.state.total_principal_repayed
        } else { 0 };
        let total_remaining_interest = if (loan.state.total_interest_for_loan_term > loan.state.total_interest_repayed) {
            loan.state.total_interest_for_loan_term - loan.state.total_interest_repayed
        } else { 0 };

        let repayment_record = loan_models::new_repayment(
            period,
            now,
            principal_paid,
            interest_paid,
            0,
            0,
            prepayment_paid,
            currency_amount,
            repayment_type,
            total_remaining_principal,
            total_remaining_interest,
        );

        if (loan.repayments.contains(period)) {
            let existing = loan.repayments.borrow_mut(period);
            loan_models::update_repayment(
                existing,
                principal_paid,
                interest_paid,
                prepayment_paid,
                currency_amount,
                total_remaining_principal,
                total_remaining_interest,
                repayment_type,
            );
        } else {
            loan.repayments.add(period, repayment_record);
        };

        if (currency_amount > loan.state.total) {
            loan.state.total = 0;
        } else {
            loan.state.total = math::safe_sub(loan.state.total, currency_amount);
        };

        let principal_fully_paid = loan.state.total_principal_repayed >= loan.principal_amount;
        let interest_fully_paid = loan.state.total_interest_repayed >= loan.state.total_interest_for_loan_term;

        if (principal_fully_paid && interest_fully_paid) {
            loan.state.loan_ended = true;
            loan.current_period = loan.period_count;
        };

    }

    public entry fun report_recovery(
        _admin: &LoanAdminCap,
        loan: &mut Loan,
        recovery_amount: u256,
        for_period: u64,
        clock: &Clock,
    ) {
        assert!(loan.has_pool_borrowed, E_POOL_NOT_INITIALIZED);
        assert!(
            loan.state.total_recovery_amount + recovery_amount <= (loan.state.total_write_off_amount as u256),
            E_RECOVERY_EXCEEDS_WRITEOFF,
        );

        loan.state.total_recovery_amount = loan.state.total_recovery_amount + recovery_amount;

        if (loan.state.loan_ended && recovery_amount > 0) {
            loan.state.loan_ended = false;
            if (loan.current_period > loan.period_count) {
                loan.current_period = loan.period_count;
            };
        };

        let now = clock.timestamp_ms() / 1000;

        if (loan.repayments.contains(for_period)) {
            let repayment = loan.repayments.borrow_mut(for_period);
            loan_models::add_recovery(repayment, recovery_amount);
        } else {
            loan.repayments.add(for_period, loan_models::new_repayment(
                for_period,
                now,
                0,
                0,
                0,
                recovery_amount,
                0,
                recovery_amount,
                b"Recovery".to_string(),
                0,
                0,
            ));
        };

    }

    public entry fun write_off(
        _admin: &LoanAdminCap,
        loan: &mut Loan,
        from_principal: u128,
        clock: &Clock,
    ) {
        assert!(loan.has_pool_borrowed, E_POOL_NOT_INITIALIZED);
        assert!((from_principal as u256) <= loan.principal_amount, E_INVALID_AMOUNT);

        loan.state.total_write_off_amount = loan.state.total_write_off_amount + from_principal;
        loan.state.total_write_off_principal = loan.state.total_write_off_principal + from_principal;
        loan.state.writeoff_applied_period = loan.current_period;

        let _now = clock.timestamp_ms() / 1000;
    }

    public entry fun update_borrower(
        _admin: &LoanAdminCap,
        loan: &mut Loan,
        borrower: address,
    ) {
        loan.borrower = borrower;
    }

    public entry fun pause_withdraw(_admin: &LoanAdminCap, config: &mut LoanConfig) {
        config.withdraw_paused = true;
    }

    public entry fun unpause_withdraw(_admin: &LoanAdminCap, config: &mut LoanConfig) {
        config.withdraw_paused = false;
    }

    public entry fun pause_repay(_admin: &LoanAdminCap, config: &mut LoanConfig) {
        config.repay_paused = true;
    }

    public entry fun unpause_repay(_admin: &LoanAdminCap, config: &mut LoanConfig) {
        config.repay_paused = false;
    }

    // ===== Internal helpers =====

    fun update_period_check_internal(loan: &mut Loan, now: u64) {
        if (now > loan.state.loan_next_period_end_timestamp && !loan.state.loan_ended) {
            if (loan.current_period + 1 <= loan.period_count) {
                let interest_per_period = loan.state.total_interest_for_loan_term / (loan.period_count as u256);
                let prev_period_principal = if (loan.is_bullet_repay && loan.current_period + 1 == loan.period_count) {
                    loan.principal_amount
                } else if (!loan.is_bullet_repay) {
                    math::safe_sub(loan.state.emi, interest_per_period)
                } else {
                    0
                };

                let unpaid_interest = if (interest_per_period > loan.state.interest_paid_this_period) {
                    math::safe_sub(interest_per_period, loan.state.interest_paid_this_period)
                } else { 0 };
                let unpaid_principal = if (prev_period_principal > loan.state.principal_paid_this_period) {
                    math::safe_sub(prev_period_principal, loan.state.principal_paid_this_period)
                } else { 0 };

                loan.state.shortfall_interest = math::safe_add(loan.state.shortfall_interest, unpaid_interest);
                loan.state.shortfall_principal = math::safe_add(loan.state.shortfall_principal, unpaid_principal);
                loan.state.interest_paid_this_period = 0;
                loan.state.principal_paid_this_period = 0;
                loan.state.partial_principal = 0;
                loan.state.partial_interest = 0;
                loan.current_period = loan.current_period + 1;
                loan.state.loan_next_period_end_timestamp = loan.state.loan_next_period_end_timestamp + loan.period_length;
                loan.state.period_required_update = true;
            };
        };
    }

    fun process_full_repayment_internal(loan: &mut Loan) {
        let interest_per_period = loan.state.total_interest_for_loan_term / (loan.period_count as u256);
        let period_principal = if (loan.is_bullet_repay) {
            if (loan.current_period == loan.period_count) { loan.principal_amount } else { 0 }
        } else {
            math::safe_sub(loan.state.emi, interest_per_period)
        };

        let (final_principal, final_interest) = if (loan.current_period == loan.period_count && !loan.state.loan_ended) {
            let rp = if (loan.principal_amount >= loan.state.total_principal_repayed) {
                loan.principal_amount - loan.state.total_principal_repayed
            } else { 0 };
            let ri = if (loan.state.total_interest_for_loan_term >= loan.state.total_interest_repayed) {
                loan.state.total_interest_for_loan_term - loan.state.total_interest_repayed
            } else { 0 };
            (rp, ri)
        } else {
            (period_principal, interest_per_period)
        };

        loan.state.total_interest_repayed = math::safe_add(loan.state.total_interest_repayed, final_interest);
        loan.state.total_principal_repayed = math::safe_add(loan.state.total_principal_repayed, final_principal);
        loan.state.interest_paid_this_period = final_interest;
        loan.state.principal_paid_this_period = final_principal;
        loan.state.shortfall_interest = 0;
        loan.state.shortfall_principal = 0;
        loan.state.partial_interest = 0;
        loan.state.partial_principal = 0;
        loan.state.last_full_payment_period = loan.current_period;

        if (loan.current_period + 1 <= loan.period_count) {
            loan.current_period = loan.current_period + 1;
            loan.state.loan_next_period_end_timestamp = loan.state.loan_next_period_end_timestamp + loan.period_length;
        };
    }

    fun process_late_fees_internal(loan: &mut Loan, payment: u256, now: u64): (u256, u256) {
        let total_late_fees = get_late_fee_internal(loan, now);
        if (total_late_fees == 0) return (payment, 0);

        let late_fee_payment = if (payment >= total_late_fees) { total_late_fees } else { payment };
        if (late_fee_payment > 0) {
            loan.state.total_late_fee_paid = loan.state.total_late_fee_paid + late_fee_payment;
            loan.state.total_late_fee_remaining = if (total_late_fees > late_fee_payment) {
                total_late_fees - late_fee_payment
            } else { 0 };
        };
        (payment - late_fee_payment, late_fee_payment)
    }

    fun process_bullet_non_final_partial(loan: &mut Loan, amount: u256) {
        let interest_per_period = math::safe_div(loan.state.total_interest_for_loan_term, (loan.period_count as u256));

        let new_shortfall = if (loan.state.shortfall_interest > 0) {
            if (loan.state.partial_interest > 0) {
                math::safe_sub(loan.state.shortfall_interest, amount)
            } else { loan.state.shortfall_interest }
        } else {
            if (interest_per_period > loan.state.partial_interest + amount) {
                math::safe_sub(interest_per_period, loan.state.partial_interest + amount)
            } else { 0 }
        };

        loan.state.partial_interest = math::safe_add(loan.state.partial_interest, amount);
        loan.state.total_interest_repayed = math::safe_add(loan.state.total_interest_repayed, amount);
        loan.state.interest_paid_this_period = amount;

        if (loan.state.period_required_update) {
            if (amount < loan.state.shortfall_interest) {
                loan.state.shortfall_interest = math::safe_sub(loan.state.shortfall_interest, amount);
            } else {
                let remaining = math::safe_sub(amount, loan.state.shortfall_interest);
                loan.state.shortfall_interest = 0;
                if (remaining < interest_per_period) {
                    loan.state.shortfall_interest = math::safe_sub(interest_per_period, remaining);
                };
            };
        } else {
            loan.state.shortfall_interest = new_shortfall;
        };
    }

    fun process_bullet_final_partial(loan: &mut Loan, amount: u256, _interest_due: u256) {
        let remaining_interest = if (loan.state.total_interest_for_loan_term > loan.state.total_interest_repayed) {
            math::safe_sub(loan.state.total_interest_for_loan_term, loan.state.total_interest_repayed)
        } else { 0 };

        if (amount <= remaining_interest) {
            loan.state.partial_interest = math::safe_add(loan.state.partial_interest, amount);
            loan.state.total_interest_repayed = math::safe_add(loan.state.total_interest_repayed, amount);
            loan.state.interest_paid_this_period = amount;
        } else {
            loan.state.partial_interest = math::safe_add(loan.state.partial_interest, remaining_interest);
            loan.state.total_interest_repayed = math::safe_add(loan.state.total_interest_repayed, remaining_interest);
            loan.state.interest_paid_this_period = remaining_interest;

            let for_principal = math::safe_sub(amount, remaining_interest);
            loan.state.partial_principal = math::safe_add(loan.state.partial_principal, for_principal);
            loan.state.total_principal_repayed = math::safe_add(loan.state.total_principal_repayed, for_principal);
            loan.state.principal_paid_this_period = for_principal;
        };
    }

    fun process_amortizing_partial(loan: &mut Loan, amount: u256, principal_due: u256, interest_due: u256) {
        if (amount <= interest_due) {
            loan.state.partial_interest = math::safe_add(loan.state.partial_interest, amount);
            loan.state.total_interest_repayed = math::safe_add(loan.state.total_interest_repayed, amount);
            loan.state.interest_paid_this_period = amount;
            loan.state.shortfall_interest = math::safe_sub(interest_due, amount);
            loan.state.shortfall_principal = principal_due;
        } else {
            loan.state.partial_interest = math::safe_add(loan.state.partial_interest, interest_due);
            loan.state.total_interest_repayed = math::safe_add(loan.state.total_interest_repayed, interest_due);
            loan.state.interest_paid_this_period = interest_due;

            let for_principal = math::safe_sub(amount, interest_due);
            if (for_principal < principal_due) {
                loan.state.partial_principal = math::safe_add(loan.state.partial_principal, for_principal);
                loan.state.total_principal_repayed = math::safe_add(loan.state.total_principal_repayed, for_principal);
                loan.state.principal_paid_this_period = for_principal;
                loan.state.shortfall_principal = math::safe_sub(principal_due, for_principal);
                loan.state.shortfall_interest = 0;
            } else {
                loan.state.partial_principal = math::safe_add(loan.state.partial_principal, principal_due);
                loan.state.total_principal_repayed = math::safe_add(loan.state.total_principal_repayed, principal_due);
                loan.state.principal_paid_this_period = principal_due;
                loan.state.shortfall_principal = 0;
                loan.state.shortfall_interest = 0;
            };
        };
    }

    fun recalculate_after_prepayment(loan: &mut Loan) {
        if (loan.is_bullet_repay || loan.principal_amount <= loan.state.total_principal_repayed) return;

        let remaining = if (loan.principal_amount > loan.state.total_principal_repayed) {
            loan.principal_amount - loan.state.total_principal_repayed
        } else { 0 };

        if (remaining == 0) {
            loan.state.emi = 0;
            loan.state.total_interest_for_loan_term = loan.state.total_interest_repayed;
            return
        };

        let remaining_periods = if (loan.current_period <= loan.period_count) {
            loan.period_count - loan.current_period + 1
        } else { 0 };

        if (remaining_periods == 0) return;

        let new_emi = interest::calculate_emi(
            remaining,
            loan.annual_interest_rate_bps,
            loan.period_length,
            remaining_periods,
        );
        loan.state.emi = new_emi;

        let future_interest = if ((new_emi * (remaining_periods as u256)) > remaining) {
            (new_emi * (remaining_periods as u256)) - remaining
        } else { 0 };

        loan.state.total_interest_for_loan_term = loan.state.total_interest_repayed + future_interest;
    }

    // ===== Expected repayment calculation =====

    public fun expected_repayment_amount_internal(loan: &Loan, now: u64): (u256, u256, u256, u256) {
        if (loan.state.loan_ended) return (0, 0, 0, 0);

        let total_late_fee = get_late_fee_internal(loan, now);

        let (_base_total, base_principal, base_interest, late_fee) = if (loan.is_bullet_repay) {
            bullet_repayment_calc(loan, total_late_fee)
        } else {
            amortized_repayment_calc(loan, total_late_fee)
        };

        let adjusted_principal = if (loan.state.total_write_off_principal > 0 && loan.current_period >= loan.state.writeoff_applied_period) {
            writeoff_adjusted_payment(loan, loan.current_period, base_principal)
        } else {
            base_principal
        };

        let total_due = adjusted_principal + base_interest + late_fee;
        (total_due, adjusted_principal, base_interest, late_fee)
    }

    fun bullet_repayment_calc(loan: &Loan, late_fee: u256): (u256, u256, u256, u256) {
        let interest_per_period = math::safe_div(loan.state.total_interest_for_loan_term, (loan.period_count as u256));

        if (loan.current_period < loan.period_count) {
            if (loan.state.period_required_update) {
                let total_interest_due = math::safe_add(interest_per_period, loan.state.shortfall_interest);
                (total_interest_due, 0, total_interest_due, late_fee)
            } else {
                let remaining_interest = if (loan.state.shortfall_interest > 0) {
                    loan.state.shortfall_interest
                } else {
                    if (interest_per_period > loan.state.partial_interest) {
                        math::safe_sub(interest_per_period, loan.state.partial_interest)
                    } else { 0 }
                };
                (remaining_interest + late_fee, 0, remaining_interest, late_fee)
            }
        } else {
            let remaining_principal = if (loan.principal_amount > loan.state.total_principal_repayed) {
                math::safe_sub(loan.principal_amount, loan.state.total_principal_repayed)
            } else { 0 };
            let remaining_interest = if (loan.state.total_interest_for_loan_term > loan.state.total_interest_repayed) {
                math::safe_sub(loan.state.total_interest_for_loan_term, loan.state.total_interest_repayed)
            } else { 0 };

            if (loan.state.period_required_update) {
                let total_due = math::safe_add(remaining_principal, remaining_interest);
                (total_due + late_fee, remaining_principal, remaining_interest, late_fee)
            } else {
                let cp = if (remaining_principal > loan.state.partial_principal) {
                    math::safe_sub(remaining_principal, loan.state.partial_principal)
                } else { 0 };
                let total_due = math::safe_add(cp, remaining_interest);
                (total_due + late_fee, cp, remaining_interest, late_fee)
            }
        }
    }

    fun amortized_repayment_calc(loan: &Loan, late_fee: u256): (u256, u256, u256, u256) {
        if (loan.current_period < loan.p_start_from) {
            return interest_only_calc(loan, late_fee)
        };
        if (loan.p_repay_frequency > 1 && (loan.current_period % loan.p_repay_frequency) != 0) {
            return interest_only_calc(loan, late_fee)
        };

        let remaining_principal = if (loan.principal_amount > loan.state.total_principal_repayed) {
            math::safe_sub(loan.principal_amount, loan.state.total_principal_repayed)
        } else { 0 };

        let one = math::get_one();
        let normalized_rate = math::safe_div(math::safe_mul(loan.annual_interest_rate_bps, one), 10000);
        let monthly_rate = math::safe_div(normalized_rate, 12);
        let period_interest = math::rmul(remaining_principal, monthly_rate);

        let period_principal = if (loan.p_start_from > 1 && loan.current_period >= loan.p_start_from) {
            let total_principal_periods = loan.period_count - loan.p_start_from + 1;
            math::safe_div(loan.principal_amount, (total_principal_periods as u256))
        } else if (loan.p_repay_frequency == 1) {
            if (loan.state.emi > period_interest) { math::safe_sub(loan.state.emi, period_interest) } else { 0 }
        } else {
            let freq = math::safe_div((loan.period_count as u256), (loan.p_repay_frequency as u256));
            math::safe_div(loan.principal_amount, freq)
        };

        let ri = if (period_interest > loan.state.partial_interest) {
            math::safe_sub(period_interest, loan.state.partial_interest)
        } else { 0 };
        let rp = if (period_principal > loan.state.partial_principal) {
            math::safe_sub(period_principal, loan.state.partial_principal)
        } else { 0 };

        if (loan.state.period_required_update) {
            let ti = math::safe_add(ri, loan.state.shortfall_interest);
            let tp = math::safe_add(rp, loan.state.shortfall_principal);
            let total = math::safe_add(ti, tp);
            (total, tp, ti, late_fee)
        } else {
            let total = math::safe_add(ri, rp);
            (total + late_fee, rp, ri, late_fee)
        }
    }

    fun interest_only_calc(loan: &Loan, late_fee: u256): (u256, u256, u256, u256) {
        let remaining_principal = if (loan.principal_amount > loan.state.total_principal_repayed) {
            math::safe_sub(loan.principal_amount, loan.state.total_principal_repayed)
        } else { 0 };

        let one = math::get_one();
        let normalized_rate = math::safe_div(math::safe_mul(loan.annual_interest_rate_bps, one), 10000);
        let monthly_rate = math::safe_div(normalized_rate, 12);
        let interest_per_period = math::rmul(remaining_principal, monthly_rate);

        if (loan.state.period_required_update) {
            let total_interest = math::safe_add(interest_per_period, loan.state.shortfall_interest);
            (total_interest + late_fee, 0, total_interest, late_fee)
        } else {
            let ri = if (interest_per_period > loan.state.partial_interest) {
                math::safe_sub(interest_per_period, loan.state.partial_interest)
            } else { 0 };
            let total_interest = math::safe_add(ri, loan.state.shortfall_interest);
            (total_interest + late_fee, 0, total_interest, late_fee)
        }
    }

    fun get_late_fee_internal(loan: &Loan, now: u64): u256 {
        if (loan.late_fee_interest_per_second == 0 || loan.state.last_full_payment_period == loan.current_period) {
            return 0
        };

        let mut total_late_fee: u256 = 0;
        let mut period_to_check = loan.state.last_full_payment_period + 1;

        while (period_to_check <= loan.current_period) {
            let period_end_time = loan.state.loan_start_timestamp + (period_to_check * loan.period_length);
            let grace_end_time = period_end_time + loan.grace_period;

            if (now > grace_end_time) {
                let late_seconds = now - grace_end_time;
                let interest_per_period = math::safe_div(loan.state.total_interest_for_loan_term, (loan.period_count as u256));
                let period_total = if (loan.is_bullet_repay) {
                    if (period_to_check == loan.period_count) {
                        math::safe_add(loan.principal_amount, interest_per_period)
                    } else { interest_per_period }
                } else { loan.state.emi };

                let period_paid = if (loan.repayments.contains(period_to_check)) {
                    let r = loan.repayments.borrow(period_to_check);
                    loan_models::principal_paid(r) + loan_models::interest_paid(r)
                } else { 0 };

                let outstanding = if (period_total > period_paid) { period_total - period_paid } else { 0 };
                if (outstanding > 0) {
                    let fee = math::safe_mul(
                        math::safe_mul(outstanding, loan.late_fee_interest_per_second),
                        (late_seconds as u256),
                    );
                    total_late_fee = total_late_fee + fee;
                };
            };
            period_to_check = period_to_check + 1;
        };
        total_late_fee
    }

    fun writeoff_adjusted_payment(loan: &Loan, period: u64, original_principal: u256): u256 {
        if (loan.state.total_write_off_principal == 0 || period < loan.state.writeoff_applied_period) {
            return original_principal
        };

        let mut total_repayed_before = 0u256;
        let mut p = 1u64;
        while (p < loan.state.writeoff_applied_period) {
            if (loan.repayments.contains(p)) {
                let r = loan.repayments.borrow(p);
                total_repayed_before = total_repayed_before + loan_models::principal_paid(r);
            };
            p = p + 1;
        };

        let remaining_at_writeoff = if (loan.principal_amount > total_repayed_before) {
            loan.principal_amount - total_repayed_before
        } else { 0 };

        if (remaining_at_writeoff > 0 && original_principal > 0) {
            let wo = (loan.state.total_write_off_principal as u256);
            let wo_this_period = math::safe_div(math::safe_mul(original_principal, wo), remaining_at_writeoff);
            if (original_principal > wo_this_period) {
                original_principal - wo_this_period
            } else { 0 }
        } else {
            original_principal
        }
    }

    // ===== View functions =====

    public fun total_value(loan: &Loan): u256 {
        math::rmul(loan.state.total, loan.risk_score)
    }

    public fun performance_fee(loan: &Loan): u16 {
        loan_models::fee_amount(&loan.all_fees[0])
    }

    public fun get_borrower(loan: &Loan): address { loan.borrower }
    public fun get_pool_id(loan: &Loan): u64 { loan.pool_id }
    public fun loan_ended(loan: &Loan): bool { loan.state.loan_ended }
    public fun get_balance(loan: &Loan): u256 { (balance::value(&loan.pool_balance) as u256) }
    public fun get_principal(loan: &Loan): u256 { loan.principal_amount }
    public fun get_total_repayed(loan: &Loan): u256 { loan.state.total_repayed_amount }
    public fun get_current_period(loan: &Loan): u64 { loan.current_period }
    public fun get_loan_start_timestamp(loan: &Loan): u64 { loan.state.loan_start_timestamp }
    public fun get_asset_nft(loan: &Loan): ID { loan.asset_nft }

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }
}
