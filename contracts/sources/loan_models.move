module contracts::loan_models {
    use std::string::String;

    public struct Fees has store, drop, copy {
        name: String,
        amount: u16,
    }

    public struct LoanRepayment has store, drop, copy {
        period: u64,
        timestamp: u64,
        principal_paid: u256,
        interest_paid: u256,
        late_fee_paid: u256,
        recovery_paid: u256,
        prepayment_amount: u256,
        total_payment: u256,
        repayment_type: String,
        remaining_principal: u256,
        remaining_interest: u256,
    }

    public fun new_fee(name: String, amount: u16): Fees {
        Fees { name, amount }
    }

    public fun fee_amount(fee: &Fees): u16 {
        fee.amount
    }

    public fun new_repayment(
        period: u64,
        timestamp: u64,
        principal_paid: u256,
        interest_paid: u256,
        late_fee_paid: u256,
        recovery_paid: u256,
        prepayment_amount: u256,
        total_payment: u256,
        repayment_type: String,
        remaining_principal: u256,
        remaining_interest: u256,
    ): LoanRepayment {
        LoanRepayment {
            period,
            timestamp,
            principal_paid,
            interest_paid,
            late_fee_paid,
            recovery_paid,
            prepayment_amount,
            total_payment,
            repayment_type,
            remaining_principal,
            remaining_interest,
        }
    }

    public fun update_repayment(
        repayment: &mut LoanRepayment,
        principal_paid: u256,
        interest_paid: u256,
        prepayment_amount: u256,
        total_payment: u256,
        remaining_principal: u256,
        remaining_interest: u256,
        repayment_type: String,
    ) {
        repayment.principal_paid = repayment.principal_paid + principal_paid;
        repayment.interest_paid = repayment.interest_paid + interest_paid;
        repayment.prepayment_amount = repayment.prepayment_amount + prepayment_amount;
        repayment.total_payment = repayment.total_payment + total_payment;
        repayment.remaining_principal = remaining_principal;
        repayment.remaining_interest = remaining_interest;
        repayment.repayment_type = repayment_type;
    }

    public fun add_recovery(repayment: &mut LoanRepayment, recovery_amount: u256) {
        repayment.recovery_paid = repayment.recovery_paid + recovery_amount;
        repayment.total_payment = repayment.total_payment + recovery_amount;
    }

    public fun principal_paid(repayment: &LoanRepayment): u256 {
        repayment.principal_paid
    }

    public fun interest_paid(repayment: &LoanRepayment): u256 {
        repayment.interest_paid
    }
}
