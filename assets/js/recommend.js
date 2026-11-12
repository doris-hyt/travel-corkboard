// 驗證後的景點依興趣篩選並排序。
// 沒選興趣＝不篩選；選了＝只留標籤有交集的，交集越多越前面，相同則距離近的在前。
// 篩完一個都不剩時改回全部，並用 fallback 告訴畫面要顯示提示。
export function pick(verified, interests, tagLabels) {
  const scored = verified.map((i) => {
    const matched = i.tags.filter((t) => interests.includes(t));
    return { ...i, matchedLabels: matched.map((t) => tagLabels[t] || t), matchCount: matched.length };
  });
  const order = (a, b) => b.matchCount - a.matchCount || a.km - b.km;
  if (!interests.length) return { shown: scored.sort(order), fallback: false };
  const hit = scored.filter((i) => i.matchCount > 0).sort(order);
  if (hit.length || !scored.length) return { shown: hit, fallback: false };
  return { shown: scored.sort(order), fallback: true };
}
