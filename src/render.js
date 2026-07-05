// 抽選一覧から自己完結型のダッシュボードHTML(public/index.html)を生成する。
// コンセプト: コレクター向けマーケット端末（相場・期待値を主役に）。
// CSS/JSインライン、外部依存なし。並替・絞込・締切ライブカウントダウンはクライアントJS。
import { config } from './config.js';
import { fmtJst } from './util/dates.js';

function toPayload(lotteries, stock, generatedAt) {
  return {
    hot: { minProfit: config.hot.minProfitYen, minRoi: config.hot.minRoiPct },
    stock: (stock || []).map((s) => ({
      store: s.store || '',
      title: s.title || '',
      desc: s.desc || '',
      price: s.priceYen ?? null,
      url: /^https?:\/\//.test(s.url || '') ? s.url : '',
      profit: s.ev?.profitYen ?? null,
      roi: s.ev?.roiPct ?? null,
      market: s.market?.yen ?? null,
    })),
    generatedAt: generatedAt.toISOString(),
    generatedLabel: new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(generatedAt),
    items: lotteries.map((l) => ({
      store: l.store || '',
      title: l.title || '',
      source: String(l.source || ''),
      format: l.format || '',
      conditions: l.conditions || '',
      start: l.applyStart ? l.applyStart.toISOString() : null,
      end: l.applyEnd ? l.applyEnd.toISOString() : null,
      startLabel: l.applyStart ? fmtJst(l.applyStart) : '',
      endLabel: l.applyEnd ? fmtJst(l.applyEnd) : '',
      result: l.resultText || '',
      url: /^https?:\/\//.test(l.url || '') ? l.url : '', // http(s)以外は載せない
      fresh: !!l.marketMissing,
      profit: l.ev?.profitYen ?? null,
      roi: l.ev?.roiPct ?? null,
      market: l.market?.yen ?? null,
      list: l.market?.listYen ?? null,
      confident: l.market?.confident ?? null,
      marketUrl: l.market?.url ?? null,
    })),
  };
}

