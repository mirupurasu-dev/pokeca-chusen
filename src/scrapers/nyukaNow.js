// 入荷Now のポケカ抽選まとめ記事をスクレイプする。
//
// 実DOM構造（2026-07時点）:
//   <main> 内に h2(セクション見出し) と h3(店舗名) が並ぶ。
//   各 h3 の直後の <table> に「対象商品 / 抽選形式 / 開始日 / 終了日 /
//   当選発表 / 応募条件 / 応募ページ(または詳細ページ)」が th/td で入る。
//   セクション h2 で「受付中 / 近日受付開始 / 会員限定」だけを対象にし、
//   「受付終了(過去) / 在庫あり(先着)」は除外する。

import * as cheerio from 'cheerio';
import { config } from '../config.js';
import { fetchHtml } from '../util/http.js';
import { parseJpDateTime } from '../util/dates.js';
import { tidy, splitProducts, sha1, lotteryKey } from '../util/text.js';
import { log } from '../util/log.js';

const LABEL = {
  product: /対象商品|商品/,
  format: /抽選形式|形式|販売方法/,
  start: /開始|受付開始/,
  end: /終了|締切|締め切り/,
  period: /受付期間|応募期間|期間/,
  result: /当選発表|当落|発表/,
  cond: /応募条件|条件/,
  link: /応募ページ|詳細ページ|申込|応募先|購入/,
};

function matchLabel(label) {
  for (const [key, re] of Object.entries(LABEL)) {
    if (re.test(label)) return key;
  }
  return null;
}

export async function scrapeNyukaNow(now = new Date()) {
  const url = config.sources.nyukaNow.url;
  log.info(`入荷Now を取得: ${url}`);
  // WordPress＝HTMLは初期レスポンスに含まれるので素のfetchで取得（ブラウザ不要）。
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  const article = $('main').first().length ? $('main').first() : $('article').first();

  const lotteries = [];
  let currentSection = '';

  article.find('h2, h3').each((_, el) => {
    const tag = el.tagName.toLowerCase();
    const text = tidy($(el).text());
    if (tag === 'h2') {
      currentSection = text;
      return;
    }
    // h3 = 店舗名。対象セクションでなければスキップ。
    if (!config.includeSection(currentSection)) return;

    const store = text;
    const table = $(el).nextUntil('h3, h2').find('table').first();
    if (!table.length) return;

    // ラベル→値/リンク を収集
    const fields = {};
    const links = [];
    table.find('tr').each((__, tr) => {
      const cells = $(tr).find('th, td');
      if (cells.length < 2) return;
      const rawLabel = tidy(cells.eq(0).text());
      const key = matchLabel(rawLabel);
      const valCell = cells.eq(1);
      const val = tidy(valCell.text());
      valCell.find('a').each((___, a) => {
        const href = $(a).attr('href');
        if (href) links.push({ key, href });
      });
      if (key && !fields[key]) fields[key] = val;
    });

    // 日付
    let applyStart = parseJpDateTime(fields.start, now);
    let applyEnd = parseJpDateTime(fields.end, now);
    if (!applyStart && !applyEnd && fields.period) {
      const [a, b] = fields.period.split(/[〜～~]/);
      applyStart = parseJpDateTime(a, now);
      applyEnd = parseJpDateTime(b || '', now);
    }
    // 日付が取れないエントリ（近日受付開始・未発売の新商品告知など）も
    // 「日程未定」として一覧に残す。カレンダーには日付確定後に載る。

    const products = splitProducts(fields.product || store);
    const primary = products[0] || store;

    // 販売/応募リンク: 応募ページ系を優先、無ければ nyuka-now 以外の外部リンク
    const applyLink =
      links.find((l) => l.key === 'link')?.href ||
      links.find((l) => !/nyuka-now\.com/.test(l.href))?.href ||
      links[0]?.href ||
      null;

    const id = 'lot:' + sha1(lotteryKey(store, primary));

    lotteries.push({
      id,
      source: '入荷Now',
      section: currentSection,
      store,
      title: primary,
      products,
      format: fields.format || '',
      conditions: fields.cond || '',
      applyStart: applyStart || null,
      applyEnd: applyEnd || null,
      resultText: fields.result || '',
      url: applyLink,
      raw: tidy(table.text()).slice(0, 400),
    });
  });

  log.info(`入荷Now から抽選 ${lotteries.length} 件を抽出`);
  return lotteries;
}
