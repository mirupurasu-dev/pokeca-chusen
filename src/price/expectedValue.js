// 期待値（期待利益）を各抽選に付与する。
//   期待利益 = 相場(中古販売) − 定価
//   ROI     = 期待利益 / 定価
// 相場・定価は駿河屋から取得。定価は抽選ソース側にあればそちらを優先。
import { config } from '../config.js';
import { lookupSurugaya } from './surugaya.js';
import { log } from '../util/log.js';

export async function attachExpectedValue(lotteries) {
  if (!config.price.enabled) return lotteries;
  log.info(`相場を取得して期待値を計算 (${lotteries.length}件)…`);

  for (const lot of lotteries) {
    try {
      const q = await lookupSurugaya(lot.title);
      if (!q || q.marketYen == null) {
        // 相場が見つからない＝未発売/新商品の可能性（発売済みなら通常ヒットする）
        lot.ev = null;
        lot.marketMissing = true;
        continue;
      }
      const listYen = lot.priceYen ?? q.listYen ?? null;
      const market = q.marketYen;
      const profit = listYen != null ? market - listYen : null;
      lot.market = {
        yen: market,
        listYen,
        source: '駿河屋',
        matchedTitle: q.matchedTitle,
        url: q.url,
        confident: q.confident,
      };
      lot.ev =
        profit == null
          ? null
          : {
              profitYen: profit,
              roiPct: listYen ? Math.round((profit / listYen) * 100) : null,
            };
    } catch (err) {
      log.warn(`期待値計算失敗 (${lot.title}): ${err.message}`);
      lot.ev = null;
    }
  }
  return lotteries;
}
