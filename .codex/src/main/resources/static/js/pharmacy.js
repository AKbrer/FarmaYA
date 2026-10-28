/* FarmaYA · panel de la farmacia */

window.__farmayaSeenOffers = window.__farmayaSeenOffers || null;
let pharmacyDashboardFrom = '';
let pharmacyDashboardTo = '';

function availabilityBar(user, onLabel, offLabel, detail) {
  const text = h('strong', null, user.active ? onLabel : offLabel);
  const control = switchControl(user.active, async input => {
    try {
      const u = await API.post('/auth/active', { value: input.checked });
      state.user = u;
      text.textContent = u.active ? onLabel : offLabel;
      refreshAll();
    } catch (e) {
      input.checked = !input.checked;
      toast(e.message, 'error');
    }
  }, onLabel);
  return h('div', { class: 'availability' }, control, h('div', null, text, detail && h('small', { class: 'muted block-line' }, detail)));
}

function pharmacyView(user) {
  window.__farmayaSeenOffers = null;
  const hours = user.openFrom === user.openTo ? 'Abierta las 24 horas' : 'Atiende de ' + user.openFrom + ' a ' + user.openTo;
  return h('div', { class: 'stack' },
    h('h1', { class: 'page-title' }, user.pharmacyName || user.name),
    availabilityBar(user, 'Recibiendo pedidos', 'En pausa', hours + ' en ' + user.zone),
    !user.verified && notice('warn', 'Tu farmacia está pendiente de verificación', 'Un administrador revisará tu licencia. Hasta entonces no verás solicitudes.'),
    sideNavigation([
      { label: 'Dashboard', icon: 'layout-dashboard', render: pharmacyDashboard },
      { label: 'Solicitudes', icon: 'inbox', render: pharmacyOffers },
      { label: 'Mis pedidos', icon: 'package-check', render: pharmacyOrders },
      { label: 'Movimientos', icon: 'history', render: () => movementHistory('/pharmacy/movements') }
    ], 0));
}

function pharmacyToday() { return fyDayKey(new Date()); }

function pharmacyShiftDay(key, delta) {
  return new Date(Date.parse(key + 'T00:00:00Z') + delta * 86400000).toISOString().slice(0, 10);
}

function pharmacyPresets() {
  const to = pharmacyToday();
  return [
    { label: 'Hoy', from: to, to },
    { label: 'Últimos 7 días', from: pharmacyShiftDay(to, -6), to },
    { label: 'Este mes', from: to.slice(0, 8) + '01', to }
  ];
}

function pharmacyReportUrl() {
  return '/pharmacy/dashboard/report?from=' + encodeURIComponent(pharmacyDashboardFrom) + '&to=' + encodeURIComponent(pharmacyDashboardTo);
}

function pharmacyPeriodLabel(from, to) {
  const fmt = k => k.split('-').reverse().join('/');
  return from === to ? fmt(from) : fmt(from) + ' al ' + fmt(to);
}

/** Descarga el reporte de ventas como archivo PDF (sin abrir el cuadro de impresión). */
async function downloadPharmacyReportPdf(btn) {
  await act(btn, async () => {
    const data = await API.get(pharmacyReportUrl());
    const bytes = fyBuildSalesPdf(data, {
      money,
      date: formatReportDate,
      status: pharmacyStatusLabel,
      generated: new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Bogota' }).format(new Date()),
      periodLabel: pharmacyPeriodLabel(data.from || pharmacyDashboardFrom, data.to || pharmacyDashboardTo)
    });
    fyDownloadBytes(bytes, 'FarmaYa_reporte_ventas_' + pharmacyDashboardFrom + '_a_' + pharmacyDashboardTo + '.pdf', 'application/pdf');
  }, 'Reporte PDF descargado');
}

function pharmacyKpi(label, value, hint, tone) {
  return h('article', { class: 'pbi-kpi fy-c-' + tone },
    h('span', { class: 'pbi-kpi-label' }, label),
    h('strong', { class: 'pbi-kpi-value' }, value),
    h('small', { class: 'pbi-kpi-hint' }, hint));
}

