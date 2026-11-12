// 小工具：html 標籤模板會自動跳脫變數，避免 XSS。要放原始 HTML 時用 raw()。
export class Raw {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}
export const raw = (s) => new Raw(s);
const MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => MAP[c]);
function fmt(v) {
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(fmt).join('');
  if (v == null || v === false) return '';
  return esc(v);
}
export function html(strings, ...vals) {
  let out = '';
  strings.forEach((s, i) => { out += s; if (i < vals.length) out += fmt(vals[i]); });
  return new Raw(out);
}
export const fmtNum = (n) => Math.round(n).toLocaleString('en-US');
