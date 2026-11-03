// เวลาของร้านคิดตามเวลาไทยเสมอ ไม่ขึ้นกับเขตเวลาของเครื่องที่เปิดเว็บ
const SHOP_TIME_ZONE = 'Asia/Bangkok';

const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: SHOP_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
const timeFormat = new Intl.DateTimeFormat('en-GB', { timeZone: SHOP_TIME_ZONE, hour: '2-digit', minute: '2-digit', hour12: false });

// วันที่แบบ YYYY-MM-DD ตามเวลาไทย
export function dayKey(date = new Date()) {
  return dayFormat.format(date);
}

// เวลาแบบ HH:MM ตามเวลาไทย
export function shopTime(date = new Date()) {
  return timeFormat.format(date);
}

// เวลาเริ่มต้นของวัน (00:00 เวลาไทย) ของวันที่ YYYY-MM-DD
export function dayStart(key) {
  return new Date(`${key}T00:00:00+07:00`);
}

// เลื่อนวันที่ YYYY-MM-DD ไป n วัน (ติดลบได้)
export function addDays(key, n) {
  return dayKey(new Date(dayStart(key).getTime() + (n * 24 + 12) * 3600 * 1000));
}

// วันถัดไปของ YYYY-MM-DD
export function nextDay(key) {
  return addDays(key, 1);
}

// วันจันทร์ของสัปดาห์ที่มีวัน YYYY-MM-DD
export function weekStart(key) {
  const weekday = new Date(`${key}T12:00:00+07:00`).getUTCDay(); // 0 = อาทิตย์
  return addDays(key, -((weekday + 6) % 7));
}

// วันแรกของเดือน (YYYY-MM-01) ของปี ค.ศ. year เดือน month (1-12) ปัดข้ามปีให้เอง
export function monthKey(year, month) {
  const y = year + Math.floor((month - 1) / 12);
  const m = ((month - 1) % 12 + 12) % 12 + 1;
  return `${y}-${String(m).padStart(2, '0')}-01`;
}

// ชั่วโมง (0-23) ตามเวลาไทย
export function shopHour(date) {
  return Number(shopTime(date).slice(0, 2));
}

// แสดงวันที่เป็นภาษาไทย เช่น { weekday: 'long', day: 'numeric', month: 'short' }
export function thaiDate(key, options) {
  return new Intl.DateTimeFormat('th-TH', { timeZone: SHOP_TIME_ZONE, ...options }).format(new Date(`${key}T12:00:00+07:00`));
}
