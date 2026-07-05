// スニーカーダンク(snkrdunk)で相場と定価を取得する（素のfetch、CI/ローカル両対応）。
// - 検索結果はSSRで <a aria-label="商品名 - ¥9,899" href="…/apparels/806644"> 形式
// - 商品ページの埋め込みJSONに `"定価","value":"¥6,000"` がある
// 駿河屋はCloudflareがGitHub(データセンター)IPを403で弾くため、CIではこちらが主戦力。
import * as cheerio from 'cheerio';
import { fetchHtml } from '../util/http.js';
import { searchKeyword } from '../util/text.js';
import { log } from '../util/log.js';

const cache = new Map(); // キーワード→結果

// 汎用語を除いた最も特徴的な語（surugaya.jsと同じ方針）
function distinctiveToken(kw) {
  const GENERIC = /^(MEGA|BOX|30th|ex|拡張パック|強化拡張パック|スペシャルカードセット|カードセット|プレミアムデッキセット|スターターセット|セット|デッキ|各種)$/i;
  const words = kw.split(/\s+/).filter(Boolean);
  return words.filter((w) => !GENERIC.test(w)).sort((a, b) => b.length - a.length)[0] || words[0];
}

/**
 * @returns {Promise<null | {marketYen:number|null, listYen:number|null, matchedTitle:string, url:string, confident:boolean}>}
 */
export async function lookupSnkrdunk(product) {
  const kw = searchKeyword(product);
  if (!kw) return null;
  if (cache.has(kw)) return cache.get(kw);

  let result = null;
  try {
    const url = `https://snkrdunk.com/search?keyword=${encodeURIComponent(kw)}`;
    const html = await fetchHtml(url, { timeout: 20000, retries: 1 });
    const $ = cheerio.load(html);

    // aria-label="商品名 - ¥9,899" のタイルを収集
    const tiles = [];
    $('a[aria-label]').each((_, a) => {
      const label = $(a).attr('aria-label') || '';
      const href = $(a).attr('href') || '';
      const m = label.match(/^(.*?)\s*-\s*[¥￥]([\d,]+)$/);
      if (!m || !href) return;
      tiles.push({
        title: m[1].trim(),
        priceYen: Number(m[2].replace(/,/g, '')),
        url: href.startsWith('http') ? href : `https://snkrdunk.com${href}`,
      });
    });

    const token = distinctiveToken(kw);
    const matching = tiles.filter((t) => t.title.includes(token));
    // BOX優先（シングルカードやサプライを避ける）、無ければトークン一致の先頭
    const hit =
      matching.find((t) => /ボックス|BOX/i.test(t.title)) || matching[0] || null;

    if (hit) {
      // 商品ページから定価を取得（埋め込みJSON: "定価","value":"¥6,000"）
      let listYen = null;
      try {
        const detail = await fetchHtml(hit.url, { timeout: 20000, retries: 1 });
        const dm = detail.match(/定価[\\"]*\s*,\s*[\\"]*value[\\"]*\s*:\s*[\\"]*[¥￥]([\d,]+)/);
        if (dm) listYen = Number(dm[1].replace(/,/g, ''));
      } catch (e) {
        log.warn(`スニダン商品ページ取得失敗 (${kw}): ${e.message}`);
      }
      result = {
        marketYen: hit.priceYen,
        listYen,
        matchedTitle: hit.title,
        url: hit.url,
        confident: hit.title.includes(token) && /ボックス|BOX/i.test(hit.title),
      };
    } else if (tiles.length) {
      log.warn(`スニダン: "${kw}" に一致するタイルなし（${tiles.length}件中）`);
    }
  } catch (err) {
    log.warn(`スニダン検索失敗 (${kw}): ${err.message}`);
  }

  cache.set(kw, result);
  return result;
}
