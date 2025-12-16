module dao_poc::platform {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::table::{Self, Table};

    use dao_poc::region_dao;
    use std::string::String;

    /// 事業主cap（あなたが持つ）
    struct PlatformAdminCap has key, store {
        id: UID,
    }

    /// 全体DAO state（shared）
    struct GlobalDaoState has key {
        id: UID,
        next_region_id: u64,
        regions: Table<u64, ID>, // region_id -> RegionDaoStateのID
    }

    /// publish時：admin capを発行し、global stateをshared化
    fun init(ctx: &mut TxContext) {
        let admin = PlatformAdminCap { id: object::new(ctx) };
        transfer::public_transfer(admin, tx_context::sender(ctx));

        let regions = table::new(ctx);
        let global = GlobalDaoState { id: object::new(ctx), next_region_id: 1, regions };
        transfer::share_object(global);
    }

    /// 地域登録：事業主のみ実行
    /// - RegionDaoState(shared) を生成
    /// - RegionIssuerCap を自治体へ転送
    /// - RegionAdminCap（デモ用）を事業主へ転送
    public entry fun register_region(
        _admin: &PlatformAdminCap,
        global: &mut GlobalDaoState,
        municipality: address,
        ctx: &mut TxContext
    ) {
        let region_id = global.next_region_id;
        global.next_region_id = region_id + 1;

        let region_state = region_dao::new_region_state(region_id, ctx);
        let region_state_id = object::id(&region_state);

        let issuer = region_dao::new_issuer_cap(region_id, ctx);
        region_dao::transfer_issuer_cap(issuer, municipality);

        // デモ用：事業主が地域投票権を配れるcapを受け取る
        let region_admin = region_dao::new_region_admin_cap(region_id, ctx);
        transfer::public_transfer(region_admin, tx_context::sender(ctx));

        table::add(&mut global.regions, region_id, region_state_id);

        region_dao::share_region_state(region_state);
    }

    // -----------------------------
    // 全体DAO（メタDAO）ガバナンス
    // -----------------------------

    /// 全体DAOの提案
    struct GlobalProposal has store, drop {
        id: u64,
        title: String,
        description: String,
        yes_votes: u64,
    }

    /// 地域メトリクス（全体DAO発行計算用）
    struct RegionMetrics has store, drop {
        population_density: u64,
        recent_active_actions: u64,
    }

    /// 全体DAOガバナンス state（shared）
    struct GlobalGovState has key {
        id: UID,
        base_mint: u64,
        next_global_proposal_id: u64,
        global_proposals: Table<u64, GlobalProposal>,
        global_balances: Table<address, u64>,
        region_metrics: Table<u64, RegionMetrics>,
    }

    /// 1回だけ呼んで GlobalGovState を作る（事業主のみ）
    public entry fun create_global_gov_state(
        _admin: &PlatformAdminCap,
        ctx: &mut TxContext
    ) {
        let s = GlobalGovState {
            id: object::new(ctx),
            base_mint: 10,
            next_global_proposal_id: 1,
            global_proposals: table::new(ctx),
            global_balances: table::new(ctx),
            region_metrics: table::new(ctx),
        };
        transfer::share_object(s);
    }

    const E_NO_REGION: u64 = 100;
    const E_NO_METRICS: u64 = 101;
    const E_NO_BAL: u64 = 200;
    const E_BAL_LOW: u64 = 201;
    const E_NO_PROPOSAL: u64 = 202;

    /// 人口密度を後からセット（事業主のみ）
    public entry fun set_region_population_density(
        _admin: &PlatformAdminCap,
        global: &GlobalDaoState, // region_id の存在確認用
        gov: &mut GlobalGovState,
        region_id: u64,
        population_density: u64
    ) {
        assert!(table::contains(&global.regions, region_id), E_NO_REGION);

        if (table::contains(&gov.region_metrics, region_id)) {
            let _old = table::remove(&mut gov.region_metrics, region_id);
        } else { };

        let m = RegionMetrics { population_density, recent_active_actions: 0 };
        table::add(&mut gov.region_metrics, region_id, m);
    }

    /// 全体DAOトークン発行（PoC：senderに mint）
    const DENSITY_SCALE: u64 = 1000;
    const ACTION_SCALE: u64 = 1000;
    const ACTION_OFFSET: u64 = 10;

    public entry fun record_global_action(
        gov: &mut GlobalGovState,
        region_id: u64,
        proof_hash: vector<u8>,
        action_weight: u64,
        ctx: &mut TxContext
    ) {
        let _ = proof_hash;

        assert!(table::contains(&gov.region_metrics, region_id), E_NO_METRICS);

        let old = table::remove(&mut gov.region_metrics, region_id);
        let m = RegionMetrics {
            population_density: old.population_density,
            recent_active_actions: old.recent_active_actions + action_weight,
        };

        let density = if (m.population_density == 0) 1 else m.population_density;
        let density_factor = DENSITY_SCALE / density;
        let action_factor = ACTION_SCALE / (m.recent_active_actions + ACTION_OFFSET);

        let raw_mint = gov.base_mint * density_factor * action_factor / 1000;
        let mint = if (raw_mint == 0) 1 else raw_mint;

        let actor = tx_context::sender(ctx);

        if (table::contains(&gov.global_balances, actor)) {
            let cur = table::remove(&mut gov.global_balances, actor);
            table::add(&mut gov.global_balances, actor, cur + mint);
        } else {
            table::add(&mut gov.global_balances, actor, mint);
        };

        table::add(&mut gov.region_metrics, region_id, m);
    }

    /// 起票（全体DAO）
    public entry fun create_global_proposal(
        gov: &mut GlobalGovState,
        title: String,
        description: String,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(table::contains(&gov.global_balances, sender), E_NO_BAL);

        let pid = gov.next_global_proposal_id;
        gov.next_global_proposal_id = pid + 1;

        let p = GlobalProposal { id: pid, title, description, yes_votes: 0 };
        table::add(&mut gov.global_proposals, pid, p);
    }

    /// 投票（全体DAO）
    public entry fun vote_global(
        gov: &mut GlobalGovState,
        proposal_id: u64,
        amount: u64,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        
        // 1. Check Balance
        assert!(table::contains(&gov.global_balances, sender), E_NO_BAL);
        let balance = table::remove(&mut gov.global_balances, sender);
        assert!(balance >= amount, E_BAL_LOW);

        // 2. Comsume Tokens
        table::add(&mut gov.global_balances, sender, balance - amount);

        // 3. Add Votes
        assert!(table::contains(&gov.global_proposals, proposal_id), E_NO_PROPOSAL);
        let p = table::remove(&mut gov.global_proposals, proposal_id);
        let updated = GlobalProposal {
            id: p.id,
            title: p.title,
            description: p.description,
            yes_votes: p.yes_votes + amount 
        };
        table::add(&mut gov.global_proposals, proposal_id, updated);
    }

    /// デモ用：事業主が全体DAOの投票権を配布
    public entry fun airdrop_global_votes(
        _admin: &PlatformAdminCap,
        gov: &mut GlobalGovState,
        to: address,
        amount: u64,
    ) {
        if (table::contains(&gov.global_balances, to)) {
            let cur = table::remove(&mut gov.global_balances, to);
            table::add(&mut gov.global_balances, to, cur + amount);
        } else {
            table::add(&mut gov.global_balances, to, amount);
        };
    }

    /// デモ用（改善版）：誰でも自分のGPSトークンを同期（Mint）可能
    /// ※PoCのため、数量(amount)はクライアント側の申告を信頼する設定
    public entry fun sync_gps_token(
        gov: &mut GlobalGovState,
        amount: u64,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        if (table::contains(&gov.global_balances, sender)) {
            let cur = table::remove(&mut gov.global_balances, sender);
            table::add(&mut gov.global_balances, sender, cur + amount);
        } else {
            table::add(&mut gov.global_balances, sender, amount);
        };
    }
}
