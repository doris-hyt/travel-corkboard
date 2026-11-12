// 計畫格式檢查。純邏輯，不碰畫面；網頁與 scripts/check.mjs 共用。
export const TYPES = ['place', 'activity'];
export const TAGS = ['food', 'culture', 'nature', 'shopping', 'photo'];
export const CONFIDENCE = ['低', '中', '高'];

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const URL_RE = /https?:\/\/|www\./i;
const PRICE_RE = /\d[\d,.]*\s*(元|円|日圓|日元|塊|TWD|NT\$?|JPY|USD|美元)|[¥￥$]\s*\d/i;
const HOURS_RE = /營業時間|營業中|開放時間|門票|入場費|入場券|票價|拜觀料|收費/;

const PLAN_KEYS = ['id', 'title', 'type', 'region', 'user_note', 'photos', 'center', 'summary', 'route',
  'stay_time', 'tips', 'nearby', 'fixed_fares', 'sources', 'checked_date', 'confidence'];
const NEARBY_KEYS = ['name', 'query', 'reason', 'tags'];
const PHOTO_KEYS = ['file', 'caption'];
const PHOTO_FILE = /^[a-z0-9][a-z0-9._-]*\.(jpe?g|png|webp)$/i;
export const MAX_PHOTOS = 8;

const isStr = (v) => typeof v === 'string' && v.trim().length > 0;

function sameKeys(obj, keys, label, errs) {
  const extra = Object.keys(obj).filter((k) => !keys.includes(k));
  const missing = keys.filter((k) => !(k in obj));
  if (extra.length) errs.push(`${label} 有多餘欄位：${extra.join('、')}（欄位固定，不可自行增減）`);
  if (missing.length) errs.push(`${label} 缺少欄位：${missing.join('、')}`);
}

// ---- AI 草稿：聊天 AI 或範例檔輸出，格式＝計畫去掉由程式補的欄位，id 換成 slug ----
const DRAFT_KEYS = ['slug', 'title', 'type', 'region', 'center', 'summary', 'route', 'stay_time', 'tips', 'nearby'];
export const AI_ERRORS = {
  off_topic: '這段內容好像和旅遊無關，換一個景點或活動再試試。',
  unsupported_region: '這個地點目前還不在支援範圍內（現在只有日本・京都），請改填支援地區的景點。',
};

function localDate() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// 把可能夾帶說明文字或 ``` 圍欄的 AI 回應解析成物件；失敗會丟出 Error
export function parseJsonLoose(text) {
  const s = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('找不到 JSON，請確認貼上的是完整的回應');
  try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { throw new Error(`JSON 格式不正確：${e.message}`); }
}

// 補上程式負責的欄位。slug 與既有 id 重複就加 -2、-3…
export function draftToPlan(draft, { userNote = '', existingIds = [] }) {
  let id = draft.slug, n = 2;
  while (existingIds.includes(id)) id = `${draft.slug}-${n++}`;
  return {
    id, title: draft.title, type: draft.type, region: draft.region, user_note: userNote, photos: [],
    center: draft.center, summary: draft.summary, route: draft.route, stay_time: draft.stay_time, tips: draft.tips,
    nearby: draft.nearby, fixed_fares: [], sources: ['使用者提供的資料與 AI 整理'], checked_date: localDate(), confidence: '低',
  };
}

// 回傳錯誤陣列；{"error":"off_topic"} 等回傳該代碼（單一元素，對應 AI_ERRORS）
export function validateAiDraft(d, { regions = {} } = {}) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return ['草稿必須是 JSON 物件'];
  if (typeof d.error === 'string' && AI_ERRORS[d.error]) return [d.error];
  const errs = [];
  sameKeys(d, DRAFT_KEYS, '草稿', errs);
  if (errs.length) return errs;
  return validatePlan(draftToPlan(d, {}), { regions });
}

