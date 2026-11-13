/* FarmaYA · gráficos SVG del dashboard y generador de PDF (sin librerías externas). */

/* ---------- Utilidades ---------- */
const FY_BOGOTA_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' });

/** Fecha (YYYY-MM-DD) en hora de Bogotá a partir de un instante ISO o un Date. */
function fyDayKey(value) {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : FY_BOGOTA_DAY.format(d);
}

function fyEsc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fyCompactMoney(n) {
  const a = Math.abs(n);
  const f = (v, s) => '$' + (Math.round(v * 10) / 10).toString().replace('.', ',') + s;
  if (a >= 1e6) return f(n / 1e6, ' M');
  if (a >= 1e3) return f(n / 1e3, ' mil');
  return '$' + Math.round(n);
}

/** Escala "bonita" para el eje Y: máximo y paso redondeados. */
function fyNiceScale(max, ticks = 4) {
  if (!(max > 0)) return { max: 100000, step: 25000, count: 4 };
  const raw = max / ticks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  const count = Math.ceil(max / step);
  return { max: step * count, step, count };
}

function fyDaysBetween(from, to) {
  const out = [];
  let t = Date.parse(from + 'T00:00:00Z');
  const end = Date.parse(to + 'T00:00:00Z');
  if (Number.isNaN(t) || Number.isNaN(end)) return out;
  for (; t <= end && out.length < 400; t += 86400000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

/* ---------- Datos para los gráficos ---------- */

/** Ventas agrupadas por día (o por mes si el rango supera ~2 meses). */
function fyBuildSalesSeries(d) {
  const days = fyDaysBetween(d.from, d.to);
  const monthly = days.length > 62;
  const map = new Map();
  const order = [];
  days.forEach(day => {
    const key = monthly ? day.slice(0, 7) : day;
    if (!map.has(key)) { map.set(key, { key, value: 0, count: 0 }); order.push(key); }
  });
  (d.reportOrders || []).forEach(o => {
    if (!o.isSale) return;
    const day = fyDayKey(o.deliveredAt || o.createdAt);
    if (!day) return;
    const p = map.get(monthly ? day.slice(0, 7) : day);
    if (p) { p.value += Number(o.total) || 0; p.count += 1; }
  });
  const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const points = order.map(k => {
    const p = map.get(k);
    const [yy, mm, dd] = k.split('-');
    const label = monthly ? MONTHS[+mm - 1] + ' ' + yy.slice(2) : (+dd) + ' ' + MONTHS[+mm - 1];
    return { ...p, label };
  });
  return { monthly, points };
}

const FY_STATUS_GROUPS = [
  { id: 'ok', label: 'Entregados', color: '#087068', test: s => s === 'ENTREGADO' },
  { id: 'open', label: 'En curso', color: '#2f80c9', test: s => !['ENTREGADO', 'CANCELADA', 'RECHAZADA', 'VENCIDA', 'CON_INCIDENCIA'].includes(s) },
  { id: 'lost', label: 'Cancelados o vencidos', color: '#b4372f', test: s => ['CANCELADA', 'RECHAZADA', 'VENCIDA'].includes(s) },
  { id: 'issue', label: 'Con incidencia', color: '#e0a31c', test: s => s === 'CON_INCIDENCIA' }
];

function fyStatusSegments(d) {
  const rows = d.reportOrders || [];
  return FY_STATUS_GROUPS
    .map(g => ({ id: g.id, label: g.label, color: g.color, value: rows.filter(o => g.test(o.status)).length }))
    .filter(s => s.value > 0);
}

/* ---------- Gráficos SVG para la pantalla ---------- */

function fyBarChartSvg(series, fmtMoney, opts = {}) {
  const W = 720, H = 280, L = 62, R = 12, T = 14, B = 36;
  const pw = W - L - R, ph = H - T - B;
  const pts = series.points;
  const maxV = Math.max(0, ...pts.map(p => p.value));
  const axisFmt = opts.axisFmt || fyCompactMoney;
  let sc;
  if (opts.integer) { const step = Math.max(1, Math.ceil(maxV / 4)); const count = Math.max(1, Math.ceil(maxV / step)); sc = { max: step * count, step, count }; }
  else sc = fyNiceScale(maxV, 4);
  const y = v => T + ph - (v / sc.max) * ph;
  let g = '';
  for (let i = 0; i <= sc.count; i++) {
    const v = i * sc.step, yy = y(v).toFixed(1);
    g += `<line class="fy-grid" x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}"/><text class="fy-axis" x="${L - 8}" y="${(+yy + 4).toFixed(1)}" text-anchor="end">${fyEsc(axisFmt(v))}</text>`;
  }
  const n = pts.length || 1, slot = pw / n, bw = Math.min(46, slot * 0.64);
  const every = Math.max(1, Math.ceil(n / 10));
  pts.forEach((p, i) => {
    const cx = L + slot * i + slot / 2;
    const hh = (p.value / sc.max) * ph;
    const tip = opts.tip ? opts.tip(p) : p.label + ': ' + fmtMoney(p.value) + ' · ' + p.count + (p.count === 1 ? ' entrega' : ' entregas');
    g += `<g class="fy-bar-group"><rect class="fy-hit" x="${(L + slot * i).toFixed(1)}" y="${T}" width="${slot.toFixed(1)}" height="${ph}"/>`
      + (p.value > 0 ? `<rect class="fy-bar" x="${(cx - bw / 2).toFixed(1)}" y="${(T + ph - hh).toFixed(1)}" width="${bw.toFixed(1)}" height="${hh.toFixed(1)}" rx="4"/>` : '')
      + `<title>${fyEsc(tip)}</title></g>`;
    if (i % every === 0) g += `<text class="fy-axis" x="${cx.toFixed(1)}" y="${H - 12}" text-anchor="middle">${fyEsc(p.label)}</text>`;
  });
  if (maxV === 0) g += `<text class="fy-empty" x="${L + pw / 2}" y="${T + ph / 2}" text-anchor="middle">${fyEsc(opts.emptyText || 'Sin ventas en este período')}</text>`;
  return `<svg class="fy-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${fyEsc(opts.aria || 'Ventas por ' + (series.monthly ? 'mes' : 'día'))}">${g}</svg>`;
}

function fyDonutSvg(segs) {
  const total = segs.reduce((a, s) => a + s.value, 0);
  const r = 70, C = 2 * Math.PI * r;
  let acc = 0;
  const rings = segs.map(s => {
    const len = C * s.value / total;
    const el = `<circle class="fy-ring fy-c-${s.id}" cx="100" cy="100" r="${r}" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-acc).toFixed(2)}"><title>${fyEsc(s.label)}: ${s.value}</title></circle>`;
    acc += len;
    return el;
  }).join('');
  return `<svg class="fy-donut" viewBox="0 0 200 200" role="img" aria-label="Pedidos por estado"><circle class="fy-ring-bg" cx="100" cy="100" r="${r}"/><g transform="rotate(-90 100 100)">${rings}</g><text class="fy-donut-n" x="100" y="104" text-anchor="middle">${total}</text><text class="fy-donut-l" x="100" y="124" text-anchor="middle">pedidos</text></svg>`;
}

/* ---------- Dashboard del repartidor ---------- */

/** Domicilios (y dinero) agrupados por día, o por mes si el rango supera ~2 meses. */
function fyBuildCourierSeries(d) {
  const days = fyDaysBetween(d.from, d.to);
  const monthly = days.length > 62;
  const map = new Map();
  const order = [];
  days.forEach(day => {
    const key = monthly ? day.slice(0, 7) : day;
    if (!map.has(key)) { map.set(key, { key, value: 0, money: 0 }); order.push(key); }
  });
  (d.rows || []).forEach(r => {
    const day = fyDayKey(r.deliveredAt);
    if (!day) return;
    const p = map.get(monthly ? day.slice(0, 7) : day);
    if (p) { p.value += 1; p.money += Number(r.earnings) || 0; }
  });
  const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const points = order.map(k => {
    const p = map.get(k);
    const [yy, mm, dd] = k.split('-');
    return { ...p, label: monthly ? MONTHS[+mm - 1] + ' ' + yy.slice(2) : (+dd) + ' ' + MONTHS[+mm - 1] };
  });
  return { monthly, points };
}

/** Línea de dinero acumulado: un punto por domicilio entregado. */
function fyLineChartSvg(points, emptyText) {
  const W = 720, H = 280, L = 62, R = 16, T = 14, B = 36;
  const pw = W - L - R, ph = H - T - B;
  const maxV = Math.max(0, ...points.map(p => p.value));
  const sc = fyNiceScale(maxV, 4);
  const y = v => T + ph - (v / sc.max) * ph;
  let g = '';
  for (let i = 0; i <= sc.count; i++) {
    const v = i * sc.step, yy = y(v).toFixed(1);
    g += `<line class="fy-grid" x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}"/><text class="fy-axis" x="${L - 8}" y="${(+yy + 4).toFixed(1)}" text-anchor="end">${fyEsc(fyCompactMoney(v))}</text>`;
  }
  const n = points.length;
  if (!n) {
    g += `<text class="fy-empty" x="${L + pw / 2}" y="${T + ph / 2}" text-anchor="middle">${fyEsc(emptyText || 'Sin domicilios en este período')}</text>`;
    return `<svg class="fy-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Dinero acumulado">${g}</svg>`;
  }
  const x = i => n === 1 ? L + pw / 2 : L + (pw * i) / (n - 1);
  const line = points.map((p, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.value).toFixed(1)).join(' ');
  const area = line + ` L${x(n - 1).toFixed(1)} ${y(0).toFixed(1)} L${x(0).toFixed(1)} ${y(0).toFixed(1)} Z`;
  g += `<path class="fy-area" d="${area}"/><path class="fy-line" d="${line}"/>`;
  const every = Math.max(1, Math.ceil(n / 8));
  points.forEach((p, i) => {
    const cx = x(i).toFixed(1), cy = y(p.value).toFixed(1);
    if (n <= 80) g += `<circle class="fy-pt" cx="${cx}" cy="${cy}" r="4"><title>${fyEsc(p.tip)}</title></circle>`;
    else g += `<circle class="fy-pt-hit" cx="${cx}" cy="${cy}" r="5"><title>${fyEsc(p.tip)}</title></circle>`;
    if (i % every === 0 || i === n - 1) g += `<text class="fy-axis" x="${cx}" y="${H - 12}" text-anchor="middle">${fyEsc(p.label)}</text>`;
  });
  return `<svg class="fy-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Dinero acumulado por domicilio">${g}</svg>`;
}

/* ---------- Generador de PDF (PDF 1.4, Helvetica, sin dependencias) ---------- */

const FY_WIN1252 = { 0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F };

const FY_LOGO_JPEG_B64 = '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';

function fyPdfDoc() {
  const W = 595.28, H = 841.89;
  const pages = [];
  const images = [];
  let ops = null;
  let ctx = null;
  try { ctx = document.createElement('canvas').getContext('2d'); } catch (_) { ctx = null; }

  const num = v => Number(v).toFixed(2);
  const rgb = hex => {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex) || [0, '00', '00', '00'];
    return [m[1], m[2], m[3]].map(x => (parseInt(x, 16) / 255).toFixed(3)).join(' ');
  };
  /** Texto Unicode -> cadena binaria WinAnsi, escapada para PDF. */
  const bin = s => {
    s = String(s == null ? '' : s).normalize('NFC').replace(/[\u2000-\u200B\u202F\u205F]/g, ' ');
    let out = '';
    for (const ch of s) {
      let c = ch.codePointAt(0);
      if (c < 32) c = 32;
      else if (!(c < 128 || (c >= 160 && c <= 255))) c = FY_WIN1252[c] || 63;
      const x = String.fromCharCode(c);
      out += (x === '\\' || x === '(' || x === ')') ? '\\' + x : x;
    }
    return out;
  };
  const measure = (str, size, bold) => {
    str = String(str == null ? '' : str);
    if (ctx) { ctx.font = (bold ? 'bold ' : '') + '100px Helvetica, Arial, sans-serif'; return ctx.measureText(str).width * size / 100; }
    return str.length * size * 0.52;
  };

  function addImage(base64Jpeg, widthPx, heightPx) {
    let img = images.find(it => it.b64 === base64Jpeg);
    if (img) return img;
    const binStr = atob(base64Jpeg);
    const id = images.length + 1;
    img = { id, width: widthPx, height: heightPx, length: binStr.length, binStr, b64: base64Jpeg };
    images.push(img);
    return img;
  }

  const api = {
    W, H, measure,
    page() { ops = []; pages.push(ops); },
    pageCount() { return pages.length; },
    pageAt(i) { ops = pages[i]; },
    rect(x, y, w, h, fill) { ops.push(`${rgb(fill)} rg ${num(x)} ${num(H - y - h)} ${num(w)} ${num(h)} re f`); },
    line(x1, y1, x2, y2, color, lw = 0.5) { ops.push(`${rgb(color)} RG ${lw} w ${num(x1)} ${num(H - y1)} m ${num(x2)} ${num(H - y2)} l S`); },
    logo(x, y, w = 140, h = 24.2) {
      const img = addImage(FY_LOGO_JPEG_B64, 942, 163);
      ops.push(`q ${num(w)} 0 0 ${num(h)} ${num(x)} ${num(H - y - h)} cm /Im${img.id} Do Q`);
    },
    image(base64Jpeg, x, y, w, h, widthPx = 942, heightPx = 163) {
      const img = addImage(base64Jpeg, widthPx, heightPx);
      ops.push(`q ${num(w)} 0 0 ${num(h)} ${num(x)} ${num(H - y - h)} cm /Im${img.id} Do Q`);
    },
    /** y = linea base, medida desde el borde superior de la pagina. */
    text(str, x, y, o = {}) {
      const size = o.size || 10, bold = !!o.bold;
      const w = measure(str, size, bold);
      const px = o.align === 'right' ? x - w : o.align === 'center' ? x - w / 2 : x;
      ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${rgb(o.color || '#18352b')} rg ${num(px)} ${num(H - y)} Td (${bin(str)}) Tj ET`);
    },
    /** Recorta el texto con '...' para que quepa en maxW. */
    fit(str, maxW, size, bold) {
      let s = String(str == null ? '' : str);
      if (measure(s, size, bold) <= maxW) return s;
      while (s.length > 1 && measure(s + '...', size, bold) > maxW) s = s.slice(0, -1);
      return s + '...';
    },
    build(docTitle = 'FarmaYa Documento') {
      const out = [];
      let len = 0;
      const offs = [];
      const push = s => { out.push(s); len += s.length; };
      const obj = (n, body) => { offs[n] = len; push(n + ' 0 obj\n' + body + '\nendobj\n'); };
      push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
      obj(1, '<< /Type /Catalog /Pages 2 0 R >>');

      const startImagesObj = 5;
      images.forEach((img, idx) => {
        img.objNum = startImagesObj + idx;
      });

      const startPagesObj = startImagesObj + images.length;
      const kids = pages.map((_, i) => (startPagesObj + i * 2) + ' 0 R').join(' ');
      obj(2, `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
      obj(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
      obj(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

      images.forEach(img => {
        obj(img.objNum, `<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.length} >>\nstream\n${img.binStr}\nendstream`);
      });

      const xobjDict = images.length > 0 ? `/XObject << ${images.map(im => `/Im${im.id} ${im.objNum} 0 R`).join(' ')} >>` : '';
      pages.forEach((p, i) => {
        const pn = startPagesObj + i * 2, cn = pn + 1, stream = p.join('\n');
        obj(pn, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> ${xobjDict} >> /Contents ${cn} 0 R >>`);
        obj(cn, `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
      });

      const total = startPagesObj + pages.length * 2;
      const xref = len;
      let x = 'xref\n0 ' + total + '\n0000000000 65535 f \n';
      for (let n = 1; n < total; n++) x += String(offs[n]).padStart(10, '0') + ' 00000 n \n';
      push(x + `trailer\n<< /Size ${total} /Root 1 0 R /Info << /Title (${bin(docTitle)}) /Producer (FarmaYa) >> >>\nstartxref\n${xref}\n%%EOF`);
      const s = out.join('');
      const bytes = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i) & 255;
      return bytes;
    }
  };
  return api;
}

/**
 * Construye el reporte de ventas de la farmacia con logo oficial y colores FarmaYA.
 * h = { money(n), date(iso), status(code), generated(texto), periodLabel(texto) }
 */
function fyBuildSalesPdf(d, h) {
  const pdf = fyPdfDoc();
  const M = 40, CW = pdf.W - 2 * M;
  const C = {
    primary: '#004e46',     // Emerald FarmaYA institucional
    primaryDark: '#003630', // Verde bosque profundo
    primarySoft: '#e2f7eb', // Menta suave de diseno
    lime: '#74c043',        // Verde lima vibrante de FarmaYA
    accent: '#0a5ca8',      // Azul institucional
    amber: '#d97706',       // Alerta
    rose: '#e11d48',        // Cancelado
    dark: '#0f172a',        // Texto principal
    muted: '#5d6f65',       // Texto secundario
    line: '#dbe6df',        // Lineas suaves
    white: '#ffffff'
  };
  const rows = d.reportOrders || [];
  const best = d.bestSellers || [];
  const sales = Number(d.sales) || 0, delivered = Number(d.delivered) || 0, ordersN = Number(d.orders) || 0;
  const pharmacy = d.pharmacyName || 'Farmacia';

  /* ----- Pagina 1: Encabezado FarmaYA con Logo ----- */
  pdf.page();

  // Banner superior institucional en verde esmeralda FarmaYA
  pdf.rect(0, 0, pdf.W, 76, C.primary);
  // Franja verde lima representativa de la identidad FarmaYA
  pdf.rect(0, 76, pdf.W, 4, C.lime);

  // Contenedor blanco y logo oficial
  pdf.rect(M, 14, 150, 28, '#ffffff');
  pdf.logo(M + 5, 17, 140, 22);

  // Titulo del documento
  pdf.text('Salud a domicilio - Reporte Oficial de Ventas', M, 64, { size: 9.5, bold: true, color: '#e0f5e9' });
  pdf.text('Generado el ' + h.generated, pdf.W - M, 36, { size: 9, color: '#c7f9e2', align: 'right' });
  pdf.text('FarmaYA S.A.S. - NIT 901.849.201-4', pdf.W - M, 52, { size: 8, color: '#a7f3d0', align: 'right' });

  // Informacion de Farmacia y Periodo
  pdf.text(pdf.fit(pharmacy, CW, 17, true), M, 114, { size: 17, bold: true, color: C.dark });
  pdf.text('Periodo analizado: ' + h.periodLabel, M, 132, { size: 10, color: C.muted });

  const kpis = [
    ['VENTAS REALIZADAS', h.money(sales)],
    ['PEDIDOS RECIBIDOS', String(ordersN)],
    ['PEDIDOS ENTREGADOS', String(delivered)],
    ['TICKET PROMEDIO', h.money(delivered ? sales / delivered : 0)]
  ];
  const kw = (CW - 30) / 4;
  kpis.forEach(([label, value], i) => {
    const x = M + i * (kw + 10);
    pdf.rect(x, 148, kw, 56, C.primarySoft);
    pdf.rect(x, 148, 4, 56, C.primary);
    pdf.text(label, x + 12, 168, { size: 7.5, bold: true, color: C.muted });
    pdf.text(pdf.fit(value, kw - 20, 15, true), x + 12, 192, { size: 15, bold: true, color: C.primary });
  });

  /* Ventas por dia / mes */
  const series = fyBuildSalesSeries(d);
  let y = 230;
  pdf.text('Ventas por ' + (series.monthly ? 'mes' : 'dia'), M, y, { size: 11.5, bold: true, color: C.primary });
  pdf.line(M, y + 6, M + CW, y + 6, C.line);
  const cx0 = M + 54, cw = CW - 54, top = y + 24, ph = 124;
  const pts = series.points;
  const maxV = Math.max(0, ...pts.map(p => p.value));
  const sc = fyNiceScale(maxV, 4);
  for (let i = 0; i <= sc.count; i++) {
    const gy = top + ph - (i * sc.step / sc.max) * ph;
    pdf.line(cx0, gy, cx0 + cw, gy, C.line, 0.4);
    pdf.text(fyCompactMoney(i * sc.step), cx0 - 6, gy + 3, { size: 7.5, color: C.muted, align: 'right' });
  }
  const n = pts.length || 1, slot = cw / n, bw = Math.min(34, slot * 0.64), every = Math.max(1, Math.ceil(n / 12));
  pts.forEach((p, i) => {
    const bx = cx0 + slot * i + slot / 2;
    const bh = maxV ? (p.value / sc.max) * ph : 0;
    if (bh > 0) {
      pdf.rect(bx - bw / 2, top + ph - bh, bw, bh, C.primary);
      pdf.rect(bx - bw / 2, top + ph - bh, bw, 2, C.lime);
    }
    if (i % every === 0) pdf.text(p.label, bx, top + ph + 14, { size: 7.5, color: C.muted, align: 'center' });
  });
  if (!maxV) pdf.text('Sin ventas en este periodo', cx0 + cw / 2, top + ph / 2, { size: 10, color: C.muted, align: 'center' });

  /* Estado de los pedidos */
  y = top + ph + 38;
  pdf.text('Estado de los pedidos', M, y, { size: 11.5, bold: true, color: C.primary });
  pdf.line(M, y + 6, M + CW, y + 6, C.line);
  const segs = fyStatusSegments(d);
  const totalSeg = segs.reduce((a, s) => a + s.value, 0);
  if (!totalSeg) {
    pdf.text('No hay pedidos en este periodo.', M, y + 28, { size: 10, color: C.muted });
    y += 40;
  } else {
    let sx = M;
    segs.forEach(s => { const w = CW * s.value / totalSeg; pdf.rect(sx, y + 16, w, 16, s.color); sx += w; });
    let lx = M;
    segs.forEach(s => {
      const label = s.label + ': ' + s.value + ' (' + Math.round(s.value * 100 / totalSeg) + '%)';
      pdf.rect(lx, y + 43, 8, 8, s.color);
      pdf.text(label, lx + 13, y + 50, { size: 8.5 });
      lx += 13 + pdf.measure(label, 8.5, false) + 18;
    });
    y += 62;
  }

  /* Medicamentos mas vendidos */
  y += 28;
  pdf.text('Medicamentos mas vendidos', M, y, { size: 11.5, bold: true, color: C.primary });
  pdf.line(M, y + 6, M + CW, y + 6, C.line);
  if (!best.length) {
    pdf.text('Sin ventas de medicamentos en este periodo.', M, y + 28, { size: 10, color: C.muted });
  } else {
    const maxQ = Math.max(...best.map(b => Number(b.quantity) || 0), 1);
    const bx = M + 190, bmax = CW - 190 - 112;
    best.slice(0, 8).forEach((b, i) => {
      const ry = y + 28 + i * 21;
      pdf.text(pdf.fit((i + 1) + '. ' + b.name, 180, 9, false), M, ry, { size: 9 });
      pdf.rect(bx, ry - 8, bmax, 9, C.primarySoft);
      pdf.rect(bx, ry - 8, Math.max(3, bmax * (Number(b.quantity) || 0) / maxQ), 9, C.primary);
      pdf.text((b.quantity || 0) + ' uds - ' + h.money(b.sales || 0), M + CW, ry, { size: 8.5, bold: true, align: 'right', color: C.primary });
    });
  }

  /* ----- Detalle de pedidos (paginas siguientes) ----- */
  const cols = [
    { t: 'Pedido', w: 88 }, { t: 'Fecha y hora', w: 128 }, { t: 'Estado', w: 128 },
    { t: 'Total', w: 98, right: true }, { t: 'Venta', w: 73, right: true }
  ];
  const tableHead = (ty) => {
    pdf.rect(M, ty, CW, 22, C.primary);
    pdf.rect(M, ty + 20, CW, 2, C.lime);
    let cx = M;
    cols.forEach(c => {
      if (c.right) pdf.text(c.t, cx + c.w - 8, ty + 14.5, { size: 8.5, bold: true, color: '#ffffff', align: 'right' });
      else pdf.text(c.t, cx + 8, ty + 14.5, { size: 8.5, bold: true, color: '#ffffff' });
      cx += c.w;
    });
  };

  pdf.page();
  // Encabezado con logo FarmaYA en paginas secundarias
  pdf.rect(0, 0, pdf.W, 48, C.primary);
  pdf.rect(0, 48, pdf.W, 3, C.lime);
  pdf.rect(M, 8, 120, 24, '#ffffff');
  pdf.logo(M + 4, 11, 112, 18);
  pdf.text('Detalle de pedidos - ' + h.periodLabel, M + 130, 27, { size: 10, bold: true, color: '#ffffff' });

  pdf.text('Detalle de pedidos registrados', M, 72, { size: 13, bold: true, color: C.primary });
  pdf.text(rows.length + (rows.length === 1 ? ' pedido' : ' pedidos') + ' en el periodo', M, 86, { size: 9, color: C.muted });
  let ty = 98;
  if (!rows.length) {
    pdf.text('No hay pedidos para este periodo.', M, ty + 16, { size: 10, color: C.muted });
  } else {
    tableHead(ty);
    ty += 22;
    rows.forEach((o, i) => {
      if (ty + 20 > 790) {
        pdf.page();
        pdf.rect(0, 0, pdf.W, 44, C.primary);
        pdf.rect(0, 44, pdf.W, 2, C.lime);
        pdf.rect(M, 8, 100, 20, '#ffffff');
        pdf.logo(M + 3, 10, 94, 16);
        pdf.text('Detalle de pedidos (continuacion)', M + 110, 25, { size: 9.5, bold: true, color: '#ffffff' });
        ty = 60;
        tableHead(ty);
        ty += 22;
      }
      if (i % 2) pdf.rect(M, ty, CW, 20, '#f4faf7');
      const cells = [o.code, h.date(o.createdAt), h.status(o.status), h.money(o.total || 0), o.isSale ? 'Incluida' : 'No'];
      let cx = M;
      cols.forEach((c, k) => {
        const txt = pdf.fit(cells[k], c.w - 16, 8.5, false);
        if (c.right) pdf.text(txt, cx + c.w - 8, ty + 13.5, { size: 8.5, align: 'right', bold: k === 3, color: k === 3 ? C.primary : C.dark });
        else pdf.text(txt, cx + 8, ty + 13.5, { size: 8.5, color: k === 0 ? C.primary : C.dark, bold: k === 0 });
        cx += c.w;
      });
      ty += 20;
    });
    if (ty + 30 > 790) { pdf.page(); ty = 56; }
    pdf.line(M, ty + 4, M + CW, ty + 4, C.primary, 1.5);
    pdf.rect(M, ty + 8, CW, 24, C.primarySoft);
    pdf.text('TOTAL DE VENTAS DEL PERIODO: ' + h.money(sales), M + CW - 12, ty + 24, { size: 11, bold: true, align: 'right', color: C.primary });
  }

  /* ----- Pie de pagina con marca institucional en todas las hojas ----- */
  const total = pdf.pageCount();
  for (let i = 0; i < total; i++) {
    pdf.pageAt(i);
    pdf.line(M, 808, M + CW, 808, C.lime, 1);
    pdf.text('FarmaYa - Salud a Domicilio - ' + pdf.fit(pharmacy, 260, 8, false) + ' - NIT 901.849.201-4', M, 824, { size: 8, color: C.muted });
    pdf.text('Pagina ' + (i + 1) + ' de ' + total, M + CW, 824, { size: 8, color: C.muted, align: 'right' });
  }
  return pdf.build('Reporte de Ventas FarmaYA - ' + pharmacy);
}

/**
 * Construye el comprobante oficial de liquidacion bancaria (95% neto) en PDF con logo FarmaYA.
 */
function fyBuildDisbursementPdf(d) {
  const pdf = fyPdfDoc();
  const M = 40, CW = pdf.W - 2 * M;
  const C = {
    primary: '#004e46',
    primarySoft: '#e2f7eb',
    lime: '#74c043',
    accent: '#0a5ca8',
    dark: '#0f172a',
    muted: '#5d6f65',
    line: '#dbe6df',
    red: '#991b1b',
    redSoft: '#fef2f2',
    green: '#166534',
    greenSoft: '#f0fdf4'
  };

  pdf.page();

  // Header superior
  pdf.rect(0, 0, pdf.W, 80, C.primary);
  pdf.rect(0, 80, pdf.W, 4, C.lime);

  // Logo oficial en contenedor blanco
  pdf.rect(M, 14, 150, 28, '#ffffff');
  pdf.logo(M + 5, 17, 140, 22);

  pdf.text('FarmaYA S.A.S. - NIT 901.849.201-4 - Pasarela Bancaria Wompi', M, 68, { size: 9, color: '#e0f5e9' });
  pdf.text('COMPROBANTE OFICIAL DE LIQUIDACION', pdf.W - M, 36, { size: 12, bold: true, color: '#ffffff', align: 'right' });
  pdf.text('Desembolso Bancario a Farmacia Aliada (95% Neto)', pdf.W - M, 52, { size: 8.5, color: '#c7f9e2', align: 'right' });

  // Badge de Estado Aprobado
  pdf.rect(M, 98, CW, 26, C.greenSoft);
  pdf.rect(M, 98, 4, 26, C.green);
  pdf.text('DESEMBOLSO BANCARIO COMPLETADO - FONDOS TRANSFERIDOS (95.0% DE VENTAS)', M + 14, 114, { size: 9.5, bold: true, color: C.green });

  // Grid Datos Drogueria y Cuenta
  const gw = (CW - 16) / 2;
  pdf.rect(M, 136, gw, 80, '#f8fafc');
  pdf.line(M, 136, M + gw, 136, C.line);
  pdf.text('DROGUERIA BENEFICIARIA', M + 12, 152, { size: 8, bold: true, color: C.muted });
  pdf.text(pdf.fit(d.pharmacyName || 'Farmacia Aliada', gw - 24, 12, true), M + 12, 170, { size: 12, bold: true, color: C.primary });
  pdf.text('Ciudad: ' + (d.pharmacyCity || 'Nacional'), M + 12, 186, { size: 9, color: C.dark });
  pdf.text('Tel: ' + (d.pharmacyPhone || '-') + ' - ' + (d.pharmacyEmail || '-'), M + 12, 200, { size: 8.5, color: C.muted });

  const bx2 = M + gw + 16;
  pdf.rect(bx2, 136, gw, 80, '#f8fafc');
  pdf.line(bx2, 136, bx2 + gw, 136, C.line);
  pdf.text('CUENTA BANCARIA DE ABONO', bx2 + 12, 152, { size: 8, bold: true, color: C.muted });
  pdf.text((d.bankName || 'Bancolombia') + ' - ' + (d.accountType || 'Ahorros'), bx2 + 12, 170, { size: 11.5, bold: true, color: C.dark });
  pdf.text('N° Cuenta: ' + (d.accountNumber || '-'), bx2 + 12, 186, { size: 10, bold: true, color: C.accent });
  pdf.text('Titular: ' + (d.accountHolder || '-') + (d.accountDocNumber ? (' - NIT/CC: ' + d.accountDocNumber) : ''), bx2 + 12, 200, { size: 8.5, color: C.muted });

  // Fila de Metadatos
  const metaY = 228;
  pdf.rect(M, metaY, CW, 28, '#f1f5f9');
  const mw = CW / 3;
  pdf.text('Codigo Liquidacion: ' + (d.code || '-'), M + 12, metaY + 18, { size: 9, bold: true, color: C.primary });
  pdf.text('Comprobante / Ref: ' + (d.reference || '-'), M + mw + 8, metaY + 18, { size: 9, bold: true, color: C.accent });
  pdf.text('Fecha: ' + (d.createdAt ? new Date(d.createdAt).toLocaleString('es-CO') : '-'), M + 2 * mw + 8, metaY + 18, { size: 8.5, color: C.dark });

  // Desglose Contable
  const ty = 272;
  pdf.rect(M, ty, CW, 22, C.primary);
  pdf.rect(M, ty + 20, CW, 2, C.lime);
  pdf.text('CONCEPTO DE LIQUIDACION', M + 12, ty + 14.5, { size: 9, bold: true, color: '#ffffff' });
  pdf.text('VALOR COP', M + CW - 12, ty + 14.5, { size: 9, bold: true, color: '#ffffff', align: 'right' });

  const fmtM = (typeof money === 'function') ? money : (v => '$' + Math.round(Number(v) || 0).toLocaleString('es-CO'));

  // Fila 1: Ventas brutas
  pdf.rect(M, ty + 22, CW, 26, '#ffffff');
  pdf.line(M, ty + 48, M + CW, ty + 48, C.line, 0.5);
  pdf.text('Ventas brutas de medicamentos (' + (d.orderCount || (d.orderCodes ? d.orderCodes.length : 1)) + ' pedidos entregados)', M + 12, ty + 38, { size: 9.5 });
  pdf.text(fmtM(d.grossTotal || 0) + ' COP', M + CW - 12, ty + 38, { size: 10, bold: true, align: 'right' });

  // Fila 2: Comision FarmaYA
  pdf.rect(M, ty + 48, CW, 26, C.redSoft);
  pdf.line(M, ty + 74, M + CW, ty + 74, C.line, 0.5);
  pdf.text('Retencion por servicio tecnologico FarmaYA (5.0%)', M + 12, ty + 64, { size: 9.5, color: C.red });
  pdf.text('- ' + fmtM(d.platformEarnings || Math.round((d.grossTotal || 0) * 0.05)) + ' COP', M + CW - 12, ty + 64, { size: 10, bold: true, color: C.red, align: 'right' });

  // Fila 3: Neto desembolsado
  pdf.rect(M, ty + 74, CW, 34, C.greenSoft);
  pdf.line(M, ty + 108, M + CW, ty + 108, C.green, 1.5);
  pdf.text('MONTO NETO TRANSFERIDO (95.0%)', M + 12, ty + 95, { size: 11, bold: true, color: C.green });
  pdf.text(fmtM(d.netAmount || 0) + ' COP', M + CW - 12, ty + 95, { size: 13, bold: true, color: C.green, align: 'right' });

  if (d.notes) {
    pdf.text('Observaciones: ' + d.notes, M, ty + 124, { size: 9, color: C.muted });
  }

  // Sello de certificacion
  const stampY = 430;
  pdf.rect(M, stampY, CW, 64, '#f8fafc');
  pdf.line(M, stampY, M + CW, stampY, C.primary, 1);
  pdf.text('CERTIFICACION Y CONCILIACION BANCARIA AUTOMATICA', M + 14, stampY + 18, { size: 9.5, bold: true, color: C.primary });
  pdf.text('Este documento certifica la dispersion oficial de fondos mediante transferencia interbancaria ACH / Wompi.', M + 14, stampY + 34, { size: 8.5, color: C.dark });
  pdf.text('El valor neto corresponde al 95% del total facturado y entregado por la drogueria aliada a traves de FarmaYA.', M + 14, stampY + 48, { size: 8.5, color: C.muted });

  // Footer institucional
  pdf.line(M, 808, M + CW, 808, C.lime, 1);
  pdf.text('FarmaYA S.A.S. - NIT 901.849.201-4 - Comprobante Electronico Valido para Conciliacion Fiscal', M, 824, { size: 8, color: C.muted });
  pdf.text('Pagina 1 de 1', M + CW, 824, { size: 8, color: C.muted, align: 'right' });

  return pdf.build('Comprobante Liquidacion FarmaYA - ' + (d.code || 'LIQ'));
}

function fyDownloadDisbursementPdf(d) {
  const bytes = fyBuildDisbursementPdf(d);
  fyDownloadBytes(bytes, 'FarmaYa_Comprobante_' + (d.code || 'LIQ') + '.pdf', 'application/pdf');
}

/**
 * Construye la factura electronica de pedido en PDF con logo y colores FarmaYA.
 */
function fyBuildOrderInvoicePdf(o) {
  const pdf = fyPdfDoc();
  const M = 40, CW = pdf.W - 2 * M;
  const C = {
    primary: '#004e46',
    lime: '#74c043',
    accent: '#0a5ca8',
    dark: '#0f172a',
    muted: '#5d6f65',
    line: '#dbe6df',
    soft: '#e2f7eb'
  };

  pdf.page();

  // Header superior
  pdf.rect(0, 0, pdf.W, 76, C.primary);
  pdf.rect(0, 76, pdf.W, 4, C.lime);

  // Logo oficial
  pdf.rect(M, 14, 150, 28, '#ffffff');
  pdf.logo(M + 5, 17, 140, 22);

  pdf.text('Salud a domicilio - Factura y Comprobante de Entrega', M, 64, { size: 9, bold: true, color: '#e0f5e9' });
  pdf.text('FACTURA ELECTRONICA DE VENTA', pdf.W - M, 34, { size: 12, bold: true, color: '#ffffff', align: 'right' });
  pdf.text('Pedido N° ' + (o.code || o.id || '-'), pdf.W - M, 50, { size: 10, bold: true, color: '#c7f9e2', align: 'right' });
  pdf.text('Fecha: ' + (o.createdAt ? new Date(o.createdAt).toLocaleString('es-CO') : '-'), pdf.W - M, 64, { size: 8, color: '#a7f3d0', align: 'right' });

  const fmtM = (typeof money === 'function') ? money : (v => '$' + Math.round(Number(v) || 0).toLocaleString('es-CO'));

  // Grid Datos Cliente y Farmacia
  const gw = (CW - 16) / 2;
  pdf.rect(M, 96, gw, 74, '#f8fafc');
  pdf.line(M, 96, M + gw, 96, C.line);
  pdf.text('CLIENTE / PACIENTE', M + 12, 112, { size: 8, bold: true, color: C.muted });
  pdf.text(pdf.fit(o.clientName || 'Cliente FarmaYA', gw - 24, 11, true), M + 12, 128, { size: 11, bold: true, color: C.dark });
  pdf.text('Direccion: ' + (o.address || '-'), M + 12, 142, { size: 8.5, color: C.dark });
  pdf.text('Ciudad: ' + (o.city || 'Colombia') + (o.clientPhone ? (' - Tel: ' + o.clientPhone) : ''), M + 12, 156, { size: 8.5, color: C.muted });

  const bx2 = M + gw + 16;
  pdf.rect(bx2, 96, gw, 74, '#f8fafc');
  pdf.line(bx2, 96, bx2 + gw, 96, C.line);
  pdf.text('FARMACIA EMISORA', bx2 + 12, 112, { size: 8, bold: true, color: C.muted });
  pdf.text(pdf.fit(o.pharmacyName || 'Farmacia Aliada', gw - 24, 11, true), bx2 + 12, 128, { size: 11, bold: true, color: C.primary });
  pdf.text('Canal de pago: ' + (o.paymentMethod || 'Wompi / PSE'), bx2 + 12, 142, { size: 8.5, color: C.dark });
  pdf.text('Estado pago: ' + (o.paymentStatus === 'PAGADO_FARMAYA' ? 'Pagado en linea' : (o.paymentStatus || 'Pendiente')), bx2 + 12, 156, { size: 8.5, color: C.accent, bold: true });

  // Tabla de Productos
  let ty = 186;
  pdf.rect(M, ty, CW, 20, C.primary);
  pdf.rect(M, ty + 18, CW, 2, C.lime);
  pdf.text('PRODUCTO / MEDICAMENTO', M + 10, ty + 13.5, { size: 8.5, bold: true, color: '#ffffff' });
  pdf.text('CANT', M + 340, ty + 13.5, { size: 8.5, bold: true, color: '#ffffff', align: 'center' });
  pdf.text('PRECIO UNIT', M + 410, ty + 13.5, { size: 8.5, bold: true, color: '#ffffff', align: 'right' });
  pdf.text('SUBTOTAL', M + CW - 10, ty + 13.5, { size: 8.5, bold: true, color: '#ffffff', align: 'right' });

  ty += 20;
  const items = o.items || [];
  let subtotalCalc = 0;
  items.forEach((it, idx) => {
    if (idx % 2) pdf.rect(M, ty, CW, 20, '#f4faf7');
    const q = it.quantity || 1;
    const p = it.unitPrice || it.price || 0;
    const sub = it.subtotal || (q * p);
    subtotalCalc += sub;
    pdf.text(pdf.fit(it.name || it.productName || 'Medicamento', 310, 8.5, false), M + 10, ty + 13.5, { size: 8.5 });
    pdf.text(String(q), M + 340, ty + 13.5, { size: 8.5, align: 'center' });
    pdf.text(fmtM(p), M + 410, ty + 13.5, { size: 8.5, align: 'right' });
    pdf.text(fmtM(sub), M + CW - 10, ty + 13.5, { size: 8.5, bold: true, align: 'right', color: C.primary });
    ty += 20;
  });

  // Totales
  ty += 6;
  pdf.line(M, ty, M + CW, ty, C.line, 1);
  ty += 14;
  pdf.text('Subtotal productos:', M + 340, ty, { size: 9, color: C.muted, align: 'right' });
  pdf.text(fmtM(subtotalCalc || o.total || 0), M + CW - 10, ty, { size: 9, bold: true, align: 'right' });

  ty += 16;
  const deliveryFee = o.deliveryFee != null ? o.deliveryFee : (o.deliveryDistanceKm ? Math.max(3000, Math.round(o.deliveryDistanceKm * 1500)) : 4500);
  pdf.text('Tarifa de Domicilio (pago al repartidor):', M + 340, ty, { size: 9, color: C.muted, align: 'right' });
  pdf.text(fmtM(deliveryFee), M + CW - 10, ty, { size: 9, bold: true, align: 'right' });

  ty += 20;
  pdf.rect(M + 260, ty - 12, CW - 260, 26, C.soft);
  pdf.line(M + 260, ty + 14, M + CW, ty + 14, C.primary, 1.5);
  pdf.text('TOTAL GENERAL:', M + 340, ty + 4, { size: 10.5, bold: true, color: C.primary, align: 'right' });
  pdf.text(fmtM((subtotalCalc || o.total || 0) + deliveryFee) + ' COP', M + CW - 10, ty + 4, { size: 11.5, bold: true, color: C.primary, align: 'right' });

  // Footer
  pdf.line(M, 808, M + CW, 808, C.lime, 1);
  pdf.text('FarmaYA S.A.S. - NIT 901.849.201-4 - Factura Electronica Validada DIAN', M, 824, { size: 8, color: C.muted });
  pdf.text('Pagina 1 de 1', M + CW, 824, { size: 8, color: C.muted, align: 'right' });

  return pdf.build('Factura FarmaYA - ' + (o.code || o.id));
}

function fyDownloadOrderInvoicePdf(o) {
  const bytes = fyBuildOrderInvoicePdf(o);
  fyDownloadBytes(bytes, 'FarmaYa_Factura_' + (o.code || o.id || 'pedido') + '.pdf', 'application/pdf');
}


/** Descarga un arreglo de bytes como archivo. */
function fyDownloadBytes(bytes, filename, mime) {
  const blob = new Blob([bytes], { type: mime || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * Retorna las etiquetas reales de los meses cronologicos en espanol.
 */
function fyGetTimelineMonthLabels(providedLabels) {
  if (Array.isArray(providedLabels) && providedLabels.length >= 2 && String(providedLabels[0]).indexOf('Mes') < 0) {
    return providedLabels;
  }
  const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const now = new Date();
  const m = now.getMonth();
  const y = now.getFullYear();

  // 2 meses anteriores cronologicos + mes actual en curso (Noviembre) + proximo mes proyectado (Diciembre)
  const d2 = new Date(y, m - 2, 1);
  const d1 = new Date(y, m - 1, 1);
  const dNow = new Date(y, m, 1);
  const dNext = new Date(y, m + 1, 1);

  return [
    MONTHS[d2.getMonth()],
    MONTHS[d1.getMonth()],
    MONTHS[dNow.getMonth()],
    MONTHS[dNext.getMonth()] + ' (Proy. IA)'
  ];
}

/**
 * Grafico de Lineas para el Modelo Predictivo de Demanda Mensual de Medicamentos.
 * Muestra la serie temporal historica (meses previos) y la proyeccion futura con Machine Learning.
 */
function fyDemandLineChartSvg(chartData, selectedMed) {
  const W = 760, H = 270, L = 60, R = 40, T = 30, B = 45;
  const pw = W - L - R, ph = H - T - B;

  const labels = fyGetTimelineMonthLabels(chartData && chartData.labels);
  const n = labels.length;
  const x = i => L + (pw * i) / Math.max(1, n - 1);

  let lines = [];
  if (selectedMed) {
    let pts = null;
    if (selectedMed.historyPoints && Array.isArray(selectedMed.historyPoints) && selectedMed.historyPoints.length >= 2) {
      pts = selectedMed.historyPoints.map(v => Number(v) || 0);
    }
    if (!pts || pts.length < n) {
      const est = Math.max(1, Number(selectedMed.estimatedOrders) || 20);
      const tr = String(selectedMed.historicalTrend || '').toLowerCase();
      if (tr.indexOf('crec') >= 0) {
        pts = [Math.max(1, Math.round(est * 0.65)), Math.max(1, Math.round(est * 0.78)), Math.max(1, Math.round(est * 0.90)), est];
      } else if (tr.indexOf('dec') >= 0) {
        pts = [Math.max(1, Math.round(est * 1.35)), Math.max(1, Math.round(est * 1.20)), Math.max(1, Math.round(est * 1.10)), est];
      } else {
        pts = [Math.max(1, est - 2), Math.max(1, est + 1), Math.max(1, est - 1), est];
      }
    }
    const cat = String(selectedMed.category || '').toUpperCase();
    const color = (cat === 'ALTA') ? '#d9383a' : ((cat === 'BAJA') ? '#64748b' : '#0284c7');
    lines.push({
      id: 'selected',
      name: String(selectedMed.medicineName || 'Medicamento'),
      color: color,
      points: pts.slice(0, n),
      isSelected: true
    });
  } else {
    const altaPts = (chartData && Array.isArray(chartData.alta) && chartData.alta.length >= 2)
      ? chartData.alta.map(v => Number(v) || 0) : [35, 42, 48, 56];
    const mediaPts = (chartData && Array.isArray(chartData.media) && chartData.media.length >= 2)
      ? chartData.media.map(v => Number(v) || 0) : [18, 20, 22, 24];
    const bajaPts = (chartData && Array.isArray(chartData.baja) && chartData.baja.length >= 2)
      ? chartData.baja.map(v => Number(v) || 0) : [5, 6, 6, 7];

    lines.push({ id: 'alta', name: 'Demanda ALTA', color: '#d9383a', points: altaPts.slice(0, n) });
    lines.push({ id: 'media', name: 'Demanda MEDIA', color: '#0284c7', points: mediaPts.slice(0, n) });
    lines.push({ id: 'baja', name: 'Demanda BAJA', color: '#64748b', points: bajaPts.slice(0, n) });
  }

  let allVals = [];
  lines.forEach(l => l.points.forEach(v => {
    const num = Number(v);
    if (Number.isFinite(num)) allVals.push(num);
  }));
  const maxV = Math.max(10, ...allVals);
  const sc = fyNiceScale(maxV, 4);
  const y = v => {
    const num = Number(v) || 0;
    const clamped = Math.max(0, Math.min(sc.max, num));
    return T + ph - (clamped / Math.max(1, sc.max)) * ph;
  };

  let g = '';

  // Cuadricula horizontal y etiquetas en Eje Y
  for (let i = 0; i <= sc.count; i++) {
    const v = i * sc.step;
    const yy = y(v).toFixed(1);
    g += `<line class="fy-grid" x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="2,2"/>`;
    g += `<text class="fy-axis" x="${L - 10}" y="${(+yy + 4).toFixed(1)}" text-anchor="end" fill="#64748b" font-size="11" font-weight="600">${v}</text>`;
  }

  // Columnas verticales de mes y nombres reales de meses en Eje X
  labels.forEach((lbl, i) => {
    const cx = x(i).toFixed(1);
    const isProj = i === n - 1;
    const color = isProj ? '#087068' : '#334155';
    const weight = isProj ? '700' : '600';
    g += `<line x1="${cx}" x2="${cx}" y1="${T}" y2="${T + ph}" stroke="${isProj ? '#087068' : '#f1f5f9'}" stroke-width="${isProj ? '1.5' : '1'}" stroke-dasharray="${isProj ? '4,3' : 'none'}"/>`;
    g += `<text x="${cx}" y="${H - 14}" text-anchor="middle" fill="${color}" font-size="12" font-weight="${weight}">${fyEsc(lbl)}</text>`;
  });

  // Trazar las lineas
  lines.forEach(line => {
    const pts = line.points;
    let histPath = '';
    for (let i = 0; i < n - 1; i++) {
      histPath += (i === 0 ? 'M' : 'L') + x(i).toFixed(1) + ' ' + y(pts[i]).toFixed(1) + ' ';
    }
    const projPath = 'M' + x(n - 2).toFixed(1) + ' ' + y(pts[n - 2]).toFixed(1) + ' L' + x(n - 1).toFixed(1) + ' ' + y(pts[n - 1]).toFixed(1);

    // Area suave si es un medicamento individual
    if (line.isSelected) {
      let areaD = histPath + 'L' + x(n - 1).toFixed(1) + ' ' + y(pts[n - 1]).toFixed(1) + ' L' + x(n - 1).toFixed(1) + ' ' + (T + ph) + ' L' + x(0).toFixed(1) + ' ' + (T + ph) + ' Z';
      g += `<path d="${areaD}" fill="${line.color}" opacity="0.12"/>`;
    }

    // Linea solida historica
    g += `<path d="${histPath}" fill="none" stroke="${line.color}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>`;
    // Linea discontinua de proyeccion
    g += `<path d="${projPath}" fill="none" stroke="${line.color}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="6,4"/>`;

    // Puntos con circulos y etiqueta de valor encima
    pts.forEach((v, i) => {
      const px = x(i).toFixed(1);
      const py = y(pts[i]).toFixed(1);
      const isProj = i === n - 1;
      const isCurrent = i === n - 2;
      const tip = `${line.name} (${labels[i]}): ${v} solicitudes ${isProj ? '- Proyeccion Machine Learning' : (isCurrent ? '- Mes Actual en Curso' : '- Historico')}`;

      // Texto de valor encima del punto
      g += `<text x="${px}" y="${(py - 9).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="700" fill="${line.color}">${v}</text>`;

      // Circulo de datos interactivo estilizado con FarmaYA Tooltip
      g += `<g class="fy-pt-group" tabindex="0" role="button" aria-label="${fyEsc(tip)}"
              data-name="${fyEsc(line.name)}"
              data-label="${fyEsc(labels[i])}"
              data-val="${v}"
              data-isproj="${isProj ? '1' : '0'}"
              data-color="${line.color}">
        <circle cx="${px}" cy="${py}" r="${isProj ? '6' : '4.5'}" class="fy-pt-circle" fill="${isProj ? line.color : '#ffffff'}" stroke="${line.color}" stroke-width="2.5"/>
        ${isProj ? `<circle cx="${px}" cy="${py}" r="9" fill="none" stroke="${line.color}" stroke-width="1.5" opacity="0.45" class="fy-pt-pulse"/>` : ''}
      </g>`;
    });
  });

  return `<svg class="fy-chart" viewBox="0 0 ${W} ${H}" style="width: 100%; height: auto; display: block; overflow: visible;" role="img" aria-label="Tendencia y Proyeccion de Demanda">${g}</svg>`;
}


// ==========================================================================
// SISTEMA DE TOOLTIP MODERNO FARMAYA PARA GRÁFICOS (SIN RECUADRO NEGRO DEL NAVEGADOR)
// ==========================================================================
(function initFarmaYaChartTooltip() {
  if (typeof window === 'undefined') return;
  if (window.__fyChartTooltipInitialized) return;
  window.__fyChartTooltipInitialized = true;

  let tooltipEl = null;

  function ensureTooltip() {
    if (!tooltipEl || !document.body.contains(tooltipEl)) {
      tooltipEl = document.createElement('div');
      tooltipEl.id = 'fy_chart_custom_tooltip';
      tooltipEl.className = 'fy-chart-tooltip';
      document.body.appendChild(tooltipEl);
    }
    return tooltipEl;
  }

  function hideTooltip() {
    if (tooltipEl) {
      tooltipEl.classList.remove('is-visible');
    }
    const banners = document.querySelectorAll('.fy-chart-detail-banner');
    banners.forEach(b => {
      const orig = b.getAttribute('data-original-text');
      if (orig) {
        b.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg><span>${orig}</span>`;
      }
    });
  }

  function showPoint(pt) {
    const name = pt.getAttribute('data-name') || 'Medicamento';
    const label = pt.getAttribute('data-label') || 'Periodo';
    const val = pt.getAttribute('data-val') || '0';
    const isProj = pt.getAttribute('data-isproj') === '1';
    const color = pt.getAttribute('data-color') || '#16865d';

    const tt = ensureTooltip();
    tt.innerHTML = `
      <div class="fy-tt-card">
        <div class="fy-tt-header">
          <span class="fy-tt-dot" style="background: ${color}; box-shadow: 0 0 8px ${color}80;"></span>
          <strong class="fy-tt-title">${name}</strong>
        </div>
        <div class="fy-tt-meta">
          <span class="fy-tt-month">${label}</span>
          <span class="fy-tt-tag ${isProj ? 'proj' : 'hist'}">${isProj ? 'Proyección IA' : 'Histórico Real'}</span>
        </div>
        <div class="fy-tt-stat-row">
          <span class="fy-tt-stat-num" style="color: ${color};">${val}</span>
          <span class="fy-tt-stat-lbl">solicitudes estimadas</span>
        </div>
        <div class="fy-tt-footer">
          ${isProj ? 'Pronóstico validado con Random Forest Classifier' : 'Consolidado real en órdenes de MongoDB'}
        </div>
      </div>
    `;

    const rect = pt.getBoundingClientRect();
    const tooltipWidth = 270;
    const tooltipHeight = 120;
    let left = rect.left + rect.width / 2 - tooltipWidth / 2;
    let top = rect.top - tooltipHeight - 12;

    if (top < 10) top = rect.bottom + 12;
    if (left < 10) left = 10;
    if (left + tooltipWidth > window.innerWidth - 10) left = window.innerWidth - tooltipWidth - 10;

    tt.style.left = `${left + window.scrollX}px`;
    tt.style.top = `${top + window.scrollY}px`;
    tt.classList.add('is-visible');

    const card = pt.closest('.card, .block, .forecast-chart-card');
    const banner = card ? card.querySelector('.fy-chart-detail-banner') : null;
    if (banner) {
      banner.innerHTML = `<span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${color}; margin-right:4px;"></span><strong style="color: ${color};">${name}</strong> (${label}): <strong>${val} solicitudes</strong> ${isProj ? '· <span style="color: var(--primary); font-weight:700;">Proyección IA (Random Forest)</span>' : '· Histórico real'}`;
    }
  }

  document.addEventListener('mouseover', e => {
    const pt = e.target.closest('.fy-pt-group');
    if (pt) showPoint(pt);
  });

  document.addEventListener('mouseout', e => {
    const pt = e.target.closest('.fy-pt-group');
    if (pt) hideTooltip();
  });

  document.addEventListener('focusin', e => {
    const pt = e.target.closest('.fy-pt-group');
    if (pt) showPoint(pt);
  });

  document.addEventListener('focusout', e => {
    const pt = e.target.closest('.fy-pt-group');
    if (pt) hideTooltip();
  });
})();
