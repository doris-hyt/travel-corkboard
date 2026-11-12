// 資訊連結由程式依名稱產生，不使用 AI 給的網址（常是編造的）。
const q = encodeURIComponent;
export function linksFor(name, query) {
  return [
    { label: 'Google 地圖', url: `https://www.google.com/maps/search/?api=1&query=${q(query || name)}` },
    { label: 'Google 搜尋', url: `https://www.google.com/search?q=${q(name + ' 旅遊')}` },
  ];
}

// 「怎麼去」：開 Google 地圖的大眾運輸路線，班次與時間由地圖即時提供，本站不存。
export const routeUrl = (fromQuery, toQuery) =>
  `https://www.google.com/maps/dir/?api=1&origin=${q(fromQuery)}&destination=${q(toQuery)}&travelmode=transit`;
