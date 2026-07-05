// Googleカレンダーへ抽選予定をupsertする。
// 認証: サービスアカウント（GOOGLE_SERVICE_ACCOUNT_JSON）。
//   対象カレンダーをサービスアカウントのメールアドレスに「予定の変更権限」で共有しておくこと。
// 冪等性: イベントIDを抽選IDのsha1(16進=a-f/0-9=有効なイベントID)にして insert、
//   既存(409)なら update する。締切（無ければ開始）にイベントを作る。
import { google } from 'googleapis';
import { config } from '../config.js';
import { sha1 } from '../util/text.js';
import { eventAnchor } from '../util/dates.js';
import { title, detailLines } from '../format.js';
import { log } from '../util/log.js';

function getCalendar() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON が未設定');
  const creds = JSON.parse(raw);
  const jwt = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });
  return google.calendar({ version: 'v3', auth: jwt });
}

function buildEvent(lot, when) {
  const end = new Date(when.getTime() + config.calendar.eventDurationMin * 60000);
  return {
    summary: `🎴 ${title(lot)}`,
    description: detailLines(lot).join('\n'),
    start: { dateTime: when.toISOString(), timeZone: 'Asia/Tokyo' },
    end: { dateTime: end.toISOString(), timeZone: 'Asia/Tokyo' },
    reminders: {
      useDefault: false,
      overrides: config.calendar.remindersMinutes.map((m) => ({ method: 'popup', minutes: m })),
    },
    source: lot.url ? { title: '応募/販売ページ', url: lot.url } : undefined,
  };
}

export async function upsertEvents(lotteries) {
  if (!config.calendar.enabled) {
    log.warn('カレンダー未設定のためスキップ（GOOGLE_CALENDAR_ID / GOOGLE_SERVICE_ACCOUNT_JSON）');
    return;
  }
  const cal = getCalendar();
  const calendarId = config.calendar.calendarId;
  let created = 0;
  let updated = 0;

  for (const lot of lotteries) {
    // 締切 or 未来の開始のみ予定化（進行中・日程未定はスキップ、確定後に自動登録）
    const anchor = eventAnchor(lot);
    if (!anchor) continue;
    const eventId = sha1(lot.id); // 16進 = 有効なGoogleイベントID
    const body = buildEvent(lot, anchor.when);
    try {
      await cal.events.insert({ calendarId, requestBody: { ...body, id: eventId } });
      created++;
    } catch (e) {
      const reason = e?.errors?.[0]?.reason || e?.code;
      if (e?.code === 409 || reason === 'duplicate') {
        try {
          await cal.events.update({ calendarId, eventId, requestBody: body });
          updated++;
        } catch (e2) {
          log.error(`カレンダー更新失敗 (${lot.title}): ${e2.message}`);
        }
      } else {
        log.error(`カレンダー登録失敗 (${lot.title}): ${e.message}`);
      }
    }
  }
  log.info(`カレンダー: 新規 ${created} 件 / 更新 ${updated} 件`);
}
