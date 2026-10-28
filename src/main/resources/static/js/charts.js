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

function fyPdfDoc() {
  const W = 595.28, H = 841.89;
  const pages = [];
  let ops = null;
  let ctx = null;
  try { ctx = document.createElement('canvas').getContext('2d'); } catch (_) { ctx = null; }

  const num = v => Number(v).toFixed(2);
  const rgb = hex => {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex) || [0, '00', '00', '00'];
    return [m[1], m[2], m[3]].map(x => (parseInt(x, 16) / 255).toFixed(3)).join(' ');
  };
  /** Texto Unicode → cadena binaria WinAnsi, escapada para PDF. */
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

  const api = {
    W, H, measure,
    page() { ops = []; pages.push(ops); },
    pageCount() { return pages.length; },
    pageAt(i) { ops = pages[i]; },
    rect(x, y, w, h, fill) { ops.push(`${rgb(fill)} rg ${num(x)} ${num(H - y - h)} ${num(w)} ${num(h)} re f`); },
    line(x1, y1, x2, y2, color, lw = 0.5) { ops.push(`${rgb(color)} RG ${lw} w ${num(x1)} ${num(H - y1)} m ${num(x2)} ${num(H - y2)} l S`); },
    /** y = línea base, medida desde el borde superior de la página. */
    text(str, x, y, o = {}) {
      const size = o.size || 10, bold = !!o.bold;
      const w = measure(str, size, bold);
      const px = o.align === 'right' ? x - w : o.align === 'center' ? x - w / 2 : x;
      ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${rgb(o.color || '#18352b')} rg ${num(px)} ${num(H - y)} Td (${bin(str)}) Tj ET`);
    },
    /** Recorta el texto con "..." para que quepa en maxW. */
    fit(str, maxW, size, bold) {
      let s = String(str == null ? '' : str);
      if (measure(s, size, bold) <= maxW) return s;
      while (s.length > 1 && measure(s + '...', size, bold) > maxW) s = s.slice(0, -1);
      return s + '...';
    },
    build() {
      const out = [];
      let len = 0;
      const offs = [];
      const push = s => { out.push(s); len += s.length; };
      const obj = (n, body) => { offs[n] = len; push(n + ' 0 obj\n' + body + '\nendobj\n'); };
      push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
      obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
      obj(2, `<< /Type /Pages /Kids [${pages.map((_, i) => (5 + i * 2) + ' 0 R').join(' ')}] /Count ${pages.length} >>`);
      obj(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
      obj(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
      pages.forEach((p, i) => {
        const pn = 5 + i * 2, cn = pn + 1, stream = p.join('\n');
        obj(pn, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${cn} 0 R >>`);
        obj(cn, `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
      });
      const total = 5 + pages.length * 2;
      const xref = len;
      let x = 'xref\n0 ' + total + '\n0000000000 65535 f \n';
      for (let n = 1; n < total; n++) x += String(offs[n]).padStart(10, '0') + ' 00000 n \n';
      push(x + `trailer\n<< /Size ${total} /Root 1 0 R /Info << /Title (${bin('Reporte de ventas FarmaYa')}) /Producer (FarmaYa) >> >>\nstartxref\n${xref}\n%%EOF`);
      const s = out.join('');
      const bytes = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i) & 255;
      return bytes;
    }
  };
  return api;
}

/**
 * Construye el reporte de ventas de la farmacia.
 * h = { money(n), date(iso), status(code), generated(texto), periodLabel(texto) }
 */
function fyBuildSalesPdf(d, h) {
  const pdf = fyPdfDoc();
  const M = 40, CW = pdf.W - 2 * M;
  const C = { dark: '#18352b', muted: '#5d6f65', line: '#dbe6df', soft: '#e9f1ee', primary: '#087068', deep: '#05564f' };
  const rows = d.reportOrders || [];
  const best = d.bestSellers || [];
  const sales = Number(d.sales) || 0, delivered = Number(d.delivered) || 0, ordersN = Number(d.orders) || 0;
  const pharmacy = d.pharmacyName || 'Farmacia';

  /* ----- Página 1 ----- */
  pdf.page();
  pdf.rect(0, 0, pdf.W, 74, C.deep);
  pdf.text('FarmaYa', M, 42, { size: 22, bold: true, color: '#ffffff' });
  pdf.text('Salud a domicilio · Reporte de ventas', M, 60, { size: 10, color: '#cfeedd' });
  pdf.text('Generado el ' + h.generated, pdf.W - M, 42, { size: 9, color: '#cfeedd', align: 'right' });
  pdf.text(pdf.fit(pharmacy, CW, 17, true), M, 108, { size: 17, bold: true });
  pdf.text('Período: ' + h.periodLabel, M, 126, { size: 10, color: C.muted });

  const kpis = [
    ['VENTAS REALIZADAS', h.money(sales)],
    ['PEDIDOS RECIBIDOS', String(ordersN)],
    ['PEDIDOS ENTREGADOS', String(delivered)],
    ['TICKET PROMEDIO', h.money(delivered ? sales / delivered : 0)]
  ];
  const kw = (CW - 30) / 4;
  kpis.forEach(([label, value], i) => {
    const x = M + i * (kw + 10);
    pdf.rect(x, 144, kw, 56, C.soft);
    pdf.rect(x, 144, 3, 56, C.primary);
    pdf.text(label, x + 12, 164, { size: 7.5, bold: true, color: C.muted });
    pdf.text(pdf.fit(value, kw - 20, 15, true), x + 12, 188, { size: 15, bold: true });
  });

  /* Ventas por día / mes */
  const series = fyBuildSalesSeries(d);
  let y = 226;
  pdf.text('Ventas por ' + (series.monthly ? 'mes' : 'día'), M, y, { size: 11.5, bold: true });
  pdf.line(M, y + 6, M + CW, y + 6, C.line);
  const cx0 = M + 54, cw = CW - 54, top = y + 24, ph = 128;
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
    if (bh > 0) pdf.rect(bx - bw / 2, top + ph - bh, bw, bh, C.primary);
    if (i % every === 0) pdf.text(p.label, bx, top + ph + 14, { size: 7.5, color: C.muted, align: 'center' });
  });
  if (!maxV) pdf.text('Sin ventas en este período', cx0 + cw / 2, top + ph / 2, { size: 10, color: C.muted, align: 'center' });

  /* Estado de los pedidos */
  y = top + ph + 40;
  pdf.text('Estado de los pedidos', M, y, { size: 11.5, bold: true });
  pdf.line(M, y + 6, M + CW, y + 6, C.line);
  const segs = fyStatusSegments(d);
  const totalSeg = segs.reduce((a, s) => a + s.value, 0);
  if (!totalSeg) {
    pdf.text('No hay pedidos en este período.', M, y + 28, { size: 10, color: C.muted });
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

  /* Medicamentos más vendidos */
  y += 28;
  pdf.text('Medicamentos más vendidos', M, y, { size: 11.5, bold: true });
  pdf.line(M, y + 6, M + CW, y + 6, C.line);
  if (!best.length) {
    pdf.text('Sin ventas de medicamentos en este período.', M, y + 28, { size: 10, color: C.muted });
  } else {
    const maxQ = Math.max(...best.map(b => Number(b.quantity) || 0), 1);
    const bx = M + 190, bmax = CW - 190 - 112;
    best.slice(0, 8).forEach((b, i) => {
      const ry = y + 28 + i * 21;
      pdf.text(pdf.fit((i + 1) + '. ' + b.name, 180, 9, false), M, ry, { size: 9 });
      pdf.rect(bx, ry - 8, bmax, 9, C.soft);
      pdf.rect(bx, ry - 8, Math.max(2, bmax * (Number(b.quantity) || 0) / maxQ), 9, C.primary);
      pdf.text((b.quantity || 0) + ' uds · ' + h.money(b.sales || 0), M + CW, ry, { size: 8.5, bold: true, align: 'right' });
    });
  }

  /* ----- Detalle de pedidos (páginas siguientes) ----- */
  const cols = [
    { t: 'Pedido', w: 88 }, { t: 'Fecha y hora', w: 128 }, { t: 'Estado', w: 128 },
    { t: 'Total', w: 98, right: true }, { t: 'Venta', w: 73, right: true }
  ];
  const tableHead = (ty) => {
    pdf.rect(M, ty, CW, 20, C.deep);
    let cx = M;
    cols.forEach(c => {
      if (c.right) pdf.text(c.t, cx + c.w - 8, ty + 13.5, { size: 8.5, bold: true, color: '#ffffff', align: 'right' });
      else pdf.text(c.t, cx + 8, ty + 13.5, { size: 8.5, bold: true, color: '#ffffff' });
      cx += c.w;
    });
  };
  pdf.page();
  pdf.text('Detalle de pedidos', M, 56, { size: 13, bold: true });
  pdf.text(rows.length + (rows.length === 1 ? ' pedido' : ' pedidos') + ' en el período', M, 72, { size: 9, color: C.muted });
  let ty = 86;
  if (!rows.length) {
    pdf.text('No hay pedidos para este período.', M, ty + 16, { size: 10, color: C.muted });
  } else {
    tableHead(ty);
    ty += 20;
    rows.forEach((o, i) => {
      if (ty + 20 > 790) {
        pdf.page();
        ty = 56;
        tableHead(ty);
        ty += 20;
      }
      if (i % 2) pdf.rect(M, ty, CW, 20, '#f6faf8');
      const cells = [o.code, h.date(o.createdAt), h.status(o.status), h.money(o.total || 0), o.isSale ? 'Incluida' : 'No'];
      let cx = M;
      cols.forEach((c, k) => {
        const txt = pdf.fit(cells[k], c.w - 16, 8.5, false);
        if (c.right) pdf.text(txt, cx + c.w - 8, ty + 13.5, { size: 8.5, align: 'right', bold: k === 3 });
        else pdf.text(txt, cx + 8, ty + 13.5, { size: 8.5 });
        cx += c.w;
      });
      ty += 20;
    });
    if (ty + 30 > 790) { pdf.page(); ty = 56; }
    pdf.line(M, ty + 4, M + CW, ty + 4, C.deep, 1);
    pdf.text('Total de ventas del período: ' + h.money(sales), M + CW, ty + 22, { size: 10.5, bold: true, align: 'right' });
  }

  /* ----- Pie de página en todas las hojas ----- */
  const total = pdf.pageCount();
  for (let i = 0; i < total; i++) {
    pdf.pageAt(i);
    pdf.line(M, 808, M + CW, 808, C.line);
    pdf.text('FarmaYa · ' + pdf.fit(pharmacy, 300, 8, false), M, 824, { size: 8, color: C.muted });
    pdf.text('Página ' + (i + 1) + ' de ' + total, M + CW, 824, { size: 8, color: C.muted, align: 'right' });
  }
  return pdf.build();
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
