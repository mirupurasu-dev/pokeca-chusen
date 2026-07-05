// 既知の抽選を data/seen.json に記録し、新規/更新を判定する。
// GitHub Actions では実行後に seen.json をコミットして状態を保持する。
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { sha1 } from './util/text.js';

const FILE = path.join('data', 'seen.json');

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
