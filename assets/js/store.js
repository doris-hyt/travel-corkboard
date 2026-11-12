// localStorage 讀寫。所有 key 都在這裡定義，格式：atq.<名稱>.v<版本>
export const KEYS = {
  geocache: 'atq.geocache.v1', // Nominatim 查詢快取
  answers: 'atq.answers.v1',   // 問卷答案
  plans: 'atq.plans.v1',       // 每個計畫的已加入景點
  myplans: 'atq.myplans.v1',   // 瀏覽器裡的使用者計畫（llm wiki 版不會新增，保留讀取）
  covers: 'atq.covers.v1',     // 封面圖（縮小後的 dataURL，以計畫 id 為 key）
};

export function read(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
export function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

export const getAnswers = () => ({ interests: [], transport: 'transit', ...read(KEYS.answers, {}) });
export const setAnswers = (a) => write(KEYS.answers, a);
export const getMyPlans = () => read(KEYS.myplans, []);
export function saveMyPlan(plan) {
  return write(KEYS.myplans, [...getMyPlans().filter((p) => p.id !== plan.id), plan]);
}
export const getCover = (id) => read(KEYS.covers, {})[id] || null;
export function setCover(id, dataUrl) {
  const all = read(KEYS.covers, {});
  all[id] = dataUrl;
  return write(KEYS.covers, all); // 空間滿了會回傳 false
}

export const getPlanState = (id) => read(KEYS.plans, {})[id] || null;
export function setPlanState(id, state) {
  const all = read(KEYS.plans, {});
  all[id] = state;
  return write(KEYS.plans, all);
}
