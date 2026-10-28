/* FarmaYA · catálogo rápido, ilustraciones e íconos de la vista de inicio del cliente.
   Los productos y precios son de ejemplo: el precio final lo confirma siempre la farmacia. */

Object.assign(ICONS, {
  capsule: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.5 20.5a4.95 4.95 0 0 1-7-7l10-10a4.95 4.95 0 0 1 7 7z"/><path d="m8.5 8.5 7 7"/></svg>',
  cream: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="9" rx="3"/><path d="M5 11V9a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v2"/><path d="M12 13.5v4M10 15.5h4"/></svg>',
  bottle: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2.5h5v3h-5z"/><path d="M8.5 5.5h7l1 3v10.5a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2V8.5z"/><path d="M8.5 12h3M8.5 15h3"/></svg>',
  percent: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-7 7"/><circle cx="9" cy="9" r="1.2"/><circle cx="15" cy="15" r="1.2"/></svg>',
  search: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  heart: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 20.5s-8-4.6-8-10.4A4.6 4.6 0 0 1 12 7.6a4.6 4.6 0 0 1 8 2.5c0 5.8-8 10.4-8 10.4z"/></svg>',
  heartfill: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 20.5s-8-4.6-8-10.4A4.6 4.6 0 0 1 12 7.6a4.6 4.6 0 0 1 8 2.5c0 5.8-8 10.4-8 10.4z"/></svg>',
  chevL: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 5-7 7 7 7"/></svg>',
  chevR: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 5 7 7-7 7"/></svg>'
});

const CATEGORIES = [
  { id: 'meds', label: 'Medicamentos', icon: 'capsule' },
  { id: 'care', label: 'Cuidado Personal', icon: 'cream' },
  { id: 'baby', label: 'Bebé e Infantil', icon: 'bottle' }
];

const CATALOG = [
  { name: 'Paracetamol 500 mg', cat: 'meds', price: 6500, art: 'box', color: '#e8742a', featured: true },
  { name: 'Vitamina C 1000 mg', cat: 'meds', price: 28900, art: 'bottle', color: '#f2a516', featured: true },
  { name: 'Ibuprofeno 400 mg', cat: 'meds', price: 8900, art: 'box', color: '#c93a52', featured: true },
  { name: 'Loratadina 10 mg', cat: 'meds', price: 7200, art: 'box', color: '#2b9a68' },
  { name: 'Omeprazol 20 mg', cat: 'meds', price: 9800, art: 'box', color: '#7a4fc0' },
  { name: 'Naproxeno 250 mg', cat: 'meds', price: 11500, art: 'box', color: '#0a5ca8' },
  { name: 'Amoxicilina 500 mg', cat: 'meds', price: 14500, art: 'box', color: '#d79a14', rx: true },
  { name: 'Suero oral', cat: 'meds', price: 4800, art: 'bottle', color: '#3b8fdb' },
  { name: 'Crema hidratante', cat: 'care', price: 19900, art: 'jar', color: '#4a7fc1', featured: true },
  { name: 'Protector solar FPS 50', cat: 'care', price: 38500, art: 'tube', color: '#f2a516', featured: true },
  { name: 'Alcohol antiséptico 350 ml', cat: 'care', price: 5900, art: 'bottle', color: '#5aa9a0' },
  { name: 'Gel antibacterial', cat: 'care', price: 7400, art: 'bottle', color: '#3b8fdb' },
  { name: 'Crema dental', cat: 'care', price: 6800, art: 'tube', color: '#0a5ca8' },
  { name: 'Jabón líquido', cat: 'care', price: 8200, art: 'bottle', color: '#7a4fc0' },
  { name: 'Pañales etapa 3', cat: 'baby', price: 54900, art: 'pack', color: '#3b8fdb', featured: true },
  { name: 'Toallitas húmedas', cat: 'baby', price: 9900, art: 'pack', color: '#5aa9a0' },
  { name: 'Biberón 250 ml', cat: 'baby', price: 16500, art: 'baby', color: '#f2a516' },
  { name: 'Crema para el pañal', cat: 'baby', price: 15800, art: 'tube', color: '#e8742a' },
  { name: 'Shampoo infantil', cat: 'baby', price: 13700, art: 'bottle', color: '#f2a3b6' },
  { name: 'Termómetro digital', cat: 'baby', price: 21900, art: 'box', color: '#0d3f7a' }
];

