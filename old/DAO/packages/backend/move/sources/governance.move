module 0x0::governance {

    use std::string;
    use std::vector;
    use sui::object::{Self as object, UID};
    use sui::event;
    use sui::tx_context::{Self as tx, TxContext};
    use sui::clock;

    struct Proposal has store {
        id: u64,
        creator: address,
        title: string::String,
        description: string::String,
        yes_votes: u64,
        no_votes: u64,
        is_active: bool,
    }

    struct Dao has key {
        id: UID,
        proposals: vector::Vector<Proposal>,
        winner_proposal_id: u64,
        voting_deadline_ms: u64,
    }

    struct ProposalCreatedEvent has copy, drop {
        proposal_id: u64,
        creator: address,
    }

    struct VotedEvent has copy, drop {
        proposal_id: u64,
        voter: address,
        support: bool,
    }

    struct VotingFinishedEvent has copy, drop {
        winner_proposal_id: u64,
    }

    public fun init_dao(
        voting_deadline_ms: u64,
        ctx: &mut TxContext
    ): Dao {
        let id = object::new(ctx);
        Dao {
            id,
            proposals: vector::empty<Proposal>(),
            winner_proposal_id: 0,
            voting_deadline_ms,
        }
    }

    public fun create_proposal(
        dao: &mut Dao,
        title: string::String,
        description: string::String,
        ctx: &mut TxContext
    ) {
        let creator = tx::sender(ctx);
        let next_id = vector::length(&dao.proposals) as u64;

        let p = Proposal {
            id: next_id,
            creator,
            title,
            description,
            yes_votes: 0,
            no_votes: 0,
            is_active: true,
        };
        vector::push_back(&mut dao.proposals, p);

        event::emit(ProposalCreatedEvent {
            proposal_id: next_id,
            creator,
        });
    }

    public fun vote(
        dao: &mut Dao,
        proposal_id: u64,
        support: bool,
        ctx: &mut TxContext
    ) {
        let now = clock::now_ms(&clock::clock());
        assert!(now <= dao.voting_deadline_ms, 1);

        let len = vector::length(&dao.proposals);
        assert!((proposal_id as usize) < len, 2);

        let p_ref = vector::borrow_mut(&mut dao.proposals, proposal_id as usize);
        assert!(p_ref.is_active, 3);

        if (support) {
            p_ref.yes_votes = p_ref.yes_votes + 1;
        } else {
            p_ref.no_votes = p_ref.no_votes + 1;
        };

        event::emit(VotedEvent {
            proposal_id,
            voter: tx::sender(ctx),
            support,
        });
    }

    public fun finish_voting(
        dao: &mut Dao,
        ctx: &mut TxContext
    ) {
        let now = clock::now_ms(&clock::clock());
        assert!(now > dao.voting_deadline_ms, 4);
        assert!(dao.winner_proposal_id == 0, 5);

        let mut i = 0;
        let len = vector::length(&dao.proposals);
        let mut winner_id = 0;
        let mut winner_score = 0;

        while (i < len) {
            let p_ref = vector::borrow_mut(&mut dao.proposals, i);
            let score = p_ref.yes_votes;

            if (score > winner_score) {
                winner_score = score;
                winner_id = p_ref.id;
            };

            p_ref.is_active = false;
            i = i + 1;
        };

        dao.winner_proposal_id = winner_id;

        event::emit(VotingFinishedEvent {
            winner_proposal_id: winner_id,
        });
    }

    public fun get_proposals(dao: &Dao): &vector::Vector<Proposal> {
        &dao.proposals
    }

    public fun get_winner_proposal_id(dao: &Dao): u64 {
        dao.winner_proposal_id
    }
}
