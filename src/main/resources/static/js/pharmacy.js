
/* ==========================================================================
   Sonido y Notificación Flotante para Farmacia
   ========================================================================== */
let activeFloatingNotice = null;

function playOrderAlertSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!window.__fyAudioCtx) {
      window.__fyAudioCtx = new AudioCtx();
    }
    const ctx = window.__fyAudioCtx;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const now = ctx.currentTime;
    // Campana de 4 notas armónicas agradable y audible: Do - Mi - Sol - Do agudo
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + idx * 0.11;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.35, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.27);
    });
    if (navigator.vibrate) {
      navigator.vibrate([250, 100, 250, 100, 350]);
    }
  } catch (err) {
    console.warn('Audio alert error:', err);
  }
}

function showFloatingOrderNotice(freshOrders) {
  if (!freshOrders || !freshOrders.length) return;
  const count = freshOrders.length;
  const first = freshOrders[0];

  playOrderAlertSound();

  if (activeFloatingNotice) activeFloatingNotice.remove();

  const title = count === 1 ? ('¡Nuevo pedido recibido (' + first.code + ')!') : ('¡Llegaron ' + count + ' nuevos pedidos!');
  const subtitle = count === 1
    ? (first.items.length + ' producto(s) solicitados · ' + (first.address || first.city || 'Entrega a domicilio'))
    : 'Hay nuevas solicitudes esperando tu cotización en la red.';

  const closeBtn = h('button', {
    class: 'btn ghost small',
    type: 'button',
    style: 'height:32px; padding:0 10px; border-radius:8px; font-size:11.5px; border:1px solid var(--line);',
    onclick: () => {
      noticeBox.remove();
      activeFloatingNotice = null;
    }
  }, 'Descartar');

  const actionBtn = h('button', {
    class: 'btn primary small',
    type: 'button',
    style: 'height:32px; padding:0 14px; border-radius:8px; font-size:12px; font-weight:700;',
    onclick: () => {
      noticeBox.remove();
      activeFloatingNotice = null;
      if (count === 1 && typeof openPriceForm === 'function') {
        openPriceForm(first);
      } else {
        const tabs = document.querySelectorAll('.side-nav-item');
        if (tabs && tabs[2]) tabs[2].click();
      }
    }
  }, count === 1 ? 'Cotizar ahora' : 'Ver pedidos');

  const noticeBox = h('div', {
    class: 'floating-pharmacy-order-alert',
    style: 'position:fixed; top:24px; left:50%; transform:translateX(-50%); z-index:999999; width:min(520px, calc(100vw - 32px)); background:var(--surface,#fff); border:2px solid var(--primary,#16865d); border-radius:14px; padding:12px 16px; box-shadow:0 14px 40px rgba(22,134,93,0.25); animation:slideDownAlert 0.28s ease; display:flex; align-items:center; justify-content:space-between; gap:12px;'
  },
    h('div', { style: 'display:flex; align-items:center; gap:12px; min-width:0;' },
      h('div', { style: 'width:38px; height:38px; border-radius:9px; background:rgba(22,134,93,0.12); color:var(--primary); display:grid; place-items:center; flex:0 0 38px;' }, icon('inbox')),
      h('div', { style: 'min-width:0;' },
        h('strong', { style: 'display:block; font-size:13px; color:var(--text);' }, title),
        h('span', { class: 'muted small', style: 'display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:260px; font-size:11.5px;' }, subtitle)
      )
    ),
    h('div', { style: 'display:flex; align-items:center; gap:6px; flex-shrink:0;' },
      closeBtn,
      actionBtn
    )
  );

  document.body.append(noticeBox);
  activeFloatingNotice = noticeBox;

  setTimeout(() => {
    if (activeFloatingNotice === noticeBox) {
      noticeBox.remove();
      activeFloatingNotice = null;
    }
  }, 25000);
}

