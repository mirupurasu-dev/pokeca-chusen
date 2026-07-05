// 既知の抽選を data/seen.json に記録し、新規/更新を判定する。
// GitHub Actions では実行後に seen.json をコミットして状態を保持する。
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { sha1 } from './util/text.js';

const FILE = path.join('data', 'seen.json');
const STOCK_FILE = path.join('data', 'stock-seen.json');

/** 抽選の「内容」の指紋。締切・開始・当落・リンク・期待利益が変われば更新扱い。 */
export function signature(lot) {
  return sha1(
    JSON.stringify({
      s: lot.applyStart?.getTime() ?? null,
      e: lot.applyEnd?.getTime() ?? null,
      r: lot.resultText || '',
      u: lot.url || '',
      p: lot.ev?.profitYen ?? null,
    })
  );
}

export async function loadSeen() {
  try {
    return JSON.parse(await readFile(FILE, 'utf8'));
  } catch {
    return {};
  }
}

export async function saveSeen(map) {
  await mkdir('data', { recursive: true });
  await writeFile(FILE, JSON.stringify(map, null, 2), 'utf8');
}

/**
 * 新規・更新エントリを判定して返す。seenは書き換えず、呼び出し側で保存する。
 * @returns {{ toNotify: {kind:string, lottery:object}[], nextSeen: object }}
 */
export function diff(lotteries, seen) {
  const toNotify = [];
  const nextSeen = {};
  for (const lot of lotteries) {
    const sig = signature(lot);
    nextSeen[lot.id] = sig;
    if (!(lot.id in seen)) toNotify.push({ kind: 'new', lottery: lot });
    else if (seen[lot.id] !== sig) toNotify.push({ kind: 'update', lottery: lot });
  }
  return { toNotify, nextSeen };
}

// ── 在庫あり（入荷速報）の状態 ──
// 「今リストに載っている」だけ記録する。消えたら状態も消え、再入荷で再通知される。
export async function loadStockSeen() {
  try {
    return JSON.parse(await readFile(STOCK_FILE, 'utf8'));
  } catch {
    return {};
  }
}

export async function saveStockSeen(map) {
  await mkdir('data', { recursive: true });
  await writeFile(STOCK_FILE, JSON.stringify(map, null, 2), 'utf8');
}

// ── 🔥買い推奨の締切リマインド状態 ──
// {抽選id: ["24h","3h"]} 送信済みステージを記録。抽選が消えたら状態も消える。
const REMIND_FILE = path.join('data', 'remind-seen.json');

export async function loadRemindSeen() {
  try {
    return JSON.parse(await readFile(REMIND_FILE, 'utf8'));
  } catch {
    return {};
  }
}

export async function saveRemindSeen(map) {
  await mkdir('data', { recursive: true });
  await writeFile(REMIND_FILE, JSON.stringify(map, null, 2), 'utf8');
}

export function diffStock(items, seen) {
  const toNotify = [];
  const nextSeen = {};
  for (const it of items) {
    nextSeen[it.id] = 1;
    if (!(it.id in seen)) toNotify.push({ kind: 'stock', lottery: it });
  }
  return { toNotify, nextSeen };
}
