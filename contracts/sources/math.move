module contracts::math {
    const ONE: u256 = 1_000_000_000_000_000_000_000_000_000;

    public fun get_one(): u256 { ONE }

    public fun safe_add(a: u256, b: u256): u256 { a + b }

    public fun safe_sub(a: u256, b: u256): u256 {
        if (a >= b) { a - b } else { 0 }
    }

    public fun safe_mul(a: u256, b: u256): u256 { a * b }

    public fun safe_div(a: u256, b: u256): u256 {
        if (b == 0) { 0 } else { a / b }
    }

    public fun rmul(a: u256, b: u256): u256 {
        safe_div(safe_mul(a, b), ONE)
    }

    public fun rdiv(a: u256, b: u256): u256 {
        if (b == 0) { 0 } else { safe_div(safe_mul(a, ONE), b) }
    }

    public fun rpow(base: u256, exp: u256): u256 {
        let mut result = ONE;
        let mut b = base;
        let mut e = exp;
        while (e > 0) {
            if (e % 2 == 1) {
                result = rmul(result, b);
            };
            b = rmul(b, b);
            e = e / 2;
        };
        result
    }
}
