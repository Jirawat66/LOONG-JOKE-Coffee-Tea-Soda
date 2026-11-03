// หน้าร้าน: shop.html
import { store, isDemo } from './store.js';
import { dayKey, shopTime } from './time.js';
import { $, el, baht } from './dom.js';
import { createReport } from './report.js';
import { createQrPanel } from './qr.js';

const STATUS_LABEL = { new: 'ใหม่', making: 'กำลังทำ', done: 'เสร็จแล้ว', cancelled: 'ยกเลิก' };
const LOGIN_ERRORS = {
  'auth/too-many-requests': 'ใส่รหัสผิดหลายครั้ง รอสักครู่แล้วลองใหม่',
  'auth/network-request-failed': 'เชื่อมต่ออินเทอร์เน็ตไม่ได้ ตรวจสอบสัญญาณแล้วลองใหม่'
};

let menu = null;
let today = dayKey();
let orders = [];
let seen = new Set();
let firstSnapshot = true;
let confirming = null; // id ของออเดอร์ที่กำลังถามยืนยันยกเลิก
const busy = new Set();
const failed = new Set();
let soldOut = new Set();
let unsubOrders = null;
let unsubSoldOut = null;
let started = false;

// ---------- เสียงแจ้งเตือน ----------
let audio = null;

function ensureAudio() {
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') audio.resume();
  } catch {
    audio = null;
  }
  updateSoundBanner();
}

function updateSoundBanner() {
  $('sound-banner').hidden = !!audio && audio.state === 'running';
}

function chime() {
  if (!audio || audio.state !== 'running') return;
  const start = audio.currentTime;
  [880, 1175, 880, 1175].forEach((freq, i) => {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const t = start + i * 0.18;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    osc.connect(gain).connect(audio.destination);
    osc.start(t);
    osc.stop(t + 0.17);
  });
}

document.addEventListener('pointerdown', () => { if (started) ensureAudio(); });
$('sound-banner').addEventListener('click', () => { ensureAudio(); chime(); });

// ---------- เปิดหน้าจอค้างไว้ ----------
let wakeLock = null;

async function keepAwake() {
  try {
    if ('wakeLock' in navigator && document.visibilityState === 'visible' && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    }
  } catch {
    // เครื่องไม่รองรับหรือไม่อนุญาต ไม่เป็นไร
  }
}

document.addEventListener('visibilitychange', () => { if (started) keepAwake(); });

// ---------- ล็อกอิน ----------
function showLogin() {
  stopApp();
  $('loading').hidden = true;
  $('app').hidden = true;
  $('logout').hidden = true;
  $('login').hidden = false;
  $('demo-hint').hidden = !isDemo;
  $('password').value = '';
  $('password').focus();
}

$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const error = $('login-error');
  const password = $('password').value;
  error.hidden = true;
  if (!password) {
    error.textContent = 'ใส่รหัสก่อนกดเข้าสู่ระบบ';
    error.hidden = false;
    return;
  }
  ensureAudio();
  const button = $('login-btn');
  button.disabled = true;
  button.textContent = 'กำลังตรวจรหัส…';
  try {
    await store.signIn(password);
  } catch (err) {
    error.textContent = LOGIN_ERRORS[err.code] ?? 'รหัสไม่ถูกต้อง ลองใหม่อีกครั้ง';
    error.hidden = false;
    $('password').select();
  } finally {
    button.disabled = false;
    button.textContent = 'เข้าสู่ระบบ';
  }
});

$('logout').addEventListener('click', () => store.signOut());

// ---------- หน้าร้าน ----------
function showApp() {
  $('loading').hidden = true;
  $('login').hidden = true;
  $('app').hidden = false;
  $('logout').hidden = false;
  if (started) return;
  started = true;
  firstSnapshot = true;
  seen = new Set();
  updateSoundBanner();
  keepAwake();
  watchToday();
  unsubSoldOut = store.watchSoldOut((ids) => {
    soldOut = ids;
    renderStock();
  });
}

