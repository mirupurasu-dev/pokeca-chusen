// 共有 Playwright ブラウザ。scraper と価格取得で使い回す。
import { chromium } from 'playwright';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

let _browser = null;
let _context = null;

export async function getContext() {
  if (_context) return _context;
  _browser = await chromium.launch({ headless: true });
  _context = await _browser.newContext({
    userAgent: UA,
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    viewport: { width: 1280, height: 1600 },
  });
  return _context;
}

/** URLを開いてレンダリング後のHTMLを返す。失敗時は null。 */
export async function fetchHtml(url, { waitUntil = 'domcontentloaded', settleMs = 1500, timeout = 45000 } = {}) {
  const ctx = await getContext();
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil, timeout });
    if (settleMs) await page.waitForTimeout(settleMs);
    return await page.content();
  } finally {
    await page.close();
  }
}

export async function closeBrowser() {
  try {
    await _context?.close();
    await _browser?.close();
  } catch {
    /* ignore */
  }
  _context = null;
  _browser = null;
}
