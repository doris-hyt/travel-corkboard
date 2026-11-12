// 旅費算式。價格只來自 cost-params.json 與計畫的 fixed_fares，不由 AI 給。
export const LEVELS = ['low', 'mid', 'high'];
export const LEVEL_LABEL = { low: '低', mid: '中', high: '高' };
const SYMBOL = { JPY: '¥', TWD: 'NT$', KRW: '₩', USD: '$' };
export const money = (currency, n) => `${SYMBOL[currency] || currency + ' '}${Math.round(n).toLocaleString('en-US')}`;

export function calcCosts(region, plan, { days, people, addedCount }) {
  const fixedOne = plan.fixed_fares.reduce((s, f) => s + f.one_way * (f.round_trip ? 2 : 1), 0);
  const levels = {};
  for (const lv of LEVELS) {
    const { fare, rides_per_day: rides } = region.transit[lv];
    const transit = fare * (rides * days + addedCount) * people + fixedOne * people;
    const meal = region.meal_per_day[lv] * days * people;
    levels[lv] = {
      transit, meal, total: transit + meal, twd: Math.round((transit + meal) * region.twd_rate),
      transitFormula: `${fare} × (${rides} 趟 × ${days} 天 + ${addedCount} 個景點) × ${people} 人`
        + (fixedOne ? ` + ${fixedOne} × ${people} 人（固定交通）` : ''),
      mealFormula: `${region.meal_per_day[lv]} × ${days} 天 × ${people} 人`,
    };
  }
  return { levels, currency: region.currency, source: region.source, checked: region.checked,
    twdRate: region.twd_rate, rateChecked: region.rate_checked };
}
