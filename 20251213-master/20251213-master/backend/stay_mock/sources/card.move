module resident_nft::card {
    use std::string::{Self, String};
    use sui::url::{Self, Url};
    use sui::event;
    use sui::object::{Self, UID, ID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    /// The Resident Card NFT struct
    public struct ResidentCard has key, store {
        id: UID,
        name: String,
        description: String,
        image_url: Url,
        user_address: String, // String representation of the user address in the card metadata
    }

    /// Event emitted when a card is minted
    public struct CardMinted has copy, drop {
        object_id: ID,
        creator: address,
        name: String,
    }

    /// Mint a new Resident Card and transfer it to the sender
    #[allow(lint(public_entry))]
    public entry fun mint(
        name: vector<u8>,
        description: vector<u8>,
        image_url: vector<u8>,
        user_address: vector<u8>,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);

        let card = ResidentCard {
            id: object::new(ctx),
            name: string::utf8(name),
            description: string::utf8(description),
            image_url: url::new_unsafe_from_bytes(image_url),
            user_address: string::utf8(user_address),
        };

        event::emit(CardMinted {
            object_id: object::id(&card),
            creator: sender,
            name: string::utf8(name),
        });

        transfer::public_transfer(card, sender);
    }

    /// Getters (optional but good for debugging/reading on-chain)
    public fun name(card: &ResidentCard): &String {
        &card.name
    }

    public fun description(card: &ResidentCard): &String {
        &card.description
    }

    public fun image_url(card: &ResidentCard): &Url {
        &card.image_url
    }
}
