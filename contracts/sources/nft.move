module contracts::nft_nisarg {
    use std::string::String;
    use sui::event;
    use sui::table::{Self, Table};
    use sui::package;
    use sui::display;

    const E_NOT_AUTHORIZED: u64 = 1;
    const E_NO_NISARG_NFT: u64 = 4;
    const E_NOT_ADMIN: u64 = 5;
    const E_NOT_APPROVED: u64 = 7;
    const BASE_AMOUNT: u64 = 1000000;

    public struct NFT_NISARG has drop {}

    public struct AdminCap has key, store {
        id: UID,
    }

    public struct Config has key {
        id: UID,
        number: u64,
        nft_count_by_user: Table<address, vector<ID>>,
    }

    public struct ApprovedMinters has key {
        id: UID,
        minters: vector<address>,
        pending_requests: vector<address>,
    }

    public struct NFTNisarg has key, store {
        id: UID,
        prob_of_default: u64,
        loss_given_default: u64,
        risk_score: u64,
        exposure_at_default: u64,
        underwritten: bool,
        name: String,
        description: String,
        portfolio_id: String,
        no_of_loans: u64,
        total_principal_amount: u64,
        average_interest_rate: u64,
        portfolio_term: String,
        portfolio_status: String,
        maturity_date: String,
        image_url: String,
        owner: address,
    }

    public struct NFTMintedEvent has copy, drop {
        token_id: ID,
        name: String,
        owner: address,
    }

    public struct NFTTransferredEvent has copy, drop {
        token_id: ID,
        from: address,
        to: address,
    }

    public struct MintRequestEvent has copy, drop {
        requester: address,
    }

    public struct MintApprovalEvent has copy, drop {
        approved_address: address,
        approved_by: address,
    }

    fun init(otw: NFT_NISARG, ctx: &mut TxContext) {
        let publisher = package::claim(otw, ctx);

        let mut display = display::new<NFTNisarg>(&publisher, ctx);
        display.add(b"name".to_string(), b"{name}".to_string());
        display.add(b"description".to_string(), b"{description}".to_string());
        display.add(b"image_url".to_string(), b"{image_url}".to_string());
        display.add(b"portfolio_id".to_string(), b"{portfolio_id}".to_string());
        display.update_version();

        transfer::public_transfer(publisher, ctx.sender());
        transfer::public_transfer(display, ctx.sender());

        transfer::transfer(AdminCap {
            id: object::new(ctx),
        }, ctx.sender());

        transfer::share_object(Config {
            id: object::new(ctx),
            number: 0,
            nft_count_by_user: table::new(ctx),
        });

        transfer::share_object(ApprovedMinters {
            id: object::new(ctx),
            minters: vector::empty(),
            pending_requests: vector::empty(),
        });
    }

    public entry fun mint_nft(
        config: &mut Config,
        approved_minters: &ApprovedMinters,
        name: String,
        nft_description: String,
        portfolio_id: String,
        no_of_loans: u64,
        total_principal_amount: u64,
        average_interest_rate: u64,
        portfolio_term: String,
        portfolio_status: String,
        maturity_date: String,
        ctx: &mut TxContext,
    ) {
        let sender = ctx.sender();
        assert!(approved_minters.minters.contains(&sender), E_NOT_APPROVED);

        let updated_total_principal_amount = total_principal_amount * BASE_AMOUNT;

        config.number = config.number + 1;

        let nft = NFTNisarg {
            id: object::new(ctx),
            prob_of_default: 0,
            loss_given_default: 0,
            risk_score: 0,
            exposure_at_default: 0,
            underwritten: false,
            name,
            description: nft_description,
            portfolio_id,
            no_of_loans,
            total_principal_amount: updated_total_principal_amount,
            average_interest_rate,
            portfolio_term,
            portfolio_status,
            maturity_date,
            image_url: b"https://example.fi/nft".to_string(),
            owner: sender,
        };

        let token_id = object::id(&nft);

        if (!config.nft_count_by_user.contains(sender)) {
            config.nft_count_by_user.add(sender, vector::empty<ID>());
        };
        let user_nfts = config.nft_count_by_user.borrow_mut(sender);
        user_nfts.push_back(token_id);

        event::emit(NFTMintedEvent {
            token_id,
            name: nft.name,
            owner: sender,
        });

        transfer::public_transfer(nft, sender);
    }

    public entry fun transfer_nft(
        config: &mut Config,
        nft: NFTNisarg,
        to: address,
        ctx: &mut TxContext,
    ) {
        let from = ctx.sender();
        let token_id = object::id(&nft);

        if (config.nft_count_by_user.contains(from)) {
            let from_nfts = config.nft_count_by_user.borrow_mut(from);
            let (exists, index) = from_nfts.index_of(&token_id);
            if (exists) {
                from_nfts.remove(index);
            };
        };

        if (!config.nft_count_by_user.contains(to)) {
            config.nft_count_by_user.add(to, vector::empty<ID>());
        };
        let to_nfts = config.nft_count_by_user.borrow_mut(to);
        to_nfts.push_back(token_id);

        event::emit(NFTTransferredEvent { token_id, from, to });

        transfer::public_transfer(nft, to);
    }

    public entry fun update_nft_data(
        _admin: &AdminCap,
        nft: &mut NFTNisarg,
        prob_of_default: u64,
        loss_given_default: u64,
        risk_score: u64,
        exposure_at_default: u64,
    ) {
        nft.prob_of_default = prob_of_default;
        nft.loss_given_default = loss_given_default;
        nft.risk_score = risk_score;
        nft.exposure_at_default = exposure_at_default;
        nft.underwritten = true;
    }

    public entry fun reset_underwritten(
        _admin: &AdminCap,
        nft: &mut NFTNisarg,
    ) {
        nft.underwritten = false;
        nft.prob_of_default = 0;
        nft.loss_given_default = 0;
        nft.risk_score = 0;
        nft.exposure_at_default = 0;
    }

    public entry fun burn_nft(
        config: &mut Config,
        nft: NFTNisarg,
        ctx: &mut TxContext,
    ) {
        let owner = ctx.sender();
        let token_id = object::id(&nft);

        if (config.nft_count_by_user.contains(owner)) {
            let user_nfts = config.nft_count_by_user.borrow_mut(owner);
            let (exists, index) = user_nfts.index_of(&token_id);
            assert!(exists, E_NO_NISARG_NFT);
            user_nfts.remove(index);
        };

        let NFTNisarg {
            id,
            prob_of_default: _,
            loss_given_default: _,
            risk_score: _,
            exposure_at_default: _,
            underwritten: _,
            name: _,
            description: _,
            portfolio_id: _,
            no_of_loans: _,
            total_principal_amount: _,
            average_interest_rate: _,
            portfolio_term: _,
            portfolio_status: _,
            maturity_date: _,
            image_url: _,
            owner: _,
        } = nft;
        object::delete(id);
    }

    public entry fun request_mint_approval(
        approved_minters: &mut ApprovedMinters,
        ctx: &mut TxContext,
    ) {
        let requester = ctx.sender();

        if (!approved_minters.pending_requests.contains(&requester)) {
            approved_minters.pending_requests.push_back(requester);
        };

        event::emit(MintRequestEvent { requester });
    }

    public entry fun approve_mint_request(
        _admin: &AdminCap,
        approved_minters: &mut ApprovedMinters,
        to_approve: address,
    ) {
        let (exists, index) = approved_minters.pending_requests.index_of(&to_approve);
        assert!(exists, E_NOT_ADMIN);

        approved_minters.pending_requests.remove(index);

        if (!approved_minters.minters.contains(&to_approve)) {
            approved_minters.minters.push_back(to_approve);
        };

        event::emit(MintApprovalEvent {
            approved_address: to_approve,
            approved_by: @contracts,
        });
    }

    public fun is_approved_minter(approved_minters: &ApprovedMinters, addr: address): bool {
        approved_minters.minters.contains(&addr)
    }

    public fun get_nft_addresses(config: &Config, owner_addr: address): vector<ID> {
        if (!config.nft_count_by_user.contains(owner_addr)) {
            vector::empty<ID>()
        } else {
            *config.nft_count_by_user.borrow(owner_addr)
        }
    }

    public fun has_nft(config: &Config, owner_addr: address): bool {
        let nfts = get_nft_addresses(config, owner_addr);
        nfts.length() > 0
    }

    public fun is_underwritten(nft: &NFTNisarg): bool {
        nft.underwritten
    }

    public fun loan_principal_amount(nft: &NFTNisarg): u64 {
        nft.total_principal_amount
    }

    public fun check_nft_owner(nft: &NFTNisarg, owner: address): bool {
        nft.owner == owner
    }

    public fun get_nft_data(nft: &NFTNisarg): (u64, u64, u64, u64, bool) {
        (
            nft.prob_of_default,
            nft.loss_given_default,
            nft.risk_score,
            nft.exposure_at_default,
            nft.underwritten,
        )
    }

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(NFT_NISARG {}, ctx);
    }
}
