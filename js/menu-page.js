// หน้าเมนูของลูกค้า: index.html?table=5
import { TABLE_COUNT } from './config.js';
import { store, isDemo } from './store.js';
import { shopTime, dayKey } from './time.js';
import { $, el, baht, photoUrl } from './dom.js';

const MAX_QTY = 20;
const STATUS_TEXT = {
  new: { badge: 'ใหม่', msg: 'ส่งถึงร้านแล้ว รอสักครู่นะ' },
  making: { badge: 'กำลังทำ', msg: '' },
  done: { badge: 'เสร็จแล้ว', msg: 'เสิร์ฟแล้ว ชำระเงินที่เคาน์เตอร์ได้เลย' },
  cancelled: { badge: 'ยกเลิก', msg: 'ร้านยกเลิกออเดอร์นี้ สอบถามพนักงานได้' }
};

function readSession(key, fallback) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeSession(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // เก็บไม่ได้ก็ยังใช้งานต่อได้ แค่รีเฟรชแล้วตะกร้าจะหาย
  }
}

// ออเดอร์ที่มือถือเครื่องนี้สั่ง เก็บใน localStorage เพราะสแกน QR ใหม่จะเปิดแท็บใหม่
// (sessionStorage หายเมื่อเปิดแท็บใหม่) เก็บเฉพาะของวันนี้: [{ id, day }]
function readMyOrders() {
  try {
    const list = JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]');
    const today = dayKey();
    return Array.isArray(list) ? list.filter((o) => o && o.id && o.day === today) : [];
  } catch {
    return [];
  }
}

function writeMyOrders(list) {
  try {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(list));
  } catch {
    // เก็บไม่ได้: ออเดอร์ยังถึงร้านปกติ แค่สแกนใหม่แล้วจะไม่เห็นรายการ
  }
}

// ---------- state ----------
const tableParam = Number(new URLSearchParams(location.search).get('table'));
const table = Number.isInteger(tableParam) && tableParam >= 1 && tableParam <= TABLE_COUNT ? tableParam : null;
const CART_KEY = `lj-cart-${table}`;
const ORDERS_KEY = `lj-my-orders-${isDemo ? 'demo-' : ''}${table}`;

let menu = null;
let itemsById = new Map();
let soldOut = new Set();
let shopOpen = null; // null = ยังโหลดไม่เสร็จ, หน้าร้านกดเปิด/ปิดเอง
let cart = readSession(CART_KEY, []);
let current = null; // { item, sweetness, qty }
const orderViews = new Map();

function canOrder() {
  return table !== null && shopOpen === true;
}

// ข้อความ "ตอนนี้ยังสั่งไม่ได้" ตามสาเหตุ
function blockedText() {
  return shopOpen === null ? 'กำลังโหลด…' : 'ร้านปิดรับออเดอร์อยู่';
}

function sweetnessName(id) {
  return menu.sweetnessLevels.find((s) => s.id === id)?.name ?? id;
}

// ---------- menu ----------
function renderMenu() {
  const main = $('menu');
  main.replaceChildren();
  const tabs = $('tabs');
  tabs.replaceChildren();

  for (const cat of menu.categories) {
    const items = menu.items.filter((i) => i.category === cat.id);
    if (!items.length) continue;
    const sectionId = `cat-${cat.id}`;
    tabs.append(el('a', { class: 'tab', href: `#${sectionId}`, text: cat.name }));
    main.append(
      el('section', { class: 'category', id: sectionId, 'aria-labelledby': `${sectionId}-title` },
        el('h2', { class: 'category-title', id: `${sectionId}-title`, text: cat.name }),
        el('div', { class: 'grid' }, items.map(renderCard))
      )
    );
  }
  tabs.firstChild?.setAttribute('aria-current', 'true');
  watchTabs();
}

function renderCard(item) {
  const media = item.image
    ? el('img', { src: photoUrl(item.image), alt: '', loading: 'lazy' })
    : el('div', { class: 'lj-card-ph', 'aria-hidden': 'true', text: item.name.trim().charAt(0).toUpperCase() });
  const card = el('button', { type: 'button', class: 'lj-card', 'data-id': item.id, onclick: () => openItem(item) },
    el('div', { class: 'lj-card-media' }, media),
    el('span', { class: 'lj-card-name', text: item.name }),
    item.nameTh && item.nameTh !== item.name ? el('span', { class: 'lj-card-th', text: item.nameTh }) : null,
    el('span', { class: 'lj-card-price', text: baht(item.price) })
  );
  return card;
}

