#[test_only]
module contracts::token_tests {
    use sui::test_scenario;
    use sui::coin::{Self, TreasuryCap, Coin};
    use contracts::token::{Self, TOKEN, TokenAdminCap};

    const ADMIN: address = @0xAD;
    const USER: address = @0xB0B;

    #[test]
    fun test_create_token() {
        let mut scenario = test_scenario::begin(ADMIN);
        {
            token::init_for_testing(scenario.ctx());
        };

        scenario.next_tx(ADMIN);
        {
            let treasury = scenario.take_from_sender<TreasuryCap<TOKEN>>();
            assert!(token::total_supply(&treasury) == 0);
            scenario.return_to_sender(treasury);

            let admin_cap = scenario.take_from_sender<TokenAdminCap>();
            scenario.return_to_sender(admin_cap);
        };

        scenario.end();
    }

    #[test]
    fun test_mint_token() {
        let mut scenario = test_scenario::begin(ADMIN);
        {
            token::init_for_testing(scenario.ctx());
        };

        scenario.next_tx(ADMIN);
        {
            let mut treasury = scenario.take_from_sender<TreasuryCap<TOKEN>>();
            token::mint(&mut treasury, 1000, USER, scenario.ctx());
            assert!(token::total_supply(&treasury) == 1000);
            scenario.return_to_sender(treasury);
        };

        scenario.next_tx(USER);
        {
            let user_coin = scenario.take_from_sender<Coin<TOKEN>>();
            assert!(coin::value(&user_coin) == 1000);
            scenario.return_to_sender(user_coin);
        };

        scenario.end();
    }

    #[test]
    fun test_burn_token() {
        let mut scenario = test_scenario::begin(ADMIN);
        {
            token::init_for_testing(scenario.ctx());
        };

        scenario.next_tx(ADMIN);
        {
            let mut treasury = scenario.take_from_sender<TreasuryCap<TOKEN>>();
            token::mint(&mut treasury, 1000, USER, scenario.ctx());
            scenario.return_to_sender(treasury);
        };

        scenario.next_tx(USER);
        {
            let user_coin = scenario.take_from_sender<Coin<TOKEN>>();
            assert!(coin::value(&user_coin) == 1000);

            // transfer coin to admin so admin can burn it
            transfer::public_transfer(user_coin, ADMIN);
        };

        scenario.next_tx(ADMIN);
        {
            let mut treasury = scenario.take_from_sender<TreasuryCap<TOKEN>>();
            let token_to_burn = scenario.take_from_sender<Coin<TOKEN>>();
            let burned = token::burn(&mut treasury, token_to_burn);
            assert!(burned == 1000);
            assert!(token::total_supply(&treasury) == 0);
            scenario.return_to_sender(treasury);
        };

        scenario.end();
    }

    #[test]
    fun test_safe_burn_partial() {
        let mut scenario = test_scenario::begin(ADMIN);
        {
            token::init_for_testing(scenario.ctx());
        };

        scenario.next_tx(ADMIN);
        {
            let mut treasury = scenario.take_from_sender<TreasuryCap<TOKEN>>();
            token::mint(&mut treasury, 1000, ADMIN, scenario.ctx());
            scenario.return_to_sender(treasury);
        };

        scenario.next_tx(ADMIN);
        {
            let mut treasury = scenario.take_from_sender<TreasuryCap<TOKEN>>();
            let admin_coin = scenario.take_from_sender<Coin<TOKEN>>();
            let burned = token::safe_burn(&mut treasury, admin_coin, 400, scenario.ctx());
            assert!(burned == 400);
            assert!(token::total_supply(&treasury) == 600);
            scenario.return_to_sender(treasury);
        };

        scenario.next_tx(ADMIN);
        {
            let remaining = scenario.take_from_sender<Coin<TOKEN>>();
            assert!(coin::value(&remaining) == 600);
            scenario.return_to_sender(remaining);
        };

        scenario.end();
    }

    #[test]
    fun test_safe_burn_exceeds_balance() {
        let mut scenario = test_scenario::begin(ADMIN);
        {
            token::init_for_testing(scenario.ctx());
        };

        scenario.next_tx(ADMIN);
        {
            let mut treasury = scenario.take_from_sender<TreasuryCap<TOKEN>>();
            token::mint(&mut treasury, 500, ADMIN, scenario.ctx());
            scenario.return_to_sender(treasury);
        };

        scenario.next_tx(ADMIN);
        {
            let mut treasury = scenario.take_from_sender<TreasuryCap<TOKEN>>();
            let admin_coin = scenario.take_from_sender<Coin<TOKEN>>();
            let burned = token::safe_burn(&mut treasury, admin_coin, 9999, scenario.ctx());
            assert!(burned == 500);
            assert!(token::total_supply(&treasury) == 0);
            scenario.return_to_sender(treasury);
        };

        scenario.end();
    }

    #[test]
    fun test_mint_burn_mint_cycle() {
        let mut scenario = test_scenario::begin(ADMIN);
        {
            token::init_for_testing(scenario.ctx());
        };

        scenario.next_tx(ADMIN);
        {
            let mut treasury = scenario.take_from_sender<TreasuryCap<TOKEN>>();
            token::mint(&mut treasury, 500, ADMIN, scenario.ctx());
            assert!(token::total_supply(&treasury) == 500);
            scenario.return_to_sender(treasury);
        };

        scenario.next_tx(ADMIN);
        {
            let mut treasury = scenario.take_from_sender<TreasuryCap<TOKEN>>();
            let coin_to_burn = scenario.take_from_sender<Coin<TOKEN>>();
            token::burn(&mut treasury, coin_to_burn);
            assert!(token::total_supply(&treasury) == 0);

            token::mint(&mut treasury, 2000, USER, scenario.ctx());
            assert!(token::total_supply(&treasury) == 2000);
            scenario.return_to_sender(treasury);
        };

        scenario.next_tx(USER);
        {
            let user_coin = scenario.take_from_sender<Coin<TOKEN>>();
            assert!(coin::value(&user_coin) == 2000);
            scenario.return_to_sender(user_coin);
        };

        scenario.end();
    }
}
