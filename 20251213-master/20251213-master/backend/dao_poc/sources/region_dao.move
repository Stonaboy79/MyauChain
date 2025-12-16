module dao_poc::region_dao {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::table::{Self, Table};
    use std::string::String;

    /// 自治体が持つ発行権（region_idに紐づく）
    struct RegionIssuerCap has key, store {
        id: UID,
        region_id: u64,
    }

    /// デモ用：事業主が持つ地域配布権（region_idに紐づく）
    struct RegionAdminCap has key, store {
        id: UID,
        region_id: u64,
    }

    /// 住民票NFT（この地域の参加資格）
    struct ResidentPass has key, store {
        id: UID,
        region_id: u64,
    }

    /// 提案
    struct Proposal has store, drop {
        id: u64,
        title: String,
        description: String,
        yes_votes: u64,
    }

    /// 将来拡張用：行動証明（GPS/ZKの「検証済み」を入れる場所）
    struct ActionReceipt has key, store {
        id: UID,
        region_id: u64,
        actor: address,
        proof_hash: vector<u8>,
    }

    /// 地域DAO state（shared）
    struct RegionDaoState has key {
        id: UID,
        region_id: u64,
        next_proposal_id: u64,
        proposals: Table<u64, Proposal>,
        balances: Table<address, u64>,
        used_proofs: Table<vector<u8>, bool>,
    }

    /// platformから呼ばれる：地域state生成
    public fun new_region_state(region_id: u64, ctx: &mut TxContext): RegionDaoState {
        RegionDaoState {
            id: object::new(ctx),
            region_id,
            next_proposal_id: 1,
            proposals: table::new(ctx),
            balances: table::new(ctx),
            used_proofs: table::new(ctx),
        }
    }

    /// platformから呼ばれる：自治体cap生成
    public fun new_issuer_cap(region_id: u64, ctx: &mut TxContext): RegionIssuerCap {
        RegionIssuerCap { id: object::new(ctx), region_id }
    }

    /// platformから呼ばれる：事業主の地域配布cap生成（デモ用）
    public fun new_region_admin_cap(region_id: u64, ctx: &mut TxContext): RegionAdminCap {
        RegionAdminCap { id: object::new(ctx), region_id }
    }

    /// platformから呼ばれる：issuer cap を自治体へ渡す
    public fun transfer_issuer_cap(cap: RegionIssuerCap, to: address) {
        transfer::public_transfer(cap, to);
    }

    /// platformから呼ばれる：地域stateをshared化
    public fun share_region_state(state: RegionDaoState) {
        transfer::share_object(state);
    }

    /// 住民票NFT発行（自治体cap必須）
    /// 同時に投票トークン残高を buyer に付与
    public entry fun mint_resident_pass(
        state: &mut RegionDaoState,
        issuer: &RegionIssuerCap,
        buyer: address,
        mint_amount: u64,
        ctx: &mut TxContext
    ) {
        assert!(issuer.region_id == state.region_id, 0);

        let pass = ResidentPass { id: object::new(ctx), region_id: state.region_id };
        transfer::public_transfer(pass, buyer);

        if (table::contains(&state.balances, buyer)) {
            let cur = table::remove(&mut state.balances, buyer);
            table::add(&mut state.balances, buyer, cur + mint_amount);
        } else {
            table::add(&mut state.balances, buyer, mint_amount);
        }
    }

    /// デモ用：事業主が地域の投票権を配布（ResidentPass不要）
    public entry fun airdrop_local_votes(
        state: &mut RegionDaoState,
        admin: &RegionAdminCap,
        to: address,
        amount: u64,
    ) {
        assert!(admin.region_id == state.region_id, 1000);

        if (table::contains(&state.balances, to)) {
            let cur = table::remove(&mut state.balances, to);
            table::add(&mut state.balances, to, cur + amount);
        } else {
            table::add(&mut state.balances, to, amount);
        };
    }

    /// 将来拡張：行動を記録して追加付与する（GPS/ZKをここに差し込む）
    public entry fun record_action(
        state: &mut RegionDaoState,
        proof_hash: vector<u8>,
        reward: u64,
        ctx: &mut TxContext
    ) {
        let actor = tx_context::sender(ctx);

        let receipt = ActionReceipt {
            id: object::new(ctx),
            region_id: state.region_id,
            actor,
            proof_hash,
        };
        transfer::public_transfer(receipt, actor);

        if (table::contains(&state.balances, actor)) {
            let cur = table::remove(&mut state.balances, actor);
            table::add(&mut state.balances, actor, cur + reward);
        } else {
            table::add(&mut state.balances, actor, reward);
        }
    }

    /// デモ用：誰でも自分のGPSトークン（地方DAO版）を同期可能
    public entry fun sync_local_token(
        state: &mut RegionDaoState,
        amount: u64,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        if (table::contains(&state.balances, sender)) {
            let cur = table::remove(&mut state.balances, sender);
            table::add(&mut state.balances, sender, cur + amount);
        } else {
            table::add(&mut state.balances, sender, amount);
        }
    }

    /// 起票（住民票NFTチェックを削除 - フロントエンドで確認）
    public entry fun create_local_proposal(
        state: &mut RegionDaoState,
        title: String,
        description: String,
        _ctx: &mut TxContext
    ) {
        // NFTの所有権チェックはフロントエンドで行う
        // ここでは誰でも提案を作成できる

        let pid = state.next_proposal_id;
        state.next_proposal_id = pid + 1;

        let p = Proposal { id: pid, title, description, yes_votes: 0 };
        table::add(&mut state.proposals, pid, p);
    }

    /// 投票：住民票NFTを持っていれば投票可能
    public entry fun vote_local(
        state: &mut RegionDaoState,
        proposal_id: u64,
        amount: u64,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);

        // 1. Check Balance
        if (table::contains(&state.balances, sender)) {
            let cur = table::remove(&mut state.balances, sender);
            assert!(cur >= amount, 201); // E_BAL_LOW
            table::add(&mut state.balances, sender, cur - amount);
        } else {
            abort 200 // E_NO_BAL
        };

        // 2. Add Votes
        let p = table::borrow_mut(&mut state.proposals, proposal_id);
        p.yes_votes = p.yes_votes + amount;
    }
}
