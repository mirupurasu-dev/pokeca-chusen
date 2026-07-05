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
import { scrapeNyukaStock } from './scrapers/nyukaNow.js';
import { attachExpectedValue, attachStockEv } from './price/expectedValue.js';
import { upsertEvents } from './calendar/google.js';
import { notify } from './notify/index.js';
import {
  loadSeen, saveSeen, diff,
  loadStockSeen, saveStockSeen, diffStock,
  loadRemindSeen, saveRemindSeen,
} from './state.js';
import { consoleBlock, isHot } from './format.js';
import { renderHtml } from './render.js';
import { renderIcs } from './calendar/ics.js';
import { log } from './util/log.js';

async function writeDashboard(lotteries, stock, now) {
  await mkdir('public', { recursive: true });
  await writeFile(path.join('public', 'index.html'), renderHtml(lotteries, stock, now), 'utf8');
  const ics = renderIcs(lotteries, now);
  await writeFile(path.join('public', 'calendar.ics'), ics, 'utf8');
  const events = (ics.match(/BEGIN:VEVENT/g) || []).length;
  log.info(
    `ダッシュボードを生成: public/index.html (抽選${lotteries.length}件+在庫${stock.length}件) / calendar.ics (${events}予定)`
  );
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
  let stock = [];
  try {
    stock = await scrapeNyukaStock();
  } catch (err) {
    log.error(`在庫スクレイプ失敗: ${err.message}`);
  }
  await attachExpectedValue(lotteries);
  await attachStockEv(stock);
  await writeDashboard(lotteries, stock, now);

  if (dryRun) {
    const seen = await loadSeen();
    if (stock.length) {
      console.log(`\n================ 📦 在庫あり ${stock.length}件 ================\n`);
      for (const it of stock) {
        const ev = it.ev ? `  期待利益 ${it.ev.profitYen >= 0 ? '+' : '−'}¥${Math.abs(it.ev.profitYen).toLocaleString()}` : '';
        console.log(`📦 ${it.store}：${it.desc.slice(0, 60)}${ev}\n   ${it.url || '(リンクなし)'}\n`);
      }
    }
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

  // 新規/更新の抽選＋新規入荷を通知
  const seen = await loadSeen();
  const { toNotify, nextSeen } = diff(lotteries, seen);
  const stockSeen = await loadStockSeen();
  const stockDiff = diffStock(stock, stockSeen);

  // 🔥買い推奨の締切リマインド（残り時間がステージを跨いだ実行回に1回だけ）
  const remindSeen = await loadRemindSeen();
  const nextRemind = {};
  const reminders = [];
  const newIds = new Set(toNotify.map((x) => x.lottery.id));
  for (const lot of lotteries) {
    if (!isHot(lot) || !lot.applyEnd) continue;
    const hoursLeft = (lot.applyEnd.getTime() - now.getTime()) / 3.6e6;
    if (hoursLeft <= 0) continue;
    const due = config.hot.remindStagesHours.filter((h) => hoursLeft <= h).map(String);
    const done = remindSeen[lot.id] || [];
    nextRemind[lot.id] = [...new Set([...done, ...due])];
    const fresh = due.filter((s) => !done.includes(s));
    // 同じ実行で🆕通知済みならリマインドは重ねない
    if (fresh.length && !newIds.has(lot.id)) {
      reminders.push({ kind: 'remind', lottery: lot, hoursLeft });
    }
  }

  log.info(
    `抽選 新規/更新: ${toNotify.length}件 / 入荷速報: ${stockDiff.toNotify.length}件 / 締切リマインド: ${reminders.length}件`
  );
  // 時間勝負順: 入荷 → 締切リマインド → 新規/更新
  await notify([...stockDiff.toNotify, ...reminders, ...toNotify]);
  await saveSeen(nextSeen);
  await saveStockSeen(stockDiff.nextSeen);
  await saveRemindSeen(nextRemind);
}

main().catch((e) => {
  log.error(e.stack || e.message);
  process.exitCode = 1;
});
