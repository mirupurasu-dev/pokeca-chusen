// DOM ダンプ用ヘルパー。
//
// 使い方:
//   node scripts/dump.js                       … 既定のターゲット(ポケセン/入荷Now)をダンプ
//   node scripts/dump.js --url https://...      … 任意URLを1つダンプ
//
// 各ターゲットについて実際の Chromium を開き、HTTPステータスと <title> を表示、
// レンダリング後のHTMLと、レスポンスに含まれるJSONを ./dumps/ に保存する。
// これらのサイトは素のHTTPクライアントだと403になったりJSで描画されるため、
// 実DOM/実APIレスポンスを見て正確なセレクタを書くのが目的。

import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const DEFAULT_TARGETS = [
  { site: 'pokecenter-lottery', url: 'https://www.pokemoncenter-online.com/lottery/apply.html' },
  { site: 'nyuka-now', url: 'https://nyuka-now.com/archives/2459' },
  { site: 'surugaya-search', url: 'https://www.suruga-ya.jp/search?category=&search_word=%E3%83%9D%E3%82%B1%E3%83%A2%E3%83%B3%E3%82%AB%E3%83%BC%E3%83%89+%E3%82%A2%E3%83%93%E3%82%B9%E3%82%A2%E3%82%A4+BOX' },
];

async function dumpOne(context, label, url) {
  const page = await context.newPage();
  const jsonHits = [];
  // JSON レスポンスを収集（SPAのAPIエンドポイント発見用）
  page.on('response', async (resp) => {
    try {
      const ct = resp.headers()['content-type'] || '';
      if (ct.includes('application/json')) {
        const body = await resp.text();
        if (body && body.length < 500000) {
          jsonHits.push({ url: resp.url(), status: resp.status(), body });
        }
      }
    } catch {
      /* ignore */
    }
  });

  let status = 'n/a';
  try {
    const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
    status = resp ? resp.status() : 'no-response';
    await page.waitForTimeout(2500); // JS描画を待つ
    const title = await page.title();
    const html = await page.content();
    const safe = label.replace(/[^a-z0-9_-]/gi, '_');
    await writeFile(path.join('dumps', `${safe}.html`), html, 'utf8');
    await page.screenshot({ path: path.join('dumps', `${safe}.png`), fullPage: true });
    if (jsonHits.length) {
      await writeFile(
        path.join('dumps', `${safe}.json.txt`),
        jsonHits.map((h) => `>>> ${h.status} ${h.url}\n${h.body}`).join('\n\n=====\n\n'),
        'utf8'
      );
    }
    console.log(
      `[${label}] ${status}  "${title}"  -> dumps/${safe}.html (+.png, ${jsonHits.length} json)  ${url}`
    );
  } catch (err) {
    console.log(`[${label}] ERROR (${status}) ${err.message}  ${url}`);
  } finally {
    await page.close();
  }
}

async function main() {
  const args = process.argv.slice(2);
  await mkdir('dumps', { recursive: true });

  let targets = DEFAULT_TARGETS;
  const urlFlag = args.indexOf('--url');
  if (urlFlag !== -1 && args[urlFlag + 1]) {
    targets = [{ site: 'explicit', url: args[urlFlag + 1] }];
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: UA,
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    viewport: { width: 1280, height: 1600 },
  });
  for (const t of targets) {
    await dumpOne(context, t.site, t.url);
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
