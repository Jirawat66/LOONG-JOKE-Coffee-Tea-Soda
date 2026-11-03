// แท็บ "QR โต๊ะ" ในหน้าร้าน: สร้างและพิมพ์ QR code ของแต่ละโต๊ะ
// QR สร้างในเครื่องด้วย qrcode-generator (โหลดใน shop.html) ไม่ส่งข้อมูลไปที่ไหน
import { SITE_URL, TABLE_COUNT } from './config.js';
import { el } from './dom.js';

const tableUrl = (n) => `${SITE_URL}/?table=${n}`;

function qrSvg(text) {
  const qr = window.qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true, alt: text });
}

function card(n) {
  const code = el('div', { class: 'qr-card-code' });
  code.innerHTML = qrSvg(tableUrl(n));
  return el('article', { class: 'qr-card', 'aria-label': `QR code โต๊ะ ${n}` },
    el('div', { class: 'qr-card-head' },
      el('img', { src: 'Photo/Logo.jpg', alt: '' }),
      el('div', {},
        el('p', { class: 'qr-card-brand', text: 'LOONG JOKE' }),
        el('p', { class: 'qr-card-sub', text: 'COFFEE · TEA · SODA' }))),
    el('p', { class: 'qr-card-table', text: `โต๊ะ ${n}` }),
    code,
    el('p', { class: 'qr-card-call', text: 'สแกนเพื่อสั่งเครื่องดื่ม' }),
    el('p', { class: 'qr-card-pay', text: 'ชำระเงินที่เคาน์เตอร์ (เงินสด / พร้อมเพย์)' })
  );
}

export function createQrPanel(container) {
  const from = el('input', { class: 'input qr-num', id: 'qr-from', type: 'number', min: '1', max: String(TABLE_COUNT), inputmode: 'numeric', value: '1' });
  const to = el('input', { class: 'input qr-num', id: 'qr-to', type: 'number', min: '1', max: String(TABLE_COUNT), inputmode: 'numeric', value: String(TABLE_COUNT), 'aria-label': 'ถึงโต๊ะ' });
  const error = el('p', { class: 'error', role: 'alert', hidden: true });
  const cards = el('div', { class: 'qr-sheet' });
  let rendered = false;

  function range() {
    const a = Number(from.value);
    const b = Number(to.value);
    return Number.isInteger(a) && Number.isInteger(b) && a >= 1 && b <= TABLE_COUNT && a <= b ? { a, b } : null;
  }

  function render() {
    const r = range();
    error.hidden = !!r;
    if (!r) {
      error.textContent = `เลือกเลขโต๊ะระหว่าง 1 ถึง ${TABLE_COUNT} และเลขแรกต้องไม่มากกว่าเลขหลัง`;
      return;
    }
    const list = [];
    for (let n = r.a; n <= r.b; n++) list.push(card(n));
    cards.replaceChildren(...list);
  }

  function print() {
    if (!range()) return;
    document.body.classList.add('print-qr');
    window.print();
  }

  window.addEventListener('afterprint', () => document.body.classList.remove('print-qr'));
  from.addEventListener('input', render);
  to.addEventListener('input', render);

  container.replaceChildren(
    el('div', { class: 'qr-controls' },
      el('p', { class: 'qr-help', text: 'พิมพ์ลงกระดาษ A4 (หน้าละ 4 โต๊ะ) แล้วตัดวางบนโต๊ะ ถ้าพิมพ์แค่บางโต๊ะ ให้เลือกช่วงเลขโต๊ะก่อนกดพิมพ์ ตอนพิมพ์ให้เปิดตัวเลือก "กราฟิกพื้นหลัง" (Background graphics) สีจะได้ติด' }),
      el('div', { class: 'qr-form' },
        el('label', { class: 'field-label', for: 'qr-from', text: 'โต๊ะ' }),
        from,
        el('span', { text: 'ถึง' }),
        to,
        el('button', { type: 'button', class: 'lj-btn lj-btn-primary', onclick: print, text: 'พิมพ์' })),
      error,
      el('p', { class: 'qr-help' }, 'ลิงก์ใน QR: ', el('code', { text: `${SITE_URL}/?table=…` }))),
    cards
  );

  return {
    // สร้าง QR ตอนเปิดแท็บครั้งแรก
    show() {
      if (rendered) return;
      rendered = true;
      if (window.qrcode) {
        render();
      } else {
        error.textContent = 'โหลดตัวสร้าง QR ไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วรีเฟรชหน้านี้';
        error.hidden = false;
      }
    }
  };
}
