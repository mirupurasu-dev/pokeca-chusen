// ==UserScript==
// @name         ポケカ抽選 フォーム自動入力（送信はしません）
// @namespace    https://mirupurasu-dev.github.io/pokeca-chusen/
// @version      1.1.0
// @description  抽選応募フォームの氏名・フリガナ・住所・電話などを自動入力します。送信ボタンは絶対に押しません（値を入れるだけ）。
// @author       pokeca-chusen
// @match        *://*/*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @noframes
// @updateURL    https://mirupurasu-dev.github.io/pokeca-chusen/autofill.user.js
// @downloadURL  https://mirupurasu-dev.github.io/pokeca-chusen/autofill.user.js
// ==/UserScript==
//
// ▼ 安全保証（仕様として絶対）
//   1. 送信しない: 値を入れるだけ。ボタンのクリック・Enter・form.submit()/requestSubmit() を一切行わない。
//      さらに入力中(約1.5秒)はプログラム的な自動送信をブロックする（ユーザー本人の送信は常に通す）。
//   2. 情報は端末内のみ: 個人情報は Tampermonkey(GM) のストレージにだけ保存。GMが無い環境では保存しない
//      （サイトのlocalStorageには絶対に書かない）。外部へ送信しない。ページJSに露出しない。

(function () {
  'use strict';

  // ── ストレージ: GM のみ。無ければ保存しない(フェイルクローズ) ──
  const hasGM = typeof GM_getValue === 'function' && typeof GM_setValue === 'function';
  const store = {
    get(k, d) { try { return hasGM ? GM_getValue(k, d) : d; } catch { return d; } },
    set(k, v) { if (!hasGM) return false; try { GM_setValue(k, v); return true; } catch { return false; } },
  };

  const PROFILE_KEY = 'pokeca_autofill_profile';
  const ALLOW_KEY = 'pokeca_autofill_allow';

  const DEFAULT_PROFILE = {
    familyName: '', givenName: '', familyKana: '', givenKana: '',
    email: '', tel: '', postal: '', pref: '', city: '', address: '', building: '',
    birthYear: '', birthMonth: '', birthDay: '', gender: '',
  };
  // 自動入力を許可するドメイン（完全一致 or サブドメイン）。抽選系を初期登録。
  const DEFAULT_ALLOW = [
    'livepocket.jp', 'hareruya2.com', 'l-tike.com', 'eplus.jp', '7net.omni7.jp',
    'shop-shimamura.com', 'nojima.co.jp', 'yodobashi.com', 'geo-online.co.jp',
    'aeon.jp', 'aeonretail.jp', 'aeon-hokkaido.jp', 'aeonsquare.net', 'joshinweb.jp',
  ];

  const getProfile = () => Object.assign({}, DEFAULT_PROFILE, store.get(PROFILE_KEY, {}));
  const getAllow = () => store.get(ALLOW_KEY, DEFAULT_ALLOW);

  // ── 文字ユーティリティ ──
  const digits = (s) => String(s || '').replace(/[^0-9]/g, '');
  const kata2hira = (s) => String(s || '').replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
  const hira2kata = (s) => String(s || '').replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));

  function isVisible(el) {
    if (!el || el.disabled || el.readOnly) return false;
    if (el.type === 'hidden') return false;
    if (el.offsetParent === null) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    }
    return true;
  }

  const FILLABLE_INPUT = new Set(['text', 'email', 'tel', 'url', 'number', 'search', 'date', 'month', '']);
  const NEVER = new Set(['submit', 'button', 'reset', 'image', 'file', 'password', 'hidden']);
  function isFillable(el) {
    const tag = el.tagName;
    if (tag === 'SELECT' || tag === 'TEXTAREA') return isVisible(el);
    if (tag !== 'INPUT') return false;
    const t = (el.type || 'text').toLowerCase();
    if (NEVER.has(t)) return false;
    if (t === 'checkbox') return false;           // 同意チェック等には絶対に触れない
    if (t === 'radio') return isVisible(el);        // 性別のみ decide で限定
    return FILLABLE_INPUT.has(t) && isVisible(el);
  }

  // ── 恒久・フラグ制御の送信ガード（一度だけ設置） ──
  // armed=true の間だけ「プログラム的(非ユーザー)送信」をブロックする。
  // ユーザー本人の送信(isTrusted=true)は armed 中でも常に通す。多重fillでも壊れない。
  let armed = false;
  let disarmTimer = null;
  function arm(ms) { armed = true; if (disarmTimer) clearTimeout(disarmTimer); disarmTimer = setTimeout(() => { armed = false; }, ms); }
  document.addEventListener('submit', (e) => {
    if (armed && !e.isTrusted) { e.preventDefault(); e.stopImmediatePropagation(); console.warn('[pokeca-autofill] 自動入力中のプログラム的送信をブロックしました'); }
  }, true);
  const _realSubmit = HTMLFormElement.prototype.submit;
  const _realRequestSubmit = HTMLFormElement.prototype.requestSubmit;
  HTMLFormElement.prototype.submit = function () {
    if (armed) { console.warn('[pokeca-autofill] 自動入力中の form.submit() をブロックしました'); return; }
    return _realSubmit.apply(this, arguments);
  };
  if (_realRequestSubmit) {
    HTMLFormElement.prototype.requestSubmit = function () {
      if (armed) { console.warn('[pokeca-autofill] 自動入力中の requestSubmit() をブロックしました'); return; }
      return _realRequestSubmit.apply(this, arguments);
    };
  }

  // ── ラベル抽出 ──
  function specificLabel(el) {
    const parts = [];
    if (el.labels && el.labels.length) parts.push([...el.labels].map((l) => l.textContent).join(' '));
    const lbl = el.closest('label');
    if (lbl) { const c = lbl.cloneNode(true); c.querySelectorAll('input,select,textarea').forEach((n) => n.remove()); parts.push(c.textContent); }
    if (el.getAttribute('aria-label')) parts.push(el.getAttribute('aria-label'));
    const albl = el.getAttribute('aria-labelledby');
    if (albl) albl.split(/\s+/).forEach((id) => { const n = document.getElementById(id); if (n) parts.push(n.textContent); });
    const cell = el.closest('td');
    if (cell) { const th = cell.parentElement && cell.parentElement.querySelector('th'); if (th) parts.push(th.textContent); }
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }
  function blockLabel(el) {
    const block = el.closest('p,li,dd,dt,div,fieldset,tr,.form-group,.form-item,.form-row');
    if (!block) return '';
    const c = block.cloneNode(true);
    c.querySelectorAll('input,select,textarea,button,a,label').forEach((n) => n.remove());
    return c.textContent.replace(/\s+/g, ' ').trim().slice(0, 60);
  }
  const attrText = (el) => `${el.name || ''} ${el.id || ''} ${el.placeholder || ''}`.trim();
  const ac = (el) => (el.getAttribute('autocomplete') || '').toLowerCase();

  const isKanaLabel = (L) => /フリガナ|ふりがな|ひらがな|カナ|かな|kana|ルビ|ruby|ｶﾅ|セイ|メイ/.test(L);
  const kataWanted = (L) => /フリガナ|カナ|セイ|メイ|ｶﾅ|katakana/.test(L) || !/ふりがな|ひらがな|hiragana/.test(L);

  // 非個人フィールド（検索/クーポン/数量/カード番号等）→ 触らない
  const DENY = /(search|filter|query|keyword|coupon|discount|promo|campaign|flag|report|count|qty|quantity|price|amount|point|cardnum|card[-_]?no|cvv|security[-_]?code|検索|絞り込み|クーポン|数量|金額|ポイント|カード番号|セキュリティ)/i;
  // 「名」を含むが個人名でない欄
  const NAMEISH_NOTPERSON = /(名義|署名|宛名|品名|件名|店名|会社名|法人名|団体名|商品名|ユーザー?名|ログイン名|アカウント名?|ニックネーム|ハンドル|表示名)/;

  // どのプロフィール値を入れるか判定。null=対象外。
  function decide(el) {
    const type = (el.type || 'text').toLowerCase();
    if (type === 'checkbox') return null;
    if (type === 'radio') {
      const s = specificLabel(el) + ' ' + attrText(el);
      const v = (el.value || '').trim();
      const ctx = /性別|sex|gender/i.test(s);
      const val = /^(男性?|女性?|male|female|man|woman)$/i.test(v);
      return ctx || val ? { key: 'gender', kind: 'radio' } : null;
    }

    const spec = specificLabel(el);
    const L = spec || blockLabel(el);
    const attr = attrText(el);
    const both = L + ' ' + attr;
    if (DENY.test(both)) return null;
    if (NAMEISH_NOTPERSON.test(L)) return null;

    const a = ac(el);
    // 強シグナル: autocomplete
    if (a === 'email') return { key: 'email' };
    if (a === 'tel' || a.startsWith('tel-')) return { key: 'tel', kind: 'tel' };
    if (a === 'postal-code') return { key: 'postal', kind: 'postal' };
    if (a === 'family-name') return isKanaLabel(L) ? { key: 'familyKana', kata: kataWanted(L) } : { key: 'familyName' };
    if (a === 'given-name') return isKanaLabel(L) ? { key: 'givenKana', kata: kataWanted(L) } : { key: 'givenName' };
    if (a === 'name') return isKanaLabel(L) ? { key: 'fullKana', kata: kataWanted(L) } : { key: 'fullName' };
    if (a === 'address-level1') return { key: 'pref' };
    if (a === 'address-level2') return { key: 'city' };
    if (a === 'street-address' || a === 'address-line1' || a === 'address-line2') return { key: 'address' };
    if (a === 'bday' || a.startsWith('bday-')) return { key: a === 'bday-year' ? 'birthYear' : a === 'bday-month' ? 'birthMonth' : a === 'bday-day' ? 'birthDay' : null, kind: 'bday' };

    // 強シグナル: type
    if (type === 'email') return { key: 'email' };

    // email（住所系の説明文が混ざる欄は除外）
    if ((/(e-?mail|メール|めーる|Ｅメール)/i.test(L) || /\bemail\b/i.test(attr)) && !/住所|郵便|〒|都道府県|市区町村|番地|丁目|町名/.test(L)) return { key: 'email' };
    // tel
    if (type === 'tel' || /(電話|携帯|連絡先)/.test(L) || /\b(tel|phone)\b/i.test(both)) return { key: 'tel', kind: 'tel' };
    // 郵便
    if (/(郵便|〒|ゆうびん)/.test(L) || /\b(zip|postal|postcode)\b/i.test(both)) return { key: 'postal', kind: 'postal' };
    // 都道府県 / 市区町村 / 建物 / 住所
    if (/(都道府県|とどうふけん)/.test(L) || /\bpref(ecture)?\b/i.test(attr)) return { key: 'pref' };
    if (/(市区町村|市町村|区市町村)/.test(L) || /\bcity\b/i.test(attr)) return { key: 'city' };
    if (/(建物|マンション|アパート|ビル名|部屋|号室)/.test(L) || /\b(building|apt|apartment|room)\b/i.test(attr)) return { key: 'building' };
    if (/(番地|丁目|町名|それ以降|以降の住所)/.test(L) || /\b(street|address[-_]?line)\b/i.test(attr) || (/住所/.test(L) && !/都道府県|市区町村|郵便|メール/.test(L))) return { key: 'address' };
    // 生年月日
    if (/(生年月日|誕生日)/.test(L) || /\bbirth(day)?\b/i.test(attr)) return { key: null, kind: 'bday' };

    // 氏名（フルネームを先に判定）
    if (/(氏名|お?名前|ご芳名|フルネーム|full ?name|お客様名|ご担当者名?)/i.test(L)) return isKanaLabel(L) ? { key: 'fullKana', kata: kataWanted(L) } : { key: 'fullName' };
    if (isKanaLabel(L)) {
      if (/(姓|苗字|セイ|せい)/.test(L)) return { key: 'familyKana', kata: kataWanted(L) };
      if (/(名|メイ|めい)/.test(L)) return { key: 'givenKana', kata: kataWanted(L) };
      return { key: 'fullKana', kata: kataWanted(L) };
    }
    if (/(姓|苗字)/.test(L) || /\b(family|last)[-_ ]?name\b/i.test(attr)) return { key: 'familyName' };
    if (/名/.test(L) || /\b(given|first)[-_ ]?name\b/i.test(attr)) return { key: 'givenName' };
    return null;
  }

  // ── 値セット（React/Vue対応） ──
  function setNativeValue(el, value) {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype
      : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && desc.set) desc.set.call(el, value); else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function fillSelect(el, value) {
    if (value == null || value === '') return false;
    const norm = (s) => String(s).replace(/\s/g, '');
    const target = norm(value);
    let opt = [...el.options].find((o) => norm(o.value) === target || norm(o.textContent) === target);
    if (!opt) opt = [...el.options].find((o) => norm(o.textContent).includes(target) || (o.value && norm(o.value).includes(target)));
    if (!opt) return false;
    setNativeValue(el, opt.value);
    return true;
  }
  function profileValue(p, d) {
    switch (d.key) {
      case 'familyName': return p.familyName;
      case 'givenName': return p.givenName;
      case 'fullName': return [p.familyName, p.givenName].filter(Boolean).join(' ');
      case 'familyKana': return d.kata ? p.familyKana : kata2hira(p.familyKana);
      case 'givenKana': return d.kata ? p.givenKana : kata2hira(p.givenKana);
      case 'fullKana': { const k = [p.familyKana, p.givenKana].filter(Boolean).join(' '); return d.kata ? k : kata2hira(k); }
      case 'email': return p.email;
      case 'pref': return p.pref; case 'city': return p.city;
      case 'address': return p.address; case 'building': return p.building;
      case 'birthYear': return p.birthYear; case 'birthMonth': return p.birthMonth; case 'birthDay': return p.birthDay;
      case 'tel': return p.tel; case 'postal': return p.postal;
      default: return '';
    }
  }
  function fillBday(el, d, p) {
    let key = d.key;
    if (!key && el.tagName === 'SELECT') {
      const nums = [...el.options].map((o) => parseInt(String(o.value || o.textContent).replace(/[^0-9]/g, ''), 10)).filter((n) => !isNaN(n) && n > 0);
      const max = nums.length ? Math.max(...nums) : 0;
      key = max > 31 ? 'birthYear' : max <= 12 ? 'birthMonth' : 'birthDay';
    }
    if (!key && el.type === 'date') {
      if (p.birthYear && p.birthMonth && p.birthDay) { setNativeValue(el, `${p.birthYear}-${String(p.birthMonth).padStart(2, '0')}-${String(p.birthDay).padStart(2, '0')}`); return true; }
      return false;
    }
    if (!key) { const L = specificLabel(el) || blockLabel(el); key = /年|year/i.test(L) ? 'birthYear' : /月|month/i.test(L) ? 'birthMonth' : /日|day/i.test(L) ? 'birthDay' : null; }
    if (!key) return false;
    const v = p[key]; if (v == null || v === '') return false;
    if (el.tagName === 'SELECT') return fillSelect(el, v) || fillSelect(el, String(parseInt(v, 10)));
    setNativeValue(el, v); return true;
  }
  function splitTel(all, n) {
    if (n >= 3) { if (all.length === 11) return [all.slice(0, 3), all.slice(3, 7), all.slice(7)]; return [all.slice(0, 3), all.slice(3, 6), all.slice(6)]; }
    if (n === 2) return [all.slice(0, 3), all.slice(3)];
    return [all];
  }
  function genderOf(el) {
    const v = (el.value || '').trim();
    if (/^(女|女性|female|woman|f)$/i.test(v)) return '女';
    if (/^(男|男性|male|man|m)$/i.test(v)) return '男';
    const t = specificLabel(el);
    if (/女性|女子|^\s*女\s*$/.test(t) && !/男/.test(t)) return '女';
    if (/男性|男子|^\s*男\s*$/.test(t) && !/女/.test(t)) return '男';
    return '';
  }

  // 対象フォームを1つに絞る（decide一致欄が最多のform）。無ければ document。
  function pickRoot() {
    const forms = [...document.querySelectorAll('form')];
    let best = null, bestN = 0;
    for (const f of forms) {
      const n = [...f.querySelectorAll('input,select,textarea')].filter((el) => isFillable(el) && decide(el)).length;
      if (n > bestN) { bestN = n; best = f; }
    }
    return bestN > 0 ? best : document;
  }
  // お届け先/配送先など「本人以外」のセクションは除外
  function inRecipientSection(el) {
    let n = el.parentElement;
    for (let i = 0; i < 7 && n; i++, n = n.parentElement) {
      const head = n.querySelector && n.querySelector('legend,h1,h2,h3,h4,.title,.heading,dt');
      const ht = (head ? head.textContent : '') + ' ' + (n.className || '') + ' ' + ((n.getAttribute && n.getAttribute('id')) || '');
      if (/ご注文者|注文者情報|ご本人|申込者|応募者|購入者|billing/i.test(ht)) return false;
      if (/お届け先|送り先|配送先|届け先|送付先|宛先|別の住所|ギフト|プレゼント|gift|shipping|delivery/i.test(ht)) return true;
    }
    return false;
  }

  let filling = false;
  function fill() {
    if (filling) return 0;
    const p = getProfile();
    if (!hasGM) { toast('保存にはTampermonkey等(GM対応)が必要です。設定を確認してください', 'warn'); return 0; }
    if (!p.familyName && !p.email && !p.tel) { toast('先に「設定」で個人情報を入力してください', 'warn'); openSettings(); return 0; }

    filling = true;
    arm(1500); // 入力中(と直後)のプログラム的送信をブロック
    let count = 0;
    try {
      const root = pickRoot();
      const scope = root === document ? document : root;
      const all = [...scope.querySelectorAll('input, select, textarea')].filter(isFillable);
      const fields = all.filter((el) => !inRecipientSection(el));

      const telEls = fields.filter((el) => { const d = decide(el); return d && d.key === 'tel'; });
      const postalEls = fields.filter((el) => { const d = decide(el); return d && d.key === 'postal'; });
      const usedKeys = new Set();
      let emailCount = 0;

      for (const el of fields) {
        const d = decide(el);
        if (!d) continue;

        if (d.kind === 'radio') {
          if (!p.gender) continue;
          if (genderOf(el) === p.gender) { el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); count++; }
          continue;
        }

        // email は確認欄のため最大2回まで許可。それ以外の key は1回だけ。
        if (d.key === 'email') {
          if (!p.email || emailCount >= 2) continue;
          setNativeValue(el, p.email); emailCount++; count++;
          continue;
        }
        const dedupKey = d.kind === 'bday' ? 'bday:' + el.name + el.id : d.key || d.kind;
        if (dedupKey && usedKeys.has(dedupKey)) continue;

        if (d.kind === 'bday') { if (fillBday(el, d, p)) { count++; } continue; }

        if (el.tagName === 'SELECT') { if (fillSelect(el, profileValue(p, d))) { count++; usedKeys.add(dedupKey); } continue; }

        if (d.key === 'tel') {
          const num = digits(p.tel); if (!num) continue;
          if (telEls.length >= 2) { const parts = splitTel(num, telEls.length); const v = parts[telEls.indexOf(el)]; if (v != null) { setNativeValue(el, v); count++; } }
          else { setNativeValue(el, num); count++; usedKeys.add('tel'); }
          continue;
        }
        if (d.key === 'postal') {
          const num = digits(p.postal); if (!num) continue;
          if (postalEls.length >= 2) { const parts = [num.slice(0, 3), num.slice(3, 7)]; const v = parts[postalEls.indexOf(el)]; if (v != null) { setNativeValue(el, v); count++; } }
          else { setNativeValue(el, num); count++; usedKeys.add('postal'); }
          continue;
        }

        const v = profileValue(p, d);
        if (v == null || v === '') continue;
        setNativeValue(el, v); count++; usedKeys.add(dedupKey);
      }
    } finally {
      filling = false;
    }

    toast(count
      ? `✅ ${count}項目を自動入力しました。内容を確認して、同意チェックと送信はご自身で押してください。`
      : '入力できる項目が見つかりませんでした', count ? 'ok' : 'warn');
    return count;
  }

  // ── UI ──
  let toastEl;
  function toast(msg, kind) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.style.cssText = 'position:fixed;z-index:2147483647;left:50%;bottom:76px;transform:translateX(-50%);max-width:90vw;padding:12px 16px;border-radius:12px;font:600 13px/1.5 system-ui,sans-serif;box-shadow:0 8px 30px #0006;color:#fff;transition:opacity .3s;pointer-events:none;text-align:center';
      document.body.appendChild(toastEl);
    }
    toastEl.style.background = kind === 'ok' ? '#166534' : kind === 'warn' ? '#92400e' : '#1f2937';
    toastEl.textContent = msg;
    toastEl.style.opacity = '1';
    clearTimeout(toastEl.__t);
    toastEl.__t = setTimeout(() => { toastEl.style.opacity = '0'; }, 5000);
  }
  function launcher() {
    if (document.getElementById('pokeca-af-btn')) return;
    const b = document.createElement('button');
    b.id = 'pokeca-af-btn'; b.type = 'button'; b.textContent = '🎴 自動入力';
    b.title = 'ポケカ抽選 自動入力（送信はしません・右クリックで設定）';
    b.style.cssText = 'position:fixed;z-index:2147483647;right:16px;bottom:16px;padding:11px 15px;border:0;border-radius:999px;background:#e6b450;color:#131313;font:800 13px system-ui,sans-serif;box-shadow:0 6px 20px #0007;cursor:pointer';
    b.addEventListener('click', (e) => { e.preventDefault(); fill(); });
    b.addEventListener('contextmenu', (e) => { e.preventDefault(); openSettings(); });
    document.body.appendChild(b);
  }
  function openSettings() {
    if (document.getElementById('pokeca-af-modal')) return;
    const p = getProfile();
    const rows = [
      ['familyName', '姓（漢字）', 'text'], ['givenName', '名（漢字）', 'text'],
      ['familyKana', 'セイ（カナ）', 'text'], ['givenKana', 'メイ（カナ）', 'text'],
      ['email', 'メールアドレス', 'email'], ['tel', '電話番号（数字）', 'tel'],
      ['postal', '郵便番号（数字）', 'text'], ['pref', '都道府県', 'text'],
      ['city', '市区町村', 'text'], ['address', '番地・町名以降', 'text'],
      ['building', '建物名・部屋番号', 'text'],
      ['birthYear', '生年(西暦)', 'text'], ['birthMonth', '生月', 'text'], ['birthDay', '生日', 'text'],
      ['gender', '性別（男/女）', 'text'],
    ];
    const wrap = document.createElement('div');
    wrap.id = 'pokeca-af-modal';
    wrap.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#000a;display:flex;align-items:center;justify-content:center;padding:16px';
    wrap.innerHTML =
      '<div style="background:#12151c;color:#e8ebf2;max-width:480px;width:100%;max-height:88vh;overflow:auto;border:1px solid #2a2f3a;border-radius:16px;padding:20px;font:14px system-ui,sans-serif">' +
      '<div style="font-weight:800;font-size:16px;margin-bottom:4px">🎴 自動入力の設定</div>' +
      '<div style="color:#8b93a7;font-size:12px;margin-bottom:14px">この情報はTampermonkey内にだけ保存され、どこにも送信されません。送信ボタンは自動では押しません。</div>' +
      (hasGM ? '' : '<div style="color:#f0a martial;color:#fca55b;font-size:12px;margin-bottom:12px">⚠ GM対応の拡張(Tampermonkey等)が検出できません。保存できない可能性があります。</div>') +
      '<div id="pokeca-af-fields" style="display:grid;grid-template-columns:1fr 1fr;gap:10px"></div>' +
      '<div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">' +
      '<button id="pokeca-af-cancel" style="padding:9px 14px;border:1px solid #2a2f3a;background:#1b2130;color:#e8ebf2;border-radius:9px;cursor:pointer">閉じる</button>' +
      '<button id="pokeca-af-save" style="padding:9px 16px;border:0;background:#e6b450;color:#131313;border-radius:9px;font-weight:800;cursor:pointer">保存</button>' +
      '</div></div>';
    document.body.appendChild(wrap);
    const grid = wrap.querySelector('#pokeca-af-fields');
    for (const [key, label, type] of rows) {
      const wide = ['email', 'address', 'building'].includes(key);
      const cell = document.createElement('label');
      cell.style.cssText = 'display:flex;flex-direction:column;gap:4px;font-size:11px;color:#8b93a7' + (wide ? ';grid-column:1/3' : '');
      cell.innerHTML = label + '<input data-k="' + key + '" type="' + type + '" style="padding:8px;border:1px solid #2a2f3a;background:#0d1015;color:#e8ebf2;border-radius:8px;font-size:14px">';
      cell.querySelector('input').value = p[key] || '';
      grid.appendChild(cell);
    }
    wrap.querySelector('#pokeca-af-cancel').onclick = () => wrap.remove();
    wrap.addEventListener('click', (e) => { if (e.target === wrap) wrap.remove(); });
    wrap.querySelector('#pokeca-af-save').onclick = () => {
      const next = {};
      grid.querySelectorAll('input[data-k]').forEach((i) => { next[i.getAttribute('data-k')] = i.value.trim(); });
      next.familyKana = hira2kata(next.familyKana);
      next.givenKana = hira2kata(next.givenKana);
      const ok = store.set(PROFILE_KEY, next);
      wrap.remove();
      toast(ok ? '設定を保存しました' : '保存に失敗しました（GM対応拡張が必要）', ok ? 'ok' : 'warn');
    };
  }

  try {
    if (typeof GM_registerMenuCommand === 'function') {
      GM_registerMenuCommand('🎴 このフォームに自動入力', fill);
      GM_registerMenuCommand('⚙ 自動入力の設定', openSettings);
    }
  } catch { /* ignore */ }

  // ── 起動 ──
  function hasFillableForm() {
    return [...document.querySelectorAll('input, select, textarea')].filter(isFillable).some((el) => decide(el));
  }
  function onAllowedDomain() {
    const host = location.hostname.toLowerCase().replace(/\.$/, '');
    return getAllow().some((d) => { d = String(d).toLowerCase().replace(/^\.+|\.+$/g, ''); return host === d || host.endsWith('.' + d); });
  }
  function hasLotterySignal() {
    const t = (document.title || '') + ' ' + (document.body ? document.body.innerText.slice(0, 3000) : '');
    return /抽選|応募|申込|申し込み|エントリー|entry|lottery|購入申込/i.test(t);
  }

  function init() {
    if (!hasFillableForm()) return;
    // 無関係ページ(銀行/SNS等)にボタンを出さない: 許可ドメイン or 抽選シグナルのみ
    if (onAllowedDomain() || hasLotterySignal()) launcher();
    if (onAllowedDomain() && !window.__pokeca_af_done) { window.__pokeca_af_done = true; setTimeout(fill, 600); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
