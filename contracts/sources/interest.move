module contracts::interest {
    use contracts::math;

    public fun calculate_emi(
        principal: u256,
        annual_rate_bps: u256,
        _period_length: u64,
        period_count: u64,
    ): u256 {
        if (period_count == 0) return 0;
        let one = math::get_one();
        let normalized_rate = math::safe_div(math::safe_mul(annual_rate_bps, one), 10000);
        let monthly_rate = math::safe_div(normalized_rate, 12);

        if (monthly_rate == 0) {
            return math::safe_div(principal, (period_count as u256))
        };

        let pow_factor = math::rpow(math::safe_add(one, monthly_rate), (period_count as u256));
        let numerator = math::rmul(principal, math::rmul(monthly_rate, pow_factor));
        let denominator = math::safe_sub(pow_factor, one);

        if (denominator == 0) {
            math::safe_div(principal, (period_count as u256))
        } else {
            math::rdiv(numerator, denominator)
        }
    }

    public fun get_amortized_interest(principal: u256, annual_rate_bps: u256): u256 {
        let one = math::get_one();
        let normalized_rate = math::safe_div(math::safe_mul(annual_rate_bps, one), 10000);
        math::rmul(principal, normalized_rate)
    }

    public fun charge_interest_internal(
        principal: u256,
        annual_rate_bps: u256,
        loan_term_seconds: u256,
    ): u256 {
        let one = math::get_one();
        let normalized_rate = math::safe_div(math::safe_mul(annual_rate_bps, one), 10000);
        let seconds_per_year: u256 = 31536000;
        let rate_per_second = math::safe_div(normalized_rate, seconds_per_year);
        let compound_factor = math::rpow(
            math::safe_add(one, rate_per_second),
            loan_term_seconds,
        );
        math::rmul(principal, compound_factor)
    }
}
