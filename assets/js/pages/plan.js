// 計畫頁：讀 data/plans/<id>.json → 檢查格式 → 顯示；打開後由程式驗證附近景點。（旅費估算暫停，cost.js 先保留）
import { html } from '../util.js';
import { validatePlan } from '../schema.js';
import { lookupNearby, classify, THRESHOLD_KM, DEFAULT_KM, MAX_SHOWN } from '../geo.js';
import { linksFor, routeUrl } from '../links.js';
import { pick } from '../recommend.js';
import { getAnswers, setAnswers, getPlanState, setPlanState, getMyPlans } from '../store.js';

const app = document.getElementById('app');
const url = (p) => new URL(`../../../data/${p}`, import.meta.url).href;
async function getJson(p) {
  const res = await fetch(url(p));
  if (!res.ok) throw new Error(`${p} ${res.status}`);
  return res.json();
}
const set = (el, tpl) => { el.innerHTML = String(tpl); };
const $ = (id) => document.getElementById(id);

const S = { plan: null, region: null, qn: null, answers: getAnswers(), st: null, raw: null, progress: 0, slide: 0 };
const TYPE_LABEL = { place: '地點', activity: '活動' };
const STATE_BADGE = {
  verified: ['badge-ok', '已驗證'], unverified: ['badge-mute', '未驗證'],
  too_far: ['badge-bad', '已過濾・太遠'], not_found: ['badge-bad', '已過濾・查不到'],
};

function message(title, body) {
  set(app, html`<a class="back" href="./index.html">← 回首頁</a><section class="panel"><h2>${title}</h2>${body}</section>`);
}

async function init() {
  const id = new URLSearchParams(location.search).get('id');
  if (!id) return message('沒有指定計畫', html`<p>網址要像 <code>plan.html?id=kyoto-kinkakuji</code>。回首頁挑一個吧。</p>`);
  let plan, params;
  try {
    [params, S.qn] = await Promise.all([getJson('cost-params.json'), getJson('questionnaire.json')]);
  } catch {
    return message('資料讀取失敗', html`<p>請用 <code>python -m http.server 8000</code> 開啟網站，不要直接雙擊 HTML 檔。</p>`);
  }
  try { plan = await getJson(`plans/${encodeURIComponent(id)}.json`); } // 內建計畫優先
  catch { plan = getMyPlans().find((p) => p && p.id === id); }          // 找不到再看使用者建立的
  if (!plan) {
    return message('找不到這個計畫', html`<p>「${id}」讀不到，可能是 id 打錯，或這個計畫是在別台電腦、別的瀏覽器建立的。</p>`);
  }
  const errors = validatePlan(plan, { regions: params.regions });
  if (errors.length) {
    return message('這個計畫的格式有問題', html`<p>修好下面這些再重新整理：</p><ul class="errors">${errors.map((e) => html`<li>${e}</li>`)}</ul>`);
  }
  S.plan = plan; S.region = params.regions[plan.region];
  S.st = { added: [], ...(getPlanState(id) || {}) };
  document.title = `${plan.title} — AI Travel Quest`;
  renderSkeleton(); renderPhotos(); renderNearby(); renderMine();
  S.raw = await lookupNearby(plan, (n) => { S.progress = n; renderNearby(); });
  renderNearby();
}

function renderSkeleton() {
  const p = S.plan;
  const mapUrl = linksFor(p.center.name, p.center.query)[0].url;
  set(app, html`
    <a class="back" href="./index.html">← 回首頁</a>
    <section class="plan-head">
      <div class="tags"><span class="badge badge-type">${TYPE_LABEL[p.type]}</span><span class="badge badge-mute">${S.region.label}</span></div>
      <h1>${p.title}</h1>
    </section>
    ${p.user_note ? html`<section class="panel note"><h2>你的想法</h2><p>${p.user_note}</p></section>` : ''}
    ${p.photos.length ? html`<section class="panel" id="photos" tabindex="0" aria-label="${p.title}的照片"></section>` : ''}
    <section class="panel"><h2>簡介</h2><p>${p.summary}</p></section>
    <section class="panel">
      <h2>路線 <span class="pill">建議停留 ${p.stay_time}</span></h2>
      <ol class="route">${p.route.map((r) => html`<li>${r}</li>`)}</ol>
    </section>
    <section class="panel">
      <h2>營業時間與門票 <span class="badge badge-warn">待確認</span></h2>
      <p>營業時間和票價會變動，這裡不放數字。出發前請到地圖頁確認：<a href="${mapUrl}" target="_blank" rel="noopener">在 Google 地圖查看 ${p.center.name}</a></p>
    </section>
    <section class="panel" id="nearby"></section>
    <section class="panel" id="mine"></section>
    <section class="panel">
      <h2>小提醒與資料來源</h2>
      ${p.tips.length ? html`<ul>${p.tips.map((t) => html`<li>${t}</li>`)}</ul>` : ''}
      <p class="small">資料來源：${p.sources.join('、')}　整理日期：${p.checked_date}　信心程度：${p.confidence}</p>
    </section>`);
}

