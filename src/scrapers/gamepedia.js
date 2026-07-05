// 攻略大百科（premium.gamepedia.jp）のポケカ抽選まとめをスクレイプする。
//
// 実DOM構造（2026-07時点）:
//   商品ごとの「要約表」に ショップ名 | 種別(抽選受付中/受付終了) と、各行に
//   詳細アンカー(#product_schedule-NNN) へのリンクがある。
//   詳細は <h3 id="product_schedule-NNN">抽選詳細ページ</h3> の直後のテーブルに
//   「対象商品 / 販売種別 / 抽選開始日時 / 抽選終了日時 / 抽選結果発表 / 購入制限等」。
//   応募先の外部リンクは詳細セクション内の <a> にある。
//   「受付中」の行だけを対象にする（古い終了分の混入を防ぐ）。

import * as cheerio from 'cheerio';
import { config } from '../config.js';
import { fetchHtml } from '../util/http.js';
import { parseJpDateTime } from '../util/dates.js';
import { tidy, splitProducts, sha1, lotteryKey, isExternalApply } from '../util/text.js';
import { log } from '../util/log.js';

export async function scrapeGamepedia(now = new Date()) {
  const url = config.sources.gamepedia.url;
  log.info(`攻略大百科 を取得: ${url}`);
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  const main = $('main').first().length ? $('main').first() : $('article').first();

  // 1) 要約表から アンカーID → {店舗, 種別} を収集
  const byAnchor = new Map();
  main.find('table').each((_, t) => {
    $(t).find('tr').each((__, tr) => {
      const c = $(tr).find('th, td');
      if (c.length < 2) return;
      const anchor = $(tr).find('a[href^="#product_schedule"]').attr('href');
      if (!anchor) return;
      const anchorId = anchor.replace(/^#/, '');
      if (byAnchor.has(anchorId)) return;
      byAnchor.set(anchorId, { shop: tidy(c.eq(0).text()), kind: tidy(c.eq(1).text()) });
    });
  });

  // 2) 受付中の詳細セクションだけ解析
  const lotteries = [];
  for (const [anchorId, meta] of byAnchor) {
    if (!/受付中/.test(meta.kind)) continue;
    const h = main.find(`#${anchorId}`);
    if (!h.length) continue;

    const seg = h.nextUntil('h3');
    const tbl = seg.filter('table').first().length ? seg.filter('table').first() : seg.find('table').first();
    if (!tbl.length) continue;

    const f = {};
    tbl.find('tr').each((_, tr) => {
      const c = $(tr).find('th, td');
      if (c.length < 2) return;
      f[tidy(c.eq(0).text())] = tidy(c.eq(1).text());
    });

    const kind = f['販売種別'] || meta.kind;
    if (!/抽選|予約/.test(kind + meta.kind)) continue;

    const applyStart = parseJpDateTime(f['抽選開始日時'] || f['予約開始日時'] || f['開始日時'], now);
    const applyEnd = parseJpDateTime(f['抽選終了日時'] || f['予約終了日時'] || f['終了日時'], now);
    if (!applyStart && !applyEnd) continue;

    // 応募先の外部リンク（まとめ内部リンクは除外）
    const link =
      seg
        .find('a')
        .map((_, a) => $(a).attr('href'))
        .get()
        .find((href) => isExternalApply(href)) || null;

    const products = splitProducts(f['対象商品'] || meta.shop);
    const primary = products[0] || meta.shop;
    const store = tidy(meta.shop.replace(/[（(]\d+回目[)）]/g, ''));
    const id = 'lot:' + sha1(lotteryKey(store, primary));

    lotteries.push({
      id,
      source: '攻略大百科',
      section: meta.kind,
      store,
      title: primary,
      products,
      format: kind,
      conditions: f['購入制限等'] || '',
      applyStart: applyStart || null,
      applyEnd: applyEnd || null,
      resultText: f['抽選結果発表'] || '',
      url: link,
      raw: tidy(tbl.text()).slice(0, 400),
    });
  }

  log.info(`攻略大百科 から抽選 ${lotteries.length} 件を抽出`);
  return lotteries;
}
