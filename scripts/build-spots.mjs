// 由所有計畫檔合併出景點總表 data/spots.json（同一個景點只留一筆）。
// 用法：npm run spots　　不要手動改 spots.json，改計畫檔後重跑即可。
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

// plans：計畫物件陣列。以 center.query／nearby[].query（不分大小寫、去頭尾空白）當作同一個景點的依據。
export function buildSpots(plans) {
  const map = new Map();
  const add = (name, query, region, tags, appearance) => {
    const key = query.trim().toLowerCase();
    if (!map.has(key)) map.set(key, { name, query, region, tags: new Set(), appearances: [] });
    const s = map.get(key);
    tags.forEach((t) => s.tags.add(t));
    s.appearances.push(appearance);
  };
  for (const p of [...plans].sort((a, b) => a.id.localeCompare(b.id))) {
    add(p.center.name, p.center.query, p.region, [], { plan: p.id, role: 'center' });
    for (const n of p.nearby) add(n.name, n.query, p.region, n.tags, { plan: p.id, role: 'nearby', reason: n.reason });
  }
  return [...map.values()]
    .map((s) => ({ name: s.name, query: s.query, region: s.region, tags: [...s.tags].sort(), appearances: s.appearances }))
    .sort((a, b) => a.region.localeCompare(b.region) || a.name.localeCompare(b.name));
}

export const spotsJson = (spots) => JSON.stringify(spots, null, 2) + '\n';

export function loadPlans() {
  return readdirSync(root + 'data/plans')
    .filter((f) => f.endsWith('.json') && f !== 'index.json')
    .map((f) => JSON.parse(readFileSync(root + 'data/plans/' + f, 'utf8')));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const spots = buildSpots(loadPlans());
  writeFileSync(root + 'data/spots.json', spotsJson(spots));
  console.log(`已寫入 data/spots.json（${spots.length} 個景點）`);
}
