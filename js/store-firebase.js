// ที่เก็บข้อมูลจริงบน Firebase (Firestore + Authentication)
// ทำงานเหมือน demo ใน store.js ทุกฟังก์ชัน
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getFirestore, collection, doc, addDoc, updateDoc, setDoc, onSnapshot,
  query, where, orderBy, serverTimestamp, Timestamp, arrayUnion, arrayRemove,
  getAggregateFromServer, sum, count
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import {
  getAuth, signInWithEmailAndPassword, signOut as firebaseSignOut, onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { FIREBASE_CONFIG, SHOP_EMAIL } from './config.js';
import { dayStart, nextDay } from './time.js';
import { cleanOrder } from './order-data.js';

const app = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);
const auth = getAuth(app);

const orders = collection(db, 'orders');
const soldOutDoc = doc(db, 'settings', 'soldOut');
const shopDoc = doc(db, 'settings', 'shop');

// เวลาที่เซิร์ฟเวอร์ยังไม่ตอบกลับ ใช้เวลาประมาณจากเครื่องไปก่อน
const SNAPSHOT_OPTIONS = { serverTimestamps: 'estimate' };

function toOrder(snap) {
  const data = snap.data(SNAPSHOT_OPTIONS);
  return cleanOrder({
    id: snap.id,
    ...data,
    createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
    updatedAt: data.updatedAt?.toMillis?.() ?? Date.now()
  });
}

function logError(what) {
  return (err) => console.error(`Firebase: ${what} failed`, err);
}

export async function placeOrder({ table, items, total }) {
  const ref = await addDoc(orders, {
    table,
    items,
    total,
    status: 'new',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return ref.id;
}

export function watchOrder(id, callback) {
  return onSnapshot(doc(orders, id), (snap) => callback(snap.exists() ? toOrder(snap) : null), logError('watchOrder'));
}

// ออเดอร์ตั้งแต่วัน fromDay ถึง toDay (YYYY-MM-DD รวมทั้งสองวัน) เรียงตามเวลาสั่ง
export function watchOrders(fromDay, toDay, callback) {
  const q = query(
    orders,
    where('createdAt', '>=', Timestamp.fromDate(dayStart(fromDay))),
    where('createdAt', '<', Timestamp.fromDate(dayStart(nextDay(toDay)))),
    orderBy('createdAt')
  );
  return onSnapshot(q, (snap) => callback(snap.docs.map(toOrder)), logError('watchOrders'));
}

// ออเดอร์ของวันก่อน beforeDay ที่ยังไม่ได้กด "เสร็จแล้ว" หรือ "ยกเลิก" (ใช้ index status + createdAt)
export function watchUnfinishedBefore(beforeDay, callback) {
  const q = query(
    orders,
    where('status', 'in', ['new', 'making']),
    where('createdAt', '<', Timestamp.fromDate(dayStart(beforeDay))),
    orderBy('createdAt')
  );
  return onSnapshot(q, (snap) => callback(snap.docs.map(toOrder)), logError('watchUnfinishedBefore'));
}

// ต่อฐานข้อมูลได้อยู่ไหม: false = ขาดการเชื่อมต่อ ข้อมูลบนจออาจไม่ใช่ล่าสุด
export function watchConnection(callback) {
  return onSnapshot(shopDoc, { includeMetadataChanges: true }, (snap) => callback(!snap.metadata.fromCache), logError('watchConnection'));
}

// ยอดขายรวมของออเดอร์ที่เสร็จแล้ว ตั้งแต่วัน from ถึงก่อนวัน until (YYYY-MM-DD)
// ให้เซิร์ฟเวอร์รวมให้ ไม่ต้องโหลดออเดอร์ทุกใบ (ใช้ index ใน firestore.indexes.json)
export async function salesTotal({ from, until } = {}) {
  const filters = [where('status', '==', 'done')];
  if (from) filters.push(where('createdAt', '>=', Timestamp.fromDate(dayStart(from))));
  if (until) filters.push(where('createdAt', '<', Timestamp.fromDate(dayStart(until))));
  const snap = await getAggregateFromServer(query(orders, ...filters), { baht: sum('total'), orders: count() });
  const data = snap.data();
  return { baht: data.baht ?? 0, orders: data.orders ?? 0 };
}

export async function setStatus(id, status) {
  await updateDoc(doc(orders, id), { status, updatedAt: serverTimestamp() });
}

export function watchSoldOut(callback) {
  return onSnapshot(soldOutDoc, (snap) => callback(new Set(snap.data()?.ids ?? [])), logError('watchSoldOut'));
}

export async function setSoldOut(itemId, soldOut) {
  await setDoc(soldOutDoc, { ids: soldOut ? arrayUnion(itemId) : arrayRemove(itemId) }, { merge: true });
}

// ร้านเปิดรับออเดอร์อยู่ไหม (หน้าร้านกดเปิด/ปิดเอง) ยังไม่เคยกด = เปิด ตรงกับ firestore.rules
export function watchShopOpen(callback) {
  return onSnapshot(shopDoc, (snap) => callback(snap.data()?.open !== false), logError('watchShopOpen'));
}

export async function setShopOpen(open) {
  await setDoc(shopDoc, { open, updatedAt: serverTimestamp() });
}

export async function signIn(password) {
  await signInWithEmailAndPassword(auth, SHOP_EMAIL, password);
}

export async function signOut() {
  await firebaseSignOut(auth);
}

export function watchAuth(callback) {
  return onAuthStateChanged(auth, (user) => callback(user?.email === SHOP_EMAIL));
}
