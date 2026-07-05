// 日本語の日付文字列を Date(絶対時刻) に変換するユーティリティ。
// 例: "7月5日(日)10:00" / "2026年7月7日（火）" / "7/10"
//
// GitHub Actions は UTC で動くため、JSTの壁時計時刻を正しい絶対時刻に変換する。

const MS_DAY = 24 * 60 * 60 * 1000;

function jstYearOf(date) {
  return Number(
    new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tokyo', year: 'numeric' }).format(date)
  );
}

/**
 * 日本語日付文字列を Date に変換する。解釈できなければ null。
 * 年が無い場合は「今日から60日以上過去にならない」ように年を推定する。
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

  const y = jstYearOf(now);
  let cand = make(y);
  if (cand.getTime() < now.getTime() - 60 * MS_DAY) cand = make(y + 1);
  return cand;
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
