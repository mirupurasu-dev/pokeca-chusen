// 日本語の日付文字列を Date(絶対時刻) に変換するユーティリティ。
// 例: "7月5日(日)10:00" / "2026年7月7日（火）" / "7/10"
//
// GitHub Actions は UTC で動くため、JSTの壁時計時刻を正しい絶対時刻に変換する。

function jstYearOf(date) {
  return Number(
    new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tokyo', year: 'numeric' }).format(date)
  );
}

/**
 * 日本語日付文字列を Date に変換する。解釈できなければ null。
 * 年が無い場合は「現在時刻に最も近い解釈」の年を選ぶ（前年/今年/翌年から最近接）。
 * 例: 7月に「4/20」→ 今年4/20(過去・進行中の開始日)、12月に「1/10」→ 翌年1/10。
 */
export function parseJpDateTime(input, now = new Date()) {
  if (!input) return null;
  const s = String(input).replace(/\s+/g, '');

  // "M月D日" 形式（年は任意）
  let m = s.match(/(?:(\d{4})年)?(\d{1,2})月(\d{1,2})日/);
  // "M/D" 形式のフォールバック
  if (!m) m = s.match(/(?:(\d{4})[/.])?(\d{1,2})[/.](\d{1,2})(?!\d)/);
  if (!m) return null;

  const mon = Number(m[2]);
  const day = Number(m[3]);
  if (mon < 1 || mon > 12 || day < 1 || day > 31) return null;

  const tm = s.match(/(\d{1,2}):(\d{2})/);
  const hh = tm ? Number(tm[1]) : 0;
  const mm = tm ? Number(tm[2]) : 0;

  // JSTの壁時計 → 絶対時刻(UTC基準)。JST = UTC+9。
  const make = (y) => new Date(Date.UTC(y, mon - 1, day, hh - 9, mm));

  if (m[1]) return make(Number(m[1]));

  // 前年・今年・翌年のうち現在時刻に最も近い解釈を採用。
  // 過去側に倒れるのは進行中の開始日（Amazon招待販売は2月開始のまま7月も受付中が実在）。
  // 過去側の締切は期限切れフィルタで除外されるため安全。
  const y = jstYearOf(now);
  let best = null;
  for (const yy of [y - 1, y, y + 1]) {
    const c = make(yy);
    if (!best || Math.abs(c.getTime() - now.getTime()) < Math.abs(best.getTime() - now.getTime())) {
      best = c;
    }
  }
  return best;
}

/**
 * カレンダーに載せる基準日時。締切があれば締切、無ければ「未来の開始日」。
 * 開始済みで締切不明（進行中の招待販売など）と日程未定は null（予定にしない）。
 * @returns {null | {when: Date, kind: 'end'|'start'}}
 */
export function eventAnchor(lot, now = new Date()) {
  if (lot.applyEnd) return { when: lot.applyEnd, kind: 'end' };
  if (lot.applyStart && lot.applyStart.getTime() > now.getTime()) {
    return { when: lot.applyStart, kind: 'start' };
  }
  return null;
}

/** 表示用に JST で整形（例: "7/5(日) 10:00"）。null は「未定」。 */
export function fmtJst(d) {
  if (!d) return '未定';
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const g = (t) => parts.find((p) => p.type === t)?.value ?? '';
  return `${g('month')}/${g('day')}(${g('weekday')}) ${g('hour')}:${g('minute')}`;
}

/** カレンダー用の ISO 文字列（絶対時刻）。 */
export function toIso(d) {
  return d.toISOString();
}
