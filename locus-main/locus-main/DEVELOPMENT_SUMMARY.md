# Locus 開発サマリー & 統合ガイド

このドキュメントは、Locusプロジェクトの現在の実装状況（主にzkLogin部分）と、他機能（GPS等）との統合、およびAIアシスタント（Gemini 3等）へのコンテキスト共有を目的としています。

## 1. プロジェクト現状 (Current Status)

- **担当範囲**: zkLogin認証基盤、基本UI、基本コントラクト構造。
- **ステータス**:
  - ✅ **zkLogin**: Googleアカウントを使用したログイン、Suiアドレスの導出、署名なしトランザクション（シミュレーション）および署名付きトランザクションの基盤実装完了。
  - ✅ **Frontend**: React + Vite + Tailwind CSS。Vercelへのデプロイ対応済み。
  - ✅ **Contract**: Sui Testnetにデプロイ済み。現在は場所を文字列（例: "Tokyo"）として受け取る仕様。
  - ✅ **構成**: `frontend/` と `contract/` に分離済み。

## 2. 統合ガイド (Integration Guide)

GPS機能担当者およびコントラクト拡張担当者向けの技術メモです。

### A. フロントエンド統合 (Frontend)

GPS機能（`navigator.geolocation` 等）は、`frontend/src/App.tsx` に組み込むのが最適です。

- **修正箇所**: `handleCheckIn` 関数
- **現状**:
  ```typescript
  // 現在の実装（固定値）
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::check_in`,
    arguments: [
      tx.pure.string("Tokyo"), // <--- ここをGPS座標データに置き換える
      tx.object(CLOCK_OBJECT_ID),
    ],
  });
  ```
- **統合案**:
  1. チェックインボタン押下時に `navigator.geolocation.getCurrentPosition` を呼び出す。
  2. 取得した `latitude`, `longitude` を適切な形式（文字列または整数）に変換する。
  3. `moveCall` の引数として渡す。

### B. コントラクト統合 (Contract)

現在、`contract/sources/locus.move` は場所を `String` で受け取っています。

- **修正案**:
  - 座標を扱う場合、`String` のまま "35.6895,139.6917" のように渡すか、
  - より厳密にやるなら引数を変更する: `check_in(lat: u64, lng: u64, ...)`
  - **注意**: 引数の型を変更した場合、一度パッケージを再公開（Publish）し、新しい `PACKAGE_ID` をフロントエンドに反映する必要があります。

## 3. AI共有用プロンプト (Context for AI)

Google AI StudioなどでGemini 3と対話する際、以下のテキストをプロンプトの冒頭に貼り付けると、現状のコンテキストを即座に共有できます。

---
**[Copy from here]**

現在のプロジェクト「Locus」の状況を共有します。私はzkLogin周りの実装を担当し、以下の状態まで完了しています。

**技術スタック:**
- **Frontend**: React, Vite, TypeScript, Tailwind CSS, @mysten/dapp-kit, @mysten/zklogin
- **Blockchain**: Sui Move (Testnet)
- **Deployment**: Vercel (Frontend)

**ディレクトリ構成:**
- `contract/`: Moveコントラクト (`sources/locus.move`, `Move.toml`)
- `frontend/`: Reactアプリ (`src/App.tsx`, `src/utils/zkLogin.ts`)

**実装済み機能:**
1. **zkLogin**: Google OAuth (OpenID Connect) を利用したログインフロー。JWTのパースとSaltを使用したSuiアドレス導出。
2. **UI**: ウォレット接続/切断、ログイン状態表示、チェックイン（モック）、提案送信フォーム。
3. **Contract**: 基本的な `check_in` (場所をStringで記録) と `create_proposal` 関数。

**次のステップ（相談したいこと）:**
- GPS機能（緯度経度）の実装担当者とのコード統合。
- コントラクト側での位置情報データの扱い（String vs u64等）の設計。
- Vercel環境変数 (`VITE_GOOGLE_CLIENT_ID`, `VITE_ZKLOGIN_SALT`) の管理。

このコンテキストを前提に、アドバイスをお願いします。

**[End of Copy]**
---
