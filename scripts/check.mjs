// 驗收：檢查所有計畫格式、檔名與 id 一致、index.json 與資料夾一致。
// 用法：npm run check　　或　node scripts/check.mjs --fix-index（依資料夾重寫 index.json）
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validatePlan, TAGS } from '../assets/js/schema.js';
import { buildSpots, spotsJson, loadPlans } from './build-spots.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (p) => JSON.parse(readFileSync(root + p, 'utf8'));
const fix = process.argv.includes('--fix-index');
let bad = 0;
const fail = (msg) => { bad++; console.log(`✗ ${msg}`); };

const params = read('data/cost-params.json');
const qn = read('data/questionnaire.json');
const qTags = qn.interests.map((i) => i.id).sort().join(',');
if (qTags !== [...TAGS].sort().join(',')) fail(`questionnaire.json 的興趣標籤（${qTags}）與 schema.js 的 TAGS 不一致`);

const files = readdirSync(root + 'data/plans').filter((f) => f.endsWith('.json') && f !== 'index.json').map((f) => f.slice(0, -5)).sort();
if (fix) {
  writeFileSync(root + 'data/plans/index.json', JSON.stringify(files, null, 2) + '\n');
  console.log(`已重寫 data/plans/index.json（${files.length} 個計畫）`);
}
const index = read('data/plans/index.json');
for (const f of files) if (!index.includes(f)) fail(`${f}.json 存在，但沒登記在 index.json（首頁會看不到；可執行 --fix-index）`);
for (const i of index) if (!files.includes(i)) fail(`index.json 列了 ${i}，但找不到 data/plans/${i}.json`);

for (const f of files) {
  let plan;
  try { plan = read(`data/plans/${f}.json`); } catch (e) { fail(`${f}.json 不是合法的 JSON：${e.message}`); continue; }
  if (plan.id !== f) fail(`${f}.json 的 id 是「${plan.id}」，必須和檔名一樣`);
  const errs = validatePlan(plan, { regions: params.regions });
  if (errs.length) { fail(`${f}.json`); errs.forEach((e) => console.log(`    - ${e}`)); }
  else {
    const missing = plan.photos.filter((ph) => !existsSync(root + 'assets/img/website/' + ph.file));
    if (missing.length) { fail(`${f}.json`); missing.forEach((ph) => console.log(`    - 找不到照片 assets/img/website/${ph.file}`)); }
    else console.log(`✓ ${f}`);
  }
}
// 景點總表要和計畫檔一致（不一致就重跑 npm run spots）
try {
  const fresh = spotsJson(buildSpots(loadPlans()));
  if (readFileSync(root + 'data/spots.json', 'utf8') !== fresh) fail('data/spots.json 和計畫檔不一致，請執行 npm run spots');
  else console.log('✓ spots.json');
} catch (e) { fail(`data/spots.json 讀不到或計畫檔有問題：${e.message}（可執行 npm run spots）`); }
console.log(bad ? `\n共 ${bad} 個問題` : `\n全部通過（${files.length} 個計畫）`);
process.exit(bad ? 1 : 0);
