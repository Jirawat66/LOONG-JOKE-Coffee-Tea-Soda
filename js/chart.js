// กราฟแท่งแนวตั้งแบบง่าย (ข้อมูลชุดเดียว) ใช้ในรายงานยอดขาย
// items: [{ label, value, tip }]  แกนตั้ง = value, แกนนอน = label
import { el } from './dom.js';

// ปัดค่าสูงสุดของแกนให้เป็นเลขสวย ๆ แบ่งได้ 4 ช่อง
function niceScale(max) {
  if (max <= 0) return { top: 4, step: 1 };
  const raw = max / 4;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw);
  return { top: step * 4, step };
}

export function columnChart({ items, format = String, label }) {
  const max = Math.max(0, ...items.map((i) => i.value));
  const { top, step } = niceScale(max);
  const peak = items.reduce((best, i) => (i.value > (best?.value ?? 0) ? i : best), null);

  const grid = el('div', { class: 'chart-grid', 'aria-hidden': 'true' },
    Array.from({ length: 5 }, (_, i) => {
      const value = step * i;
      return el('div', { class: 'chart-gridline', style: `bottom: ${(value / top) * 100}%` },
        el('span', { class: 'chart-tick', text: format(value) }));
    }));

  const tip = el('div', { class: 'chart-tip', role: 'status', hidden: true });
  const bars = el('div', { class: 'chart-bars' });
  const showTip = (col, item) => {
    tip.textContent = item.tip;
    tip.hidden = false;
    const bar = col.querySelector('.chart-bar');
    const half = tip.offsetWidth / 2;
    const center = col.offsetLeft + col.offsetWidth / 2;
    tip.style.left = `${Math.min(Math.max(center, half), bars.offsetWidth - half)}px`;
    tip.style.top = `${bar.offsetTop}px`;
  };
  const hideTip = () => { tip.hidden = true; };

  for (const item of items) {
    const col = el('div', { class: 'chart-col', tabindex: '0', 'aria-label': item.tip },
      el('div', { class: `chart-bar${item.value ? '' : ' chart-bar-zero'}`, style: `height: ${(item.value / top) * 100}%` },
        item === peak ? el('span', { class: 'chart-peak', text: format(item.value) }) : null));
    col.addEventListener('pointerenter', () => showTip(col, item));
    col.addEventListener('focus', () => showTip(col, item));
    col.addEventListener('pointerleave', hideTip);
    col.addEventListener('blur', hideTip);
    bars.append(col);
  }

  return el('figure', { class: 'chart', 'aria-label': label },
    el('div', { class: 'chart-plot' }, grid, bars, tip),
    el('div', { class: 'chart-labels', 'aria-hidden': 'true' }, items.map((i) => el('span', { text: i.label })))
  );
}
