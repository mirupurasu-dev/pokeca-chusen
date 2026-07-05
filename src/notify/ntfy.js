// ntfy.sh へ通知。ntfyアプリでトピックを購読すればスマホにプッシュが届く。
// アカウント不要。UTF-8タイトルのため JSON パブリッシュ形式を使う。
import { title, evBadge, detailLines, isHot } from '../format.js';
import { yen } from '../util/text.js';
import { log } from '../util/log.js';

function ntfyTitle(it) {
  const lot = it.lottery;
  const hot = isHot(lot);
  const profit = lot.ev?.profitYen;
  const money = hot && profit != null ? ` [+${yen(profit).replace('¥', '¥')}]` : '';
  if (it.kind === 'remind') return `⏰🔥 締切あと約${Math.max(1, Math.round(it.hoursLeft))}時間${money}: ${title(lot)}`;
  if (it.kind === 'stock') return `📦${hot ? '🔥' : ''} 入荷速報${money}: ${title(lot)}`;
  return `${hot ? '🔥 買い推奨' : it.kind === 'new' ? '🆕' : '🔄'}${money}: ${title(lot)}`;
}

export async function sendNtfy(server, topic, items) {
  for (const it of items) {
    const lot = it.lottery;
    const badge = evBadge(lot);
    const hot = isHot(lot);
    const payload = {
      topic,
      title: ntfyTitle(it),
      message: [badge, ...detailLines(lot)].filter(Boolean).join('\n'),
      tags: [it.kind === 'remind' ? 'alarm_clock' : it.kind === 'stock' ? 'package' : hot ? 'fire' : 'game_die'],
      // 🔥買い推奨・リマインド・在庫は最優先(5=urgent)。他は期待利益プラスで高め。
      priority: hot || it.kind === 'stock' || it.kind === 'remind' ? 5 : lot.ev?.profitYen > 0 ? 4 : 3,
      click: lot.url || undefined,
    };
    const res = await fetch(server.replace(/\/$/, ''), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) log.error(`ntfy送信失敗 ${res.status}: ${await res.text().catch(() => '')}`);
    await new Promise((r) => setTimeout(r, 300));
  }
}
