module resident_nft::token_management {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::event;

    /// トークン管理のためのシングルトンオブジェクト。
    /// このオブジェクトはパッケージにパブリックに共有され、
    /// 全ユーザーのトークン残高を格納するテーブルへのIDを持つ。
    public struct TokenManager has key {
        id: UID,
        // ここにユーザーID(address)とTokenBalanceをマッピングする構造を保持できますが、
        // 簡潔にするため、ここでは直接ユーザー残高リソースに転送するモデルを採用します。
    }

    /// ユーザー一人ひとりが所有する、獲得トークン残高を記録するリソース。
    /// これがフロントエンドで「ウォレット残高」として表示されます。
    public struct TokenBalance has key, store {
        id: UID,
        owner: address,
        balance: u64, // 獲得トークンの総量
    }

    /// トークン残高が更新されたことを示すイベント
    public struct BalanceUpdatedEvent has copy, drop {
        user: address,
        reward_amount: u64, // 今回の計測で獲得した量
        new_total: u64,     // 更新後の合計残高
    }

    // =========================================================
    // 初期化関数
    // =========================================================

    /// パッケージ発行時に一度だけ実行される初期化関数
    fun init(ctx: &mut TxContext) {
        // TokenManager オブジェクトを作成し、共有オブジェクトとして公開
        transfer::share_object(TokenManager {
            id: object::new(ctx),
        });
    }

    // =========================================================
    // トークン記録エントリー関数
    // =========================================================

    /// 計測完了時にフロントエンドから呼び出されるエントリー関数。
    /// ユーザーのTokenBalanceオブジェクトを検索し、報酬を加算します。
    public entry fun complete_stay_measurement(
        user_balance: &mut TokenBalance, // ユーザーのTokenBalanceオブジェクト（可変参照）
        reward_amount: u64,             // フロントエンドで計算された報酬額
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        
        // 必須チェック: トランザクションの送信者が、渡されたTokenBalanceオブジェクトの所有者であることを確認
        // Moveの所有権システムにより、このチェックは不要または簡略化されますが、念のため
        assert!(user_balance.owner == sender, 0); 
        
        // 1. 残高の更新
        user_balance.balance = user_balance.balance + reward_amount;

        // 2. イベントの発行
        event::emit(BalanceUpdatedEvent {
            user: sender,
            reward_amount: reward_amount,
            new_total: user_balance.balance,
        });

        // 3. (オプション) 報酬が記録されたことを通知するログ
        // sui::debug::print<u64>(&user_balance.balance); 
    }
    
    // =========================================================
    // 初期残高発行関数
    // =========================================================

    /// 新規ユーザーが初めてトークン残高オブジェクトを受け取るための関数。
    /// この関数は、新規ユーザーが一度だけ呼び出すか、 resident_nft::stay_feature から呼び出されます。
    public entry fun mint_initial_balance(
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        
        // 初期残高 0 の TokenBalance オブジェクトを作成し、送信者へ転送
        let balance_object = TokenBalance {
            id: object::new(ctx),
            owner: sender,
            balance: 0, 
        };
        
        transfer::public_transfer(balance_object, sender);
    }
}