export function renderBody(lotteries, stock = [], generatedAt = new Date()) {
  const payload = toPayload(lotteries, stock, generatedAt);
  const json = JSON.stringify(payload).replace(/</g, '\\u003c');

  return `<title>ポケカ抽選ターミナル</title>
<style>
:root{
  --ink:#0b0d12; --surface:#141821; --surface-2:#1b2130; --line:#262d3b;
  --text:#e8ebf2; --muted:#8b93a7; --faint:#5c6474;
  --gold:#e6b450; --gold-dim:#8a6d2e;
  --good:#40c76a; --bad:#ff6a6a; --urgent:#ffb454;
  --mono:ui-monospace,"SF Mono","Cascadia Code","Roboto Mono",Consolas,monospace;
  --jp:"Hiragino Kaku Gothic ProN","Yu Gothic",YuGothic,Meiryo,system-ui,sans-serif;
}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{
  margin:0; background:
    radial-gradient(1200px 600px at 80% -10%, #16203010, transparent),
    radial-gradient(900px 500px at -10% 0%, #1a141f18, transparent),
    var(--ink);
  color:var(--text); font-family:var(--jp); line-height:1.5;
  font-feature-settings:"palt" 1;
}
a{color:inherit;text-decoration:none}
.wrap{max-width:1160px;margin:0 auto;padding:0 18px}

/* ── top bar ── */
header.top{
  position:sticky;top:0;z-index:20;
  background:color-mix(in srgb, var(--ink) 82%, transparent);
  backdrop-filter:blur(12px);
  border-bottom:1px solid var(--line);
}
.top .wrap{display:flex;align-items:center;gap:16px;height:60px}
.brand{display:flex;align-items:baseline;gap:10px;min-width:0}
.brand .mark{
  font-weight:800;letter-spacing:.14em;font-size:15px;
  color:var(--gold);text-transform:uppercase;white-space:nowrap;
}
.brand .jp{font-size:13px;color:var(--muted);white-space:nowrap}
.top .spacer{flex:1}
.updated{font:500 12px/1 var(--mono);color:var(--faint);white-space:nowrap}
.updated b{color:var(--muted);font-weight:600}
.cal{font:600 12px var(--jp);color:var(--gold);border:1px solid var(--gold-dim);
  border-radius:8px;padding:6px 10px;white-space:nowrap;transition:.15s}
.cal:hover{background:#e6b4500f;border-color:var(--gold)}

/* ── summary ── */
.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:22px 0 8px}
.stat{
  background:linear-gradient(180deg,var(--surface),#10141c);
  border:1px solid var(--line);border-radius:14px;padding:14px 16px;position:relative;overflow:hidden;
}
.stat .lbl{font:600 10.5px/1 var(--mono);letter-spacing:.16em;text-transform:uppercase;color:var(--faint)}
.stat .val{font:700 26px/1.1 var(--mono);margin-top:10px;font-variant-numeric:tabular-nums}
.stat .sub{font-size:11.5px;color:var(--muted);margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.stat.hero{border-color:var(--gold-dim)}
.stat.hero:before{
  content:"";position:absolute;inset:0;pointer-events:none;
  background:linear-gradient(115deg,transparent 30%,#e6b45015 46%,#7fd7ff10 52%,#e6b45012 58%,transparent 74%);
}
.stat.hero .val{color:var(--gold)}

/* ── hot ranking (買い推奨) ── */
.hotwrap{margin:16px 0 4px;border:1px solid var(--gold-dim);border-radius:14px;overflow:hidden;position:relative;
  background:linear-gradient(180deg,#2a210f30,transparent 60%),linear-gradient(180deg,var(--surface),#10141c)}
.hotwrap:before{content:"";position:absolute;inset:0;pointer-events:none;
  background:linear-gradient(115deg,transparent 30%,#e6b45012 46%,#7fd7ff08 52%,#e6b45010 58%,transparent 74%)}
.hothead{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;padding:13px 16px 4px}
.hottitle{font-weight:800;font-size:15px;color:var(--gold);letter-spacing:.02em}
.hotnote{font-size:11px;color:var(--faint)}
.hotlist{display:flex;flex-direction:column;padding:6px 8px 10px;position:relative}
.hotrow{display:flex;align-items:center;gap:12px;padding:11px 12px;border-radius:10px;transition:.15s;min-width:0}
.hotrow:hover{background:#e6b4500c}
.hotrow .rank{flex:none;font:800 18px var(--mono);color:var(--gold-dim);width:26px;text-align:center}
.hotrow:first-child .rank{color:var(--gold);font-size:22px}
.hotrow .hmain{flex:1;min-width:0;display:block}
.hotrow .hname{display:block;font-weight:700;font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hotrow .hsub{font-size:11px;color:var(--muted);margin-top:2px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.hotrow .hprofit{flex:none;text-align:right}
.hotrow .hprofit .p{font:800 19px/1 var(--mono);color:var(--good);font-variant-numeric:tabular-nums}
.hotrow:first-child .hprofit .p{font-size:23px}
.hotrow .hprofit .r{font:700 10.5px var(--mono);color:var(--muted);margin-top:3px}
.hotrow .act{flex:none;font:700 12.5px var(--jp);color:#131313;background:var(--gold);
  border-radius:9px;padding:8px 14px;white-space:nowrap;transition:.15s}
.hotrow:hover .act{filter:brightness(1.1)}
.hotrow .kindtag{font:700 9.5px var(--mono);letter-spacing:.1em;padding:2px 6px;border-radius:5px;
  background:var(--surface-2);color:var(--muted)}
@media (max-width:640px){
  .hotrow{flex-wrap:wrap;row-gap:6px}
  .hotrow .hmain{flex-basis:calc(100% - 40px)}
  .hotrow .act{margin-left:auto}
}

/* ── stock strip (今すぐ買える) ── */
.stockwrap{margin:16px 0 4px;border:1px solid #2f6b45;border-radius:14px;overflow:hidden;
  background:linear-gradient(180deg,#12241a20,transparent),linear-gradient(180deg,var(--surface),#10141c)}
.stockhead{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;padding:12px 16px 4px}
.stocktitle{font-weight:800;font-size:14px;color:var(--good);letter-spacing:.02em}
.stockcount{font:700 12px var(--mono);margin-left:6px;color:var(--muted)}
.stocknote{font-size:11px;color:var(--faint)}
.stocklist{display:flex;flex-direction:column;padding:6px 8px 10px}
.stockrow{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:10px;transition:.15s;min-width:0}
.stockrow:hover{background:#40c76a0d}
.stockrow .chip{flex:none}
.stockrow .sdesc{flex:1;min-width:0;font-size:12.5px;color:var(--text);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.stockrow .sprice{flex:none;font:700 13px var(--mono);color:var(--text);font-variant-numeric:tabular-nums}
.stockrow .sev{flex:none;font:700 11px var(--mono);padding:3px 7px;border-radius:6px}
.stockrow .sev.pos{color:var(--good);background:#40c76a1a}
.stockrow .sev.neg{color:var(--bad);background:#ff6a6a17}
.stockrow .go{flex:none;font:700 12px var(--jp);color:var(--good);border:1px solid #2f6b45;
  border-radius:8px;padding:5px 10px;white-space:nowrap}
.stockrow:hover .go{background:#40c76a14}
@media (max-width:640px){
  .stockrow{flex-wrap:wrap;row-gap:4px}
  .stockrow .sdesc{flex-basis:100%;white-space:normal;
    display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
}

/* ── controls ── */
.controls{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:18px 0 6px}
.segs{display:inline-flex;background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:3px}
.segs button{
  appearance:none;border:0;background:transparent;color:var(--muted);
  font:600 12.5px var(--jp);padding:7px 14px;border-radius:7px;cursor:pointer;transition:.15s;
}
.segs button[aria-pressed=true]{background:var(--surface-2);color:var(--text);box-shadow:0 1px 0 #0006}
.search{flex:1;min-width:160px;display:flex;align-items:center;gap:8px;
  background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:0 12px}
.search input{flex:1;background:transparent;border:0;outline:none;color:var(--text);
  font:400 13.5px var(--jp);padding:9px 0}
.search input::placeholder{color:var(--faint)}
.toggle{display:inline-flex;align-items:center;gap:8px;cursor:pointer;user-select:none;
  font:600 12px var(--jp);color:var(--muted);
  background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:8px 12px}
.toggle input{accent-color:var(--good);width:15px;height:15px;margin:0}
.toggle[data-on=true]{color:var(--text);border-color:#2f6b45}

.count{font:500 12px var(--mono);color:var(--faint);margin:14px 2px 10px}

/* ── grid & cards ── */
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px;padding-bottom:40px}
.card{
  position:relative;display:flex;flex-direction:column;gap:12px;
  background:linear-gradient(180deg,var(--surface),#10131b);
  border:1px solid var(--line);border-radius:16px;padding:16px 16px 14px 18px;
  transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease;
}
.card:before{content:"";position:absolute;left:0;top:14px;bottom:14px;width:3px;border-radius:3px;background:var(--faint)}
.card.pos:before{background:linear-gradient(var(--good),#2c9a52)}
.card.neg:before{background:linear-gradient(var(--bad),#c94b4b)}
.card:hover{transform:translateY(-2px);border-color:#33405a;box-shadow:0 10px 30px -12px #000a}
.card .row1{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.chip{font:600 11.5px var(--jp);color:var(--text);background:var(--surface-2);
  border:1px solid var(--line);border-radius:999px;padding:4px 10px;white-space:nowrap}
.chip.fresh{color:var(--gold);border-color:var(--gold-dim);background:#e6b4500d}
.chip.hotchip{color:var(--gold);border-color:var(--gold);background:#e6b45015;font-weight:800}
.card.hotcard{border-color:var(--gold-dim)}
.card.hotcard:hover{border-color:var(--gold)}
.src{font:600 10px var(--mono);letter-spacing:.08em;color:var(--faint);margin-left:auto;white-space:nowrap}
.title{font-weight:700;font-size:16px;letter-spacing:.01em;text-wrap:balance;margin:2px 0 0}

.ev{display:flex;align-items:flex-end;gap:12px;padding:10px 0 2px;border-top:1px solid var(--line)}
.ev .big{font:800 27px/1 var(--mono);font-variant-numeric:tabular-nums}
.ev.pos .big{color:var(--good)} .ev.neg .big{color:var(--bad)} .ev.na .big{color:var(--faint);font-size:15px;font-weight:600}
.ev .roi{font:700 12px var(--mono);padding:3px 7px;border-radius:6px;align-self:center}
.ev.pos .roi{color:var(--good);background:#40c76a1a} .ev.neg .roi{color:var(--bad);background:#ff6a6a17}
.ev .price{margin-left:auto;text-align:right;font:500 11px/1.5 var(--mono);color:var(--muted)}
.ev .price s{color:var(--faint);text-decoration:none}
.ev .price .warnmark{color:var(--urgent)}

.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px 12px}
.meta .m{min-width:0}
.meta .k{font:600 9.5px var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--faint)}
.meta .v{font-size:12.5px;color:var(--text);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dl{display:inline-flex;align-items:center;gap:6px}
.dl .pill{font:700 11px var(--mono);padding:2px 7px;border-radius:6px;background:var(--surface-2);color:var(--muted)}
.dl .pill.soon{background:#ffb4541c;color:var(--urgent)}
.dl .pill.now{background:#ff6a6a1e;color:var(--bad)}
.dl .pill.live{background:#40c76a1a;color:var(--good)}
.dl .pill.tbd{background:#e6b4501a;color:var(--gold)}

.cond{font-size:11.5px;color:var(--muted);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.cta{margin-top:auto;display:flex;align-items:center;justify-content:space-between;
  border:1px solid var(--gold-dim);border-radius:10px;padding:10px 14px;
  color:var(--gold);font:700 13px var(--jp);transition:.15s}
.cta:hover{background:#e6b4500f;border-color:var(--gold)}
.cta.disabled{border-color:var(--line);color:var(--faint);pointer-events:none}

.empty{text-align:center;color:var(--muted);padding:60px 20px;border:1px dashed var(--line);border-radius:16px}
footer{border-top:1px solid var(--line);margin-top:20px;padding:20px 0 40px;color:var(--faint);font-size:11.5px}
footer .wrap{display:flex;flex-wrap:wrap;gap:6px 16px;justify-content:space-between}
footer a{color:var(--muted);border-bottom:1px solid var(--line)}

@media (max-width:640px){
  .summary{grid-template-columns:1fr;gap:10px}
  .brand .jp{display:none}
  .updated{display:none}
  .grid{grid-template-columns:1fr}
}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
</style>
<header class="top"><div class="wrap">
  <div class="brand"><span class="mark">Chusen Terminal</span><span class="jp">ポケカ抽選</span></div>
  <span class="spacer"></span>
  <a class="cal" href="calendar.ics" title="カレンダーアプリで購読（URLで追加）">📅 カレンダー購読</a>
  <span class="updated">更新 <b id="upd"></b></span>
</div></header>

<main class="wrap">
  <section class="summary" id="summary"></section>

  <section class="hotwrap" id="hotwrap" hidden>
    <div class="hothead">
      <span class="hottitle">🔥 買い推奨</span>
      <span class="hotnote">期待利益ランキング — 逃すと損する順</span>
    </div>
    <div class="hotlist" id="hotlist"></div>
  </section>

  <section class="stockwrap" id="stockwrap" hidden>
    <div class="stockhead">
      <span class="stocktitle">📦 今すぐ買える<span class="stockcount" id="stockcount"></span></span>
      <span class="stocknote">先着・在庫あり（入荷Now調べ / 15分毎更新）</span>
    </div>
    <div class="stocklist" id="stocklist"></div>
  </section>

  <div class="controls">
    <div class="segs" role="tablist" aria-label="並び替え">
      <button data-sort="deadline" aria-pressed="true">締切が近い順</button>
      <button data-sort="ev" aria-pressed="false">期待利益が高い順</button>
    </div>
    <label class="toggle" id="posToggle" data-on="false">
      <input type="checkbox" id="posOnly"> 期待利益プラスのみ
    </label>
    <label class="toggle" id="freshToggle" data-on="false">
      <input type="checkbox" id="freshOnly"> 🆕 新商品のみ
    </label>
    <div class="search">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--faint)"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>
      <input id="q" type="search" placeholder="店舗・商品名でしぼり込み">
    </div>
  </div>
  <div class="count" id="count"></div>

  <section class="grid" id="grid"></section>
</main>

<footer><div class="wrap">
  <span>データ元: 入荷Now ・ 攻略大百科 ／ 相場: スニダン・駿河屋</span>
  <span>期待利益 = 相場 − 定価。応募可否・締切は必ずリンク先の公式でご確認ください。</span>
</div></footer>

<script id="data" type="application/json">${json}</script>
<script>
(function(){
  "use strict";
  var DATA = JSON.parse(document.getElementById("data").textContent);
  var items = DATA.items;
  document.getElementById("upd").textContent = DATA.generatedLabel;

  var state = { sort:"deadline", posOnly:false, freshOnly:false, q:"" };

  function yen(n){ if(n==null||isNaN(n)) return "—"; return "¥"+Math.round(n).toLocaleString("en-US"); }
  function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;"}[c];}); }

  function rel(ms){ var h=ms/3600000,d=Math.floor(h/24);
    if(h<24){var hh=Math.floor(h),mm=Math.floor((ms%3600000)/60000);return hh+"時間"+(hh<6?(mm+"分"):"");}
    return d+"日";
  }
  // 締切がある→締切カウントダウン。無い→開始前なら開始まで、開始済みなら受付中。
  function statusOf(it){
    var now=Date.now();
    if(it.end){
      var ms=new Date(it.end).getTime()-now;
      if(ms<0) return {txt:"締切済",cls:"now"};
      return {txt:"締切まで "+rel(ms),cls:ms/3600000<24?"now":(ms/3600000<72?"soon":"")};
    }
    if(it.start){
      var s=new Date(it.start).getTime()-now;
      if(s>0) return {txt:"開始まで "+rel(s),cls:s/3600000<24?"soon":""};
      return {txt:"受付中",cls:"live"};
    }
    return {txt:"日程未定",cls:"tbd"};
  }

  function evClass(p){ return p==null?"na":(p>=0?"pos":"neg"); }
  function isHot(x){ return x.profit!=null && (x.profit>=DATA.hot.minProfit || (x.roi!=null && x.roi>=DATA.hot.minRoi)); }

  function card(it){
    var cd = statusOf(it);
    var ec = evClass(it.profit);
    var h = "";
    var hot=isHot(it);
    h += '<article class="card '+(ec==="pos"?"pos":ec==="neg"?"neg":"")+(hot?" hotcard":"")+'">';
    h +=   '<div class="row1"><span class="chip">'+esc(it.store)+'</span>';
    if(hot) h += '<span class="chip hotchip">🔥 買い推奨</span>';
    if(it.fresh) h += '<span class="chip fresh">🆕 新商品</span>';
    h +=     '<span class="src">'+esc(it.source)+'</span></div>';
    h +=   '<h3 class="title">'+esc(it.title)+'</h3>';

    // EV block
    h +=   '<div class="ev '+ec+'">';
    if(it.profit==null){
      h += '<span class="big">'+(it.fresh?"相場未確立（未発売の可能性）":"相場データなし")+'</span>';
    }else{
      h += '<span class="big">'+(it.profit>=0?"+":"−")+yen(Math.abs(it.profit))+'</span>';
      if(it.roi!=null) h += '<span class="roi">ROI '+it.roi+'%</span>';
    }
    if(it.market!=null){
      h += '<span class="price">相場 '+yen(it.market)+(it.confident?"":' <span class="warnmark">要確認</span>')
         + (it.list!=null?('<br><s>定価 '+yen(it.list)+'</s>'):'')+'</span>';
    }
    h +=   '</div>';

    // meta
    h +=   '<div class="meta">';
    h +=     '<div class="m"><div class="k">'+(it.end?"Deadline":"Status")+'</div><div class="v"><span class="dl"><span class="pill '+cd.cls+'">'+cd.txt+'</span>'+(it.end?(" "+esc(it.endLabel)):"")+'</span></div></div>';
    h +=     '<div class="m"><div class="k">Opens</div><div class="v">'+esc(it.startLabel||"—")+'</div></div>';
    if(it.result){ h += '<div class="m"><div class="k">Result</div><div class="v">'+esc(it.result)+'</div></div>'; }
    if(it.format){ h += '<div class="m"><div class="k">Type</div><div class="v">'+esc(it.format)+'</div></div>'; }
    h +=   '</div>';

    if(it.conditions) h += '<div class="cond">'+esc(it.conditions)+'</div>';

    if(it.url){ h += '<a class="cta" href="'+esc(it.url)+'" target="_blank" rel="noopener">応募ページへ <span>&rarr;</span></a>'; }
    else { h += '<span class="cta disabled">応募リンクなし</span>'; }

    h += '</article>';
    return h;
  }

  function anchorMs(it){ var a=it.end||it.start; return a?new Date(a).getTime():Infinity; }

  function view(){
    var list = items.slice();
    if(state.posOnly) list = list.filter(function(x){return x.profit!=null && x.profit>0;});
    if(state.freshOnly) list = list.filter(function(x){return x.fresh;});
    if(state.q){ var q=state.q.toLowerCase();
      list = list.filter(function(x){return (x.store+" "+x.title).toLowerCase().indexOf(q)>=0;}); }
    if(state.sort==="ev") list.sort(function(a,b){return (b.profit==null?-1e15:b.profit)-(a.profit==null?-1e15:a.profit);});
    else list.sort(function(a,b){return anchorMs(a)-anchorMs(b);});

    var grid=document.getElementById("grid");
    if(!list.length){ grid.innerHTML='<div class="empty">該当する抽選はありません。</div>'; }
    else grid.innerHTML = list.map(card).join("");
    document.getElementById("count").textContent = list.length+" 件表示";

    // summary
    var now=Date.now();
    var withEv = items.filter(function(x){return x.profit!=null;});
    var best = withEv.slice().sort(function(a,b){return b.profit-a.profit;})[0];
    var futureEnds = items.filter(function(x){return x.end && new Date(x.end).getTime()>now;})
                          .sort(function(a,b){return new Date(a.end)-new Date(b.end);});
    var nd = futureEnds[0];
    var s="";
    s += stat("Active Lotteries", items.length+" 件", "監視中の受付中抽選", false);
    s += stat("Best Expected Value",
              best? ((best.profit>=0?"+":"−")+yen(Math.abs(best.profit))) : "—",
              best? (best.store+"・"+best.title) : "相場データ待ち", true);
    s += stat("Next Deadline", nd? statusOf(nd).txt : "—",
              nd? (nd.store+"・"+nd.title) : "締切設定のある抽選なし", false);
    document.getElementById("summary").innerHTML=s;
  }
  function stat(lbl,val,sub,hero){
    return '<div class="stat'+(hero?" hero":"")+'"><div class="lbl">'+esc(lbl)+'</div>'
         + '<div class="val">'+esc(val)+'</div><div class="sub">'+esc(sub)+'</div></div>';
  }

  // 🔥買い推奨ランキング — 抽選＋在庫を統合し期待利益順トップ5（一度だけ描画）
  (function renderHot(){
    var pool=[];
    items.forEach(function(x){ if(isHot(x)) pool.push({type:"抽選",name:x.store+"："+x.title,profit:x.profit,roi:x.roi,url:x.url,it:x}); });
    (DATA.stock||[]).forEach(function(s){ if(isHot(s)) pool.push({type:"在庫",name:s.store+"："+s.title,profit:s.profit,roi:s.roi,url:s.url,st:s}); });
    if(!pool.length) return;
    pool.sort(function(a,b){return b.profit-a.profit;});
    document.getElementById("hotwrap").hidden=false;
    document.getElementById("hotlist").innerHTML=pool.slice(0,5).map(function(p,i){
      var sub;
      if(p.st){ sub='<span class="pill live">在庫あり・先着</span>'+(p.st.price!=null?(' 販売価格 '+yen(p.st.price)):''); }
      else { var cd=statusOf(p.it); sub='<span class="pill '+cd.cls+'">'+cd.txt+'</span>'+(p.it.endLabel?(' '+esc(p.it.endLabel)):''); }
      var tag=p.url?'a':'div';
      var h='<'+tag+' class="hotrow"'+(p.url?' href="'+esc(p.url)+'" target="_blank" rel="noopener"':'')+'>';
      h+='<span class="rank">'+(i+1)+'</span>';
      h+='<span class="hmain"><span class="hname">'+esc(p.name)+'</span>'
        +'<span class="hsub"><span class="kindtag">'+p.type+'</span>'+sub+'</span></span>';
      h+='<span class="hprofit"><span class="p">+'+yen(p.profit)+'</span>'
        +(p.roi!=null?('<div class="r">ROI '+p.roi+'%</div>'):'')+'</span>';
      h+='<span class="act">'+(p.st?"今すぐ買う":"応募する")+' →</span>';
      h+='</'+tag+'>';
      return h;
    }).join("");
  })();

  // 在庫あり（今すぐ買える）ストリップ — 一度だけ描画
  (function renderStock(){
    var st=DATA.stock||[];
    if(!st.length) return;
    document.getElementById("stockwrap").hidden=false;
    document.getElementById("stockcount").textContent=st.length+"件";
    document.getElementById("stocklist").innerHTML=st.map(function(s){
      var h='';
      var tag=s.url?'a':'div';
      h+='<'+tag+' class="stockrow"'+(s.url?' href="'+esc(s.url)+'" target="_blank" rel="noopener"':'')+'>';
      h+='<span class="chip">'+esc(s.store)+'</span>';
      h+='<span class="sdesc" title="'+esc(s.desc)+'">'+esc(s.desc)+'</span>';
      if(s.price!=null) h+='<span class="sprice">'+yen(s.price)+'</span>';
      if(s.profit!=null) h+='<span class="sev '+(s.profit>=0?"pos":"neg")+'">'+(s.profit>=0?"+":"−")+yen(Math.abs(s.profit))+'</span>';
      h+='<span class="go">買う &rarr;</span>';
      h+='</'+tag+'>';
      return h;
    }).join("");
  })();

  // events
  Array.prototype.forEach.call(document.querySelectorAll(".segs button"),function(b){
    b.addEventListener("click",function(){
      state.sort=b.dataset.sort;
      Array.prototype.forEach.call(document.querySelectorAll(".segs button"),function(x){x.setAttribute("aria-pressed", x===b);});
      view();
    });
  });
  document.getElementById("posOnly").addEventListener("change",function(e){
    state.posOnly=e.target.checked;
    document.getElementById("posToggle").dataset.on=e.target.checked;
    view();
  });
  document.getElementById("freshOnly").addEventListener("change",function(e){
    state.freshOnly=e.target.checked;
    document.getElementById("freshToggle").dataset.on=e.target.checked;
    view();
  });
  document.getElementById("q").addEventListener("input",function(e){ state.q=e.target.value.trim(); view(); });

  view();
  setInterval(view, 60000); // 締切カウントダウンを毎分更新
})();
</script>`;
}

export function renderHtml(lotteries, stock = [], generatedAt = new Date()) {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#0b0d12">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='88'%3E%F0%9F%8E%B4%3C/text%3E%3C/svg%3E">
</head>
<body>
${renderBody(lotteries, stock, generatedAt)}
</body>
</html>`;
}
