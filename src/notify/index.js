// 設定されている通知先すべてに送る（スマホに届けばOK）。
import { config } from '../config.js';
import { sendDiscord } from './discord.js';
import { sendNtfy } from './ntfy.js';
import { log } from '../util/log.js';

/** items: [{ kind:'new'|'update', lottery }] */
export async function notify(items) {
  if (!items.length) return;
  const { discordWebhook, ntfyTopic, ntfyServer } = config.notify;
  let sent = false;

  if (discordWebhook) {
    await sendDiscord(discordWebhook, items);
    sent = true;
  }
  if (ntfyTopic) {
    await sendNtfy(ntfyServer, ntfyTopic, items);
    sent = true;
  }
  if (!sent) {
    log.warn('通知先が未設定です（DISCORD_WEBHOOK_URL か NTFY_TOPIC を設定してください）');
  } else {
    log.info(`${items.length}件を通知しました`);
  }
}
