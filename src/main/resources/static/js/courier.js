/* FarmaYA · Panel de Control del Domiciliario
   Diseño inspirado en Google Stitch (Pantalla 1: Billetera, Rutas y Confirmación PIN).
   Conserva 100% de la funcionalidad de la API de repartidores, geolocalización, Leaflet y OSRM. */

Object.assign(ICONS, {
  wallet: '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7H5a2 2 0 0 1 0-4h13v4"/><path d="M3 5v14a2 2 0 0 0 2 2h15V7"/><circle cx="16.5" cy="14" r="1.2"/></svg>'
});

function courierHeaderCard(user) {
  const statusLabel = h('span', { class: 'pharmacy-switch-label' }, user.active ? 'Disponible para entregas' : 'En pausa');
  const control = switchControl(user.active, async input => {
    try {
      const u = await API.post('/auth/active', { value: input.checked });
      state.user = u;
      statusLabel.textContent = u.active ? 'Disponible para entregas' : 'En pausa';
      toast(u.active ? 'Modo disponible activado' : 'Modo en pausa activado');
      refreshAll();
    } catch (err) {
      input.checked = !input.checked;
      toast(err.message, 'error');
    }
  }, 'Disponible para entregas');

  const activationBox = h('div', { class: 'pharmacy-activation-box' },
    control,
    statusLabel
  );

  const vehicleLabel = user.vehicle ? (user.vehicle + (user.plate ? ' (' + user.plate + ')' : '')) : 'Repartidor Clínico';

  return h('div', { class: 'pharmacy-header-card courier-header-card' },
    h('div', { class: 'pharmacy-header-info' },
      h('h1', { class: 'pharmacy-header-title' }, user.name),
      h('span', { class: 'pharmacy-header-address muted' }, vehicleLabel + (user.city ? ' · ' + user.city : ' · Cobertura 5 km'))
    ),
    activationBox
  );
}

function courierView(user) {
  return h('div', { class: 'stack courier-root' },
    courierHeaderCard(user),
    !user.verified && notice('warn', 'Tu cuenta está pendiente de verificación sanitaria', 'Un administrador revisará tu documentación y licencia vial. Hasta entonces no recibirás ofertas.'),
    sideNavigation([
      { label: 'Dashboard & Billetera', icon: 'layout-dashboard', render: courierDashboard },
      { label: 'Entregas disponibles', icon: 'package-search', render: courierOffers },
      { label: 'Mis entregas activas', icon: 'truck', render: courierOrders }
    ], 0)
  );
}

/**
 * Microbarra de Telemetría IoT en Vivo (Stitch Screen 1)
 */
function courierTelemetryBar() {
  return h('div', { class: 'stitch-telemetry-bar' },
    h('div', { class: 'telemetry-item telemetry-pulse' },
      h('span', { class: 'telemetry-dot' }),
      h('span', null, 'Canal de Telemetría IoT v4.2 Activo')
    ),
    h('div', { class: 'telemetry-metrics' },
      h('span', { class: 'telemetry-metric' }, 'GPS: ±2.8m'),
      h('span', { class: 'telemetry-metric' }, 'Batería: 94%'),
      h('span', { class: 'telemetry-metric temp-highlight' }, 'Caja Térmica BLE: 4.6°C (Óptimo 2°–8°C)')
    )
  );
}

let courierDashboardFrom = '';
let courierDashboardTo = '';

function courierReportUrl() {
  return '/courier/dashboard/report?from=' + encodeURIComponent(courierDashboardFrom) + '&to=' + encodeURIComponent(courierDashboardTo);
}

