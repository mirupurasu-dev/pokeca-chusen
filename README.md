# ポケカ抽選オートメーション

ポケモンカードの**抽選スケジュールを自動収集**し、

- 📅 **Googleカレンダー**に応募締切を自動登録（締切前にスマホへリマインド）
- 📱 **スマホ通知**（Discord または ntfy）で新規・更新の抽選をお知らせ
- 📈 **期待値（相場−定価）**を自動算出して表示
- 🔗 **応募/販売リンク**を自動取得

を行います。**GitHub Actions で30分ごとに自動実行**されるので、PCを起動していなくても動きます。

---

## 仕組み

```
[入荷Now まとめ記事] --scrape--> 抽選一覧
                                   │
                        [駿河屋] 相場を取得 → 期待利益 = 相場 − 定価
                                   │
             ┌─────────────────────┼─────────────────────┐
             ▼                     ▼                     ▼
     Googleカレンダー登録     Discord/ntfy通知      seen.json に記録
     (締切にリマインド)      (新規・更新のみ)      (二重通知を防ぐ)
```

- **収集元**：`入荷Now` のポケカ抽選まとめ記事（ポケセン・晴れる屋・ヨドバシ・イオン・Amazon 等を集約）。ポケセン公式の抽選一覧はログイン必須のため、まとめ経由で拾います。
- **相場**：`駿河屋` の中古販売価格（＝二次流通の目安）と定価。BOX名で検索してトップ結果を採用。名前が一致しない場合は「参考・要確認」と表示します。

---

## セットアップ（初回だけ）

### 1. GitHubリポジトリを作る

1. GitHubで新規リポジトリを作成（**Private推奨**）。
2. この `pokeca-chusen/` フォルダの中身を push する。

```bash
cd pokeca-chusen
git init
git add .
git commit -m "init: ポケカ抽選オートメーション"
git branch -M main
git remote add origin https://github.com/<あなた>/<リポジトリ>.git
git push -u origin main
```

### 2. スマホ通知先を用意（どちらか片方でOK）

**方法A：ntfy（一番かんたん・アカウント不要）**
1. スマホに **ntfy** アプリをインストール（iOS/Android）。
2. アプリで「＋」→ 好きな**長めのトピック名**を購読（例 `pokeca-chusen-8f3a20`）。他人と被らない名前に。
3. そのトピック名を後で `NTFY_TOPIC` に設定。

**方法B：Discord**
1. Discordで自分用サーバーを作る（無料）。
2. 通知したいチャンネル → 歯車（編集）→ **連携サービス** → **ウェブフック** → 新しいウェブフック → **URLをコピー**。
3. そのURLを後で `DISCORD_WEBHOOK_URL` に設定。スマホのDiscordアプリでそのチャンネルの通知をON。

### 3. Googleカレンダー連携（サービスアカウント）

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成。
2. 「APIとサービス」→ **Google Calendar API** を有効化。
3. 「認証情報」→ **サービスアカウントを作成** → 作成後、そのアカウントの「鍵」→ **新しい鍵（JSON）** をダウンロード。
4. サービスアカウントのメールアドレス（`xxxxx@xxxxx.iam.gserviceaccount.com`）を控える。
5. [Googleカレンダー](https://calendar.google.com/) で新しいカレンダーを作成（例「ポケカ抽選」）。
6. そのカレンダーの **設定 → 特定のユーザーやグループとの共有** に、4のメールを追加し、権限を **「予定の変更権限」** にする。
7. 同じ設定画面の **「カレンダーの統合」→ カレンダーID** を控える（`GOOGLE_CALENDAR_ID` に使う）。

> スマホには普段使いのGoogleカレンダーアプリでこのカレンダーを表示すれば、締切のリマインド通知が届きます。

### 4. GitHub に Secrets を登録

リポジトリ → **Settings → Secrets and variables → Actions → New repository secret** で以下を登録：

| Secret名 | 値 |
|---|---|
| `GOOGLE_CALENDAR_ID` | 手順3-7のカレンダーID |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | 手順3-3のJSONファイルの**中身を全部**貼り付け |
| `DISCORD_WEBHOOK_URL` | （Discordを使うなら）ウェブフックURL |
| `NTFY_TOPIC` | （ntfyを使うなら）トピック名 |

※ カレンダー不要なら `GOOGLE_*` は省略可（通知だけ動きます）。通知不要ならカレンダーだけでもOK。

### 5. 動かす

- リポジトリの **Actions** タブでワークフローを有効化。
- 「ポケカ抽選チェック」→ **Run workflow** で手動実行してテスト。
- 以後は**30分ごとに自動実行**されます。

---

## ローカルで動作確認

```bash
npm install

# 収集と期待値の表示だけ（書き込み・通知なし）
node src/index.js --dry-run

# 本番と同じ動作（.env に各種キーを入れてから）
cp .env.example .env   # 値を編集
node src/index.js
```

> 収集は素の HTTP 取得（ブラウザ不要）です。`scripts/dump.js`（実DOM調査用）を使うときだけ `npx playwright install chromium` が必要です。

`--dry-run` は抽選一覧・期待値・「期待利益トップ5」を表示するだけで、カレンダー登録も通知もしません。まずはこれで中身を確認してください。

---

## 期待値について

- **期待利益 = 駿河屋の中古相場 − 定価**。ROI（％）も表示します。
- これは「当選して定価で買えたら、二次流通でいくら得か」の目安です。**当選確率は含めていません**（応募総数が非公開のため）。
- 商品名の自動マッチのため、たまに別商品の相場を拾うことがあります。その場合は `（参考・要確認）` と表示されるので、リンク先で確認してください。
- BOX以外（デッキ/セット）は相場が取れないことがあります。その場合は期待値なしで登録・通知します。

---

## カスタマイズ

- 実行間隔：`.github/workflows/chusen.yml` の `cron` を変更（例 `'*/15 * * * *'` で15分ごと）。
- リマインドのタイミング：`src/config.js` の `calendar.remindersMinutes`（分）。
- 対象セクション：`src/config.js` の `includeSection()`。
- 相場を止める：Secret/`.env` に `PRICE_ENABLED=false`。
- 収集元を増やす：`src/scrapers/` に scraper を追加し `src/scrapers/index.js` に登録（`id` で重複排除されます）。

---

## 注意事項

- スクレイピングは各サイトの構造に依存します。サイト改修で取得できなくなったら、`node scripts/dump.js` で実DOMを取得し、`src/scrapers/nyukaNow.js` のセレクタを調整してください。
- アクセスは常識的な頻度（30分毎）で、個人利用の範囲で行ってください。各サイトの利用規約を尊重してください。
- 抽選情報・相場は参考値です。応募可否・締切・価格は必ず**リンク先の公式情報**で最終確認してください。
```
