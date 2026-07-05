// 全スクレイパーを実行して抽選一覧をまとめる。
// 将来ソースを増やす場合はここに追加し、id で重複排除する。
import { scrapeNyukaNow } from './nyukaNow.js';
import { log } from '../util/log.js';

const SCRAPERS = [scrapeNyukaNow];

export async function scrapeAll(now = new Date()) {
  const all = [];
  for (const run of SCRAPERS) {
    try {
      const items = await run(now);
      all.push(...items);
    } catch (err) {
      log.error(`スクレイパー失敗: ${err.message}`);
    }
  }
  // id で重複排除（複数ソースが同じ抽選を拾った場合）
  const byId = new Map();
  for (const item of all) {
    if (!byId.has(item.id)) byId.set(item.id, item);
  }
  // 締切(なければ開始)が過去(24時間より前)のエントリは除外する
  const cutoff = now.getTime() - 24 * 60 * 60 * 1000;
  const active = [...byId.values()].filter((x) => {
    const anchor = (x.applyEnd || x.applyStart)?.getTime();
    return anchor != null && anchor >= cutoff;
  });
  // 締切(なければ開始)の昇順に並べる
  active.sort((a, b) => {
    const da = (a.applyEnd || a.applyStart)?.getTime() ?? Infinity;
    const db = (b.applyEnd || b.applyStart)?.getTime() ?? Infinity;
    return da - db;
  });
  return active;
}
