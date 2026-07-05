// テキスト整形・金額抽出・商品名処理のヘルパー。
import crypto from 'node:crypto';

/** 連続空白をまとめてトリム。 */
export function tidy(s) {
  return String(s || '')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "￥9,980" や "9980円" から数値 9980 を取り出す。取れなければ null。 */
export function parseYen(s) {
  if (!s) return null;
  const m = String(s).match(/[￥¥]?\s*([\d,]{2,})\s*円?/);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

/**
 * 「対象商品」文字列を個々の商品名に分割する。
 * 例: "ポケモンカード MEGAドリームexポケモンカード インフェルノX" → 2件
 */
export function splitProducts(raw) {
  const s = tidy(raw);
  if (!s) return [];
  const parts = s
    .split(/(?=ポケモンカード)/)
    .map((p) => tidy(p))
    .filter(Boolean);
  return parts.length ? parts : [s];
}

/**
 * 相場検索用のキーワード。商品名から総称・記号を落として要点を残す。
 * 例: "ポケモンカード アビスアイ" → "アビスアイ"
 */
export function searchKeyword(product) {
  return (
    tidy(product)
      .replace(/ポケモンカード(ゲーム)?/g, ' ')
      .replace(/各種.*$/, ' ')
      .replace(/（.*?）|\(.*?\)/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || tidy(product)
  );
}

/** 文字列から安定した16進ハッシュを作る（カレンダーIDやstateキーに使用）。 */
export function sha1(s) {
  return crypto.createHash('sha1').update(String(s), 'utf8').digest('hex');
}

/** 円を "¥1,234" 形式に。 */
export function yen(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  return '¥' + Math.round(n).toLocaleString('en-US');
}

/**
 * ソース非依存の抽選キー（複数まとめサイト間の重複排除用）。
 * 店舗名から「(N回目)/各店/通販/店/オンライン」等の表記揺れを除去し、商品の
 * 先頭語で正規化する。異なるサイトの同一抽選（＝同じ店×同じ商品）が同じキーになる。
 * 日付はソース間でズレやすいのでキーに含めない（＝同店同商品の再抽選は1件に統合）。
 */
export function lotteryKey(store, product) {
  const s = tidy(store)
    .replace(/[（(][^）)]*[)）]/g, '') // (5回目) など
    .replace(/各店|店舗|オンラインショップ|オンライン|eショップ|ネットショッピング|通販|支店|本店|店/g, '')
    .replace(/\s/g, '')
    .toLowerCase();
  const p = (searchKeyword(product).split(/\s+/)[0] || tidy(product)).toLowerCase();
  return `${s}|${p}`;
}

/** 応募リンクがまとめサイト内部リンクでなく実際の外部応募先か。 */
export function isExternalApply(url) {
  return !!url && /^https?:/.test(url) && !/nyuka-now\.com|gamepedia\.jp/.test(url);
}
