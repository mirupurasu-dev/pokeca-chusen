// Discord Webhook へ通知（埋め込み）。スマホのDiscordアプリにプッシュが届く。
import { title, detailLines, evBadge } from '../format.js';
import { log } from '../util/log.js';

function toEmbed({ kind, lottery }) {
  const isNew = kind === 'new';
  const profit = lottery.ev?.profitYen;
  // 期待利益がプラスなら緑、マイナスなら赤、不明なら青
  const color = profit == null ? 0x3b82f6 : profit >= 0 ? 0x22c55e : 0xef4444;
  return {
    title: `${isNew ? '🆕' : '🔄'} ${title(lottery)}`,
    description: detailLines(lottery).join('\n'),
    url: lottery.url || undefined,
    color,
    footer: { text: `${lottery.source}${evBadge(lottery) ? ' ・ ' + evBadge(lottery) : ''}` },
  };
}

export async function sendDiscord(webhook, items) {
  // Discordは1メッセージ最大10 embed
  for (let i = 0; i < items.length; i += 10) {
    const embeds = items.slice(i, i + 10).map(toEmbed);
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'ポケカ抽選ボット', embeds }),
    });
    if (!res.ok) {
      log.error(`Discord送信失敗 ${res.status}: ${await res.text().catch(() => '')}`);
    }
    // レート制限を避けて少し待つ
    if (i + 10 < items.length) await new Promise((r) => setTimeout(r, 1000));
  }
}
