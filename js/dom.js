// ตัวช่วยสร้างหน้าเว็บ ใช้ร่วมกันทุกหน้า

export const $ = (id) => document.getElementById(id);

// สร้าง element: el('button', { class: 'x', text: 'กด', onclick: fn }, ...ลูก)
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) if (child != null) node.append(child);
  return node;
}

export const baht = (n) => `${n} ฿`;

export const photoUrl = (path) => path.split('/').map(encodeURIComponent).join('/');
