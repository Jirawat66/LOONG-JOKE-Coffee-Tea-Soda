// ทำให้ข้อมูลออเดอร์ที่อ่านจากฐานข้อมูลแสดงผลได้เสมอ
// ออเดอร์อาจถูกส่งตรงเข้าฐานข้อมูลโดยไม่ผ่านหน้าเว็บ ข้อมูลจึงอาจขาด ผิดชนิด หรือยาวผิดปกติ
// ถ้าไม่ทำความสะอาดก่อน ออเดอร์ใบเดียวทำให้บอร์ดหน้าร้านแสดงผลไม่ได้ทั้งวัน

const MAX_TEXT = 80;
const text = (v) => (typeof v === 'string' ? v.slice(0, MAX_TEXT) : '');
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

function cleanItem(raw) {
  const i = raw && typeof raw === 'object' ? raw : {};
  return {
    id: text(i.id),
    name: text(i.name) || '(ไม่มีชื่อ)',
    nameTh: text(i.nameTh),
    price: num(i.price),
    sweetness: text(i.sweetness),
    sweetnessName: text(i.sweetnessName),
    qty: num(i.qty),
    note: text(i.note)
  };
}

export function cleanOrder(order) {
  return {
    ...order,
    table: num(order.table),
    total: num(order.total),
    items: (Array.isArray(order.items) ? order.items : []).map(cleanItem)
  };
}
