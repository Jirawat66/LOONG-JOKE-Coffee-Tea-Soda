// รายงานยอดขาย (แท็บ "ยอดขาย" ในหน้าร้าน)
// นับเฉพาะออเดอร์ที่ "เสร็จแล้ว" ออเดอร์ที่ยกเลิกหรือยังทำไม่เสร็จไม่นับ
import { dayKey, addDays, weekStart, monthKey, shopHour, thaiDate } from './time.js';
import { el } from './dom.js';
import { columnChart } from './chart.js';

const num = (n) => n.toLocaleString('th-TH');
const money = (n) => `${num(n)} ฿`;
const cupsOf = (order) => order.items.reduce((s, i) => s + i.qty, 0);

function summarize(orders) {
  const done = orders.filter((o) => o.status === 'done');
  const items = new Map();
  for (const order of done) {
    for (const item of order.items) {
      const row = items.get(item.id) ?? { name: item.name, nameTh: item.nameTh, cups: 0, baht: 0 };
      row.cups += item.qty;
      row.baht += item.price * item.qty;
      items.set(item.id, row);
    }
  }
  return {
    done,
    baht: done.reduce((sum, o) => sum + o.total, 0),
    cups: done.reduce((sum, o) => sum + cupsOf(o), 0),
    orders: done.length,
    cancelled: orders.filter((o) => o.status === 'cancelled').length,
    pending: orders.filter((o) => o.status === 'new' || o.status === 'making').length,
    items: [...items.values()].sort((a, b) => b.cups - a.cups || b.baht - a.baht)
  };
}

