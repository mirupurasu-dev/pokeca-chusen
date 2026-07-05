// 軽量HTTPクライアント（ブラウザ不要）。対象サイトはWordPress/静的HTMLなので
// 素の fetch + ブラウザUA で全内容が取れる。Playwright より速く、CI(データセンターIP)でも安定。
import { log } from './log.js';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export async function fetchHtml(url, { timeout = 25000, retries = 2 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': UA,
          'Accept-Language': 'ja,en;q=0.8',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        // 4xx（404など）はリトライしても無駄なので即失敗
        const noRetry = res.status >= 400 && res.status < 500 && res.status !== 429;
        throw Object.assign(new Error(`HTTP ${res.status}`), { noRetry });
      }
      return await res.text();
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      if (e.noRetry) break;
      if (attempt < retries) {
        log.warn(`再取得 (${attempt + 1}/${retries}) ${url}: ${e.message}`);
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
  }
  throw lastErr;
}