function applySoldOut() {
  document.querySelectorAll('.lj-card').forEach((card) => {
    const out = soldOut.has(card.dataset.id) || itemsById.get(card.dataset.id)?.available === false;
    if (out) card.setAttribute('aria-disabled', 'true');
    else card.removeAttribute('aria-disabled');
    const media = card.querySelector('.lj-card-media');
    media.querySelector('.lj-card-out')?.remove();
    if (out) media.append(el('span', { class: 'lj-card-out' }, el('span', { class: 'lj-badge lj-badge-out', text: 'หมด' })));
  });
}

function isSoldOut(id) {
  return soldOut.has(id) || itemsById.get(id)?.available === false;
}

function watchTabs() {
  const tabs = [...document.querySelectorAll('.tab')];
  const setCurrent = (id) => tabs.forEach((t) => t.setAttribute('aria-current', String(t.getAttribute('href') === `#${id}`)));
  tabs.forEach((t) => t.addEventListener('click', () => setCurrent(t.getAttribute('href').slice(1))));
  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
    if (visible) setCurrent(visible.target.id);
  }, { rootMargin: '-80px 0px -60% 0px' });
  document.querySelectorAll('.category').forEach((s) => observer.observe(s));
}

// ---------- item sheet ----------
function openItem(item) {
  if (isSoldOut(item.id)) return;
  const defaultSweet = menu.sweetnessLevels.find((s) => s.default)?.id ?? menu.sweetnessLevels[0].id;
  current = { item, sweetness: defaultSweet, qty: 1 };

  $('item-media').replaceChildren(item.image
    ? el('img', { src: photoUrl(item.image), alt: '' })
    : el('div', { class: 'lj-card-ph', 'aria-hidden': 'true', text: item.name.trim().charAt(0).toUpperCase() }));
  $('item-title').textContent = item.name;
  $('item-th').textContent = item.nameTh && item.nameTh !== item.name ? item.nameTh : '';
  $('item-th').hidden = !$('item-th').textContent;
  $('item-price').textContent = baht(item.price);
  $('item-note').value = '';
  renderSweetness();
  renderItemQty();
  $('item-sheet').showModal();
}

function renderSweetness() {
  $('sweetness').replaceChildren(...menu.sweetnessLevels.map((s) =>
    el('button', {
      type: 'button',
      class: 'lj-chip',
      'aria-pressed': String(current.sweetness === s.id),
      text: s.name,
      onclick: () => { current.sweetness = s.id; renderSweetness(); }
    })
  ));
}

function renderItemQty() {
  $('qty-value').textContent = current.qty;
  $('qty-minus').disabled = current.qty <= 1;
  $('qty-plus').disabled = current.qty >= MAX_QTY;
  const add = $('add-to-cart');
  add.disabled = !canOrder();
  add.textContent = canOrder() ? `เพิ่มลงตะกร้า · ${baht(current.item.price * current.qty)}` : blockedText();
}

$('qty-minus').addEventListener('click', () => { current.qty = Math.max(1, current.qty - 1); renderItemQty(); });
$('qty-plus').addEventListener('click', () => { current.qty = Math.min(MAX_QTY, current.qty + 1); renderItemQty(); });

$('add-to-cart').addEventListener('click', () => {
  if (!canOrder()) return;
  const note = $('item-note').value.trim();
  const key = `${current.item.id}|${current.sweetness}|${note}`;
  const line = cart.find((l) => l.key === key);
  if (line) line.qty = Math.min(MAX_QTY, line.qty + current.qty);
  else cart.push({ key, id: current.item.id, sweetness: current.sweetness, note, qty: current.qty });
  saveCart();
  $('item-sheet').close();
});

// ---------- cart ----------
const SLOW_SEND_MS = 8000;
let sending = false; // กำลังส่งออเดอร์อยู่ (กันกดสั่งซ้ำ)

function linesTotal(lines) {
  return lines.reduce((sum, l) => sum + (itemsById.get(l.id)?.price ?? 0) * l.qty, 0);
}

function cartTotal() {
  return linesTotal(cart);
}

function showCartError(msg) {
  $('cart-error').textContent = msg;
  $('cart-error').hidden = false;
}