export function createReport({ store, container }) {
  let mode = 'day';
  let day = dayKey();
  let week = weekStart(day);
  let year = Number(day.slice(0, 4));
  let orders = null;
  let totals = null; // { allTime, months: [{ key, baht, orders }] } หรือ { error }
  let unsubscribe = null;
  let loadId = 0;

  // ---------- โหลดข้อมูล ----------
  function load() {
    unsubscribe?.();
    unsubscribe = null;
    orders = null;
    totals = null;
    render();
    if (mode === 'total') {
      loadTotals();
      return;
    }
    const [from, to] = mode === 'day' ? [day, day] : [week, addDays(week, 6)];
    unsubscribe = store.watchOrders(from, to, (list) => {
      orders = list;
      render();
    });
  }

  async function loadTotals() {
    const id = ++loadId;
    try {
      const months = Array.from({ length: 12 }, (_, i) => ({ key: monthKey(year, i + 1), until: monthKey(year, i + 2) }));
      const [allTime, ...results] = await Promise.all([
        store.salesTotal(),
        ...months.map((m) => store.salesTotal({ from: m.key, until: m.until }))
      ]);
      if (id !== loadId) return;
      totals = { allTime, months: months.map((m, i) => ({ key: m.key, ...results[i] })) };
    } catch (err) {
      console.error(err);
      if (id !== loadId) return;
      totals = { error: true };
    }
    render();
  }

  function go(step) {
    if (mode === 'day') day = addDays(day, step);
    else if (mode === 'week') week = addDays(week, step * 7);
    else year += step;
    load();
  }

  function setMode(next) {
    mode = next;
    load();
  }

  function goToNow() {
    day = dayKey();
    week = weekStart(day);
    year = Number(day.slice(0, 4));
    load();
  }

  // ---------- ส่วนหัว ----------
  function periodLabel() {
    if (mode === 'day') return thaiDate(day, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    if (mode === 'week') {
      const end = addDays(week, 6);
      return `${thaiDate(week, { day: 'numeric', month: 'short' })} – ${thaiDate(end, { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    return `ปี ${year + 543}`;
  }

  function controls() {
    const today = dayKey();
    const isNow = mode === 'day' ? day === today : mode === 'week' ? week === weekStart(today) : year === Number(today.slice(0, 4));
    const unit = { day: 'วัน', week: 'สัปดาห์', total: 'ปี' }[mode];
    const modes = [['day', 'รายวัน'], ['week', 'รายสัปดาห์'], ['total', 'ยอดรวม']];
    return el('div', { class: 'report-controls' },
      el('div', { class: 'segmented', role: 'group', 'aria-label': 'ช่วงเวลา' },
        modes.map(([id, text]) => el('button', { type: 'button', class: 'tab', 'aria-pressed': String(mode === id), onclick: () => setMode(id), text }))),
      el('div', { class: 'period-nav' },
        el('button', { type: 'button', class: 'lj-step-btn', 'aria-label': `${unit}ก่อนหน้า`, onclick: () => go(-1), text: '‹' }),
        el('span', { class: 'period-label', 'aria-live': 'polite', text: periodLabel() }),
        el('button', { type: 'button', class: 'lj-step-btn', 'aria-label': `${unit}ถัดไป`, disabled: isNow, onclick: () => go(1), text: '›' }),
        isNow ? null : el('button', { type: 'button', class: 'lj-btn lj-btn-quiet period-now', onclick: goToNow, text: `${unit}นี้` })
      )
    );
  }

  function tile(label, value, primary = false) {
    return el('div', { class: `tile${primary ? ' tile-primary' : ''}` },
      el('span', { class: 'tile-label', text: label }),
      el('span', { class: 'tile-value', text: value })
    );
  }

  function section(id, title, ...content) {
    return el('section', { class: 'report-section', 'aria-labelledby': id },
      el('h3', { class: 'report-title', id, text: title }), ...content);
  }

  // ---------- วาด ----------
  function render() {
    const parts = mode === 'total' ? renderTotal() : renderPeriod();
    container.replaceChildren(controls(), ...parts.filter(Boolean));
  }

  function renderPeriod() {
    if (!orders) return [el('p', { class: 'loading', text: 'กำลังโหลดยอดขาย…' })];
    const s = summarize(orders);
    return [
      el('div', { class: 'tiles' },
        tile('ยอดขาย', money(s.baht), true),
        tile('จำนวนแก้ว', `${num(s.cups)} แก้ว`),
        tile('ออเดอร์ที่เสร็จ', `${num(s.orders)} ออเดอร์`),
        tile('ยกเลิก', `${num(s.cancelled)} ออเดอร์`)),
      s.pending ? el('p', { class: 'report-note', text: `ยังมี ${s.pending} ออเดอร์ที่ยังทำไม่เสร็จ ยอดนี้ยังไม่นับรวม` }) : null,
      byHour(s.done),
      mode === 'week' ? byDay(orders) : null,
      byItem(s.items)
    ];
  }

  // ช่วงเวลาที่ลูกค้าซื้อ: จำนวนแก้วในแต่ละชั่วโมง (ตามเวลาที่สั่ง)
  function byHour(done) {
    const title = mode === 'day' ? 'ช่วงเวลาที่ขายได้' : 'ช่วงเวลาที่ขายได้ (รวมทั้งสัปดาห์)';
    if (!done.length) return section('by-hour-title', title, el('p', { class: 'empty', text: 'ยังไม่มียอดขายในช่วงนี้' }));
    const hours = done.map((o) => shopHour(new Date(o.createdAt)));
    const first = Math.min(9, ...hours);
    const last = Math.max(15, ...hours);
    const items = [];
    for (let h = first; h <= last; h++) {
      const inHour = done.filter((o, i) => hours[i] === h);
      const cups = inHour.reduce((s, o) => s + cupsOf(o), 0);
      const baht = inHour.reduce((s, o) => s + o.total, 0);
      const hh = String(h).padStart(2, '0');
      items.push({ label: `${hh}:00`, value: cups, tip: `${hh}:00–${hh}:59 น. · ${num(cups)} แก้ว · ${num(inHour.length)} ออเดอร์ · ${money(baht)}` });
    }
    const busiest = items.reduce((a, b) => (b.value > a.value ? b : a));
    return section('by-hour-title', title,
      el('p', { class: 'report-sub', text: `ขายดีที่สุดช่วง ${busiest.label}–${busiest.label.slice(0, 2)}:59 น. (${num(busiest.value)} แก้ว)` }),
      columnChart({ items, format: (v) => num(v), label: 'จำนวนแก้วที่ขายได้ในแต่ละชั่วโมง' }));
  }

  function byDay(list) {
    const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
    const rows = days.map((key) => ({ key, ...summarize(list.filter((o) => dayKey(new Date(o.createdAt)) === key)) }));
    const max = Math.max(1, ...rows.map((r) => r.cups));
    const today = dayKey();
    return section('by-day-title', 'แก้วที่ขายได้แต่ละวัน',
      el('table', { class: 'report-table day-table' },
        el('thead', {}, el('tr', {},
          el('th', { scope: 'col', text: 'วัน' }),
          el('th', { scope: 'col', class: 'bar-col' }, el('span', { class: 'sr-only', text: 'กราฟ' })),
          el('th', { scope: 'col', class: 'num', text: 'แก้ว' }),
          el('th', { scope: 'col', class: 'num', text: 'ยอดขาย' }))),
        el('tbody', {}, rows.map((r) => el('tr', { class: r.key > today ? 'future' : null, title: `${thaiDate(r.key, { weekday: 'long', day: 'numeric', month: 'short' })}: ${r.cups} แก้ว, ${money(r.baht)}` },
          el('th', { scope: 'row', text: thaiDate(r.key, { weekday: 'short', day: 'numeric' }) }),
          el('td', { class: 'bar-col' }, r.cups ? el('span', { class: 'bar', style: `width: ${(r.cups / max) * 100}%` }) : null),
          el('td', { class: 'num', text: num(r.cups) }),
          el('td', { class: 'num', text: money(r.baht) })))))
    );
  }

  function byItem(items) {
    return section('by-item-title', 'ขายได้แต่ละเมนู',
      items.length
        ? el('table', { class: 'report-table' },
          el('thead', {}, el('tr', {},
            el('th', { scope: 'col', text: 'เมนู' }),
            el('th', { scope: 'col', class: 'num', text: 'แก้ว' }),
            el('th', { scope: 'col', class: 'num', text: 'ยอดขาย' }))),
          el('tbody', {}, items.map((i) => el('tr', {},
            el('th', { scope: 'row' }, i.name, i.nameTh && i.nameTh !== i.name ? el('span', { class: 'ticket-meta', text: i.nameTh }) : null),
            el('td', { class: 'num', text: num(i.cups) }),
            el('td', { class: 'num', text: money(i.baht) })))))
        : el('p', { class: 'empty', text: 'ยังไม่มียอดขายในช่วงนี้' }));
  }

  // ยอดรวม: ยอดตั้งแต่เริ่มใช้ระบบ + กราฟยอดขายรายเดือนของปีที่เลือก
  function renderTotal() {
    if (!totals) return [el('p', { class: 'loading', text: 'กำลังรวมยอดขาย…' })];
    if (totals.error) {
      return [el('div', { class: 'report-error' },
        el('p', { class: 'error', role: 'alert', text: 'โหลดยอดรวมไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่ (ถ้าเพิ่งอัปเดตระบบ รอประมาณ 10 นาทีก่อน)' }),
        el('button', { type: 'button', class: 'lj-btn lj-btn-secondary', onclick: load, text: 'ลองใหม่' }))];
    }
    const thisMonth = monthKey(Number(dayKey().slice(0, 4)), Number(dayKey().slice(5, 7)));
    const months = totals.months.filter((m) => m.key <= thisMonth);
    const yearBaht = totals.months.reduce((s, m) => s + m.baht, 0);
    const yearOrders = totals.months.reduce((s, m) => s + m.orders, 0);
    const monthName = (key, month) => thaiDate(key, { month });
    const chartItems = totals.months.map((m) => ({
      label: monthName(m.key, 'short'),
      value: m.baht,
      tip: `${monthName(m.key, 'long')} ${year + 543} · ${money(m.baht)} · ${num(m.orders)} ออเดอร์`
    }));
    return [
      el('div', { class: 'tiles tiles-3' },
        tile('ยอดรวมทั้งหมด (ตั้งแต่เริ่มใช้ระบบ)', money(totals.allTime.baht), true),
        tile(`ยอดขายปี ${year + 543}`, money(yearBaht)),
        tile(`ออเดอร์ปี ${year + 543}`, `${num(yearOrders)} ออเดอร์`)),
      section('by-month-title', `ยอดขายรายเดือน ปี ${year + 543}`,
        yearBaht
          ? columnChart({ items: chartItems, format: (v) => num(v), label: `ยอดขาย (บาท) แต่ละเดือนของปี ${year + 543}` })
          : el('p', { class: 'empty', text: 'ยังไม่มียอดขายในปีนี้' })),
      months.length
        ? section('month-table-title', 'ตารางยอดขายรายเดือน',
          el('table', { class: 'report-table' },
            el('thead', {}, el('tr', {},
              el('th', { scope: 'col', text: 'เดือน' }),
              el('th', { scope: 'col', class: 'num', text: 'ออเดอร์' }),
              el('th', { scope: 'col', class: 'num', text: 'ยอดขาย' }))),
            el('tbody', {}, months.slice().reverse().map((m) => el('tr', {},
              el('th', { scope: 'row', text: monthName(m.key, 'long') }),
              el('td', { class: 'num', text: num(m.orders) }),
              el('td', { class: 'num', text: money(m.baht) }))))))
        : null
    ];
  }

  return {
    show() { if (!unsubscribe && !totals) load(); },
    hide() { unsubscribe?.(); unsubscribe = null; totals = null; loadId++; }
  };
}
