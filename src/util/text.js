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