﻿/* FarmaYA · panel de la farmacia */

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

  const gpsBtn = h('button', {
    class: 'btn secondary small pharmacy-header-gps-btn',
    type: 'button',
    style: 'display:inline-flex; align-items:center; gap:6px; font-weight:600; font-size:0.82rem; margin-top:6px; height:34px; padding:0 12px; border-radius:8px;',
    onclick: async () => {
      const prev = gpsBtn.innerHTML;
      gpsBtn.disabled = true;
      gpsBtn.innerHTML = '<span class="spinner" style="width:13px;height:13px;border-width:2px;"></span> GPS...';
      try {
        const pos = await farmayaGetPosition();
        const geo = await reverseGeocode(pos);
        const newAddress = (geo && geo.address) ? geo.address : (user.address || '');
        const updated = await API.put('/auth/profile', {
          name: user.name,
          email: user.email,
          phone: user.phone,
          zone: user.zone || 'Cobertura General',
          pharmacyName: user.pharmacyName || user.name,
          address: newAddress,
          latitude: pos.lat,
          longitude: pos.lng,
          openFrom: user.openFrom || '08:00',
          openTo: user.openTo || '22:00'
        });
        Object.assign(state.user, updated);
        toast('Ubicación GPS guardada exitosamente');
        refreshAll();
      } catch (err) {
        toast(err.message || 'No se pudo obtener la ubicación GPS', 'error');
      } finally {
        gpsBtn.disabled = false;
        gpsBtn.innerHTML = prev;
      }
    }
  }, icon('my_location'), 'Calibrar GPS');

  const coordsInfo = (user.latitude != null && user.longitude != null)
    ? h('small', { class: 'muted', style: 'display:block; font-size:0.8rem; margin-top:3px;' },
        'Ubicación GPS: ' + Number(user.latitude).toFixed(5) + ', ' + Number(user.longitude).toFixed(5))
    : h('small', { class: 'tone-wait', style: 'display:block; font-size:0.8rem; margin-top:3px; font-weight:600;' },
        'Sin ubicación GPS precisa. Pulsa el botón para calibrarla.');

  return h('div', { class: 'pharmacy-header-card' },
    h('div', { class: 'pharmacy-header-info' },
      h('h1', { class: 'pharmacy-header-title' }, user.pharmacyName || user.name),
      user.address && h('span', { class: 'pharmacy-header-address muted', style: 'display:block; font-size:0.9rem;' }, user.address),
      coordsInfo,
      gpsBtn
    ),
    activationBox
  );
}

