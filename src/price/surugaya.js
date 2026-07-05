// 駿河屋で商品を検索し、中古相場・定価を取得する。
// 期待値の「相場」は中古販売価格（無ければ新品）を用いる。
import { getContext } from '../util/browser.js';
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

  const query = `${kw} BOX`;
  const url = `https://www.suruga-ya.jp/search?search_word=${encodeURIComponent(query)}`;
  const ctx = await getContext();
  const page = await ctx.newPage();
  let result = null;
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 40000 });
    await page.waitForTimeout(1200);

    const items = await page.evaluate(() => {
      const anchors = [...document.querySelectorAll('a[href*="/product/detail/"]')];
      const seen = new Set();
      const out = [];
      for (const a of anchors) {
        const href = a.href;
        const title = (a.textContent || '').trim();
        if (!title || seen.has(href)) continue;
        let node = a;
        let block = '';
        for (let i = 0; i < 6 && node; i++) {
          node = node.parentElement;
          if (node && /[￥¥]|円/.test(node.textContent)) {
            block = node.textContent;
            break;
          }
        }
        seen.add(href);
        out.push({ title: title.slice(0, 120), href, block: block.replace(/\s+/g, ' ').slice(0, 500) });
        if (out.length >= 8) break;
      }
      return out;
    });

    if (items.length) {
      // キーワード（先頭トークン）を含む結果を優先。無ければ先頭。
      const token = kw.split(/\s+/)[0];
      const hit = items.find((it) => it.title.includes(token)) || items[0];
      const market = yenFrom(/中古[：:]\s*[￥¥]?\s*([\d,]+)/, hit.block) ??
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
  } finally {
    await page.close();
  }

  cache.set(kw, result);
  return result;
}
