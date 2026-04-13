# Tournament MVP

React + TypeScript + Vite で作成した大会・イベント用トーナメント管理 Web アプリです。

## セットアップ

```bash
npm install
```

`.env.local`

```bash
VITE_STORAGE_MODE=local
VITE_SUPABASE_URL=YOUR_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

`VITE_SUPABASE_PUBLISHABLE_KEY` を優先して使い、未設定なら `VITE_SUPABASE_ANON_KEY` を使います。

起動:

```bash
npm run dev
```

## 参加導線

- 通常参加: `/join/:shareToken`
  名前を入力して参加し、空き枠へランダム割当します。
- 招待参加: `/invite/:inviteToken`
  主催者が事前登録した参加者が専用URLから参加します。固定ブロック・固定シードも設定できます。

## 対戦ルール

- 全ラウンド: 多人数同時対戦のブロック進行
- 各ブロックから指定人数が次ラウンドへ進出します
- 進出人数が減らなくなる場合は、最後に 1 ブロックの最終ステージを自動生成します
- `participantsPerBlock=2` にすると、各ブロックが実質 1対1 として使えます

## 保存層

- `VITE_STORAGE_MODE=local`: localStorage
- `VITE_STORAGE_MODE=supabase`: Supabase
- repository interface は共通なので差し替え可能です

## Supabase

- 使用テーブル: `events`, `participants`, `event_invites`, `matches`
- SQL 例: [docs/supabase-schema.sql](docs/supabase-schema.sql)
- `participants`, `matches`, `event_invites` は realtime で再取得されます

## 補足

- MVP として閲覧は全員可能です
- 通常参加は全員可能です
- 招待参加は専用URLベースです
- 試合更新は現状 MVP のため広めに許可しています
- 将来は `events.host_auth_user_id` と Supabase Auth を使って host 限定更新へ寄せられます