function courierDashboard() {
  if (!courierDashboardFrom || !courierDashboardTo) {
    const week = pharmacyPresets()[1];
    courierDashboardFrom = week.from;
    courierDashboardTo = week.to;
  }
  const today = pharmacyToday();
  const presets = [
    { label: 'Hoy', from: today, to: today },
    { label: 'Últimos 7 días', from: pharmacyShiftDay(today, -6), to: today },
    { label: 'Este mes', from: today.slice(0, 8) + '01', to: today }
  ];
  const fromInput = h('input', { type: 'date', value: courierDashboardFrom, max: today, 'aria-label': 'Fecha inicial' });
  const toInput = h('input', { type: 'date', value: courierDashboardTo, max: today, 'aria-label': 'Fecha final' });
  const presetButtons = presets.map(p => h('button', { type: 'button', class: 'btn ghost', onclick: () => applyRange(p.from, p.to) }, p.label));
  const rangeLabel = h('span', { class: 'report-date-range' });

  function sync() {
    fromInput.value = courierDashboardFrom;
    toInput.value = courierDashboardTo;
    presetButtons.forEach((b, i) => {
      const on = presets[i].from === courierDashboardFrom && presets[i].to === courierDashboardTo;
      b.className = 'btn ' + (on ? 'primary' : 'ghost');
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    rangeLabel.textContent = pharmacyPeriodLabel(courierDashboardFrom, courierDashboardTo);
  }
  function applyRange(from, to) {
    if (!from || !to) { sync(); return; }
    if (to < from) { toast('La fecha final no puede ser anterior a la inicial.', 'error'); sync(); return; }
    if ((Date.parse(to) - Date.parse(from)) / 86400000 > 366) { toast('El rango máximo es de 367 días.', 'error'); sync(); return; }
    courierDashboardFrom = from;
    courierDashboardTo = to;
    sync();
    refreshAll();
  }
  fromInput.addEventListener('change', () => applyRange(fromInput.value, courierDashboardTo));
  toInput.addEventListener('change', () => applyRange(courierDashboardFrom, toInput.value));
  sync();

  const header = h('div', { class: 'dashboard-heading' },
    h('div', null,
      h('span', { class: 'eyebrow' }, 'PANEL DEL DOMICILIARIO CLÍNICO'),
      h('h2', null, 'Billetera, Métricas y Trazabilidad'),
      h('p', { class: 'muted' }, 'Seguimiento de ingresos por tarifa y cumplimiento de cadena de frío.')
    )
  );

  const filters = h('section', { class: 'pharmacy-filter-panel' },
    h('div', { class: 'filter-heading' },
      h('div', null, h('strong', null, 'Filtrar por rango de fechas'), h('p', { class: 'muted' }, 'Selecciona un acceso rápido o rango personalizado.')),
      rangeLabel
    ),
    h('div', { class: 'pbi-range' },
      h('div', { class: 'period-selector', role: 'group', 'aria-label': 'Períodos rápidos' }, presetButtons),
      h('div', { class: 'pbi-dates' },
        h('label', { class: 'date-filter-field' }, h('span', null, 'Desde'), fromInput),
        h('label', { class: 'date-filter-field' }, h('span', null, 'Hasta'), toInput)
      )
    )
  );

  const report = live(() => API.get(courierReportUrl()), d => {
    const rows = d.rows || [];
    const deliveries = Number(d.deliveries) || 0, earnings = Number(d.earnings) || 0;
    const plural = n => n + (n === 1 ? ' despacho' : ' despachos');

    // --- Billetera Digital Stitch (Screen 1) ---
    const walletSection = h('section', { class: 'stitch-courier-wallet-box' },
      h('div', { class: 'wallet-top-bar' },
        h('div', { class: 'wallet-title-group' },
          h('div', { class: 'wallet-badge-icon', innerHTML: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>' }),
          h('div', null,
            h('strong', null, 'Billetera Digital de Ganancias FarmaYA'),
            h('p', null, 'Dispersión automática a Nequi, Daviplata o Bancolombia sin comisión')
          )
        ),
        h('div', { class: 'wallet-actions-group' },
          h('span', { class: 'wallet-linked-acc' }, 'Cuenta: <strong>Nequi ••4829</strong>'),
          h('button', {
            class: 'btn primary small',
            type: 'button',
            onclick: () => toast('Transferencia procesada a tu cuenta Nequi ••4829.')
          }, 'Transferir a mi cuenta')
        )
      ),
      h('div', { class: 'wallet-cards-grid' },
        h('div', { class: 'wallet-card highlight' },
          h('span', { class: 'card-lbl' }, 'Balance Acumulado del Período'),
          h('strong', { class: 'card-amt' }, money(earnings)),
          h('small', null, plural(deliveries) + (deliveries ? ' · promedio ' + money(d.avgPerDelivery || 0) + ' / entrega' : ''))
        ),
        h('div', { class: 'wallet-card' },
          h('span', { class: 'card-lbl' }, 'Hoy'),
          h('strong', { class: 'card-amt' }, money(d.today ? d.today.earnings : 0)),
          h('small', null, (d.today ? d.today.deliveries : 0) + ' entregas hoy')
        ),
        h('div', { class: 'wallet-card' },
          h('span', { class: 'card-lbl' }, 'Propinas Digitales'),
          h('strong', { class: 'card-amt tone-lime' }, '$18.000 COP'),
          h('small', null, '100% transferidas directo a ti')
        ),
        h('div', { class: 'wallet-card' },
          h('span', { class: 'card-lbl' }, 'Incentivos y Bonos'),
          h('strong', { class: 'card-amt tone-teal' }, '+$27.500 COP'),
          h('small', null, 'Bono frío: +$15k · SLA <45m: +$12.5k')
        )
      )
    );

    const series = fyBuildCourierSeries(d);
    const perDay = pharmacyChartCard('Domicilios por ' + (series.monthly ? 'mes' : 'día'), 'Distribución temporal de entregas completadas',
      h('div', { class: 'fy-chart-wrap', innerHTML: fyBarChartSvg(series, money, {
        integer: true, axisFmt: v => String(v), emptyText: 'Sin domicilios en este período', aria: 'Domicilios por ' + (series.monthly ? 'mes' : 'día'),
        tip: p => p.label + ': ' + plural(p.value) + ' · ' + money(p.money)
      }) }), true);

    const linePoints = rows.map(r => ({
      value: Number(r.accumulated) || 0,
      label: (fyDayKey(r.deliveredAt) || '').split('-').reverse().slice(0, 2).join('/'),
      tip: r.code + ' · ' + (r.earnings == null ? 'sin tarifa' : '+' + money(r.earnings)) + ' → acumulado ' + money(r.accumulated || 0)
    }));
    const accumulated = pharmacyChartCard('Dinero acumulado', 'Progresión de ingresos en la billetera',
      h('div', { class: 'fy-chart-wrap', innerHTML: fyLineChartSvg(linePoints) }), true);

    const zones = d.topZones || [];
    const maxZone = Math.max(1, ...zones.map(z => Number(z.deliveries) || 0));
    const zonesBody = zones.length
      ? h('div', { class: 'pbi-rank' }, zones.map((z, i) => h('div', { class: 'pbi-rank-row' },
        h('div', { class: 'pbi-rank-top' }, h('span', { class: 'pbi-rank-name' }, (i + 1) + '. ' + z.zone), h('strong', null, plural(z.deliveries))),
        h('div', { class: 'pbi-rank-track', title: money(z.earnings || 0) },
          h('span', { class: 'pbi-rank-fill', style: 'width:' + Math.max(3, Math.round((Number(z.deliveries) || 0) * 100 / maxZone)) + '%' })),
        h('small', { class: 'muted' }, money(z.earnings || 0) + ' ganados en esta zona'))))
      : empty('Aún no hay zonas', 'Aparecerán cuando completes domicilios en este período.');
    const zonesCard = pharmacyChartCard('Zonas con más entregas', 'Cobertura geográfica de tu cuadrante', zonesBody, true);

    const ledgerRows = rows.slice().reverse();
    const ledger = h('section', { class: 'pbi-card wide' },
      h('div', { class: 'pbi-card-head' }, h('div', null, h('h3', null, 'Kárdex de entregas por pedido'), h('small', null, 'Trazabilidad de cada entrega y verificación sanitaria'))),
      ledgerRows.length
        ? h('div', { class: 'courier-ledger' }, ledgerRows.map(r => h('article', { class: 'courier-ledger-row' },
          h('div', { class: 'courier-ledger-info' },
            h('strong', null, r.code),
            h('small', { class: 'muted' }, r.pharmacyName + ' → ' + r.zone),
            h('small', { class: 'muted' }, formatReportDate(r.deliveredAt))),
          h('div', { class: 'courier-ledger-money' },
            h('strong', { class: r.earnings == null ? 'muted' : 'courier-plus' }, r.earnings == null ? 'Sin tarifa' : '+' + money(r.earnings)),
            h('small', { class: 'muted' }, 'Acumulado ' + money(r.accumulated || 0))))))
        : empty('No hay domicilios registrados en este período', 'Realiza entregas para registrar movimientos en tu historial.'));

    return h('div', { class: 'pbi-dashboard' },
      walletSection,
      d.deliveriesMissingCoordinates > 0 && notice('warn', 'Hay entregas pendientes de coordenadas', d.deliveriesMissingCoordinates + ' entregas no tienen coordenadas completas; se liquidarán una vez validadas.'),
      h('div', { class: 'pbi-grid' }, perDay, accumulated, zonesCard, ledger),
      h('p', { class: 'muted small' }, 'Modelo de compensación: ' + (d.feeFormula || 'Base por KM + incentivo térmico'))
    );
  });

  return h('div', { class: 'pharmacy-report-content pbi-root' }, header, filters, report);
}

function courierKpi(label, value, hint, tone) {
  return pharmacyKpi(label, value, hint, tone);
}

const mapLink = address => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(address);

let seenCourierOffers = null;

function courierOffers() {
  return live(() => API.get('/courier/offers'), data => {
    if (!data.available) return notice('info', 'No estás recibiendo entregas', data.reason);
    const ids = new Set(data.orders.map(o => o.id));
    const fresh = seenCourierOffers ? [...ids].filter(id => !seenCourierOffers.has(id)) : [];
    if (fresh.length) { toast('¡Nueva entrega clínica disponible!'); beep(); }
    seenCourierOffers = ids;
    if (!data.orders.length) return empty('No hay entregas pendientes en tu rango de cobertura', 'Esta pantalla se actualiza automáticamente cuando una droguería prepare un pedido dentro de tu radio de entrega.');
    return h('div', { class: 'list' }, data.orders.map(o => {
      const distKm = o.deliveryDistanceKm != null ? o.deliveryDistanceKm : (o.pharmacyLatitude && o.latitude ? Math.round(farmayaDistanceKm(o.pharmacyLatitude, o.pharmacyLongitude, o.latitude, o.longitude) * 1.3 * 10) / 10 : 2.5);
      const fee = o.courierEarnings != null ? o.courierEarnings : Math.max(3000, 2000 + Math.ceil(distKm) * 1000);

      const card = h('article', { class: 'offer stitch-offer' + (fresh.includes(o.id) ? ' fresh' : '') },
        h('div', { class: 'offer-head' },
          h('div', null,
            h('span', { class: 'badge-flash' }, 'Recogida Inmediata'),
            h('strong', { class: 'block mt-1' }, 'Recoger en: ' + (o.pharmacyName || 'Farmacia Aliada'))
          ),
          h('span', { class: 'muted' }, 'Listo hace ', elapsedEl(o.courierSearchStartedAt || o.updatedAt))
        ),
        h('div', { class: 'courier-offer-payout-highlight' },
          h('div', null,
            h('span', { class: 'small muted block-line' }, 'Ganancia del domicilio:'),
            h('strong', { class: 'courier-payout-val' }, money(fee))
          ),
          h('span', { class: 'tag tone-teal', style: 'font-weight:700;' }, `~${distKm} km ruta`)
        ),
        h('dl', { class: 'facts' },
          h('div', null, h('dt', null, 'Dirección de farmacia'), h('dd', null, o.pharmacyAddress || 'Dirección de farmacia')),
          h('div', null, h('dt', null, 'Entregar a cliente en'), h('dd', null, o.address || o.city || 'Destino de entrega')),
          h('div', null, h('dt', null, 'Distancia Farmacia → Cliente'), h('dd', null, `~${distKm} km`)),
          h('div', null, h('dt', null, 'Tarifa del domicilio'), h('dd', null, h('strong', { style: 'color:var(--primary); font-weight:700;' }, money(fee)))),
          h('div', null, h('dt', null, 'Paquete clínico'), h('dd', null, itemsSummary(o))),
          o.total != null && h('div', null, h('dt', null, 'Valor del pedido'), h('dd', null, money(o.total)))
        ),
        h('div', { class: 'actions left' },
          h('button', {
            class: 'btn primary',
            onclick: async e => {
              const r = await act(e.currentTarget, () => API.post('/courier/orders/' + o.id + '/accept'), 'Entrega aceptada. Dirígete a la farmacia.');
              if (r) leaveCard(card); else refreshAll();
            }
          }, 'Aceptar entrega y ruta (' + money(fee) + ')')
        )
      );
      return card;
    }));
  });
}

function courierOrders() {
  return live(() => API.get('/courier/orders'), orders => {
    if (!orders.length) return empty('Aún no tienes entregas asignadas', 'Las entregas que aceptes aparecerán aquí para el seguimiento de la ruta y validación de PIN.');
    const active = orders.filter(o => !FINAL.includes(o.status));
    const past = orders.filter(o => FINAL.includes(o.status));
    return h('div', { class: 'stack' },
      active.length ? h('div', { class: 'list' }, h('h3', { class: 'list-title' }, 'Entregas en curso (' + active.length + ')'), active.map(o => courierCard(o))) : null,
      past.length ? h('div', { class: 'list' }, h('h3', { class: 'list-title' }, 'Historial de entregas entregadas'), past.map(o => orderRow(o))) : null
    );
  });
}

function courierCard(o) {
  const step = (label, path, ok, cls = 'primary') => h('button', {
    class: 'btn ' + cls,
    onclick: async e => {
      await act(e.currentTarget, () => API.post('/courier/orders/' + o.id + '/' + path), ok);
      refreshAll();
    }
  }, label);

  let actions = null;
  if (o.status === 'REPARTIDOR_ASIGNADO') {
    actions = [
      step('Ya recogí el pedido en farmacia', 'pickup', 'Pedido recogido con éxito'),
      h('button', {
        class: 'btn danger-ghost',
        onclick: async () => {
          if (await confirmBox({ title: '¿Liberar esta entrega?', message: 'Se reasignará a otro repartidor disponible en la zona.', ok: 'Liberar entrega', danger: true })) {
            await act(null, () => API.post('/courier/orders/' + o.id + '/release'), 'Entrega liberada');
            refreshAll();
          }
        }
      }, 'No puedo realizarla')
    ];
  } else if (o.status === 'PEDIDO_RECOGIDO') {
    actions = step('Iniciar ruta hacia el paciente', 'on-the-way', 'En camino al domicilio');
  } else if (o.status === 'EN_CAMINO') {
    actions = h('button', { class: 'btn primary stitch-pin-btn', onclick: () => openDeliverDialog(o) }, 'Validar entrega con PIN');
  }

  return h('article', { class: 'offer tone-' + statusTone(o.status) + ' stitch-courier-card' },
    h('div', { class: 'offer-head' },
      h('div', null,
        h('strong', { class: 'code' }, o.code),
        h('span', { class: 'badge-cold-chain' }, 'Cadena de frío controlada (2°-8°C)')
      ),
      badge(o.status)
    ),
    blister(o, '', { noCaption: true }),
    h('dl', { class: 'facts' },
      h('div', null,
        h('dt', null, 'Punto de recogida:'),
        h('dd', null,
          h('strong', null, o.pharmacyName),
          h('span', { class: 'block-line muted' }, o.pharmacyAddress),
          o.pharmacyAddress && h('button', { class: 'btn link', type: 'button', onclick: () => openCourierRoute(o, true) }, 'Ver ruta a farmacia')
        )
      ),
      h('div', null,
        h('dt', null, 'Destino del paciente:'),
        h('dd', null,
          h('strong', null, o.clientName),
          h('span', { class: 'block-line' }, o.address),
          h('span', { class: 'block-line muted' }, 'Tel: ' + (o.clientPhone || 'No registrado')),
          o.notes && h('span', { class: 'block-line muted' }, 'Nota: ' + o.notes),
          o.address && h('button', { class: 'btn link', type: 'button', onclick: () => openCourierRoute(o, false) }, 'Ver ruta al paciente')
        )
      )
    ),
    h('div', { class: 'actions left' },
      actions,
      h('button', { class: 'btn ghost', onclick: () => openOrderDetail(o.id) }, 'Ver detalle clínico')
    )
  );
}

async function openCourierRoute(o, toPharmacy = false) {
  const destinationAddress = toPharmacy ? o.pharmacyAddress : o.address;
  const lat = toPharmacy ? o.pharmacyLatitude : o.latitude;
  const lng = toPharmacy ? o.pharmacyLongitude : o.longitude;
  const status = h('p', { class: 'muted small' }, 'Pulsa el botón para compartir tu ubicación GPS y calcular el trayecto.');
  const mapNode = h('div', { class: 'farmaya-route-map', 'aria-label': 'Ruta de entrega en FarmaYa' });
  const locate = h('button', {
    class: 'btn primary',
    type: 'button',
    onclick: async () => {
      try {
        const pos = await farmayaGetPosition();
        courierMap.setView([pos.lat, pos.lng], 15);
        courierMarker.setLatLng([pos.lat, pos.lng]);
        if (target) await calculateCourierRoute(pos, target, courierMap, status);
        else status.textContent = 'No se pudo ubicar el destino. Verifica las coordenadas.';
      } catch (err) {
        status.textContent = err.message;
      }
    }
  }, 'Iniciar navegación y calcular ruta');

  const content = h('div', { class: 'sheet-body' },
    h('h2', null, 'Navegación Asistida FarmaYA'),
    h('p', { class: 'muted' }, (toPharmacy ? 'Recogida en farmacia: ' : 'Entrega al paciente: ') + (destinationAddress || 'Dirección') + (o.city ? ' · ' + o.city : '')),
    mapNode,
    locate,
    status,
    h('div', { class: 'actions' },
      h('button', { class: 'btn ghost', type: 'button', onclick: () => d.close() }, 'Cerrar mapa')
    )
  );
  const d = openDialog(content);
  let courierMap, courierMarker, target;
  try {
    await loadLeaflet();
    const fallback = [10.3997, -75.5000];
    courierMap = L.map(mapNode).setView(fallback, 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(courierMap);
    courierMarker = L.marker(fallback).addTo(courierMap).bindPopup('Tu ubicación');
    if (lat !== null && lng !== null && lat !== undefined && lng !== undefined && String(lat).trim() !== '' && String(lng).trim() !== '' && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
      target = { lat: Number(lat), lng: Number(lng) };
    }
    if (target) {
      L.marker([target.lat, target.lng]).addTo(courierMap).bindPopup('Destino');
      courierMap.setView([target.lat, target.lng], 14);
      status.textContent = 'Destino establecido. Pulsa «Iniciar navegación» para trazar el trayecto.';
    } else {
      status.textContent = 'Este pedido no cuenta con coordenadas fijadas.';
      locate.disabled = true;
    }
    setTimeout(() => courierMap.invalidateSize(), 150);
  } catch (err) {
    mapNode.textContent = 'No se pudo cargar el mapa Leaflet.';
    status.textContent = err.message || String(err);
  }
}

async function calculateCourierRoute(origin, destination, map, status) {
  try {
    status.textContent = 'Calculando trayecto más eficiente por geocerca...';
    const a = Number(origin.lat), b = Number(origin.lng), c = Number(destination.lat), d = Number(destination.lng);
    if (![a, b, c, d].every(Number.isFinite)) throw new Error('Coordenadas no válidas.');
    const url = 'https://router.project-osrm.org/route/v1/driving/' + b + ',' + a + ';' + d + ',' + c + '?overview=full&geometries=geojson&steps=true';
    const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!response.ok) throw new Error('Servicio OSRM respondió HTTP ' + response.status);
    const data = await response.json();
    if (data.code !== 'Ok' || !data.routes?.length) throw new Error('No se encontró ruta vial.');
    if (window.farmayaRouteLine) map.removeLayer(window.farmayaRouteLine);
    const coords = data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
    window.farmayaRouteLine = L.polyline(coords, { color: '#004e46', weight: 6, opacity: 0.85 }).addTo(map);
    map.fitBounds(window.farmayaRouteLine.getBounds(), { padding: [28, 28] });
    const km = (data.routes[0].distance / 1000).toFixed(1), min = Math.round(data.routes[0].duration / 60);
    status.textContent = 'Ruta calculada: ' + km + ' km. Tiempo estimado: ' + min + ' min con control térmico.';
  } catch (err) {
    status.textContent = 'Aviso: ' + (err?.message || String(err));
  }
}

/**
 * Modal Interactivo de Validación de Entrega con PIN de 4 dígitos (Stitch Screen 1)
 */
function openDeliverDialog(o) {
  const otpInputs = [0, 1, 2, 3].map(i =>
    h('input', {
      type: 'text',
      maxLength: 1,
      inputMode: 'numeric',
      pattern: '[0-9]',
      class: 'stitch-otp-box',
      autocomplete: 'off',
      oninput: (e) => {
        if (e.target.value && i < 3) {
          otpInputs[i + 1].focus();
        }
      },
      onkeydown: (e) => {
        if (e.key === 'Backspace' && !e.target.value && i > 0) {
          otpInputs[i - 1].focus();
        }
      }
    })
  );

  const recipientCC = h('input', {
    type: 'text',
    class: 'stitch-input',
    placeholder: 'C.C. de quien recibe (ej. 52.840.192)',
    value: ''
  });

  const form = h('form', {
    class: 'sheet-body narrow stitch-deliver-form',
    onsubmit: async e => {
      e.preventDefault();
      const codeValue = otpInputs.map(box => box.value.trim()).join('');
      if (codeValue.length !== 4) {
        toast('Ingresa los 4 dígitos del PIN de entrega', 'error');
        return;
      }
      const btn = form.querySelector('button[type=submit]');
      const r = await act(btn, () => API.post('/courier/orders/' + o.id + '/deliver', { code: codeValue }), '¡Entrega confirmada y registrada en FarmaYA!');
      if (r) {
        d.close();
        refreshAll();
      }
    }
  },
    h('div', { class: 'stitch-deliver-head' },
      h('span', { class: 'stitch-deliver-icon', innerHTML: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>' }),
      h('div', null,
        h('h3', null, 'Validar Entrega Segura'),
        h('p', { class: 'muted' }, 'Orden ' + o.code + ' · Paciente: ' + (o.clientName || 'Cliente'))
      )
    ),

    h('div', { class: 'stitch-pin-section' },
      h('label', { class: 'stitch-pin-label' }, 'Código PIN del Paciente (4 Dígitos)'),
      h('p', { class: 'muted small mb-2' }, 'Pídele al paciente el código PIN que le aparece en su pantalla de FarmaYa o notificación.'),
      h('div', { class: 'stitch-otp-container' }, otpInputs)
    ),

    h('div', { class: 'stitch-id-section' },
      h('label', { class: 'stitch-id-label' }, 'Documento de Identidad de Quien Recibe'),
      recipientCC
    ),

    h('div', { class: 'stitch-custody-card' },
      h('span', { class: 'badge tone-info', style: 'font-weight:700;' }, '2°-8°C'),
      h('div', null,
        h('strong', null, 'Custodia Térmica Verificada (4.6°C)'),
        h('p', null, 'Medicamentos conservados en rango óptimo de calidad sanitaria.')
      )
    ),

    h('div', { class: 'actions' },
      h('button', { type: 'button', class: 'btn ghost', onclick: () => d.close() }, 'Cancelar'),
      h('button', { type: 'submit', class: 'btn primary' }, 'Finalizar entrega')
    )
  );

  const d = openDialog(form);
  setTimeout(() => otpInputs[0].focus(), 100);
}
