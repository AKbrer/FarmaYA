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

function pharmacyHeaderCard(user) {
  const statusLabel = h('span', { class: 'pharmacy-switch-label' }, user.active ? 'Recibiendo pedidos' : 'En pausa');
  const control = switchControl(user.active, async input => {
    try {
      const u = await API.post('/auth/active', { value: input.checked });
      state.user = u;
      statusLabel.textContent = u.active ? 'Recibiendo pedidos' : 'En pausa';
      toast(u.active ? 'Recepción de pedidos activada' : 'Recepción de pedidos pausada');
      refreshAll();
    } catch (err) {
      input.checked = !input.checked;
      toast(err.message, 'error');
    }
  }, 'Recibiendo pedidos');

  const activationBox = h('div', { class: 'pharmacy-activation-box' },
    control,
    statusLabel
  );

  return h('div', { class: 'pharmacy-header-card' },
    h('div', { class: 'pharmacy-header-info' },
      h('h1', { class: 'pharmacy-header-title' }, user.pharmacyName || user.name),
      user.address && h('span', { class: 'pharmacy-header-address muted' }, user.address)
    ),
    activationBox
  );
}

function pharmacyView(user) {
  window.__farmayaSeenOffers = null;
  return h('div', { class: 'stack pharmacy-root' },
    pharmacyHeaderCard(user),
    !user.verified && notice('warn', 'Tu farmacia está pendiente de verificación sanitaria', 'Un administrador revisará tu licencia y documentación INVIMA. Hasta entonces no verás solicitudes.'),
    sideNavigation([
      { label: 'Dashboard & Ventas', icon: 'layout-dashboard', render: pharmacyDashboard },
      { label: 'Predicción de Demanda (IA)', icon: 'trending-up', render: pharmacyDemandForecast },
      { label: 'Solicitudes y Despacho', icon: 'inbox', render: pharmacyOffers },
      { label: 'Mis pedidos activos', icon: 'package-check', render: pharmacyOrders },
      { label: 'Kárdex de Movimientos', icon: 'history', render: () => movementHistory('/pharmacy/movements') }
    ], 0));
}

