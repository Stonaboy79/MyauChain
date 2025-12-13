# Locus - 分散型位置証明

LocusはSuiネットワーク上に構築された分散型アプリケーション（dApp）で、ユーザーが特定の場所での存在を証明し、提案を送信できるようにします。

> **Note**
> このプロジェクトは **Antigravity** を使用し、**Gemini 3** によってコーディングされています。

## プロジェクト構成

- **`contract/`**: Moveスマートコントラクトが含まれています。
  - `sources/locus.move`: 位置チェックインと提案のためのメインモジュール。
- **`frontend/`**: スマートコントラクトと対話するためのReactアプリケーション。
  - Vite、React、TypeScript、Tailwind CSS、`@mysten/dapp-kit`で構築されています。

## 機能

- **zkLogin / Google ログイン**: Web2の認証情報（Googleアカウント）を使用して、Web3アプリにシームレスにログインできます。
- **ウォレット接続**: Sui Walletなどの標準的なウォレット接続に加え、切断（ログアウト）機能もサポート。
- **チェックイン**: オンチェーンで位置を証明します（現在はデモ用に「東京」に固定されています）。
- **提案の送信**: テキストベースの提案をブロックチェーンに送信します。
- **テストネットサポート**: Sui Testnetで動作するように構成されています。

## 始め方

### スマートコントラクト

1. Sui CLIをインストールします。
2. コントラクトディレクトリに移動: `cd contract`
3. テストネットに切り替え: `sui client switch --env testnet`
4. ビルドと公開: `sui client publish --gas-budget 100000000`

### フロントエンド

1. フロントエンドディレクトリに移動: `cd frontend`
2. 依存関係をインストール: `npm install`
3. 環境変数の設定: `.env` ファイルを作成し、`VITE_GOOGLE_CLIENT_ID` などを設定します。
4. 開発サーバーを起動: `npm run dev`

## ライセンス

MIT