function saveCart() {
  cart = cart.filter((l) => l.qty > 0 && itemsById.has(l.id));
  writeSession(CART_KEY, cart);
  renderCartBar();
  if ($('cart-sheet').open) renderCart();
}

function renderCartBar() {
  const cups = cart.reduce((n, l) => n + l.qty, 0);
  $('cartbar').hidden = cups === 0;
  $('open-cart').replaceChildren(
    el('span', { text: `ดูตะกร้า · ${cups} แก้ว` }),
    el('span', { text: baht(cartTotal()) })
  );
}

function renderCart() {
  if (!sending) $('cart-error').hidden = true;
  const list = $('cart-list');
  if (!cart.length) {
    list.replaceChildren(el('li', {}, el('p', { class: 'empty', text: 'ตะกร้ายังว่างอยู่' })));
  } else {
    list.replaceChildren(...cart.map((line) => {
      const item = itemsById.get(line.id);
      const meta = [sweetnessName(line.sweetness), line.note].filter(Boolean).join(' · ');
      return el('li', { class: 'cart-line' },
        el('div', {},
          el('div', { class: 'cart-line-name', text: item.name }),
          el('div', { class: 'cart-line-meta', text: meta }),
          isSoldOut(line.id) ? el('div', { class: 'error', text: 'เมนูนี้หมดแล้ว' }) : null
        ),
        el('div', { class: 'cart-line-price', text: baht(item.price * line.qty) }),
        el('div', { class: 'cart-line-controls' },
          el('div', { class: 'lj-stepper', role: 'group', 'aria-label': `จำนวน ${item.name}` },
            el('button', { type: 'button', class: 'lj-step-btn', 'aria-label': 'ลดจำนวน', disabled: sending || line.qty <= 1, onclick: () => { line.qty -= 1; saveCart(); }, text: '−' }),
            el('output', { class: 'lj-step-val', text: line.qty }),
            el('button', { type: 'button', class: 'lj-step-btn', 'aria-label': 'เพิ่มจำนวน', disabled: sending || line.qty >= MAX_QTY, onclick: () => { line.qty += 1; saveCart(); }, text: '+' })
          ),
          el('button', { type: 'button', class: 'link-btn', disabled: sending, onclick: () => { line.qty = 0; saveCart(); }, text: 'ลบ' })
        )
      );
    }));
  }
  $('cart-total').textContent = baht(cartTotal());
  const place = $('place-order');
  place.disabled = sending || !cart.length || !canOrder();
  place.textContent = sending ? 'กำลังส่งออเดอร์…' : canOrder() ? 'สั่งเลย' : blockedText();
}

$('open-cart').addEventListener('click', () => {
  renderCart();
  $('cart-sheet').showModal();
});

$('place-order').addEventListener('click', async () => {
  if (sending) return;
  if (!canOrder()) return showCartError('ร้านปิดรับออเดอร์อยู่ ลองใหม่เมื่อร้านเปิด');
  const out = cart.filter((l) => isSoldOut(l.id));
  if (out.length) return showCartError(`${out.map((l) => itemsById.get(l.id).name).join(', ')} หมดแล้ว ลบออกจากตะกร้าก่อนสั่ง`);
  // ไม่มีเน็ต: ไม่ส่ง ไม่อย่างนั้นออเดอร์จะค้างในเครื่อง แล้วไปถึงร้านทีหลังโดยลูกค้าไม่รู้ตัว
  if (navigator.onLine === false) return showCartError('ไม่มีอินเทอร์เน็ต ตรวจสอบสัญญาณแล้วลองอีกครั้ง');

  const lines = [...cart];
  sending = true;
  renderCart();
  // ส่งนานผิดปกติ: บอกว่ายังส่งอยู่ ระบบจะส่งต่อเองเมื่อสัญญาณกลับมา ถ้าปิดหน้าออเดอร์จะไม่ถึงร้าน
  const slow = setTimeout(() => showCartError('สัญญาณอินเทอร์เน็ตอ่อน กำลังส่งออเดอร์อยู่ อย่าเพิ่งปิดหน้านี้'), SLOW_SEND_MS);
  try {
    const items = lines.map((l) => {
      const item = itemsById.get(l.id);
      return { id: item.id, name: item.name, nameTh: item.nameTh, price: item.price, sweetness: l.sweetness, sweetnessName: sweetnessName(l.sweetness), qty: l.qty, note: l.note };
    });
    const id = await store.placeOrder({ table, items, total: linesTotal(lines) });
    writeMyOrders([...readMyOrders(), { id, day: dayKey() }]);
    sending = false;
    // เอาออกเฉพาะรายการที่ส่งไปแล้ว ของที่เพิ่มลงตะกร้าระหว่างรอยังอยู่
    cart = cart.filter((l) => !lines.includes(l));
    saveCart();
    $('cart-sheet').close();
    watchMyOrder(id);
    $('my-orders').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    console.error(err);
    sending = false;
    renderCart();
    // ร้านเพิ่งกดปิดรับออเดอร์ ฐานข้อมูลจึงไม่รับ
    showCartError(err.code === 'permission-denied'
      ? 'ร้านเพิ่งปิดรับออเดอร์ สอบถามพนักงานได้'
      : 'ส่งออเดอร์ไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง');
  } finally {
    clearTimeout(slow);
  }
});

