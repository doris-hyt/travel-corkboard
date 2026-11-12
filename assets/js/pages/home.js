// 首頁：讀 data/plans/index.json 的內建計畫，加上使用者建立的計畫，顯示成寶麗來卡片。
import { html } from '../util.js';
import { validatePlan } from '../schema.js';
import { getMyPlans, getCover } from '../store.js';

const grid = document.getElementById('grid');
const count = document.getElementById('count');
const url = (p) => new URL(`../../../data/${p}`, import.meta.url).href;
async function getJson(p) {
  const r = await fetch(url(p));
  if (!r.ok) throw new Error(`${p} ${r.status}`);
  return r.json();
}
const TYPE_LABEL = { place: '地點', activity: '活動' };
const firstSentence = (s) => (String(s).split(/(?<=[。！？])/)[0] || '').trim();

function card(plan, errors) {
  const href = `./plan.html?id=${encodeURIComponent(plan.id)}`;
  if (errors.length) {
    return html`<a class="card" href="${href}"><div class="photo"><span class="badge badge-bad">格式錯誤</span>⚠️</div>
      <h3>${plan.id || '（沒有 id）'}</h3><p>這個計畫的格式有問題，點進去看原因。</p></a>`;
  }
  const first = plan.photos[0];
  const cover = getCover(plan.id) || (first ? `./assets/img/website/${encodeURIComponent(first.file)}` : null); // 沒有照片時用 📍／🎒
  return html`
    <a class="card" href="${href}">
      <div class="photo ${plan.type}"><span class="badge badge-type">${TYPE_LABEL[plan.type]}</span>${cover ? html`<img src="${cover}" alt="">` : (plan.type === 'place' ? '📍' : '🎒')}</div>
      <h3>${plan.title}</h3>
      <p>${firstSentence(plan.summary)}</p>
      <div class="meta"><span>⏱ ${plan.stay_time}</span><span class="go">看計畫 →</span></div>
    </a>`;
}

async function init() {
  let ids, regions;
  try {
    [ids, { regions }] = await Promise.all([getJson('plans/index.json'), getJson('cost-params.json')]);
  } catch {
    grid.innerHTML = '<p class="notice">資料讀取失敗。請用 <code>python -m http.server 8000</code> 開啟網站，不要直接雙擊 HTML 檔。</p>';
    return;
  }
  const loaded = await Promise.all(ids.map(async (id) => {
    try { return await getJson(`plans/${id}.json`); } catch { return { id, __missing: true }; }
  }));
  const builtinIds = new Set(ids);
  const mine = getMyPlans().filter((p) => p && !builtinIds.has(p.id)); // 同名以內建為準
  const all = [...loaded, ...mine];
  const cards = all.map((p) => (p.__missing
    ? html`<div class="card"><div class="photo"><span class="badge badge-bad">讀不到</span>⚠️</div><h3>${p.id}</h3><p>index.json 有列，但找不到這個檔案。</p></div>`
    : card(p, validatePlan(p, { regions }))));
  count.textContent = `${all.length} 個計畫`;
  grid.innerHTML = String(html`${cards}<div class="card placeholder">跟 AI 說「新增一個計畫：XXX」<br>🧳</div>`);
}

init();
