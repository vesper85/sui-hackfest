#[test_only]
module contracts::nft_nisarg_tests {
    use sui::test_scenario;
    use contracts::nft_nisarg::{Self, Config, ApprovedMinters, AdminCap, NFTNisarg};

    #[test]
    fun test_mint_and_burn_flow() {
        let admin = @0xAD;
        let user = @0xB0B;

        let mut scenario = test_scenario::begin(admin);

        // init is called automatically on publish, simulate it
        {
            nft_nisarg::init_for_testing(scenario.ctx());
        };

        // admin approves user as minter
        scenario.next_tx(user);
        {
            let mut approved_minters = scenario.take_shared<ApprovedMinters>();
            nft_nisarg::request_mint_approval(&mut approved_minters, scenario.ctx());
            test_scenario::return_shared(approved_minters);
        };

        scenario.next_tx(admin);
        {
            let admin_cap = scenario.take_from_sender<AdminCap>();
            let mut approved_minters = scenario.take_shared<ApprovedMinters>();
            nft_nisarg::approve_mint_request(&admin_cap, &mut approved_minters, user);
            test_scenario::return_shared(approved_minters);
            scenario.return_to_sender(admin_cap);
        };

        // user mints an NFT
        scenario.next_tx(user);
        {
            let mut config = scenario.take_shared<Config>();
            let approved_minters = scenario.take_shared<ApprovedMinters>();
            nft_nisarg::mint_nft(
                &mut config,
                &approved_minters,
                b"Test NFT".to_string(),
                b"A test NFT".to_string(),
                b"PF-001".to_string(),
                10,
                1000,
                5,
                b"12 months".to_string(),
                b"active".to_string(),
                b"2025-12-31".to_string(),
                scenario.ctx(),
            );
            assert!(nft_nisarg::has_nft(&config, user));
            test_scenario::return_shared(config);
            test_scenario::return_shared(approved_minters);
        };

        // user burns the NFT
        scenario.next_tx(user);
        {
            let mut config = scenario.take_shared<Config>();
            let nft = scenario.take_from_sender<NFTNisarg>();
            nft_nisarg::burn_nft(&mut config, nft, scenario.ctx());
            test_scenario::return_shared(config);
        };

        scenario.end();
    }
}
