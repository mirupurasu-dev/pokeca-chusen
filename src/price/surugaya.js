// 駿河屋で商品を検索し、中古相場・定価を取得する（素のfetch + cheerio、ブラウザ不要）。
// 期待値の「相場」は中古販売価格（無ければ新品）を用いる。
// 検索結果は div.item コンテナに入り、その中に .title と「中古：/定価：」テキストがある。
import * as cheerio from 'cheerio';
import { fetchHtml } from '../util/http.js';
import { searchKeyword } from '../util/text.js';
import { log } from '../util/log.js';

const cache = new Map(); // キーワード→結果（同一runでの再検索を避ける）

function yenFrom(re, text) {
  const m = text.match(re);
  return m ? Number(m[1].replace(/,/g, '')) : null;
}

/**
 * @returns {Promise<null | {marketYen:number|null, listYen:number|null, matchedTitle:string, url:string, confident:boolean}>}
 */
export async function lookupSurugaya(product) {
  const kw = searchKeyword(product);
  if (!kw) return null;
  if (cache.has(kw)) return cache.get(kw);

  // 照合用トークン: 汎用語(MEGA/拡張パック等)を除いた最長の語＝最も商品を特定する語。
  // 汎用語だけで照合すると別商品にconfident=trueが付く誤マッチが起きる。
  const GENERIC = /^(MEGA|BOX|30th|ex|拡張パック|強化拡張パック|スペシャルカードセット|カードセット|プレミアムデッキセット|スターターセット|セット|デッキ|各種)$/i;
  const words = kw.split(/\s+/).filter(Boolean);
  const distinctive = words.filter((w) => !GENERIC.test(w)).sort((a, b) => b.length - a.length)[0];
  const token = distinctive || words[0];
  // クエリ候補：フル → 特徴語だけ（副題が長すぎて0件/404になる場合の保険）
  const queries = [...new Set([`${kw} BOX`, `${token} BOX`])];

  let result = null;
  try {
    let items = [];
    for (const q of queries) {
      const url = `https://www.suruga-ya.jp/search?search_word=${encodeURIComponent(q)}`;
      let html;
      try {
        html = await fetchHtml(url, { timeout: 20000, retries: 1 });
      } catch (e) {
        continue; // 404等は次の候補へ
      }
      const $ = cheerio.load(html);
      items = [];
      $('div.item').each((_, el) => {
        const box = $(el);
        const a = box.find('a[href*="/product/detail/"]').first();
        const href = a.attr('href');
        const t = (box.find('.title').first().text() || a.text() || '').replace(/\s+/g, ' ').trim();
        if (!href || !t) return;
        const block = box.text().replace(/\s+/g, ' ');
        if (!/[￥¥]|円/.test(block)) return;
        items.push({
          title: t.slice(0, 120),
          href: href.startsWith('http') ? href : `https://www.suruga-ya.jp${href}`,
          block,
        });
      });
      if (items.length) break;
    }

    if (items.length) {
      const hit = items.find((it) => it.title.includes(token)) || items[0];
      const market =
        yenFrom(/中古[：:]\s*[￥¥]?\s*([\d,]+)/, hit.block) ??
        yenFrom(/新品[：:]\s*[￥¥]?\s*([\d,]+)/, hit.block);
      const list = yenFrom(/定価[：:]\s*[￥¥]?\s*([\d,]+)/, hit.block);
      result = {
        marketYen: market,
        listYen: list,
        matchedTitle: hit.title,
        url: hit.href,
        confident: hit.title.includes(token),
      };
    }
  } catch (err) {
    log.warn(`駿河屋検索失敗 (${kw}): ${err.message}`);
  }

  cache.set(kw, result);
  return result;
}