function pharmacyChartCard(title, subtitle, body, wide) {
  return h('section', { class: 'pbi-card' + (wide ? ' wide' : '') },
    h('div', { class: 'pbi-card-head' }, h('div', null, h('h3', null, title), subtitle && h('small', null, subtitle))),
    body);
}

function pharmacyDashboard() {
  if (!pharmacyDashboardFrom || !pharmacyDashboardTo) {
    const week = pharmacyPresets()[1];
    pharmacyDashboardFrom = week.from;
    pharmacyDashboardTo = week.to;
  }
  const today = pharmacyToday();
  const presets = pharmacyPresets();
  const fromInput = h('input', { type: 'date', value: pharmacyDashboardFrom, max: today, 'aria-label': 'Fecha inicial' });
  const toInput = h('input', { type: 'date', value: pharmacyDashboardTo, max: today, 'aria-label': 'Fecha final' });
  const presetButtons = presets.map(p => h('button', { type: 'button', class: 'btn ghost', onclick: () => applyRange(p.from, p.to) }, p.label));
  const rangeLabel = h('span', { class: 'report-date-range' });

  function sync() {
    fromInput.value = pharmacyDashboardFrom;
    toInput.value = pharmacyDashboardTo;
    presetButtons.forEach((b, i) => {
      const on = presets[i].from === pharmacyDashboardFrom && presets[i].to === pharmacyDashboardTo;
      b.className = 'btn ' + (on ? 'primary' : 'ghost');
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    rangeLabel.textContent = pharmacyPeriodLabel(pharmacyDashboardFrom, pharmacyDashboardTo);
  }
  function applyRange(from, to) {
    if (!from || !to) { sync(); return; }
    if (to < from) { toast('La fecha final no puede ser anterior a la inicial.', 'error'); sync(); return; }
    if ((Date.parse(to) - Date.parse(from)) / 86400000 > 366) { toast('El rango máximo es de 367 días.', 'error'); sync(); return; }
    pharmacyDashboardFrom = from;
    pharmacyDashboardTo = to;
    sync();
    refreshAll();
  }
  fromInput.addEventListener('change', () => applyRange(fromInput.value, pharmacyDashboardTo));
  toInput.addEventListener('change', () => applyRange(pharmacyDashboardFrom, toInput.value));
  sync();

  const pdfButton = h('button', { type: 'button', class: 'btn primary', onclick: e => downloadPharmacyReportPdf(e.currentTarget) }, icon('file-down'), ' Descargar PDF');

  const header = h('div', { class: 'dashboard-heading' },
    h('div', null, h('span', { class: 'eyebrow' }, 'PANEL DE CONTROL'), h('h2', null, 'Resumen de tu farmacia'), h('p', { class: 'muted' }, 'Ventas, pedidos y medicamentos más vendidos del período que elijas.')),
    pdfButton);

  const filters = h('section', { class: 'pharmacy-filter-panel' },
    h('div', { class: 'filter-heading' }, h('div', null, h('strong', null, 'Período'), h('p', { class: 'muted' }, 'Elige un atajo o selecciona las fechas en el calendario.')), rangeLabel),
    h('div', { class: 'pbi-range' },
      h('div', { class: 'period-selector', role: 'group', 'aria-label': 'Períodos rápidos' }, presetButtons),
      h('div', { class: 'pbi-dates' },
        h('label', { class: 'date-filter-field' }, h('span', null, 'Desde'), fromInput),
        h('label', { class: 'date-filter-field' }, h('span', null, 'Hasta'), toInput))));

  // La URL se calcula en cada consulta para que respete el período elegido.
  const report = live(() => API.get(pharmacyReportUrl()), d => {
    const series = fyBuildSalesSeries(d);
    const segs = fyStatusSegments(d);
    const best = d.bestSellers || [];
    const rows = d.reportOrders || [];
    const sales = Number(d.sales) || 0, delivered = Number(d.delivered) || 0, ordersN = Number(d.orders) || 0;
    const maxQty = Math.max(1, ...best.map(b => Number(b.quantity) || 0));
    const segTotal = segs.reduce((a, x) => a + x.value, 0);

    const kpis = h('div', { class: 'pbi-kpis' },
      pharmacyKpi('Ventas realizadas', money(sales), 'Pedidos entregados en el período', 'ok'),
      pharmacyKpi('Pedidos recibidos', String(ordersN), 'Creados en el período', 'open'),
      pharmacyKpi('Pedidos entregados', String(delivered), ordersN ? Math.round(delivered * 100 / ordersN) + '% de los recibidos' : 'Sin pedidos aún', 'ok'),
      pharmacyKpi('Ticket promedio', money(delivered ? sales / delivered : 0), 'Venta promedio por entrega', 'issue'));

    const salesChart = pharmacyChartCard('Ventas por ' + (series.monthly ? 'mes' : 'día'), 'Pasa el cursor sobre una barra para ver el detalle',
      h('div', { class: 'fy-chart-wrap', innerHTML: fyBarChartSvg(series, money) }), true);

    const statusBody = segTotal
      ? h('div', { class: 'pbi-donut-layout' },
        h('div', { class: 'fy-donut-wrap', innerHTML: fyDonutSvg(segs) }),
        h('ul', { class: 'pbi-legend' }, segs.map(x => h('li', null,
          h('span', { class: 'fy-dot fy-c-' + x.id }), h('span', null, x.label),
          h('strong', null, x.value + ' · ' + Math.round(x.value * 100 / segTotal) + '%')))))
      : empty('Sin pedidos en este período', 'Prueba con otro rango de fechas.');
    const statusCard = pharmacyChartCard('Estado de los pedidos', 'Distribución de los pedidos recibidos', statusBody);

    const bestBody = best.length
      ? h('div', { class: 'pbi-rank' }, best.map((item, i) => h('div', { class: 'pbi-rank-row' },
        h('div', { class: 'pbi-rank-top' },
          h('span', { class: 'pbi-rank-name' }, (i + 1) + '. ' + item.name),
          h('strong', null, item.quantity + ' uds')),
        h('div', { class: 'pbi-rank-track', title: money(item.sales || 0) },
          h('span', { class: 'pbi-rank-fill', style: 'width:' + Math.max(3, Math.round((Number(item.quantity) || 0) * 100 / maxQty)) + '%' })),
        h('small', { class: 'muted' }, money(item.sales || 0) + ' en ventas'))))
      : empty('Sin ventas de medicamentos', 'Aparecerán cuando haya pedidos entregados con artículos confirmados.');
    const bestCard = pharmacyChartCard('Medicamentos más vendidos', 'Por unidades vendidas', bestBody);

    const tableCard = h('section', { class: 'pbi-card wide' },
      h('div', { class: 'pbi-card-head' }, h('div', null, h('h3', null, 'Detalle de pedidos'), h('small', null, rows.length + (rows.length === 1 ? ' pedido' : ' pedidos') + ' en el período'))),
      rows.length ? h('div', { class: 'table-wrap' },
        h('table', { class: 'prices pharmacy-report-table' },
          h('thead', null, h('tr', null, h('th', null, 'Pedido'), h('th', null, 'Fecha y hora'), h('th', null, 'Estado'), h('th', null, 'Total'), h('th', null, 'Venta'))),
          h('tbody', null, rows.map(o => h('tr', null,
            h('td', null, o.code), h('td', null, formatReportDate(o.createdAt)), h('td', null, pharmacyStatusLabel(o.status)), h('td', null, money(o.total || 0)),
            h('td', null, o.isSale ? h('span', { class: 'tag' }, 'Incluida') : h('span', { class: 'muted' }, 'No')))))))
        : empty('No hay pedidos para este filtro', 'Prueba con otro rango de fechas.'));

    return h('div', { class: 'pbi-dashboard' }, kpis, h('div', { class: 'pbi-grid' }, salesChart, statusCard, bestCard, tableCard));
  });

  return h('div', { class: 'pharmacy-report-content pbi-root' }, header, filters, report);
}

function formatReportDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Bogota' }).format(date);
}

function pharmacyStatusLabel(status) {
  const fromServer = state.meta && state.meta.statuses && state.meta.statuses[status];
  if (fromServer) return fromServer;
  const text = String(status || '—').replaceAll('_', ' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function pharmacyOffers(t) {
  return live(() => API.get('/pharmacy/offers'), data => {
    if (!data.receiving) {
      document.title = 'FarmaYA';
      return notice('info', 'No estás recibiendo solicitudes', data.reason);
    }
    const ids = new Set(data.orders.map(o => o.id));
    const previousOffers = window.__farmayaSeenOffers;
    const fresh = previousOffers ? [...ids].filter(id => !previousOffers.has(id)) : [];
    if (fresh.length) { toast('Llegó una nueva solicitud'); beep(); }
    window.__farmayaSeenOffers = ids;
    document.title = ids.size ? '(' + ids.size + ') FarmaYA' : 'FarmaYA';

    if (!data.orders.length) return empty('No hay solicitudes por ahora', 'Esta pantalla se actualiza sola. Apenas llegue una solicitud de tu zona, la verás aquí.');
    return h('div', { class: 'list' }, data.orders.map(o => offerRow(o, fresh.includes(o.id))));
  });
}

/** Saca la tarjeta con una animación y luego refresca la lista. */
function leaveCard(card) {
  card.classList.add('leaving');
  setTimeout(refreshAll, 220);
}

function offerRow(o, isFresh) {
  const card = h('article', { class: 'offer' + (isFresh ? ' fresh' : '') },
    h('div', { class: 'offer-head' },
      h('strong', null, 'Solicitud de ' + o.zone),
      h('span', { class: 'muted' }, 'Esperando hace ', elapsedEl(o.searchStartedAt || o.createdAt))),
    h('ul', { class: 'plain' }, o.items.map(i => h('li', null,
      h('span', null, i.name + ' ×' + i.quantity), i.prescription && h('span', { class: 'tag' }, 'Con fórmula médica'), i.note && h('small', { class: 'muted' }, i.note)))),
    o.items.some(i => i.prescription) && h('p', { class: 'muted small' }, 'Verifica la fórmula médica antes de entregar medicamentos que la requieren.'),
    o.notes && h('p', { class: 'muted' }, 'Nota: ' + o.notes),
    h('div', { class: 'actions left' },
      h('button', { class: 'btn primary', onclick: async e => {
        const order = await act(e.currentTarget, () => API.post('/pharmacy/orders/' + o.id + '/accept'), 'Pedido aceptado. Confirma existencias y precios.');
        if (order) { leaveCard(card); openPriceForm(order); } else refreshAll();
      } }, 'Aceptar pedido'),
      h('button', { class: 'btn ghost', onclick: async e => {
        const r = await act(e.currentTarget, () => API.post('/pharmacy/orders/' + o.id + '/reject'));
        if (r) leaveCard(card);
      } }, 'No lo tengo')));
  return card;
}

function openPriceForm(order) {
  const rows = order.items.map(it => {
    const avail = h('input', { type: 'checkbox', checked: true, 'aria-label': 'Disponible: ' + it.name });
    const qty = h('input', { type: 'number', min: 1, max: 99, value: it.quantity, 'aria-label': 'Cantidad de ' + it.name });
    const price = h('input', { type: 'number', min: 0, step: 'any', placeholder: '0', 'aria-label': 'Precio unitario de ' + it.name });
    const sub = h('span', { class: 'subtotal' }, money(0));
    return { it, avail, qty, price, sub };
  });
  const totalEl = h('strong', null, money(0));
  const recompute = () => {
    let total = 0;
    rows.forEach(r => {
      const on = r.avail.checked;
      r.qty.disabled = r.price.disabled = !on;
      const s = on ? (Number(r.qty.value) || 0) * (Number(r.price.value) || 0) : 0;
      r.sub.textContent = on ? money(s) : 'No disponible';
      total += s;
    });
    totalEl.textContent = money(total);
  };

  const prep = h('input', { name: 'prep', type: 'number', min: 1, max: 240, value: 20, required: true });
  const note = h('input', { name: 'note', maxLength: 300, placeholder: 'Ej. Genérico equivalente' });

  const form = h('form', {
    class: 'sheet-body',
    oninput: recompute,
    onsubmit: async e => {
      e.preventDefault();
      const items = rows.map(r => ({ name: r.it.name, available: r.avail.checked, quantity: Number(r.qty.value), unitPrice: Number(r.price.value) }));
      const btn = form.querySelector('button[type=submit]');
      const ok = await act(btn, () => API.post('/pharmacy/orders/' + order.id + '/confirm', { items, prepMinutes: Number(prep.value), note: note.value }),
        'Precio enviado al cliente');
      if (ok) { d.close(); refreshAll(); }
    }
  },
    h('h3', null, 'Confirma existencias y precios'),
    h('p', { class: 'muted' }, 'Pedido ' + order.code + '. El cliente deberá aceptar el precio antes de que prepares nada.'),
    h('div', { class: 'table-wrap' }, h('table', { class: 'prices edit' },
      h('thead', null, h('tr', null, h('th', null, 'Tengo'), h('th', null, 'Producto'), h('th', null, 'Cantidad'), h('th', null, 'Precio unitario'), h('th', null, 'Subtotal'))),
      h('tbody', null, rows.map(r => h('tr', null,
        h('td', null, r.avail),
        h('td', null, r.it.name, r.it.prescription && h('span', { class: 'tag' }, 'Con fórmula médica'), r.it.note && h('small', { class: 'muted block-line' }, r.it.note)),
        h('td', null, r.qty), h('td', null, r.price), h('td', null, r.sub)))),
      h('tfoot', null, h('tr', null, h('td', { colspan: 4 }, 'Total'), h('td', null, totalEl))))),
    h('div', { class: 'two' },
      field('Minutos para preparar', prep),
      field('Nota para el cliente (opcional)', note)),
    h('div', { class: 'actions' },
      h('button', { type: 'button', class: 'btn link', onclick: async () => {
        if (await confirmBox({ title: '¿No puedes surtir este pedido?', message: 'Lo enviaremos a otras farmacias. Esta no volverá a verlo.', ok: 'Sí, liberar pedido' })) {
          const r = await act(null, () => API.post('/pharmacy/orders/' + order.id + '/release'), 'Pedido liberado');
          if (r) { d.close(); refreshAll(); }
        }
      } }, 'No puedo surtir este pedido'),
      h('button', { type: 'button', class: 'btn ghost', onclick: () => d.close() }, 'Cerrar'),
      h('button', { type: 'submit', class: 'btn primary' }, 'Enviar precio al cliente')));
  const d = openDialog(form, { wide: true });
  recompute();
}

function pharmacyOrders() {
  return live(() => API.get('/pharmacy/orders'), orders => {
    if (!orders.length) return empty('Todavía no tienes pedidos', 'Los pedidos que aceptes aparecerán aquí con el siguiente paso a realizar.');
    const active = orders.filter(o => !FINAL.includes(o.status));
    const past = orders.filter(o => FINAL.includes(o.status));
    return h('div', { class: 'stack' },
      active.length ? h('div', { class: 'list' }, h('h3', { class: 'list-title' }, 'En curso'), active.map(o => orderRow(o, pharmacyAction(o)))) : null,
      past.length ? h('div', { class: 'list' }, h('h3', { class: 'list-title' }, 'Anteriores'), past.map(o => orderRow(o))) : null);
  });
}

function pharmacyAction(o) {
  const step = (label, path, ok) => h('button', { class: 'btn primary', onclick: async e => {
    await act(e.currentTarget, () => API.post('/pharmacy/orders/' + o.id + '/' + path), ok);
    refreshAll();
  } }, label);
  switch (o.status) {
    case 'FARMACIA_ASIGNADA': return h('button', { class: 'btn primary', onclick: () => openPriceForm(o) }, 'Confirmar precios');
    case 'PRECIO_POR_ACEPTAR': return h('span', { class: 'waiting' }, 'Esperando al cliente');
    case 'PRECIO_CONFIRMADO': return step('Empezar preparación', 'start', 'Preparación iniciada');
    case 'PEDIDO_EN_PREPARACION': return step('Marcar listo para recoger', 'ready', 'Pedido listo. Buscamos repartidor.');
    case 'BUSCANDO_REPARTIDOR': return h('span', { class: 'waiting' }, 'Buscando repartidor');
    case 'REPARTIDOR_ASIGNADO': return h('span', { class: 'waiting' }, (o.courierName || 'El repartidor') + ' viene por el pedido');
    default: return null;
  }
}