let pharmacyPollerInterval = null;
function pharmacyView(user) {
  window.__farmayaSeenOffers = null;
  if (pharmacyPollerInterval) clearInterval(pharmacyPollerInterval);
  pharmacyPollerInterval = setInterval(async () => {
    if (state.user?.role !== 'FARMACIA' || !state.user?.active) return;
    try {
      const data = await API.get('/pharmacy/offers');
      if (data && data.orders) {
        const ids = new Set(data.orders.map(o => o.id));
        const prev = window.__farmayaSeenOffers;
        if (prev) {
          const fresh = data.orders.filter(o => !prev.has(o.id));
          if (fresh.length) {
            showFloatingOrderNotice(fresh);
          }
        }
        window.__farmayaSeenOffers = ids;
      }
    } catch (_) {}
  }, 4000);

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
    const fresh = previousOffers ? data.orders.filter(o => !previousOffers.has(o.id)) : [];
    if (fresh.length) {
      showFloatingOrderNotice(fresh);
    }
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
    const fixedQty = it.quantity || 1;
    const price = h('input', {
      type: 'number',
      min: 0,
      step: 'any',
      inputmode: 'decimal',
      required: true,
      placeholder: '0',
      'aria-label': 'Precio unitario de ' + it.name,
      style: 'height:38px; border-radius:8px; text-align:right; font-weight:700;'
    });
    const sub = h('output', { class: 'subtotal' }, money(0));
    return { it, avail, fixedQty, price, sub, tr: null };
  });
  rows.forEach(r => {
    r.tr = h('tr', { class: 'quote-row' },
      h('td', { class: 'q-check', 'data-label': 'Tengo' }, r.avail),
      h('td', { class: 'q-name' },
        h('strong', { class: 'q-product' }, r.it.name),
        r.it.note && h('small', { class: 'muted block-line' }, r.it.note)),
      h('td', { class: 'q-qty', 'data-label': 'Cantidad solicitada' },
        h('span', { class: 'badge tone-go', style: 'font-weight:700; border-radius:6px; font-size:12px; padding:4px 9px;' },
          r.fixedQty + (r.fixedQty === 1 ? ' unidad' : ' unidades')
        )),
      h('td', { class: 'q-price', 'data-label': 'Precio unitario (COP)' },
        h('div', { class: 'money-field' },
          h('span', { class: 'money-prefix', 'aria-hidden': 'true' }, '$'),
          r.price
        )),
      h('td', { class: 'q-sub', 'data-label': 'Subtotal' }, r.sub));
  });

  const totalEl = h('output', { class: 'quote-total-amount' }, money(0));
  const countEl = h('span', { class: 'quote-count' });
  const noneHint = h('p', { class: 'quote-hint', role: 'status', hidden: true }, 'Marca al menos un producto, o usa «No puedo surtir este pedido».');
  const submit = h('button', { type: 'submit', class: 'btn primary' }, 'Enviar cotización');
  const recompute = () => {
    let total = 0;
    let count = 0;
    rows.forEach(r => {
      const on = r.avail.checked;
      r.price.disabled = !on;
      r.price.required = on;
      r.tr.classList.toggle('is-off', !on);
      const s = on ? (r.fixedQty * (Number(r.price.value) || 0)) : 0;
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
      const items = rows.map(r => ({ name: r.it.name, available: r.avail.checked, quantity: r.fixedQty, unitPrice: Number(r.price.value) }));
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

    const chartCard = h('div', { class: 'card', style: 'padding: 1.25rem 1.5rem; margin-bottom: 1.25rem;' },
      h('div', { class: 'flex items-center justify-between', style: 'flex-wrap: wrap; gap: 0.75rem; margin-bottom: 1rem;' },
        h('div', null,
          h('h3', { style: 'margin: 0; font-size: 1.05rem; display: flex; align-items: center; gap: 0.5rem;' },
            '?? Gr�fico de L�neas: Evoluci�n y Demanda Proyectada',
            pharmacySelectedMedicineForChart ? h('span', { class: 'tag primary', style: 'font-size: 0.75rem;' }, pharmacySelectedMedicineForChart.medicineName) : null
          ),
          h('small', { class: 'muted' }, 'Hist�rico de pedidos en MongoDB (l�nea continua) y proyecci�n predictiva del pr�ximo mes (l�nea discontinua)')
        ),
        h('div', { class: 'flex items-center gap-3 text-xs' },
          pharmacySelectedMedicineForChart ? h('button', {
            class: 'btn secondary',
            style: 'font-size: 0.75rem; padding: 0.25rem 0.6rem;',
            onclick: () => { pharmacySelectedMedicineForChart = null; refreshAll(); }
          }, '? Ver comparativa global') : null,
          h('span', { style: 'display: flex; align-items: center; gap: 0.35rem;' }, h('span', { style: 'width: 10px; height: 10px; border-radius: 50%; background: #d9383a; display: inline-block;' }), 'ALTA'),
          h('span', { style: 'display: flex; align-items: center; gap: 0.35rem;' }, h('span', { style: 'width: 10px; height: 10px; border-radius: 50%; background: #0284c7; display: inline-block;' }), 'MEDIA'),
          h('span', { style: 'display: flex; align-items: center; gap: 0.35rem;' }, h('span', { style: 'width: 10px; height: 10px; border-radius: 50%; background: #64748b; display: inline-block;' }), 'BAJA')
        )
      ),
      h('div', { class: 'chart-container', style: 'width: 100%; min-height: 250px;', innerHTML: fyDemandLineChartSvg(data.chartSeries, pharmacySelectedMedicineForChart) }),
      h('p', { class: 'muted text-xs', style: 'margin: 0.75rem 0 0 0; text-align: right;' }, '?? Haz clic en cualquier medicamento de la tabla para graficar su curva individual.')
    );

    return h('div', { class: 'stack' },
      courierIncident ? notice('warn', 'Alerta: Sin repartidores disponibles en tu zona', 'Actualmente no hay repartidores disponibles cerca de tu farmacia (radio máximo 5 km). Estamos buscando activamente para continuar con la entrega tan pronto haya un repartidor disponible.') : null,
      active.length ? h('div', { class: 'list' }, h('h3', { class: 'list-title' }, 'En curso'), active.map(o => orderRow(o, pharmacyAction(o)))) : null,
      chartCard,
      past.length ? h('div', { class: 'list' }, h('h3', { class: 'list-title' }, 'Anteriores'), past.map(o => orderRow(o))) : null);
  });
}

