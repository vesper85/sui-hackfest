module contracts::token {
    use std::string::String;
    use sui::coin::{Self, TreasuryCap, Coin};
    use sui::event;
    use sui::url;

    public struct TOKEN has drop {}

    public struct TokenAdminCap has key, store {
        id: UID,
    }

    public struct MintEvent has copy, drop {
        amount: u64,
        recipient: address,
    }

    public struct BurnEvent has copy, drop {
        amount: u64,
        burner: address,
    }

    public struct TransferEvent has copy, drop {
        from: address,
        to: address,
        amount: u64,
    }

    fun init(witness: TOKEN, ctx: &mut TxContext) {
        let (treasury_cap, metadata) = coin::create_currency(
            witness,
            6,
            b"TKN",
            b"Tranche Token",
            b"Fungible tranche token for the lending protocol",
            option::some(url::new_unsafe_from_bytes(
                b"https://res.cloudinary.com/dyk5s8gbw/image/upload/v1717438870/fhpgfmybp1kz2en3pbte.png"
            )),
            ctx,
        );

        transfer::public_freeze_object(metadata);
        transfer::public_transfer(treasury_cap, ctx.sender());

        transfer::transfer(TokenAdminCap {
            id: object::new(ctx),
        }, ctx.sender());
    }

    public fun mint(
        treasury: &mut TreasuryCap<TOKEN>,
        amount: u64,
        recipient: address,
        ctx: &mut TxContext,
    ) {
        let minted = coin::mint(treasury, amount, ctx);
        transfer::public_transfer(minted, recipient);

        event::emit(MintEvent { amount, recipient });
    }

    public entry fun mint_to(
        _admin: &TokenAdminCap,
        treasury: &mut TreasuryCap<TOKEN>,
        amount: u64,
        recipient: address,
        ctx: &mut TxContext,
    ) {
        mint(treasury, amount, recipient, ctx);
    }

    public fun burn(
        treasury: &mut TreasuryCap<TOKEN>,
        token: Coin<TOKEN>,
    ): u64 {
        let amount = coin::value(&token);
        coin::burn(treasury, token);

        event::emit(BurnEvent { amount, burner: @0x0 });
        amount
    }

    public entry fun burn_from(
        _admin: &TokenAdminCap,
        treasury: &mut TreasuryCap<TOKEN>,
        token: Coin<TOKEN>,
    ) {
        burn(treasury, token);
    }

    public fun safe_burn(
        treasury: &mut TreasuryCap<TOKEN>,
        mut token: Coin<TOKEN>,
        max_amount: u64,
        ctx: &mut TxContext,
    ): u64 {
        let balance = coin::value(&token);
        if (balance == 0) {
            coin::destroy_zero(token);
            return 0
        };

        let burn_amount = if (max_amount >= balance) { balance } else { max_amount };

        if (burn_amount < balance) {
            let to_burn = coin::split(&mut token, burn_amount, ctx);
            coin::burn(treasury, to_burn);
            transfer::public_transfer(token, ctx.sender());
        } else {
            coin::burn(treasury, token);
        };

        event::emit(BurnEvent { amount: burn_amount, burner: ctx.sender() });
        burn_amount
    }

    public entry fun transfer_token(
        token: Coin<TOKEN>,
        recipient: address,
        ctx: &mut TxContext,
    ) {
        let amount = coin::value(&token);
        let sender = ctx.sender();
        transfer::public_transfer(token, recipient);

        event::emit(TransferEvent { from: sender, to: recipient, amount });
    }

    public fun total_supply(treasury: &TreasuryCap<TOKEN>): u64 {
        coin::total_supply(treasury) as u64
    }

    public fun balance_of(token: &Coin<TOKEN>): u64 {
        coin::value(token)
    }

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(TOKEN {}, ctx);
    }
}