// 回傳錯誤陣列，空陣列＝通過
export function validatePlan(p, { regions = {} } = {}) {
  const errs = [];
  if (!p || typeof p !== 'object' || Array.isArray(p)) return ['計畫必須是 JSON 物件'];
  sameKeys(p, PLAN_KEYS, '計畫', errs);
  if (!KEBAB.test(p.id || '')) errs.push('id 必須是英文小寫 kebab-case，例如 kyoto-kinkakuji');
  if (!isStr(p.title)) errs.push('title 不可空白');
  if (!TYPES.includes(p.type)) errs.push('type 必須是 place 或 activity');
  if (!(p.region in regions)) errs.push(`region「${p.region}」不在 cost-params.json（可用：${Object.keys(regions).join('、')}）`);
  if (typeof p.user_note !== 'string' || p.user_note.length > 500) errs.push('user_note 必須是字串，最多 500 字');
  if (!Array.isArray(p.photos) || p.photos.length > MAX_PHOTOS) errs.push(`photos 必須是陣列，最多 ${MAX_PHOTOS} 張`);
  else p.photos.forEach((ph, i) => {
    const L = `photos[${i}]`;
    if (!ph || typeof ph !== 'object') return errs.push(`${L} 必須是物件`);
    sameKeys(ph, PHOTO_KEYS, L, errs);
    if (!isStr(ph.file) || !PHOTO_FILE.test(ph.file)) errs.push(`${L}.file 只能是 assets/img/website/ 裡的檔名（jpg、png、webp），不可含路徑`);
    if (typeof ph.caption !== 'string' || ph.caption.length > 40) errs.push(`${L}.caption 必須是字串，最多 40 字（可留空）`);
  });
  if (!p.center || !isStr(p.center.name) || !isStr(p.center.query)) errs.push('center 必須有 name 與 query');
  else if (Object.keys(p.center).length !== 2) errs.push('center 只能有 name 與 query（不要寫經緯度）');
  if (!isStr(p.summary)) errs.push('summary 不可空白');
  else if (p.summary.length < 60 || p.summary.length > 150) errs.push(`summary 要 60–150 字（目前 ${p.summary.length} 字）`);
  if (!Array.isArray(p.route) || p.route.length < 3 || p.route.length > 6 || !p.route.every(isStr)) errs.push('route 要 3–6 步，每步一句');
  if (!isStr(p.stay_time)) errs.push('stay_time 不可空白');
  if (!Array.isArray(p.tips) || p.tips.length > 3 || !p.tips.every(isStr)) errs.push('tips 最多 3 則');
  if (!Array.isArray(p.nearby) || p.nearby.length !== 4) errs.push('nearby 必須剛好 4 個');
  else p.nearby.forEach((n, i) => {
    const L = `nearby[${i}]`;
    if (!n || typeof n !== 'object') return errs.push(`${L} 必須是物件`);
    sameKeys(n, NEARBY_KEYS, L, errs);
    if (!isStr(n.name) || !isStr(n.query)) errs.push(`${L} 需要 name 與 query`);
    if (!isStr(n.reason) || n.reason.trim().length < 10) errs.push(`${L}.reason 要具體說明為什麼推薦（至少 10 字）`);
    if (!Array.isArray(n.tags) || n.tags.length < 1 || n.tags.length > 3 || !n.tags.every((t) => TAGS.includes(t)))
      errs.push(`${L}.tags 要 1–3 個，只能用：${TAGS.join('、')}`);
  });
  if (!Array.isArray(p.fixed_fares)) errs.push('fixed_fares 必須是陣列');
  else p.fixed_fares.forEach((f, i) => {
    if (!f || !isStr(f.label) || !(f.one_way > 0) || typeof f.round_trip !== 'boolean' || !isStr(f.source) || !DATE.test(f.checked || ''))
      errs.push(`fixed_fares[${i}] 需要 label、one_way、round_trip、source、checked`);
  });
  if (!Array.isArray(p.sources) || !p.sources.every(isStr)) errs.push('sources 必須是字串陣列');
  if (!DATE.test(p.checked_date || '')) errs.push('checked_date 格式要 YYYY-MM-DD');
  if (!CONFIDENCE.includes(p.confidence)) errs.push('confidence 必須是 低／中／高');

  // 全文檢查：網址、價格、營業時間／門票（user_note 是使用者自己的話，不檢查）
  const { user_note, ...rest } = p;
  if (URL_RE.test(JSON.stringify(rest))) errs.push('不可出現網址（資訊連結由程式依名稱產生）');
  const texts = [p.summary, ...(Array.isArray(p.route) ? p.route : []), ...(Array.isArray(p.tips) ? p.tips : []), p.stay_time,
    ...(Array.isArray(p.nearby) ? p.nearby.map((n) => n && n.reason) : []),
    ...(Array.isArray(p.photos) ? p.photos.map((ph) => ph && ph.caption) : [])];
  if (texts.some((t) => typeof t === 'string' && PRICE_RE.test(t))) errs.push('不可出現價格（價格只來自參數表）');
  if (texts.some((t) => typeof t === 'string' && HOURS_RE.test(t))) errs.push('不可出現營業時間或門票（畫面會標示「待確認」）');
  return errs;
}
