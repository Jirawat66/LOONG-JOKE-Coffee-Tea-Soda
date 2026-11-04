// ตั้งค่าของร้าน

// ค่าเชื่อมต่อ Firebase (ไม่ใช่รหัสลับ ทุกเว็บที่ใช้ Firebase มีค่านี้อยู่ในโค้ด)
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDBlSFYGJgQwxU360W7oYBtcBhlJBJ4bJ4',
  authDomain: 'loong-joke-coffee-tea-soda.firebaseapp.com',
  projectId: 'loong-joke-coffee-tea-soda',
  storageBucket: 'loong-joke-coffee-tea-soda.firebasestorage.app',
  messagingSenderId: '498348013659',
  appId: '1:498348013659:web:e7a03af2d59229dbb9a77e'
};

// ลิงก์เว็บของร้านที่ใส่ใน QR code ของแต่ละโต๊ะ
export const SITE_URL = 'https://loong-joke-coffee-tea-soda.web.app';

// บัญชีหน้าร้านใน Firebase Authentication (พนักงานพิมพ์แค่รหัส ไม่ต้องพิมพ์อีเมลนี้)
// ถ้าเปลี่ยน ต้องแก้ใน firestore.rules ด้วย
export const SHOP_EMAIL = 'shop@loongjoke.app';

// จำนวนโต๊ะ (QR ของแต่ละโต๊ะคือ ?table=1 ถึง ?table=10)
// ถ้าเปลี่ยน ต้องแก้ใน firestore.rules ด้วย
export const TABLE_COUNT = 10;

// ใส่ ?demo=1 ต่อท้ายลิงก์เพื่อทดลองโดยไม่ส่งข้อมูลไป Firebase
// โหมดทดลองเก็บข้อมูลไว้ในเบราว์เซอร์เครื่องนี้เท่านั้น
export const DEMO_MODE = new URLSearchParams(location.search).has('demo');
