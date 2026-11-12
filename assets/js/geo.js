// Nominatim 查座標（排隊＋快取）、Haversine 距離、景點驗證與分類。
import { KEYS, read, write } from './store.js';

export const THRESHOLD_KM = { walk: 1.5, transit: 3 }; // 距離門檻（依問卷交通偏好）
export const DEFAULT_KM = 3;
export const MAX_SHOWN = 3;
const MIN_GAP_MS = 1100; // Nominatim 規定每秒最多 1 次

let chain = Promise.resolve();
let lastAt = 0;
function enqueue(fn) {
  const run = chain.then(async () => {
    const wait = lastAt + MIN_GAP_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    try { return await fn(); } finally { lastAt = Date.now(); }
  });
  chain = run.catch(() => {});
  return run;
}

// 回傳 {lat,lng}；查不到回傳 null；網路錯誤丟出例外，且不寫入快取
export async function geocode(query) {
  const key = query.trim().toLowerCase();
  const cache = read(KEYS.geocache, {});
  if (key in cache) return cache[key].nf ? null : cache[key];
  const data = await enqueue(async () => {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=zh-TW&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);
    return res.json();
  });
  const c = read(KEYS.geocache, {});
  if (!data.length) { c[key] = { nf: 1 }; write(KEYS.geocache, c); return null; }
  const pt = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  c[key] = pt; write(KEYS.geocache, c);
  return pt;
}

export function haversineKm(a, b) {
  const R = 6371, rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 10) / 10;
}

// 查中心點與 4 個景點，回傳原始結果（不含門檻判斷，換門檻不必重查）。
// 中心點查不到或出錯 → 整區視為未驗證。
export async function lookupNearby(plan, onProgress = () => {}) {
  let center = null;
  try { center = await geocode(plan.center.query); } catch { center = null; }
  const items = [];
  for (const n of plan.nearby) {
    let r;
    if (!center) r = { ...n, lookup: 'error' };
    else {
      try {
        const p = await geocode(n.query);
        r = p ? { ...n, lookup: 'found', km: haversineKm(center, p) } : { ...n, lookup: 'not_found' };
      } catch { r = { ...n, lookup: 'error' }; }
    }
    items.push(r);
    onProgress(items.length);
  }
  return { centerOk: !!center, items };
}

// 依距離門檻分成 verified / too_far / not_found / unverified
export function classify(raw, thresholdKm) {
  return raw.items.map((i) => {
    if (!raw.centerOk || i.lookup === 'error') return { ...i, state: 'unverified' };
    if (i.lookup === 'not_found') return { ...i, state: 'not_found' };
    return { ...i, state: i.km <= thresholdKm ? 'verified' : 'too_far' };
  });
}