function stopApp() {
  started = false;
  report.hide();
  showTab('orders');
  unsubOrders?.();
  unsubSoldOut?.();
  unsubOrders = unsubSoldOut = null;
  wakeLock?.release().catch(() => {});
}

function watchToday() {
  today = dayKey();
  $('shop-date').textContent = new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  unsubOrders?.();
  orders = [];
  renderOrders();
  unsubOrders = store.watchOrders(today, today, (list) => {
    const arrivals = list.filter((o) => o.status === 'new' && !seen.has(o.id));
    list.forEach((o) => seen.add(o.id));
    if (!firstSnapshot && arrivals.length) chime();
    firstSnapshot = false;
    orders = list;
    renderOrders();
  });
}

// เปลี่ยนวันตอนเที่ยงคืน และอัปเดต "กี่นาทีที่แล้ว"
setInterval(() => {
  if (!started) return;
  if (dayKey() !== today) {
    firstSnapshot = true;
    watchToday();
  } else {
    renderOrders();
  }
}, 30000);

function minutesAgo(ms) {
  const mins = Math.floor((Date.now() - ms) / 60000);
  return mins < 1 ? 'เมื่อสักครู่' : `${mins} นาทีที่แล้ว`;
}

async function changeStatus(order, status) {
  busy.add(order.id);
  failed.delete(order.id);
  confirming = null;
  renderOrders();
  try {
    await store.setStatus(order.id, status);
  } catch (err) {
    console.error(err);
    failed.add(order.id);
  } finally {
    busy.delete(order.id);
    renderOrders();
  }
}

function renderOrders() {
  const byStatus = (s) => orders.filter((o) => o.status === s);
  const lanes = {
    new: byStatus('new'),
    making: byStatus('making'),
    finished: orders.filter((o) => o.status === 'done' || o.status === 'cancelled').reverse()
  };
  for (const [lane, list] of Object.entries(lanes)) {
    $(`count-${lane}`).textContent = list.length;
    $(`lane-${lane}`).replaceChildren(...(list.length
      ? list.map(renderTicket)
      : [el('li', { class: 'empty-lane', text: lane === 'new' ? 'ยังไม่มีออเดอร์ใหม่' : 'ไม่มีรายการ' })]));
  }
  const waiting = lanes.new.length;
  document.title = `${waiting ? `(${waiting}) ` : ''}หน้าร้าน · LOONG JOKE`;
}

