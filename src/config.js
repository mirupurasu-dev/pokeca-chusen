// 挙動の設定。環境変数で上書き可能なものは process.env を参照。
export const config = {
  // 抽選まとめの取得元（入荷Now のポケカまとめ記事）
  sources: {
    nyukaNow: {
      url: process.env.NYUKA_NOW_URL || 'https://nyuka-now.com/archives/2459',
    },
    gamepedia: {
      url: process.env.GAMEPEDIA_URL || 'https://premium.gamepedia.jp/pokeca/archives/124',
    },
  },

  // まとめページのどのセクション(h2)を対象にするか。
  // 受付中・近日開始・会員限定は対象、終了/過去/在庫あり(先着)は除外。
  includeSection(h2) {
    return /受付中|近日受付開始|会員限定/.test(h2) && !/終了|過去|在庫あり|先着/.test(h2);
  },

  // 🔥買い推奨（Hot）判定: どちらかを満たす案件は最優先通知＋UIランキング＋締切リマインド
  hot: {
    minProfitYen: Number(process.env.HOT_MIN_PROFIT || 3000),
    minRoiPct: Number(process.env.HOT_MIN_ROI || 50),
    // 締切リマインドの段階（残り時間がこの値を下回った実行回に1回通知）
    remindStagesHours: [24, 3],
  },

  // 相場取得（駿河屋）。期待値 = 相場(中古) − 定価。
  price: {
    enabled: process.env.PRICE_ENABLED !== 'false',
    minMarketYen: 0, // これ未満の相場はノイズとして無視
  },

  // Googleカレンダー（任意・API直書き方式）
  // ※設定する場合は必ず個人アカウント mirupurasu@gmail.com が所有するカレンダーのIDを使うこと。
  //   仕事用アカウント(o.tarumi@…)のカレンダーには絶対に書き込まない。
  calendar: {
    enabled: !!process.env.GOOGLE_CALENDAR_ID,
    calendarId: process.env.GOOGLE_CALENDAR_ID || '',
    // 応募締切の何分前にリマインド（スマホのカレンダー通知になる）
    remindersMinutes: [60, 60 * 24],
    eventDurationMin: 60,
  },

  // 通知（スマホに届けばOK。設定されている通知先すべてに送る）
  notify: {
    discordWebhook: process.env.DISCORD_WEBHOOK_URL || '',
    ntfyTopic: process.env.NTFY_TOPIC || '', // https://ntfy.sh/<topic> にPOST
    ntfyServer: process.env.NTFY_SERVER || 'https://ntfy.sh',
  },
};
