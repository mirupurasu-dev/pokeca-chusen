// 全スクレイパーを実行して抽選一覧をまとめる。
// ソースを増やす場合はここに追加。id はソース非依存の正規化キーなので、
// 複数まとめが同じ抽選を拾っても重複排除＆情報マージされる。
import { scrapeNyukaNow } from './nyukaNow.js';
import { scrapeGamepedia } from './gamepedia.js';
import { isExternalApply } from '../util/text.js';
import { log } from '../util/log.js';

const SCRAPERS = [scrapeNyukaNow, scrapeGamepedia];

/** 重複時に情報を補完マージする（欠けている値を埋め、応募リンクは外部URL優先）。 */
function merge(base, extra) {
  if (isExternalApply(extra.url) && !isExternalApply(base.url)) base.url = extra.url;
  else base.url = base.url || extra.url;
  base.applyStart = base.applyStart || extra.applyStart;
  base.applyEnd = base.applyEnd || extra.applyEnd;
  base.resultText = base.resultText || extra.resultText;
  base.conditions = base.conditions || extra.conditions;
  base.format = base.format || extra.format;
  const sources = new Set(String(base.source).split('/').concat(extra.source));
  base.source = [...sources].join('/');
  return base;
}

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

  // id で重複排除＋マージ
  const byId = new Map();
  for (const item of all) {
    const ex = byId.get(item.id);
    if (ex) merge(ex, item);
    else byId.set(item.id, item);
  }

  // 締切(なければ開始)が過去(24時間より前)のエントリは除外
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