function pharmacyRegulatoryRibbon() {
  return h('div', { class: 'stitch-telemetry-bar pharmacy-reg-bar' },
    h('div', { class: 'telemetry-item' },
      h('span', { class: 'telemetry-dot' }),
      h('span', null, 'Dispensación Regulada • Decreto 2200 de 2005')
    ),
    h('div', { class: 'telemetry-metrics' },
      h('span', { class: 'telemetry-metric' }, 'ReTHUS MinSalud En Línea (v3.1)'),
      h('span', { class: 'telemetry-metric' }, 'Vigilado Superintendencia Nacional de Salud')
    )
  );
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
      h('div', null,
        h('strong', null, 'Solicitud ' + (o.city ? 'en ' + o.city : 'por cercanía') + (o.deliveryDistanceKm ? ' (~' + o.deliveryDistanceKm + ' km)' : '')),
        o.address && h('span', { class: 'block-line muted small', style: 'margin-top:2px;' }, 'Ubicación de entrega: ' + o.address)
      ),
      h('span', { class: 'muted' }, 'Esperando hace ', elapsedEl(o.searchStartedAt || o.createdAt))),
    h('ul', { class: 'plain' }, o.items.map(i => h('li', null,
      h('span', null, i.name + ' ×' + i.quantity), i.note && h('small', { class: 'muted' }, i.note)))),
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
    const qty = h('input', { type: 'number', min: 1, max: 99, step: 1, inputmode: 'numeric', required: true, value: it.quantity, 'aria-label': 'Cantidad de ' + it.name });
    const price = h('input', { type: 'number', min: 0, step: 'any', inputmode: 'decimal', required: true, placeholder: '0', 'aria-label': 'Precio unitario de ' + it.name });
    const sub = h('output', { class: 'subtotal' }, money(0));
    return { it, avail, qty, price, sub, tr: null };
  });
  rows.forEach(r => {
    r.tr = h('tr', { class: 'quote-row' },
      h('td', { class: 'q-check', 'data-label': 'Tengo' }, r.avail),
      h('td', { class: 'q-name' },
        h('span', { class: 'q-product' }, r.it.name),
        r.it.note && h('small', { class: 'muted block-line' }, r.it.note)),
      h('td', { class: 'q-qty', 'data-label': 'Cantidad' }, r.qty),
      h('td', { class: 'q-price', 'data-label': 'Precio unitario' },
        h('span', { class: 'money-field' }, h('span', { class: 'money-prefix', 'aria-hidden': 'true' }, '$'), r.price)),
      h('td', { class: 'q-sub', 'data-label': 'Subtotal' }, r.sub));
  });

  const totalEl = h('output', { class: 'quote-total-amount' }, money(0));
  const countEl = h('span', { class: 'quote-count' });
  const noneHint = h('p', { class: 'quote-hint', role: 'status', hidden: true }, 'Marca al menos un producto, o usa «No puedo surtir este pedido».');
  const submit = h('button', { type: 'submit', class: 'btn primary' }, 'Enviar precio al cliente');
  const recompute = () => {
    let total = 0;
    let count = 0;
    rows.forEach(r => {
      const on = r.avail.checked;
      r.qty.disabled = r.price.disabled = !on;
      r.qty.required = r.price.required = on;
      r.tr.classList.toggle('is-off', !on);
      const s = on ? (Number(r.qty.value) || 0) * (Number(r.price.value) || 0) : 0;
      r.sub.textContent = on ? money(s) : 'No disponible';
      if (on) count++;
      total += s;
    });
    totalEl.textContent = money(total);
    countEl.textContent = count + ' de ' + rows.length + (rows.length === 1 ? ' producto disponible' : ' productos disponibles');
    noneHint.hidden = count > 0;
    submit.disabled = count === 0;
  };

  const prep = h('input', { name: 'prep', type: 'number', min: 1, max: 240, step: 1, inputmode: 'numeric', value: 20, required: true });
  const note = h('input', { name: 'note', maxLength: 300, placeholder: 'Ej. Genérico equivalente' });

  const form = h('form', {
    class: 'sheet-body quote-sheet',
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
    h('header', { class: 'quote-head' },
      h('h3', null, 'Confirma existencias y precios'),
      h('p', null, 'Pedido ', h('strong', null, order.code), '. El cliente deberá aceptar el precio antes de que prepares nada.')),
    h('div', { class: 'table-wrap quote-table' },
      h('table', { class: 'prices edit' },
        h('thead', null, h('tr', null,
          h('th', { scope: 'col', class: 'q-check' }, 'Tengo'),
          h('th', { scope: 'col' }, 'Producto'),
          h('th', { scope: 'col', class: 'q-qty' }, 'Cantidad'),
          h('th', { scope: 'col', class: 'q-price' }, 'Precio unitario'),
          h('th', { scope: 'col', class: 'q-sub' }, 'Subtotal'))),
        h('tbody', null, rows.map(r => r.tr))),
      h('div', { class: 'quote-total' },
        countEl,
        h('div', { class: 'quote-total-line' }, h('span', null, 'Total'), totalEl))),
    noneHint,
    h('div', { class: 'quote-extra' },
      field('Minutos para preparar', h('span', { class: 'unit-field' }, prep, h('span', { class: 'unit', 'aria-hidden': 'true' }, 'min')), 'Entre 1 y 240 minutos'),
      field('Nota para el cliente (opcional)', note)),
    h('div', { class: 'actions quote-actions' },
      h('button', { type: 'button', class: 'btn link', onclick: async () => {
        if (await confirmBox({ title: '¿No puedes surtir este pedido?', message: 'Lo enviaremos a otras farmacias. Esta no volverá a verlo.', ok: 'Sí, liberar pedido' })) {
          const r = await act(null, () => API.post('/pharmacy/orders/' + order.id + '/release'), 'Pedido liberado');
          if (r) { d.close(); refreshAll(); }
        }
      } }, 'No puedo surtir este pedido'),
      h('button', { type: 'button', class: 'btn ghost', onclick: () => d.close() }, 'Cerrar'),
      submit));
  const d = openDialog(form, { wide: true });
  recompute();
  // el cursor arranca donde el trabajo empieza: el primer precio pendiente
  const firstEmpty = rows.find(r => r.price.value === '') || rows[0];
  if (firstEmpty) firstEmpty.price.focus({ preventScroll: true });
}

