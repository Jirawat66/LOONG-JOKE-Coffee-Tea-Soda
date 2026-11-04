# LOONG JOKE Coffee Tea Soda — ระบบสั่งเครื่องดื่มผ่าน QR Code

ลูกค้าสแกน QR ที่โต๊ะ เลือกเครื่องดื่มแล้วสั่ง หน้าร้านเห็นหมายเลขโต๊ะและรายการทันที พร้อมรายงานยอดขาย

- หน้าลูกค้า: https://loong-joke-coffee-tea-soda.web.app/?table=1 (โต๊ะ 1–10)
- หน้าร้าน: https://loong-joke-coffee-tea-soda.web.app/shop.html
- ทดลองโดยไม่ส่งข้อมูลจริง: ใส่ `?demo=1` ท้ายลิงก์ (รหัสหน้าร้านโหมดทดลองคือ `demo1234`)

## เอกสาร

- [SRS – Software Requirements Specification](docs/SRS.md)
- [Design system "LOONG JOKE"](design-system/project/README.md) — สี ฟอนต์ และคอมโพเนนต์ที่ใช้ในแอป

## โครงสร้าง

| ไฟล์/โฟลเดอร์ | หน้าที่ |
|---|---|
| `index.html`, `js/menu-page.js` | หน้าเมนูลูกค้า |
| `shop.html`, `js/shop-page.js` | หน้าร้าน: ออเดอร์ / เมนูหมด / ยอดขาย / QR โต๊ะ |
| `js/report.js`, `js/chart.js` | รายงานยอดขายและกราฟ |
| `js/qr.js` | สร้างและพิมพ์ QR โต๊ะ |
| `js/store.js`, `js/store-firebase.js` | การเก็บข้อมูล (โหมดทดลอง / Firebase) |
| `js/order-data.js` | ทำความสะอาดข้อมูลออเดอร์ก่อนแสดงผล |
| `js/config.js` | ค่าตั้งค่า: จำนวนโต๊ะ, ลิงก์เว็บ, บัญชีหน้าร้าน |
| `data/menu.json` | เมนู ราคา และระดับความหวาน |
| `css/` | สีและคอมโพเนนต์จาก design system |
| `Photo/` | โลโก้และรูปเมนู |
| `design-system/project/` | design system ต้นฉบับ (ไม่ได้ขึ้นเว็บ) |
| `firestore.rules`, `firestore.indexes.json`, `firebase.json` | การตั้งค่า Firebase |
| `tools/dev-server.js` | เซิร์ฟเวอร์สำหรับทดสอบในเครื่อง (`node tools/dev-server.js` แล้วเปิด http://localhost:5173) |

## แก้ไขและอัปขึ้นเว็บ

ต้องมี [Firebase CLI](https://firebase.google.com/docs/cli) ที่ล็อกอินบัญชีของร้านแล้ว

| แก้อะไร | ไฟล์ | คำสั่ง deploy |
|---|---|---|
| เมนู ราคา | `data/menu.json` | `firebase deploy --only hosting` |
| หน้าเว็บ | `*.html`, `js/`, `css/` | `firebase deploy --only hosting` |
| กฎความปลอดภัย | `firestore.rules` | `firebase deploy --only firestore:rules` |
| ดัชนีฐานข้อมูล | `firestore.indexes.json` | `firebase deploy --only firestore:indexes` |

**จำนวนโต๊ะ** ต้องแก้ให้ตรงกันสองที่: `TABLE_COUNT` ใน `js/config.js` และ `d.table <= 10` ใน `firestore.rules`

เปิด/ปิดรับออเดอร์ไม่ต้องแก้โค้ด พนักงานกดปุ่มที่หน้าร้านได้เลย

รหัสหน้าร้านตั้งและเปลี่ยนใน Firebase Console → Authentication เท่านั้น ห้ามใส่ไว้ในโค้ด
