// iCalendar (.ics) フィードを生成する。GitHub Pages で配信し、
// GoogleカレンダーやiPhoneの「URLで追加(購読)」に登録すると全抽選が自動反映される。
// サービスアカウント不要のカレンダー連携。期待値の有無に関係なく全件載せる。
//
// 予定の基準日時は eventAnchor に従う:
//   締切あり→締切 / 締切なし・開始が未来→開始 / 進行中・日程未定→予定にしない
//   （日程未定の新商品は日付確定後の実行で自動的に予定化される）
import { eventAnchor } from '../util/dates.js';
import { title, detailLines, evBadge } from '../format.js';

function esc(s) {
  return String(s || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

// 20260705T120000Z 形式
function dt(d) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

// RFC5545 の行折り（長い行は CRLF+空白 で継続）
function fold(line) {
  const out = [];
  let s = line;
  while (s.length > 72) {
    out.push(s.slice(0, 72));
    s = ' ' + s.slice(72);
  }
  out.push(s);
  return out;
}

export function renderIcs(lotteries, generatedAt = new Date()) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//pokeca-chusen//lottery feed//JP',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:ポケカ抽選',
    'X-WR-TIMEZONE:Asia/Tokyo',
  ];

  for (const lot of lotteries) {
    const a = eventAnchor(lot, generatedAt);
    if (!a) continue;
    const end = new Date(a.when.getTime() + 60 * 60000);
    const badge = evBadge(lot);
    const kindLabel = a.kind === 'end' ? '締切' : '応募開始';
    const summary = `🎴${kindLabel} ${title(lot)}${badge ? ` [${badge}]` : ''}`;

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${lot.id.replace(/[^a-z0-9]/gi, '')}@pokeca-chusen`);
    lines.push(`DTSTAMP:${dt(generatedAt)}`);
    lines.push(`DTSTART:${dt(a.when)}`);
    lines.push(`DTEND:${dt(end)}`);
    lines.push(...fold(`SUMMARY:${esc(summary)}`));
    lines.push(...fold(`DESCRIPTION:${esc(detailLines(lot).join('\n'))}`));
    if (lot.url && /^https?:\/\//.test(lot.url)) {
      lines.push(...fold(`URL:${esc(lot.url)}`));
    }
    // 1時間前アラーム（Apple系で有効。Google購読カレンダーはアラーム非対応）
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-PT1H');
    lines.push(...fold(`DESCRIPTION:${esc(`${kindLabel}1時間前: ${title(lot)}`)}`));
    lines.push('END:VALARM');
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
