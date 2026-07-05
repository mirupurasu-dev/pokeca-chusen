// ntfy.sh へ通知。ntfyアプリでトピックを購読すればスマホにプッシュが届く。
// アカウント不要。UTF-8タイトルのため JSON パブリッシュ形式を使う。
import { title, evBadge, detailLines } from '../format.js';
import { log } from '../util/log.js';

export async function sendNtfy(server, topic, items) {
  for (const it of items) {
    const lot = it.lottery;
    const badge = evBadge(lot);
    const payload = {
      topic,
      title: `${it.kind === 'new' ? '🆕' : '🔄'} ${title(lot)}`,
      message: [badge, ...detailLines(lot)].filter(Boolean).join('\n'),
      tags: ['game_die'],
      priority: lot.ev?.profitYen > 0 ? 4 : 3,
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