const norm = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/* ---------- Ilustraciones de producto (SVG propio, sin imágenes externas) ---------- */
function productArt(p) {
  const c = p.color;
  const shadow = '<ellipse cx="60" cy="83" rx="36" ry="4.5" fill="rgba(13,47,92,.13)"/>';
  const art = {
    box: '<rect x="22" y="20" width="76" height="58" rx="5" fill="#fff" stroke="#c8d6e6"/><path d="M22 25a5 5 0 0 1 5-5h66a5 5 0 0 1 5 5v13H22z" fill="' + c + '"/>' +
      '<rect x="32" y="48" width="34" height="5" rx="2.5" fill="#cfdaea"/><rect x="32" y="58" width="48" height="4" rx="2" fill="#e1e9f3"/>' +
      '<rect x="72" y="46" width="18" height="9" rx="4.5" fill="' + c + '" transform="rotate(-35 81 50)"/>',
    jar: '<rect x="27" y="31" width="66" height="45" rx="11" fill="#e9f1fb" stroke="#c8d6e6"/><rect x="23" y="20" width="74" height="17" rx="6" fill="' + c + '"/>' +
      '<rect x="38" y="46" width="44" height="16" rx="4" fill="#fff"/><rect x="44" y="52" width="32" height="4" rx="2" fill="' + c + '" opacity=".7"/>',
    bottle: '<rect x="47" y="7" width="26" height="14" rx="3" fill="#0d3f7a"/><rect x="39" y="19" width="42" height="62" rx="11" fill="' + c + '"/>' +
      '<rect x="44" y="38" width="32" height="28" rx="3" fill="#fff"/><circle cx="60" cy="52" r="7.5" fill="' + c + '"/>',
    tube: '<g transform="rotate(-16 60 46)"><rect x="26" y="34" width="68" height="25" rx="8" fill="#fff" stroke="#c8d6e6"/>' +
      '<rect x="26" y="34" width="22" height="25" rx="7" fill="' + c + '"/><rect x="88" y="39" width="12" height="15" rx="3" fill="#0d3f7a"/>' +
      '<rect x="55" y="42" width="26" height="4" rx="2" fill="' + c + '"/><rect x="55" y="50" width="17" height="3" rx="1.5" fill="#cfdaea"/></g>',
    pack: '<rect x="25" y="16" width="70" height="63" rx="13" fill="' + c + '"/><circle cx="60" cy="40" r="13" fill="#fff"/>' +
      '<circle cx="55.5" cy="38" r="1.7" fill="#0d2f5c"/><circle cx="64.5" cy="38" r="1.7" fill="#0d2f5c"/>' +
      '<path d="M55 44q5 4 10 0" stroke="#0d2f5c" fill="none" stroke-width="1.7" stroke-linecap="round"/><rect x="37" y="61" width="46" height="5" rx="2.5" fill="#fff" opacity=".85"/>',
    baby: '<rect x="52" y="5" width="16" height="13" rx="7" fill="#f6c3d0"/><rect x="45" y="16" width="30" height="9" rx="3" fill="' + c + '"/>' +
      '<rect x="41" y="24" width="38" height="57" rx="11" fill="#e9f1fb" stroke="#c8d6e6"/><path d="M41 42h9M41 54h9M41 66h9" stroke="#8aa3c0" stroke-width="2"/>' +
      '<rect x="53" y="46" width="14" height="22" rx="7" fill="' + c + '" opacity=".35"/>'
  }[p.art] || '';
  const span = document.createElement('span');
  span.className = 'p-art';
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = '<svg viewBox="0 0 120 90" xmlns="http://www.w3.org/2000/svg">' + shadow + art + '</svg>';
  return span;
}

/* ---------- Fachada de farmacia ---------- */
const AWNINGS = ['#2b9a68', '#0a5ca8', '#c93a52', '#7a4fc0', '#d97a1f'];
function hashOf(s) { let n = 0; for (const ch of String(s)) n = (n * 31 + ch.charCodeAt(0)) >>> 0; return n; }

function storefrontArt(p) {
  const c = AWNINGS[hashOf(p.id) % AWNINGS.length];
  const stripes = Array.from({ length: 8 }, (_, i) => '<rect x="' + (20 + i * 22.5) + '" y="39" width="11.25" height="7" rx="0" fill="#fff" opacity=".28"/>').join('');
  const span = document.createElement('span');
  span.className = 'store-art';
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = '<svg viewBox="0 0 220 110" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
    '<rect width="220" height="110" fill="#dfe8f3"/><rect y="94" width="220" height="16" fill="#c4d0df"/>' +
    '<rect x="20" y="28" width="180" height="68" fill="#f6f8fb"/><rect x="20" y="16" width="180" height="26" rx="3" fill="' + c + '"/>' + stripes +
    '<g fill="#fff"><rect x="30" y="21" width="4.5" height="16" rx="1"/><rect x="24.3" y="26.8" width="16" height="4.5" rx="1"/></g>' +
    '<text x="48" y="34" font-size="13" font-weight="700" fill="#fff" font-family="Figtree, system-ui, sans-serif"></text>' +
    '<rect x="34" y="54" width="62" height="42" rx="2" fill="#bcd3ea"/><rect x="40" y="60" width="50" height="30" fill="#e4f0fb" opacity=".8"/>' +
    '<rect x="110" y="54" width="38" height="42" rx="2" fill="#8fb3d9"/><circle cx="141" cy="76" r="2" fill="#fff"/>' +
    '<rect x="160" y="60" width="28" height="22" rx="2" fill="#bcd3ea"/></svg>';
  const label = p.name.length > 15 ? p.name.slice(0, 14) + '…' : p.name;
  span.querySelector('text').textContent = label;
  return span;
}
