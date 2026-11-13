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

const FY_LOGO_PNG_RGB_B64 = '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';
const FY_LOGO_PNG_ALPHA_B64 = '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';
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

  function addImagePng(rgbB64, alphaB64, widthPx, heightPx) {
    let img = images.find(it => it.rgbB64 === rgbB64);
    if (img) return img;
    const rgbBinStr = atob(rgbB64);
    const alphaBinStr = atob(alphaB64);
    const id = images.length + 1;
    img = {
      id,
      width: widthPx,
      height: heightPx,
      isPng: true,
      length: rgbBinStr.length,
      binStr: rgbBinStr,
      rgbB64,
      smask: {
        length: alphaBinStr.length,
        binStr: alphaBinStr
      }
    };
    images.push(img);
    return img;
  }

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
      const img = addImagePng(FY_LOGO_PNG_RGB_B64, FY_LOGO_PNG_ALPHA_B64, 942, 163);
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

      let nextObj = 5;
      images.forEach(img => {
        if (img.smask) {
          img.smaskObjNum = nextObj++;
          img.objNum = nextObj++;
        } else {
          img.objNum = nextObj++;
        }
      });

      const startPagesObj = nextObj;
      const kids = pages.map((_, i) => (startPagesObj + i * 2) + ' 0 R').join(' ');
      obj(2, `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
      obj(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
      obj(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

      images.forEach(img => {
        if (img.smask) {
          obj(img.smaskObjNum, `<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ${img.smask.length} >>\nstream\n${img.smask.binStr}\nendstream`);
          obj(img.objNum, `<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /SMask ${img.smaskObjNum} 0 R /Length ${img.length} >>\nstream\n${img.binStr}\nendstream`);
        } else {
          obj(img.objNum, `<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.length} >>\nstream\n${img.binStr}\nendstream`);
        }
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

  // Header superior FarmaYA: fondo blanco con ribete institucional esmeralda y lima
  pdf.rect(0, 0, pdf.W, 76, '#ffffff');
  pdf.rect(0, 76, pdf.W, 2.5, C.primary);
  pdf.rect(0, 78.5, pdf.W, 2.5, C.lime);

  // Logo oficial FarmaYA (PNG transparente con canal alfa / SMask)
  pdf.logo(M, 16, 140, 24.2);

  // Titulos y metadatos en colores institucionales sobre fondo blanco
  pdf.text('Salud a domicilio - Reporte Oficial de Ventas', M, 58, { size: 9, bold: true, color: C.muted });
  pdf.text('REPORTE OFICIAL DE VENTAS', pdf.W - M, 34, { size: 12, bold: true, color: C.primary, align: 'right' });
  pdf.text('Generado el ' + h.generated, pdf.W - M, 49, { size: 9, color: C.muted, align: 'right' });
  pdf.text('FarmaYA S.A.S. - NIT 901.849.201-4', pdf.W - M, 63, { size: 8, color: C.muted, align: 'right' });

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
  pdf.rect(0, 0, pdf.W, 46, '#ffffff');
  pdf.rect(0, 46, pdf.W, 2, C.primary);
  pdf.rect(0, 48, pdf.W, 2, C.lime);
  pdf.logo(M, 11, 112, 19.4);
  pdf.text('Detalle de pedidos - ' + h.periodLabel, M + 130, 27, { size: 10, bold: true, color: C.primary });

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
        pdf.rect(0, 0, pdf.W, 44, '#ffffff');
        pdf.rect(0, 44, pdf.W, 2, C.primary);
        pdf.rect(0, 46, pdf.W, 2, C.lime);
        pdf.logo(M, 10, 94, 16.3);
        pdf.text('Detalle de pedidos (continuacion)', M + 110, 25, { size: 9.5, bold: true, color: C.primary });
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

  // Header superior FarmaYA: fondo blanco con ribete institucional esmeralda y lima
  pdf.rect(0, 0, pdf.W, 76, '#ffffff');
  pdf.rect(0, 76, pdf.W, 2.5, C.primary);
  pdf.rect(0, 78.5, pdf.W, 2.5, C.lime);

  // Logo oficial FarmaYA (PNG transparente con canal alfa / SMask)
  pdf.logo(M, 16, 140, 24.2);

  pdf.text('FarmaYA S.A.S. - NIT 901.849.201-4 - Pasarela Bancaria Wompi', M, 58, { size: 8.5, color: C.muted });
  pdf.text('COMPROBANTE OFICIAL DE LIQUIDACION', pdf.W - M, 34, { size: 12, bold: true, color: C.primary, align: 'right' });
  pdf.text('Desembolso Bancario a Farmacia Aliada (95% Neto)', pdf.W - M, 49, { size: 8.5, color: C.muted, align: 'right' });
  pdf.text('Comprobante: ' + (d.code || 'LIQ'), pdf.W - M, 63, { size: 8.5, bold: true, color: C.dark, align: 'right' });

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

  // Header superior FarmaYA: fondo blanco con ribete institucional esmeralda y lima
  pdf.rect(0, 0, pdf.W, 76, '#ffffff');
  pdf.rect(0, 76, pdf.W, 2.5, C.primary);
  pdf.rect(0, 78.5, pdf.W, 2.5, C.lime);

  // Logo oficial FarmaYA (PNG transparente con canal alfa / SMask)
  pdf.logo(M, 16, 140, 24.2);

  pdf.text('Salud a domicilio - Factura y Comprobante de Entrega', M, 58, { size: 9, bold: true, color: C.muted });
  pdf.text('FACTURA ELECTRONICA DE VENTA', pdf.W - M, 34, { size: 12, bold: true, color: C.primary, align: 'right' });
  pdf.text('Pedido N° ' + (o.code || o.id || '-'), pdf.W - M, 49, { size: 10, bold: true, color: C.primary, align: 'right' });
  pdf.text('Fecha: ' + (o.createdAt ? new Date(o.createdAt).toLocaleString('es-CO') : '-'), pdf.W - M, 63, { size: 8, color: C.muted, align: 'right' });

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
