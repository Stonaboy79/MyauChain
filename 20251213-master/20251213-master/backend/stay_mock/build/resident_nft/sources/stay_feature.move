module resident_nft::stay_feature {
    use sui::event;
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    /// ユーザーに配布される「滞在証明書」オブジェクト
    public struct StayProof has key, store {
        id: UID,
        lat: u64,
        lng: u64,
    }

    /// インデクサが検知するためのイベント
    public struct StayEvent has copy, drop {
        user: address,
        lat: u64,
        lng: u64,
    }

    /// フロントエンドから呼ばれる関数
    public entry fun stay(
        lat: u64,
        lng: u64,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);

        // 1. 証明書オブジェクトの作成
        let proof = StayProof {
            id: object::new(ctx),
            lat,
            lng,
        };

        // 2. イベントの発行
        event::emit(StayEvent {
            user: sender,
            lat,
            lng,
        });

        // 3. 実行者へオブジェクトを転送
        transfer::public_transfer(proof, sender);
    }
}