function pharmacyOrders() {
  return live(() => API.get('/pharmacy/orders'), orders => {
    if (!orders.length) return empty('Todavía no tienes pedidos', 'Los pedidos que aceptes aparecerán aquí con el siguiente paso a realizar.');
    const active = orders.filter(o => !FINAL.includes(o.status));
    const past = orders.filter(o => FINAL.includes(o.status));

    const courierIncident = active.some(o => o.status === 'CON_INCIDENCIA' && ((o.incidentNote || '').toLowerCase().includes('repartidor') || (o.incidentNote || '').toLowerCase().includes('5 km') || (o.incidentNote || '').toLowerCase().includes('zona')));

    return h('div', { class: 'stack' },
      courierIncident ? notice('warn', 'Alerta: Sin repartidores disponibles en tu zona', 'Actualmente no hay repartidores disponibles cerca de tu farmacia (radio máximo 5 km). Estamos buscando activamente para continuar con la entrega tan pronto haya un repartidor disponible.') : null,
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
    case 'CON_INCIDENCIA': return h('span', { class: 'tag', style: 'background: var(--warning-soft); color: var(--warning); font-weight: 700;' }, 'Sin repartidor en tu zona (5 km)');
    default: return null;
  }
}

/**
 * Vista de Predicción de Demanda Mensual basada en Machine Learning y registros de MongoDB.
 * Clasifica la demanda de cada medicamento en ALTA, MEDIA y BAJA para optimizar compras y stock.
 */
let __pharmacyDemandFilter = 'TODAS';

function pharmacyDemandForecast() {
  return live(() => API.get('/demand-forecast'), data => {
    const list = data.forecasts || [];
    const summary = data.summary || { totalMedicines: list.length, alta: 0, media: 0, baja: 0 };
    const period = data.period || 'Próximo Mes';

    // Barra de KPI cards
    const kpis = h('div', { class: 'grid stats-grid', style: 'grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;' },
      h('div', { class: 'card stat-card' },
        h('span', { class: 'muted text-xs' }, 'Periodo Proyectado'),
        h('strong', { class: 'stat-num', style: 'font-size: 1.25rem; color: var(--primary);' }, period),
        h('small', { class: 'muted' }, 'Modelo de ML FarmaYA')
      ),
      h('div', { class: 'card stat-card' },
        h('span', { class: 'muted text-xs' }, 'Demanda ALTA (Riesgo Quiebre)'),
        h('strong', { class: 'stat-num', style: 'font-size: 1.75rem; color: #d9383a;' }, String(summary.alta || 0)),
        h('small', { class: 'muted' }, 'Alta rotación • Mayor stock')
      ),
      h('div', { class: 'card stat-card' },
        h('span', { class: 'muted text-xs' }, 'Demanda MEDIA (Rotación Regular)'),
        h('strong', { class: 'stat-num', style: 'font-size: 1.75rem; color: #0284c7;' }, String(summary.media || 0)),
        h('small', { class: 'muted' }, 'Consumo estándar predecible')
      ),
      h('div', { class: 'card stat-card' },
        h('span', { class: 'muted text-xs' }, 'Demanda BAJA (Poco Movimiento)'),
        h('strong', { class: 'stat-num', style: 'font-size: 1.75rem; color: #64748b;' }, String(summary.baja || 0)),
        h('small', { class: 'muted' }, 'Stock mínimo bajo demanda')
      )
    );

    // Controles de filtrado y botón de recálculo
    const filterBtn = (label, cat) => {
      const active = __pharmacyDemandFilter === cat;
      return h('button', {
        class: 'btn ' + (active ? 'primary' : 'secondary'),
        style: 'font-size: 0.85rem; padding: 0.35rem 0.85rem;',
        onclick: () => {
          __pharmacyDemandFilter = cat;
          refreshAll();
        }
      }, label);
    };

    const filters = h('div', { class: 'flex items-center gap-2', style: 'flex-wrap: wrap;' },
      filterBtn('Todos (' + list.length + ')', 'TODAS'),
      filterBtn('ALTA (' + summary.alta + ')', 'ALTA'),
      filterBtn('MEDIA (' + summary.media + ')', 'MEDIA'),
      filterBtn('BAJA (' + summary.baja + ')', 'BAJA')
    );

    const recalculateBtn = h('button', {
      class: 'btn secondary',
      style: 'font-size: 0.85rem; display: inline-flex; align-items: center; gap: 0.4rem;',
      onclick: async e => {
        await act(e.currentTarget, async () => {
          const res = await API.post('/demand-forecast/recalculate', {});
          toast(res.message || 'Pronóstico recalculado exitosamente con IA.');
          refreshAll();
        }, 'Modelo actualizado');
      }
    }, 'Recalcular con Histórico Reciente');

    const toolbar = h('div', { class: 'flex items-center justify-between', style: 'flex-wrap: wrap; gap: 1rem; margin-bottom: 1.25rem;' },
      filters,
      recalculateBtn
    );

    // Filtrar lista
    const filtered = list.filter(item => {
      if (__pharmacyDemandFilter === 'TODAS') return true;
      return (item.category || '').toUpperCase() === __pharmacyDemandFilter;
    });

    // Badge helper para las 3 categorías
    const categoryBadge = (cat) => {
      const c = (cat || '').toUpperCase();
      let bg = 'rgba(100, 116, 139, 0.15)', color = '#475569', label = 'BAJA';
      if (c === 'ALTA') {
        bg = 'rgba(217, 56, 58, 0.15)';
        color = '#c5221f';
        label = 'ALTA';
      } else if (c === 'MEDIA') {
        bg = 'rgba(2, 132, 199, 0.15)';
        color = '#0284c7';
        label = 'MEDIA';
      } else {
        label = 'BAJA';
      }
      return h('span', {
        class: 'tag',
        style: 'background: ' + bg + '; color: ' + color + '; font-weight: 700; border-radius: 999px; padding: 0.25rem 0.65rem;'
      }, label);
    };

    const trendBadge = (trend) => {
      const t = trend || 'Estable';
      let icon = 'Estable';
      if (t === 'Creciente') icon = 'Creciente';
      else if (t === 'Decreciente') icon = 'Decreciente';
      else icon = 'Estable';
      return h('span', { class: 'text-xs muted' }, icon);
    };

    // Tabla de resultados
    const tableHeader = h('thead', null,
      h('tr', null,
        h('th', { style: 'text-align: left; padding: 0.75rem 1rem;' }, 'Medicamento'),
        h('th', { style: 'text-align: center; padding: 0.75rem 0.5rem;' }, 'Demanda Prevista'),
        h('th', { style: 'text-align: right; padding: 0.75rem 0.75rem;' }, 'Solicitudes Est.'),
        h('th', { style: 'text-align: right; padding: 0.75rem 0.75rem;' }, 'Unidades Proy.'),
        h('th', { style: 'text-align: right; padding: 0.75rem 0.75rem;' }, 'Stock Sugerido'),
        h('th', { style: 'text-align: center; padding: 0.75rem 0.5rem;' }, 'Tendencia'),
        h('th', { style: 'text-align: left; padding: 0.75rem 1rem;' }, 'Recomendación de Compra e Inventario')
      )
    );

    const tableRows = filtered.map(item => {
      return h('tr', { style: 'border-bottom: 1px solid var(--border);' },
        h('td', { style: 'padding: 0.75rem 1rem; font-weight: 600;' }, item.medicineName),
        h('td', { style: 'text-align: center; padding: 0.75rem 0.5rem;' }, categoryBadge(item.category)),
        h('td', { style: 'text-align: right; padding: 0.75rem 0.75rem; font-weight: 600;' }, String(item.estimatedOrders || 0)),
        h('td', { style: 'text-align: right; padding: 0.75rem 0.75rem;' }, String(item.predictedUnits || 0) + ' uds'),
        h('td', { style: 'text-align: right; padding: 0.75rem 0.75rem; font-weight: 700; color: var(--primary);' }, String(item.recommendedStock || 0) + ' uds'),
        h('td', { style: 'text-align: center; padding: 0.75rem 0.5rem;' }, trendBadge(item.historicalTrend)),
        h('td', { style: 'padding: 0.75rem 1rem; font-size: 0.85rem;', class: 'muted' }, item.actionRecommendation || '')
      );
    });

    const table = h('div', { class: 'card', style: 'padding: 0; overflow-x: auto;' },
      h('table', { style: 'width: 100%; border-collapse: collapse;' },
        tableHeader,
        h('tbody', null, ...tableRows)
      )
    );

    const infoNotice = notice('info',
      'Clasificación predictiva de demanda (Machine Learning)',
      'El modelo analiza los pedidos históricos de clientes en MongoDB, frecuencias de compra y estacionalidad. Ayuda a anticipar qué medicamentos tendrán mayor demanda para programar pedidos a proveedores y prevenir desabastecimiento o sobreinventario.'
    );

    return h('div', { class: 'stack' },
      infoNotice,
      kpis,
      toolbar,
      filtered.length ? table : empty('Sin registros', 'No se encontraron medicamentos en esta categoría.')
    );
  });
}