/* ---------- 照片輪播 ---------- */
function renderPhotos() {
  const el = $('photos');
  if (!el) return;
  const list = S.plan.photos, n = list.length, cur = list[S.slide];
  const nav = n > 1 ? html`
    <button class="slide-btn prev" data-act="slide-prev" aria-label="上一張">‹</button>
    <button class="slide-btn next" data-act="slide-next" aria-label="下一張">›</button>` : '';
  const dots = n > 1 ? html`<div class="slide-dots">${list.map((_, i) => html`<button class="slide-dot ${i === S.slide ? 'on' : ''}" data-act="slide-go" data-v="${i}" aria-label="第 ${i + 1} 張" aria-current="${i === S.slide ? 'true' : 'false'}"></button>`)}</div>` : '';
  set(el, html`
    <div class="slide"><img src="./assets/img/website/${encodeURIComponent(cur.file)}" alt="${cur.caption || S.plan.title}">${nav}</div>
    <div class="slide-foot"><span class="slide-cap">${cur.caption}</span>${n > 1 ? html`<span class="slide-count">${S.slide + 1} / ${n}</span>` : ''}</div>
    ${dots}`);
}
function goSlide(i) {
  const n = S.plan.photos.length;
  if (n < 2) return;
  S.slide = (i + n) % n;
  renderPhotos();
}

/* ---------- 附近推薦 ---------- */
function prefsView() {
  const { interests, transport } = S.answers;
  return html`
    <div class="prefs">
      <div><strong>你的興趣</strong> <small class="small">（可複選；不選就是全部）</small>
        <div class="chips">${S.qn.interests.map((i) => html`<button class="chip ${interests.includes(i.id) ? 'on' : ''}" data-act="interest" data-v="${i.id}" aria-pressed="${interests.includes(i.id) ? 'true' : 'false'}">${i.label}</button>`)}</div></div>
      <div><strong>怎麼移動</strong>
        <div class="chips">${S.qn.transport.map((t) => html`<button class="chip ${transport === t.id ? 'on' : ''}" data-act="transport" data-v="${t.id}" aria-pressed="${transport === t.id ? 'true' : 'false'}">${t.label}<small>${t.hint}</small></button>`)}</div></div>
    </div>`;
}

function spotCard(s) {
  const added = S.st.added.includes(s.name);
  const [bc, bt] = STATE_BADGE[s.state];
  return html`
    <article class="spot">
      <div class="spot-head"><h3>${s.name}</h3><span class="badge ${bc}">${bt}</span></div>
      <p>${s.reason}</p>
      ${s.matchedLabels && s.matchedLabels.length ? html`<p class="match">符合你選的：${s.matchedLabels.join('、')}</p>` : ''}
      <div class="links"><a class="route" href="${routeUrl(S.plan.center.query, s.query)}" target="_blank" rel="noopener">🗺️ 怎麼去（請先在 Google 地圖確認路線）</a><span>外部搜尋連結：</span>${linksFor(s.name, s.query).map((l) => html`<a href="${l.url}" target="_blank" rel="noopener">${l.label}</a>`)}</div>
      <button class="btn ${added ? 'btn-ghost' : 'btn-primary'}" data-act="${added ? 'remove' : 'add'}" data-v="${s.name}">${added ? '已加入（點一下移除）' : '＋ 加入計畫'}</button>
    </article>`;
}

