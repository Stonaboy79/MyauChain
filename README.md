GitHubからのタウンロードと実行手順まとめ

GitHub上の最新コードには、スマートコントラクト（backend/stay_mock と backend/dao_poc）と、フロントエンド（frontend）のすべてが含まれています。

以下の手順で、ゼロから構築・実行およびコントラクトのパブリッシュ（デプロイ）が可能です。

1. 準備 (Prerequisites)
以下のツールがインストールされているか確認してください。

Git: コードのダウンロード用
Node.js (v18以上推奨): フロントエンド実行用
Sui CLI: スマートコントラクトのデプロイ用（Sui WalletのアドレスにGASが必要です）
2. ダウンロード (Clone)
ターミナルを開き、任意のフォルダで以下を実行します。

bash
git clone https://github.com/Stonaboy79/MyauChain.git
cd MyauChain/20251213-master/20251213-master
3. スマートコントラクトのパブリッシュ (Publish)
2つのパッケージ (stay_mock と dao_poc) をデプロイし、生成されたIDをフロントエンドに設定します。

① stay_mock (GPSトークン・チェックイン機能)
bash
cd backend/stay_mock
sui client publish --gas-budget 500000000 --json
出力結果の確認:

packageId をメモしてください (例: 0x...A)。
これが STAY_PACKAGE_ID になります。
② dao_poc (DAO機能)
bash
cd ../dao_poc
sui client publish --gas-budget 500000000 --json
出力結果の確認:

packageId をメモしてください (例: 0x...B)。
objectChanges の中から以下の type を持つオブジェクトIDを探してメモしてください。
GlobalGovState (ID: 例 0x...C)
RegionDaoState (ID: 例 0x...D)
AdminCap (ID: 例 0x...E) ※今回は設定に使わない場合がありますが、管理用として重要です。
4. フロントエンドの設定更新
取得したIDを使って、フロントエンドのコードを更新します。

ファイル 1: 
frontend/src/StayFeature.tsx

23行目付近の const PACKAGE_ID を、上記①の STAY_PACKAGE_ID に書き換えます。
ファイル 2: 
frontend/src/dao/daoConfig.tsx

stayPkgId: ①の STAY_PACKAGE_ID
govPkgId: ②の dao_poc パッケージID (0x...B)
platformPkgId: ②の dao_poc パッケージID (0x...B) ※通常は同じ
globalGovStateId: ②で取得した GlobalGovState オブジェクトID (0x...C)
regionDaoStateId: ②で取得した RegionDaoState オブジェクトID (0x...D)
※上記書き換えを行わない場合、以前デプロイされた古いID（devnetに残っていれば）に接続されますが、最新機能を使うにはご自身での再デプロイを推奨します。

5. フロントエンドの起動
設定が終わったら、アプリを起動します。

bash
cd ../../frontend
npm install
npm run dev
ブラウザで http://localhost:5173 (または表示されたURL) にアクセスすれば完了です！
