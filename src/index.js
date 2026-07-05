// ポケカ抽選 自動化オーケストレーター。
//   収集(まとめ) → 期待値(相場-定価) → カレンダー登録 → スマホ通知 → 状態保存
//
// 使い方:
//   node src/index.js            … 本番実行（カレンダー登録＋通知＋状態保存）
//   node src/index.js --dry-run  … 収集と期待値だけ表示（書き込み・通知なし）
//   node src/index.js --no-price … 相場取得をスキップ（動作確認用）
import './env.js';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';
import { scrapeAll } from './scrapers/index.js';
import { attachExpectedValue } from './price/expectedValue.js';
import { upsertEvents } from './calendar/google.js';
import { notify } from './notify/index.js';
import { loadSeen, saveSeen, diff } from './state.js';
import { consoleBlock } from './format.js';
import { renderHtml } from './render.js';
import { log } from './util/log.js';

async function writeDashboard(lotteries, now) {
  const html = renderHtml(lotteries, now);
  await mkdir('public', { recursive: true });
  await writeFile(path.join('public', 'index.html'), html, 'utf8');
  log.info(`ダッシュボードを生成: public/index.html (${lotteries.length}件)`);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  if (args.includes('--no-price')) config.price.enabled = false;

  const now = new Date();
  let lotteries = await scrapeAll(now);
  if (!lotteries.length) {
    log.warn('抽選が1件も取得できませんでした（サイト構造変更の可能性）');
    return;
  }
  await attachExpectedValue(lotteries);
  await writeDashboard(lotteries, now);

  if (dryRun) {
    const seen = await loadSeen();
    console.log(`\n================ 抽選 ${lotteries.length}件 (締切順) ================\n`);
    for (const lot of lotteries) {
      const tag = !(lot.id in seen) ? '🆕 ' : '既知 ';
      console.log(consoleBlock(lot, tag) + '\n');
    }
    const withEv = lotteries.filter((l) => l.ev?.profitYen != null);
    if (withEv.length) {
      withEv.sort((a, b) => b.ev.profitYen - a.ev.profitYen);
      console.log('---- 期待利益トップ ----');
      for (const l of withEv.slice(0, 5)) {
        console.log(`  ${l.ev.profitYen >= 0 ? '+' : '−'}¥${Math.abs(l.ev.profitYen).toLocaleString()} (ROI ${l.ev.roiPct}%)  ${l.store}：${l.title}`);
      }
    }
    console.log('\n(dry-run: カレンダー登録・通知・状態保存は行っていません)');
    return;
  }

  // 本番: カレンダーへupsert（全件・冪等）
  await upsertEvents(lotteries);

  // 新規/更新だけ通知
  const seen = await loadSeen();
  const { toNotify, nextSeen } = diff(lotteries, seen);
  log.info(`新規/更新: ${toNotify.length}件`);
  await notify(toNotify);
  await saveSeen(nextSeen);
}

main().catch((e) => {
  log.error(e.stack || e.message);
  process.exitCode = 1;
});