function renderNearby() {
  const el = $('nearby');
  const head = html`<h2>附近推薦</h2><p class="small">AI 先推薦，再由程式查座標、算距離。「已驗證」只代表地圖上查得到名稱、兩點直線距離在範圍內（距離由程式在背景計算，不顯示）。<strong>實際路程會比直線長，出發前請先用 Google 地圖確認行程路線。</strong></p>${prefsView()}`;
  if (!S.raw) {
    const names = S.plan.nearby.map((n, i) => html`<li>${n.name} <span class="badge badge-mute">${i < S.progress ? '查完了' : '驗證中…'}</span></li>`);
    return set(el, html`${head}<p>程式正在查座標，約需 5 秒（地圖服務限制每秒查一次）。</p><ul class="pending">${names}</ul>`);
  }
  const km = THRESHOLD_KM[S.answers.transport] ?? DEFAULT_KM;
  const all = classify(S.raw, km);
  const { shown, fallback } = pick(all.filter((i) => i.state === 'verified'), S.answers.interests, Object.fromEntries(S.qn.interests.map((i) => [i.id, i.label])));
  let main = shown.slice(0, MAX_SHOWN);
  let banner = fallback ? html`<p class="notice soft">沒有符合你興趣的景點，先顯示全部。</p>` : '';
  if (!S.raw.centerOk) banner = html`<p class="notice">沒辦法確認「${S.plan.center.name}」的位置（可能是網路問題），下面的景點都沒有驗證，距離也不知道。</p>`;
  if (!main.length) main = all.filter((i) => i.state === 'unverified');
  const mainNames = new Set(main.map((i) => i.name));
  const rest = all.filter((i) => !mainNames.has(i.name));
  const body = main.length
    ? html`<div class="spots">${main.map(spotCard)}</div>`
    : html`<p class="notice">直線 ${km} 公里內沒有查得到的推薦景點。可以改成「大眾運輸」放寬範圍，或展開下面看被過濾的。</p>`;
  const restView = rest.length ? html`
    <details class="filtered"><summary>已過濾與未列入的景點（${rest.length}）</summary>
      <p class="small">被擋下的原因寫在標籤上，可以用來判斷 AI 的推薦準不準。</p>
      <div class="spots">${rest.map((s) => spotCard(s))}</div></details>` : '';
  set(el, html`${head}${banner}${body}${restView}`);
}

/* ---------- 我的計畫 ---------- */
function renderMine() {
  const list = S.st.added;
  set($('mine'), html`
    <h2>我的計畫 <span class="pill">${list.length} 個景點</span></h2>
    ${list.length
      ? html`<ul class="mine">${list.map((n) => html`<li>${n} <button class="btn btn-ghost btn-sm" data-act="remove" data-v="${n}">移除</button></li>`)}</ul>`
      : html`<p>還沒加入景點。從上面的推薦挑幾個吧。</p>`}`);
}

/* ---------- 事件 ---------- */
function saveState() { setPlanState(S.plan.id, S.st); }
app.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const v = b.dataset.v;
  switch (b.dataset.act) {
    case 'interest': {
      const a = S.answers.interests;
      S.answers.interests = a.includes(v) ? a.filter((x) => x !== v) : [...a, v];
      setAnswers(S.answers); renderNearby(); break;
    }
    case 'slide-prev': goSlide(S.slide - 1); break;
    case 'slide-next': goSlide(S.slide + 1); break;
    case 'slide-go': goSlide(Number(v)); break;
    case 'transport': S.answers.transport = v; setAnswers(S.answers); renderNearby(); break;
    case 'add': if (!S.st.added.includes(v)) S.st.added.push(v); saveState(); renderNearby(); renderMine(); break;
    case 'remove': S.st.added = S.st.added.filter((x) => x !== v); saveState(); renderNearby(); renderMine(); break;
  }
});
app.addEventListener('keydown', (e) => { // 照片區取得焦點時，左右鍵切換
  if (!e.target.closest || !e.target.closest('#photos')) return;
  if (e.key === 'ArrowLeft') { goSlide(S.slide - 1); e.preventDefault(); }
  if (e.key === 'ArrowRight') { goSlide(S.slide + 1); e.preventDefault(); }
});
let touchX = null; // 手機左右滑動
app.addEventListener('touchstart', (e) => { touchX = e.target.closest('#photos') ? e.touches[0].clientX : null; }, { passive: true });
app.addEventListener('touchend', (e) => {
  if (touchX == null) return;
  const dx = e.changedTouches[0].clientX - touchX; touchX = null;
  if (Math.abs(dx) > 40) goSlide(S.slide + (dx < 0 ? 1 : -1));
}, { passive: true });

init();
