// ที่เก็บออเดอร์ สถานะเมนูหมด และการล็อกอินหน้าร้าน
// โหมดจริง: Firebase (store-firebase.js)
// โหมดทดลอง (?demo=1): เก็บใน localStorage และอัปเดตข้ามแท็บในเบราว์เซอร์เดียวกัน
import { DEMO_MODE } from './config.js';
import { dayKey } from './time.js';

export const isDemo = DEMO_MODE;

// รหัสหน้าร้านของโหมดทดลองเท่านั้น โหมดจริงใช้รหัสที่ตั้งใน Firebase
export const DEMO_PASSWORD = 'demo1234';

const ORDERS_KEY = 'lj-demo-orders';
const SOLD_OUT_KEY = 'lj-demo-soldout';
const OPEN_KEY = 'lj-demo-open';
const AUTH_KEY = 'lj-demo-shop';
const listeners = new Set();

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ที่เก็บของเบราว์เซอร์เต็มหรือถูกปิดไว้: ข้อมูลอยู่ได้แค่ในหน้านี้
  }
  listeners.forEach((fn) => fn());
}

// แท็บอื่นแก้ข้อมูล (เช่น หน้าร้านกด "กำลังทำ") ให้หน้านี้อัปเดตตาม
window.addEventListener('storage', (e) => {
  if ([ORDERS_KEY, SOLD_OUT_KEY, OPEN_KEY, AUTH_KEY].includes(e.key)) listeners.forEach((fn) => fn());
});

function subscribe(fn) {
  listeners.add(fn);
  fn();
  return () => listeners.delete(fn);
}

const demo = {
  async placeOrder({ table, items, total }) {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const now = Date.now();
    const order = { id, table, items, total, status: 'new', createdAt: now, updatedAt: now };
    write(ORDERS_KEY, [...read(ORDERS_KEY, []), order]);
    return id;
  },

  watchOrder(id, callback) {
    return subscribe(() => callback(read(ORDERS_KEY, []).find((o) => o.id === id) || null));
  },

  // ออเดอร์ตั้งแต่วัน fromDay ถึง toDay (YYYY-MM-DD รวมทั้งสองวัน) เรียงตามเวลาสั่ง
  watchOrders(fromDay, toDay, callback) {
    return subscribe(() => callback(read(ORDERS_KEY, [])
      .filter((o) => {
        const day = dayKey(new Date(o.createdAt));
        return day >= fromDay && day <= toDay;
      })
      .sort((a, b) => a.createdAt - b.createdAt)));
  },

  // ยอดขายรวมของออเดอร์ที่เสร็จแล้ว ตั้งแต่วัน from ถึงก่อนวัน until (YYYY-MM-DD)
  // ไม่ใส่ from/until = ตั้งแต่เริ่มใช้ระบบ
  async salesTotal({ from, until } = {}) {
    const done = read(ORDERS_KEY, []).filter((o) => {
      const day = dayKey(new Date(o.createdAt));
      return o.status === 'done' && (!from || day >= from) && (!until || day < until);
    });
    return { baht: done.reduce((sum, o) => sum + o.total, 0), orders: done.length };
  },

  async setStatus(id, status) {
    write(ORDERS_KEY, read(ORDERS_KEY, []).map((o) => (o.id === id ? { ...o, status, updatedAt: Date.now() } : o)));
  },

  watchSoldOut(callback) {
    return subscribe(() => callback(new Set(read(SOLD_OUT_KEY, []))));
  },

  async setSoldOut(itemId, soldOut) {
    const ids = new Set(read(SOLD_OUT_KEY, []));
    if (soldOut) ids.add(itemId);
    else ids.delete(itemId);
    write(SOLD_OUT_KEY, [...ids]);
  },

  // ร้านเปิดรับออเดอร์อยู่ไหม (หน้าร้านกดเปิด/ปิดเอง) ยังไม่เคยกด = เปิด
  watchShopOpen(callback) {
    return subscribe(() => callback(read(OPEN_KEY, true) !== false));
  },

  async setShopOpen(open) {
    write(OPEN_KEY, open);
  },

  async signIn(password) {
    if (password !== DEMO_PASSWORD) throw new Error('wrong-password');
    write(AUTH_KEY, true);
  },

  async signOut() {
    write(AUTH_KEY, false);
  },

  watchAuth(callback) {
    let last;
    return subscribe(() => {
      const signedIn = read(AUTH_KEY, false) === true;
      if (signedIn !== last) callback((last = signedIn));
    });
  }
};

export const store = isDemo ? demo : await import('./store-firebase.js');