function pharmacyAction(o) {
  const step = (label, path, ok) => h('button', { class: 'btn primary', onclick: async e => {
    await act(e.currentTarget, () => API.post('/pharmacy/orders/' + o.id + '/' + path), ok);
    refreshAll();
  } }, label);
  switch (o.status) {
    case 'FARMACIA_ASIGNADA': return h('button', { class: 'btn primary', onclick: () => openPriceForm(o) }, 'Cotizar pedido');
    case 'PRECIO_POR_ACEPTAR': return h('span', { class: 'waiting' }, 'Esperando al cliente');
    case 'PRECIO_CONFIRMADO': return step('Preparar', 'start', 'Preparación iniciada');
    case 'PEDIDO_EN_PREPARACION': return step('Listo para entrega', 'ready', 'Pedido listo. Buscamos repartidor.');
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
let __pharmacyDemandSearch = '';
let pharmacySelectedMedName = '';

/**
 * Vista de Prediccion de Demanda Mensual basada en Machine Learning y registros de MongoDB.
 * Clasifica la demanda de cada medicamento en ALTA, MEDIA y BAJA para optimizar compras y stock.
 */
function pharmacyDemandForecast() {
  return live(() => API.get('/demand-forecast'), data => {
    const list = data.forecasts || [];
    const summary = data.summary || { totalMedicines: list.length, alta: 0, media: 0, baja: 0 };
    const period = data.period || 'Proximo Mes';

    // Barra de KPI cards de Predicción de Demanda (IA FarmaYA)
    const kpis = h('div', { class: 'forecast-kpis-grid' },
      // Card 1: Periodo Proyectado
      h('div', { class: 'forecast-kpi-card tone-period' },
        h('div', { class: 'forecast-kpi-top' },
          h('div', { class: 'forecast-kpi-title-wrap' },
            icon('calendar', 'forecast-kpi-ico tone-period'),
            h('span', { class: 'forecast-kpi-label' }, 'Periodo Proyectado')
          ),
          h('span', { class: 'forecast-kpi-badge badge-ai' }, 'IA FarmaYA')
        ),
        h('div', { class: 'forecast-kpi-body' },
          h('strong', { class: 'forecast-kpi-value tone-period' }, period)
        ),
        h('div', { class: 'forecast-kpi-footer' },
          h('span', { class: 'forecast-kpi-desc' }, 'Modelo Predictivo de ML FarmaYA')
        )
      ),

      // Card 2: Demanda ALTA
      h('div', { class: 'forecast-kpi-card tone-alta' },
        h('div', { class: 'forecast-kpi-top' },
          h('div', { class: 'forecast-kpi-title-wrap' },
            icon('alert-triangle', 'forecast-kpi-ico tone-alta'),
            h('span', { class: 'forecast-kpi-label' }, 'Demanda ALTA (Riesgo Quiebre)')
          ),
          h('span', { class: 'forecast-kpi-badge badge-alta' }, 'Prioridad')
        ),
        h('div', { class: 'forecast-kpi-body' },
          h('strong', { class: 'forecast-kpi-value tone-alta' }, String(summary.alta || 0)),
          h('span', { class: 'forecast-kpi-unit' }, 'medicamentos')
        ),
        h('div', { class: 'forecast-kpi-footer' },
          h('span', { class: 'forecast-kpi-desc' }, 'Alta rotación · Mayor stock (+35%)')
        )
      ),

      // Card 3: Demanda MEDIA
      h('div', { class: 'forecast-kpi-card tone-media' },
        h('div', { class: 'forecast-kpi-top' },
          h('div', { class: 'forecast-kpi-title-wrap' },
            icon('trending-up', 'forecast-kpi-ico tone-media'),
            h('span', { class: 'forecast-kpi-label' }, 'Demanda MEDIA (Rotación Regular)')
          ),
          h('span', { class: 'forecast-kpi-badge badge-media' }, 'Estable')
        ),
        h('div', { class: 'forecast-kpi-body' },
          h('strong', { class: 'forecast-kpi-value tone-media' }, String(summary.media || 0)),
          h('span', { class: 'forecast-kpi-unit' }, 'medicamentos')
        ),
        h('div', { class: 'forecast-kpi-footer' },
          h('span', { class: 'forecast-kpi-desc' }, 'Consumo estándar predecible')
        )
      ),

      // Card 4: Demanda BAJA
      h('div', { class: 'forecast-kpi-card tone-baja' },
        h('div', { class: 'forecast-kpi-top' },
          h('div', { class: 'forecast-kpi-title-wrap' },
            icon('package', 'forecast-kpi-ico tone-baja'),
            h('span', { class: 'forecast-kpi-label' }, 'Demanda BAJA (Poco Movimiento)')
          ),
          h('span', { class: 'forecast-kpi-badge badge-baja' }, 'Mínimo')
        ),
        h('div', { class: 'forecast-kpi-body' },
          h('strong', { class: 'forecast-kpi-value tone-baja' }, String(summary.baja || 0)),
          h('span', { class: 'forecast-kpi-unit' }, 'medicamentos')
        ),
        h('div', { class: 'forecast-kpi-footer' },
          h('span', { class: 'forecast-kpi-desc' }, 'Stock mínimo bajo demanda')
        )
      )
    );

    // Medicamento seleccionado para el grafico
    const selectedMed = list.find(m => m.medicineName === pharmacySelectedMedName) || null;

    // Selector interactivo que ocupa toda la anchura
    const medSelect = h('select', {
      class: 'input select forecast-med-select',
      style: 'width: 100%; font-size: 0.9rem; padding: 0.6rem 0.9rem; border-radius: 8px; border: 1px solid var(--line); background: var(--surface); color: var(--text);',
      onchange: e => {
        pharmacySelectedMedName = e.target.value;
        refreshAll();
      }
    },
      h('option', { value: '' }, '-- Comparativa global de categorias (ALTA, MEDIA, BAJA) --'),
      list.map(m => h('option', { value: m.medicineName, selected: m.medicineName === pharmacySelectedMedName }, m.medicineName + ' [' + m.category + ']'))
    );

    const selectorSection = h('div', {
      class: 'forecast-full-selection',
      style: 'width: 100%; display: flex; align-items: center; gap: 0.75rem; margin-top: 1rem; padding-top: 1rem; border-top: 1.5px solid var(--line);'
    },
      h('div', { style: 'flex: 1; width: 100%;' }, medSelect),
      selectedMed ? h('button', {
        class: 'btn secondary',
        style: 'white-space: nowrap; font-size: 0.85rem; padding: 0.55rem 1rem;',
        onclick: () => { pharmacySelectedMedName = ''; refreshAll(); }
      }, 'Ver comparativa global') : null
    );

    // Grafico de Lineas a ancho completo
    const chartCard = h('div', { class: 'card forecast-chart-card', style: 'padding: 1.25rem 1.5rem; margin-bottom: 1.25rem; width: 100%;' },
      h('div', { class: 'flex items-center justify-between', style: 'flex-wrap: wrap; gap: 0.75rem; margin-bottom: 0.75rem;' },
        h('div', null,
          h('h3', { style: 'margin: 0; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem;' },
            'Grafico de Lineas: Evolucion y Demanda Proyectada',
            selectedMed ? h('span', { class: 'tag primary', style: 'font-size: 0.75rem;' }, selectedMed.medicineName) : null
          ),
          h('small', { class: 'muted' }, 'Historico de pedidos en MongoDB (linea continua) y proyeccion predictiva del proximo mes (linea discontinua - -)')
        )
      ),
      selectorSection,
(() => {
        const holder = h('div', { class: 'chart-container', style: 'width: 100%; min-height: 270px; margin-top: 0.5rem;' });
        holder.innerHTML = fyDemandLineChartSvg(data.chartSeries, selectedMed);
        return holder;
      })(),
      h('div', { class: 'forecast-chart-legend-bar', style: 'margin-top: 0.85rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--line);' },
        h('div', { class: 'flex items-center gap-2' },
          h('span', { class: 'demand-legend-pill alta' }, h('span', { class: 'legend-dot alta' }), 'Demanda ALTA'),
          h('span', { class: 'demand-legend-pill media' }, h('span', { class: 'legend-dot media' }), 'Demanda MEDIA'),
          h('span', { class: 'demand-legend-pill baja' }, h('span', { class: 'legend-dot baja' }), 'Demanda BAJA')
        ),
        h('div', {
          class: 'fy-chart-detail-banner',
          'data-original-text': 'Pasa el cursor por la curva o haz clic en la tabla para ver la curva individual.',
          style: 'display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.4rem 0.95rem; border-radius: 999px; background: rgba(22, 134, 93, 0.08); color: var(--primary); font-size: 0.82rem; font-weight: 600;'
        },
          icon('chart'),
          h('span', null, 'Pasa el cursor por la curva o haz clic en la tabla para ver la curva individual.')
        )
      )
    );

    // Controles de filtrado
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

    // Buscador interactivo que ocupa toda la anchura de la seccion
    const searchInput = h('input', {
      type: 'search',
      placeholder: 'Buscar medicamentos por nombre comercial, principio activo o indicación clínica...',
      value: __pharmacyDemandSearch,
      style: 'width: 100%; font-size: 0.95rem; padding: 0.7rem 1.1rem; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); color: var(--text);',
      oninput: e => {
        __pharmacyDemandSearch = e.target.value;
        const term = __pharmacyDemandSearch.toLowerCase().trim();
        const rows = document.querySelectorAll('.pharmacy-forecast-row');
        rows.forEach(r => {
          const name = (r.getAttribute('data-name') || '').toLowerCase();
          r.style.display = (!term || name.includes(term)) ? '' : 'none';
        });
      }
    });

    const recalculateBtn = h('button', {
      class: 'btn secondary',
      style: 'font-size: 0.85rem; display: inline-flex; align-items: center; gap: 0.4rem;',
      onclick: async e => {
        await act(e.currentTarget, async () => {
          const res = await API.post('/demand-forecast/recalculate', {});
          toast(res.message || 'Pronostico recalculado exitosamente con IA.');
          refreshAll();
        }, 'Modelo actualizado');
      }
    }, 'Recalcular con Historico Reciente');

    // Barra de búsqueda y filtros a todo lo ancho con línea divisoria
    const toolbar = h('div', { class: 'stack forecast-search-bar-wrap', style: 'width: 100%; gap: 0.85rem; margin: 1.5rem 0 1rem;' },
      h('div', { class: 'forecast-search-row', style: 'width: 100%;' }, searchInput),
      h('div', { class: 'flex items-center justify-between', style: 'width: 100%; flex-wrap: wrap; gap: 0.75rem; padding-bottom: 0.75rem; border-bottom: 1.5px solid var(--line);' },
        filters,
        recalculateBtn
      )
    );

    // Filtrar lista
    const filtered = list.filter(item => {
      const matchCat = __pharmacyDemandFilter === 'TODAS' || (item.category || '').toUpperCase() === __pharmacyDemandFilter;
      const matchSearch = !__pharmacyDemandSearch || (item.medicineName || '').toLowerCase().includes(__pharmacyDemandSearch.toLowerCase().trim());
      return matchCat && matchSearch;
    });

    // Badge helper sin emojis
    const categoryBadge = cat => {
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
        style: 'background: ' + bg + '; color: ' + color + '; font-weight: 700; border-radius: 999px; padding: 0.25rem 0.75rem; font-size: 0.8rem;'
      }, label);
    };

    const trendBadge = trend => {
      const t = trend || 'Estable';
      let icon = '[=] Estable';
      if (t === 'Creciente') icon = '[+] Creciente';
      else if (t === 'Decreciente') icon = '[-] Decreciente';
      return h('span', { class: 'text-xs muted', style: 'font-weight: 600;' }, icon);
    };

    // Tabla de resultados
    const tableHeader = h('thead', null,
      h('tr', { style: 'background: var(--surface-soft); border-bottom: 1.5px solid var(--line);' },
        h('th', { style: 'text-align: center; padding: 0.75rem 0.5rem; width: 90px;' }, 'Grafico'),
        h('th', { style: 'text-align: left; padding: 0.75rem 1rem;' }, 'Medicamento'),
        h('th', { style: 'text-align: center; padding: 0.75rem 0.5rem;' }, 'Demanda Prevista'),
        h('th', { style: 'text-align: right; padding: 0.75rem 0.75rem;' }, 'Solicitudes Est.'),
        h('th', { style: 'text-align: right; padding: 0.75rem 0.75rem;' }, 'Unidades Proy.'),
        h('th', { style: 'text-align: right; padding: 0.75rem 0.75rem;' }, 'Stock Sugerido'),
        h('th', { style: 'text-align: center; padding: 0.75rem 0.5rem;' }, 'Tendencia'),
        h('th', { style: 'text-align: left; padding: 0.75rem 1rem;' }, 'Recomendacion de Compra e Inventario')
      )
    );

    const tableRows = filtered.map(item => {
      const isSelected = pharmacySelectedMedName === item.medicineName;
      const selectBtn = h('button', {
        class: 'btn ' + (isSelected ? 'primary' : 'secondary'),
        style: 'font-size: 0.75rem; padding: 0.25rem 0.55rem; width: 100%; text-align: center;',
        onclick: e => {
          e.stopPropagation();
          pharmacySelectedMedName = isSelected ? '' : item.medicineName;
          refreshAll();
        }
      }, isSelected ? 'Graficado' : 'Graficar');

      return h('tr', {
        class: 'pharmacy-forecast-row',
        'data-name': item.medicineName,
        style: 'border-bottom: 1px solid var(--line); cursor: pointer; transition: background 0.15s;' + (isSelected ? ' background: var(--primary-soft); font-weight: 600;' : ''),
        onclick: () => {
          pharmacySelectedMedName = isSelected ? '' : item.medicineName;
          refreshAll();
        }
      },
        h('td', { style: 'padding: 0.6rem 0.5rem; text-align: center;' }, selectBtn),
        h('td', { style: 'padding: 0.75rem 1rem; font-weight: 600;' }, item.medicineName),
        h('td', { style: 'text-align: center; padding: 0.75rem 0.5rem;' }, categoryBadge(item.category)),
        h('td', { style: 'text-align: right; padding: 0.75rem 0.75rem; font-weight: 600;' }, String(item.estimatedOrders || 0)),
        h('td', { style: 'text-align: right; padding: 0.75rem 0.75rem;' }, String(item.predictedUnits || 0) + ' uds'),
        h('td', { style: 'text-align: right; padding: 0.75rem 0.75rem; font-weight: 700; color: var(--primary);' }, String(item.recommendedStock || 0) + ' uds'),
        h('td', { style: 'text-align: center; padding: 0.75rem 0.5rem;' }, trendBadge(item.historicalTrend)),
        h('td', { style: 'padding: 0.75rem 1rem; font-size: 0.85rem;', class: 'muted' }, item.actionRecommendation || '')
      );
    });

    // Tabla dentro de un recuadro compatible con tema oscuro y todo el ancho
    const tableFrame = h('div', {
      class: 'card forecast-table-frame',
      style: 'padding: 0; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: var(--surface); box-shadow: var(--shadow-sm, 0 2px 6px rgba(0,0,0,0.04)); margin-top: 1rem; width: 100%;'
    },
      h('div', { class: 'forecast-table-head', style: 'padding: 0.9rem 1.25rem; background: var(--surface-soft); border-bottom: 1px solid var(--line); display: flex; justify-content: space-between; align-items: center;' },
        h('strong', { style: 'font-size: 0.95rem; color: var(--text);' }, 'Planificacion y Clasificacion de Existencias'),
        h('span', { class: 'muted text-xs' }, 'Mostrando ' + filtered.length + ' de ' + list.length + ' medicamentos')
      ),
      h('div', { style: 'overflow-x: auto; width: 100%;' },
        h('table', { class: 'forecast-table', style: 'width: 100%; border-collapse: collapse;' },
          tableHeader,
          h('tbody', null, ...tableRows)
        )
      )
    );

    const infoNotice = notice('info',
      'Clasificacion predictiva de demanda (Machine Learning)',
      'El modelo analiza los pedidos historicos de clientes en MongoDB, frecuencias de compra y estacionalidad. Ayuda a anticipar que medicamentos tendran mayor demanda para programar pedidos a proveedores y prevenir desabastecimiento o sobreinventario.'
    );

    return h('div', { class: 'stack' },
      infoNotice,
      kpis,
      chartCard,
      toolbar,
      filtered.length ? tableFrame : empty('Sin registros', 'No se encontraron medicamentos en esta categoria.')
    );
  });
}
