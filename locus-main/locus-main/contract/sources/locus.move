module locus::locus;

use std::string::String;
use sui::clock::Clock;
use sui::transfer;
use sui::object::{Self, UID};
use sui::tx_context::TxContext;

public struct VisitProof has key, store {
    id: UID,
    location: String,
    timestamp: u64,
}

public struct Proposal has key, store {
    id: UID,
    message: String,
    author: address,
}

public fun check_in(location: String, clock: &Clock, ctx: &mut TxContext) {
    let proof = VisitProof {
        id: object::new(ctx),
        location,
        timestamp: clock.timestamp_ms(),
    };
    transfer::public_transfer(proof, ctx.sender());
}

public fun create_proposal(message: String, ctx: &mut TxContext) {
    let proposal = Proposal {
        id: object::new(ctx),
        message,
        author: ctx.sender(),
    };
    transfer::public_share_object(proposal);
}