function renderTicket(order) {
  const isBusy = busy.has(order.id);
  const actions = [];

  if (confirming === order.id) {
    actions.push(el('div', { class: 'ticket-confirm' },
      el('p', { text: `ยกเลิกออเดอร์โต๊ะ ${order.table} ใช่ไหม?` }),
      el('button', { type: 'button', class: 'lj-btn lj-btn-secondary', onclick: () => changeStatus(order, 'cancelled'), text: 'ยกเลิกออเดอร์' }),
      el('button', { type: 'button', class: 'lj-btn lj-btn-quiet', onclick: () => { confirming = null; renderOrders(); }, text: 'ไม่ใช่' })
    ));
  } else if (order.status === 'new' || order.status === 'making') {
    const next = order.status === 'new' ? { status: 'making', label: 'เริ่มทำ' } : { status: 'done', label: 'เสร็จแล้ว' };
    actions.push(
      el('button', { type: 'button', class: 'lj-btn lj-btn-primary', disabled: isBusy, onclick: () => changeStatus(order, next.status), text: isBusy ? 'กำลังบันทึก…' : next.label }),
      el('button', { type: 'button', class: 'lj-btn lj-btn-quiet', disabled: isBusy, onclick: () => { confirming = order.id; renderOrders(); }, text: 'ยกเลิก' })
    );
  } else {
    actions.push(
      el('span', { class: `lj-badge lj-badge-${order.status}`, text: STATUS_LABEL[order.status] }),
      el('button', {
        type: 'button',
        class: 'lj-btn lj-btn-quiet',
        disabled: isBusy,
        onclick: () => changeStatus(order, order.status === 'done' ? 'making' : 'new'),
        text: order.status === 'done' ? 'ย้อนกลับไปกำลังทำ' : 'กู้คืนออเดอร์'
      })
    );
  }

  return el('li', { class: `ticket ticket-${order.status}` },
    el('div', { class: 'ticket-head' },
      el('span', { class: 'ticket-table', text: `โต๊ะ ${order.table}` }),
      el('span', { class: 'ticket-time' },
        `${shopTime(new Date(order.createdAt))} น.`,
        el('br'),
        order.status === 'new' || order.status === 'making' ? minutesAgo(order.createdAt) : STATUS_LABEL[order.status])
    ),
    el('ul', { class: 'ticket-lines' }, order.items.map((item) =>
      el('li', { class: 'ticket-line' },
        el('span', { class: 'ticket-qty', text: `${item.qty}×` }),
        el('span', { class: 'ticket-name' },
          item.name,
          el('span', { class: 'ticket-meta', text: item.sweetnessName }),
          item.note ? el('span', { class: 'ticket-note', text: item.note }) : null)
      ))),
    el('div', { class: 'ticket-total' }, el('span', { text: 'รวม' }), el('span', { text: baht(order.total) })),
    failed.has(order.id) ? el('p', { class: 'error ticket-error', role: 'alert', text: 'บันทึกไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง' }) : null,
    el('div', { class: 'ticket-actions' }, actions)
  );
}

// ---------- เมนูหมด ----------
let stockError = false;

function renderStock() {
  if (!menu) return;
  $('stock-list').replaceChildren(
    ...(stockError ? [el('p', { class: 'error', role: 'alert', text: 'บันทึกไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง' })] : []),
    ...menu.categories.map((cat) =>
      el('section', { class: 'stock-cat' },
        el('h2', { class: 'stock-cat-title', text: cat.name }),
        el('div', { class: 'stock-grid' }, menu.items.filter((i) => i.category === cat.id).map((item) => {
          const out = soldOut.has(item.id);
          return el('button', {
            type: 'button',
            class: 'stock-item',
            'aria-pressed': String(out),
            onclick: async () => {
              stockError = false;
              try {
                await store.setSoldOut(item.id, !out);
              } catch (err) {
                console.error(err);
                stockError = true;
                renderStock();
              }
            }
          },
            el('span', { class: 'stock-name' }, item.name, item.nameTh && item.nameTh !== item.name ? el('span', { class: 'ticket-meta', text: item.nameTh }) : null),
            el('span', { class: `stock-state lj-badge ${out ? 'lj-badge-out' : 'stock-on'}`, text: out ? 'หมด' : 'มีขาย' })
          );
        }))
      )
    )
  );
}

// ---------- แท็บ ----------
const report = createReport({ store, container: $('view-report') });
const qrPanel = createQrPanel($('view-qr'));
const TABS = ['orders', 'stock', 'report', 'qr'];

function showTab(name) {
  for (const tab of TABS) {
    $(`tab-${tab}`).setAttribute('aria-current', String(tab === name));
    $(`view-${tab}`).hidden = tab !== name;
  }
  if (name === 'report') report.show();
  else report.hide();
  if (name === 'qr') qrPanel.show();
}

TABS.forEach((tab) => $(`tab-${tab}`).addEventListener('click', () => showTab(tab)));

// ---------- เริ่ม ----------
async function start() {
  try {
    const res = await fetch('data/menu.json', { cache: 'no-store' });
    menu = await res.json();
  } catch (err) {
    console.error(err);
  }
  store.watchAuth((isShop) => (isShop ? showApp() : showLogin()));
}

start();
