// 期待値（期待利益）を各抽選に付与する。
//   期待利益 = 相場(中古販売) − 定価
//   ROI     = 期待利益 / 定価
// 相場・定価は駿河屋から取得。定価は抽選ソース側にあればそちらを優先。
import { config } from '../config.js';
import { lookupSurugaya } from './surugaya.js';
import { lookupSnkrdunk } from './snkrdunk.js';
import { log } from '../util/log.js';

/**
 * 相場ルックアップのフォールバックチェーン。
 * スニダンを第一（CI/ローカル両方で到達可）、駿河屋を第二
 * （駿河屋はCloudflareがデータセンターIPを403で弾くためCIでは失敗する）。
 * @returns {Promise<null | {marketYen, listYen, matchedTitle, url, confident, source}>}
 */
async function lookupMarket(product) {
  const s = await lookupSnkrdunk(product);
  if (s && s.marketYen != null) return { ...s, source: 'スニダン' };
  const g = await lookupSurugaya(product);
  if (g && g.marketYen != null) {
    // 定価はスニダンで取れていれば補完
    return { ...g, listYen: g.listYen ?? s?.listYen ?? null, source: '駿河屋' };
  }
  return null;
}

/**
 * 在庫あり商品に期待値を付ける。BOX商品だけ対象
 * （グミ・プロモ等の関連商品にBOX相場を当てると誤った巨額利益が出るため）。
 * 期待利益 = 相場 − 実際の販売価格。
 */
export async function attachStockEv(items) {
  if (!config.price.enabled) return items;
  // 食玩・グッズ類はカードBOXの相場と比較すると偽の巨額利益が出るので除外
  // （例: グミの「20個入りBOX」がBOX判定を通ってしまう）
  const NOT_CARD = /グミ|ウエハース|チョコ|キャンディ|ラムネ|スナック|食玩|シール|マグネット|ファイル|バインダー|スリーブ|デッキシールド|プレイマット|フィギュア|ぬいぐるみ/;
  for (const it of items) {
    try {
      if (it.priceYen == null || !/BOX|ボックス/i.test(it.desc)) continue;
      if (NOT_CARD.test(it.desc)) continue;
      const q = await lookupMarket(it.title);
      if (!q || !q.confident) continue; // 相場側の商品一致が確実な時だけ
      const profit = q.marketYen - it.priceYen;
      it.market = { yen: q.marketYen, listYen: it.priceYen, source: q.source, matchedTitle: q.matchedTitle, url: q.url, confident: q.confident };
      it.ev = { profitYen: profit, roiPct: it.priceYen ? Math.round((profit / it.priceYen) * 100) : null };
    } catch (err) {
      log.warn(`在庫EV計算失敗 (${it.title}): ${err.message}`);
    }
  }
  return items;
}

export async function attachExpectedValue(lotteries) {
  if (!config.price.enabled) return lotteries;
  log.info(`相場を取得して期待値を計算 (${lotteries.length}件)…`);

  for (const lot of lotteries) {
    try {
      const q = await lookupMarket(lot.title);
      if (!q) {
        // 相場が見つからない＝未発売/新商品の可能性（発売済みなら通常ヒットする）
        lot.ev = null;
        lot.marketMissing = true;
        continue;
      }
      const listYen = lot.priceYen ?? q.listYen ?? null;
      const market = q.marketYen;
      lot.market = {
        yen: market,
        listYen,
        source: q.source,
        matchedTitle: q.matchedTitle,
        url: q.url,
        confident: q.confident,
      };
      // 期待利益は「商品名の確信マッチ」時のみ算出する。
      // 曖昧マッチの定価/相場で計算すると誤った損益（別商品の定価¥891等）が出るため、
      // その場合は相場を参考表示するだけに留める。
      const profit = q.confident && listYen != null ? market - listYen : null;
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
