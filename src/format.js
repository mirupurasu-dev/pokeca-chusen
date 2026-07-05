// 抽選エントリを人間向けテキストに整形する（通知・カレンダー・dry-run共用）。
import { fmtJst } from './util/dates.js';
import { yen } from './util/text.js';

/** 期待利益のバッジ文字列。データが無ければ空。 */
export function evBadge(lot) {
  if (!lot.ev || lot.ev.profitYen == null) return '';
  const p = lot.ev.profitYen;
  const sign = p >= 0 ? '+' : '−';
  const roi = lot.ev.roiPct != null ? ` / ROI ${lot.ev.roiPct}%` : '';
  return `期待利益 ${sign}${yen(Math.abs(p))}${roi}`;
}

export function title(lot) {
  return `${lot.store}：${lot.title}`;
}

/** カレンダーやDiscordの本文に使う詳細行。 */
export function detailLines(lot) {
  const lines = [];
  if (lot.applyStart) lines.push(`🟢 開始: ${fmtJst(lot.applyStart)}`);
  if (lot.applyEnd) lines.push(`⏰ 締切: ${fmtJst(lot.applyEnd)}`);
  if (lot.resultText) lines.push(`🎯 当落発表: ${lot.resultText}`);
  if (lot.format) lines.push(`📋 形式: ${lot.format}`);
  if (lot.market?.yen != null) {
    const list = lot.market.listYen != null ? ` / 定価 ${yen(lot.market.listYen)}` : '';
    const conf = lot.market.confident ? '' : '（参考・要確認）';
    lines.push(`💴 相場 ${yen(lot.market.yen)}${list} 〔駿河屋${conf}〕`);
  } else if (lot.marketMissing) {
    lines.push('🆕 相場未確立（新商品・未発売の可能性）');
  }
  if (!lot.applyStart && !lot.applyEnd) lines.push('📆 日程未定（確定したら再通知）');
  const ev = evBadge(lot);
  if (ev) lines.push(`📈 ${ev}`);
  if (lot.conditions) lines.push(`📝 条件: ${lot.conditions}`);
  if (lot.url) lines.push(`🔗 応募/販売: ${lot.url}`);
  return lines;
}

/** dry-run のコンソール表示用の1エントリ。 */
export function consoleBlock(lot, tag = '') {
  const head = `${tag}${title(lot)}`;
  return [head, ...detailLines(lot).map((l) => '   ' + l)].join('\n');
}