// ---------- my orders ----------
function watchMyOrder(id) {
  if (orderViews.has(id)) return;
  const li = el('li', { class: 'order' });
  orderViews.set(id, li);
  $('order-list').prepend(li);
  $('my-orders').hidden = false;
  store.watchOrder(id, (order) => {
    if (!order) {
      li.remove();
      $('my-orders').hidden = !$('order-list').children.length;
      return;
    }
    const s = STATUS_TEXT[order.status] ?? STATUS_TEXT.new;
    const time = shopTime(new Date(order.createdAt));
    li.replaceChildren(...[
      el('div', { class: 'order-head' },
        el('span', { class: `lj-badge lj-badge-${order.status}`, text: s.badge }),
        el('span', { class: 'order-time', text: `สั่งเมื่อ ${time} น.` })
      ),
      s.msg ? el('p', { class: 'order-msg', text: s.msg }) : null,
      el('ul', { class: 'order-lines' },
        order.items.map((i) => el('li', {},
          el('span', { text: `${i.name} · ${i.sweetnessName} × ${i.qty}${i.note ? ` (${i.note})` : ''}` }),
          el('span', { text: baht(i.price * i.qty) })
        )),
        el('li', {}, el('strong', { text: 'รวม' }), el('strong', { text: baht(order.total) }))
      )
    ].filter(Boolean));
  });
}

// ---------- start ----------
function renderNotice() {
  const notice = $('notice');
  if (table === null) {
    notice.innerHTML = '<strong>ไม่พบเลขโต๊ะ</strong> สแกน QR code บนโต๊ะอีกครั้งเพื่อสั่งเครื่องดื่ม';
  } else if (shopOpen === false) {
    notice.innerHTML = '<strong>ตอนนี้ร้านปิดรับออเดอร์</strong> ดูเมนูได้ก่อน สั่งได้เมื่อร้านเปิดรับออเดอร์';
  } else {
    notice.hidden = true;
    return;
  }
  notice.hidden = false;
}

// หน้าร้านกดเปิด/ปิด: อัปเดตปุ่มที่เปิดอยู่ทันที
function applyShopOpen() {
  renderNotice();
  if ($('item-sheet').open) renderItemQty();
  if ($('cart-sheet').open) renderCart();
}

async function start() {
  if (table !== null) {
    $('table-pill').textContent = `โต๊ะ ${table}`;
    $('table-pill').hidden = false;
  }

  try {
    const res = await fetch('data/menu.json', { cache: 'no-store' });
    menu = await res.json();
  } catch (err) {
    console.error(err);
    $('menu').replaceChildren(el('p', { class: 'error', text: 'โหลดเมนูไม่สำเร็จ ลองรีเฟรชหน้านี้อีกครั้ง' }));
    return;
  }
  itemsById = new Map(menu.items.map((i) => [i.id, i]));

  renderNotice();
  if (isDemo) console.info('LOONG JOKE: demo mode, orders are stored in this browser only.');

  renderMenu();
  store.watchShopOpen((open) => {
    shopOpen = open;
    applyShopOpen();
  });
  store.watchSoldOut((ids) => {
    soldOut = ids;
    applySoldOut();
    if ($('cart-sheet').open) renderCart();
  });
  saveCart();
  const mine = readMyOrders();
  writeMyOrders(mine); // ล้างของวันก่อนทิ้ง
  mine.forEach((o) => watchMyOrder(o.id));
}

start();
