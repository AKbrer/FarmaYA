/* FarmaYA · panel del repartidor */

Object.assign(ICONS, {
  wallet: '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7H5a2 2 0 0 1 0-4h13v4"/><path d="M3 5v14a2 2 0 0 0 2 2h15V7"/><circle cx="16.5" cy="14" r="1.2"/></svg>'
});

function courierView(user) {
  return h('div', { class: 'stack' },
    h('h1', { class: 'page-title' }, user.name),
    availabilityBar(user, 'Disponible para entregas', 'En pausa', user.vehicle + ' en ' + user.zone),
    !user.verified && notice('warn', 'Tu cuenta está pendiente de verificación', 'Un administrador la revisará. Hasta entonces no verás entregas.'),
    sideNavigation([
      { label: 'Dashboard', icon: 'layout-dashboard', render: courierDashboard },
      { label: 'Entregas disponibles', icon: 'package-search', render: courierOffers },
      { label: 'Mis entregas', icon: 'truck', render: courierOrders },
      { label: 'Movimientos', icon: 'history', render: () => movementHistory('/courier/movements') }
    ], 0));
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
    h('div', null, h('span', { class: 'eyebrow' }, 'PANEL DE CONTROL'), h('h2', null, 'Tu dashboard'), h('p', { class: 'muted' }, 'Tus domicilios, tus ganancias acumuladas y las zonas donde más repartes.')));

  const filters = h('section', { class: 'pharmacy-filter-panel' },
    h('div', { class: 'filter-heading' }, h('div', null, h('strong', null, 'Buscar por días'), h('p', { class: 'muted' }, 'Elige un atajo o busca un día o rango en el calendario.')), rangeLabel),
    h('div', { class: 'pbi-range' },
      h('div', { class: 'period-selector', role: 'group', 'aria-label': 'Períodos rápidos' }, presetButtons),
      h('div', { class: 'pbi-dates' },
        h('label', { class: 'date-filter-field' }, h('span', null, 'Desde'), fromInput),
        h('label', { class: 'date-filter-field' }, h('span', null, 'Hasta'), toInput))));

  const report = live(() => API.get(courierReportUrl()), d => {
    const rows = d.rows || [];
    const deliveries = Number(d.deliveries) || 0, earnings = Number(d.earnings) || 0;
    const plural = n => n + (n === 1 ? ' domicilio' : ' domicilios');
    const per = (p, label) => courierKpi(label, plural(p.deliveries), money(p.earnings) + ' ganados', 'ok');

    const hero = h('section', { class: 'courier-wallet' },
      h('div', { class: 'courier-wallet-main' },
        h('span', { class: 'courier-wallet-label' }, 'Acumulado del período'),
        h('strong', { class: 'courier-wallet-amount' }, money(earnings)),
        h('small', null, plural(deliveries) + (deliveries ? ' · promedio ' + money(d.avgPerDelivery || 0) + ' por domicilio' : ' en este período'))),
      h('div', { class: 'courier-wallet-icon', 'aria-hidden': 'true' }, icon('wallet')));

    const kpis = h('div', { class: 'pbi-kpis' }, per(d.today, 'Hoy'), per(d.week, 'Hace 7 días'), per(d.month, 'Este mes'));

    const series = fyBuildCourierSeries(d);
    const perDay = pharmacyChartCard('Domicilios por ' + (series.monthly ? 'mes' : 'día'), 'Pasa el cursor sobre una barra para ver el detalle',
      h('div', { class: 'fy-chart-wrap', innerHTML: fyBarChartSvg(series, money, {
        integer: true, axisFmt: v => String(v), emptyText: 'Sin domicilios en este período', aria: 'Domicilios por ' + (series.monthly ? 'mes' : 'día'),
        tip: p => p.label + ': ' + plural(p.value) + ' · ' + money(p.money)
      }) }), true);

    const linePoints = rows.map(r => ({
      value: Number(r.accumulated) || 0,
      label: (fyDayKey(r.deliveredAt) || '').split('-').reverse().slice(0, 2).join('/'),
      tip: r.code + ' · ' + (r.earnings == null ? 'sin tarifa' : '+' + money(r.earnings)) + ' → acumulado ' + money(r.accumulated || 0)
    }));
    const accumulated = pharmacyChartCard('Dinero acumulado', 'Cada punto es un domicilio entregado',
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
    const zonesCard = pharmacyChartCard('Dónde llevas más domicilios', 'Ranking por zona o ciudad de entrega', zonesBody, true);

    const ledgerRows = rows.slice().reverse();
    const ledger = h('section', { class: 'pbi-card wide' },
      h('div', { class: 'pbi-card-head' }, h('div', null, h('h3', null, 'Cuenta por domicilio'), h('small', null, 'Lo que ganaste en cada entrega y tu saldo acumulado'))),
      ledgerRows.length
        ? h('div', { class: 'courier-ledger' }, ledgerRows.map(r => h('article', { class: 'courier-ledger-row' },
          h('div', { class: 'courier-ledger-info' },
            h('strong', null, r.code),
            h('small', { class: 'muted' }, r.pharmacyName + ' → ' + r.zone),
            h('small', { class: 'muted' }, formatReportDate(r.deliveredAt))),
          h('div', { class: 'courier-ledger-money' },
            h('strong', { class: r.earnings == null ? 'muted' : 'courier-plus' }, r.earnings == null ? 'Sin tarifa' : '+' + money(r.earnings)),
            h('small', { class: 'muted' }, 'Acumulado ' + money(r.accumulated || 0))))))
        : empty('No hay domicilios en este filtro', 'Prueba con otro día o rango de fechas.'));

    return h('div', { class: 'pbi-dashboard' },
      hero, kpis,
      d.deliveriesMissingCoordinates > 0 && notice('warn', 'Hay entregas sin coordenadas', d.deliveriesMissingCoordinates + ' entregas no tienen coordenadas de farmacia o cliente; sus ganancias no se incluyen hasta completar esa información.'),
      h('div', { class: 'pbi-grid' }, perDay, accumulated, zonesCard, ledger),
      h('p', { class: 'muted small' }, 'Tarifa estimada: ' + d.feeFormula));
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
    if (fresh.length) { toast('Hay una nueva entrega disponible'); beep(); }
    seenCourierOffers = ids;
    if (!data.orders.length) return empty('No hay entregas por ahora', 'Esta pantalla se actualiza sola. Cuando una farmacia deje un pedido listo en tu zona, aparecerá aquí.');
    return h('div', { class: 'list' }, data.orders.map(o => {
      const card = h('article', { class: 'offer' + (fresh.includes(o.id) ? ' fresh' : '') },
        h('div', { class: 'offer-head' },
          h('strong', null, 'Recoger en ' + o.pharmacyName),
          h('span', { class: 'muted' }, 'Esperando hace ', elapsedEl(o.courierSearchStartedAt || o.updatedAt))),
        h('dl', { class: 'facts' },
          h('div', null, h('dt', null, 'Dirección de la farmacia'), h('dd', null, o.pharmacyAddress)),
          h('div', null, h('dt', null, 'Entregar en'), h('dd', null, o.city || o.zone)),
          h('div', null, h('dt', null, 'Paquete'), h('dd', null, itemsSummary(o))),
          o.total != null && h('div', null, h('dt', null, 'Valor del pedido'), h('dd', null, money(o.total)))),
        h('div', { class: 'actions left' },
          h('button', { class: 'btn primary', onclick: async e => {
            const r = await act(e.currentTarget, () => API.post('/courier/orders/' + o.id + '/accept'), 'Entrega aceptada');
            if (r) leaveCard(card); else refreshAll();
          } }, 'Aceptar entrega')));
      return card;
    }));
  });
}

function courierOrders() {
  return live(() => API.get('/courier/orders'), orders => {
    if (!orders.length) return empty('Aún no tienes entregas', 'Las entregas que aceptes aparecerán aquí con el siguiente paso.');
    const active = orders.filter(o => !FINAL.includes(o.status));
    const past = orders.filter(o => FINAL.includes(o.status));
    return h('div', { class: 'stack' },
      active.length ? h('div', { class: 'list' }, h('h3', { class: 'list-title' }, 'En curso'), active.map(o => courierCard(o))) : null,
      past.length ? h('div', { class: 'list' }, h('h3', { class: 'list-title' }, 'Anteriores'), past.map(o => orderRow(o))) : null);
  });
}

function courierCard(o) {
  const step = (label, path, ok, cls = 'primary') => h('button', { class: 'btn ' + cls, onclick: async e => {
    await act(e.currentTarget, () => API.post('/courier/orders/' + o.id + '/' + path), ok);
    refreshAll();
  } }, label);
  let actions = null;
  if (o.status === 'REPARTIDOR_ASIGNADO') {
    actions = [step('Ya recogí el pedido', 'pickup', 'Pedido recogido'),
      h('button', { class: 'btn danger-ghost', onclick: async () => {
        if (await confirmBox({ title: '¿Dejar esta entrega?', message: 'Se ofrecerá a otros repartidores.', ok: 'Dejar entrega', danger: true })) {
          await act(null, () => API.post('/courier/orders/' + o.id + '/release'), 'Entrega liberada');
          refreshAll();
        }
      } }, 'No puedo hacerla')];
  } else if (o.status === 'PEDIDO_RECOGIDO') {
    actions = step('Salir hacia el cliente', 'on-the-way', 'En camino');
  } else if (o.status === 'EN_CAMINO') {
    actions = h('button', { class: 'btn primary', onclick: () => openDeliverDialog(o) }, 'Confirmar entrega');
  }
  return h('article', { class: 'offer tone-' + statusTone(o.status) },
    h('div', { class: 'offer-head' }, h('strong', { class: 'code' }, o.code), badge(o.status)),
    blister(o, '', { noCaption: true }),
    h('dl', { class: 'facts' },
      h('div', null, h('dt', null, 'Recoge en'), h('dd', null, o.pharmacyName, h('span', { class: 'block-line muted' }, o.pharmacyAddress),
        o.pharmacyAddress && h('button', { class: 'btn link', type: 'button', onclick: () => openCourierRoute(o, true) }, 'Ver ruta en FarmaYa'))),
      h('div', null, h('dt', null, 'Entrega a'), h('dd', null, o.clientName, h('span', { class: 'block-line' }, o.address), h('span', { class: 'block-line muted' }, o.clientPhone),
        o.notes && h('span', { class: 'block-line muted' }, 'Nota: ' + o.notes),
        o.address && h('button', { class: 'btn link', type: 'button', onclick: () => openCourierRoute(o, false) }, 'Ver ruta en FarmaYa')))),
    h('div', { class: 'actions left' }, actions,
      h('button', { class: 'btn link', onclick: () => openOrderDetail(o.id) }, 'Ver detalle')));
}

async function openCourierRoute(o, toPharmacy=false) {
  const destinationAddress = toPharmacy ? o.pharmacyAddress : o.address;
  const lat = toPharmacy ? o.pharmacyLatitude : o.latitude;
  const lng = toPharmacy ? o.pharmacyLongitude : o.longitude;
  const status = h('p',{class:'muted small'},'Pulsa el botón para compartir tu ubicación y calcular la ruta.');
  const mapNode = h('div',{class:'farmaya-route-map','aria-label':'Ruta de entrega en FarmaYa'});
  const locate = h('button',{class:'btn primary',type:'button',onclick:async()=>{
    try {
      const pos=await farmayaGetPosition(); courierMap.setView([pos.lat,pos.lng],15); courierMarker.setLatLng([pos.lat,pos.lng]);
      if(target) await calculateCourierRoute(pos,target,courierMap,status);
      else status.textContent='No se pudo ubicar el destino. Verifica que el pedido tenga coordenadas de entrega.';
    } catch(err){status.textContent=err.message;}
  }},'Mostrar mi ubicación e iniciar ruta');
  const content=h('div',{class:'sheet-body'},h('h2',null,'Ruta de entrega'),h('p',{class:'muted'},(toPharmacy?'Recogida: ':'Entrega: ')+ (destinationAddress||'Dirección no disponible') + (o.city?' · '+o.city:'')),mapNode,locate,status,h('div',{class:'actions'},h('button',{class:'btn ghost',type:'button',onclick:()=>d.close()},'Cerrar')));
  const d=openDialog(content); let courierMap, courierMarker, target;
  try {
    await loadLeaflet();
    const fallback=[10.3997,-75.5000];
    courierMap=L.map(mapNode).setView(fallback,12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(courierMap);
    courierMarker=L.marker(fallback).addTo(courierMap).bindPopup('Tu ubicación');
    if(lat!==null&&lng!==null&&lat!==undefined&&lng!==undefined&&String(lat).trim()!==''&&String(lng).trim()!==''&&Number.isFinite(Number(lat))&&Number.isFinite(Number(lng))) target={lat:Number(lat),lng:Number(lng)};
    if(target){L.marker([target.lat,target.lng]).addTo(courierMap).bindPopup('Destino');courierMap.setView([target.lat,target.lng],14);status.textContent='Destino marcado. Pulsa «Mostrar mi ubicación e iniciar ruta» para calcular el recorrido.';}
    else { status.textContent='Este pedido no tiene coordenadas guardadas. Pide al cliente que seleccione su ubicación en el mapa.'; locate.disabled=true; }
    setTimeout(()=>courierMap.invalidateSize(),150);
  } catch(err){mapNode.textContent='No se pudo cargar el mapa gratuito.';status.textContent=err.message||String(err);}
}

// Calcula una ruta sin Google: OSRM público y mapa Leaflet/OpenStreetMap.
// El servicio OSRM de demostración es apropiado para pruebas, no garantiza SLA de producción.
async function calculateCourierRoute(origin, destination, map, status) {
  try {
    status.textContent='Calculando ruta…';
    const a=Number(origin.lat), b=Number(origin.lng), c=Number(destination.lat), d=Number(destination.lng);
    if (![a,b,c,d].every(Number.isFinite)) throw new Error('Las coordenadas de origen o destino no son válidas.');
    const url='https://router.project-osrm.org/route/v1/driving/'+b+','+a+';'+d+','+c+'?overview=full&geometries=geojson&steps=true';
    const response=await fetch(url,{headers:{'Accept':'application/json'}});
    if(!response.ok) throw new Error('El servicio de rutas respondió HTTP '+response.status+'.');
    const data=await response.json();
    if(data.code!=='Ok'||!data.routes?.length) throw new Error('No se encontró una ruta para estas ubicaciones.');
    if(window.farmayaRouteLine) map.removeLayer(window.farmayaRouteLine);
    const coords=data.routes[0].geometry.coordinates.map(([lng,lat])=>[lat,lng]);
    window.farmayaRouteLine=L.polyline(coords,{color:'#1976d2',weight:6,opacity:.85}).addTo(map);
    map.fitBounds(window.farmayaRouteLine.getBounds(),{padding:[28,28]});
    const km=(data.routes[0].distance/1000).toFixed(1), min=Math.round(data.routes[0].duration/60);
    status.textContent='Ruta calculada con OpenStreetMap/OSRM. Distancia aproximada: '+km+' km. Tiempo estimado: '+min+' min.';
    const nav=h('a',{class:'btn link',href:'https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route='+a+'%2C'+b+'%3B'+c+'%2C'+d,target:'_blank',rel:'noopener noreferrer'},'Abrir indicaciones');
    status.appendChild(nav);
  } catch(err) { console.error('FarmaYa OSRM:',err); status.textContent='No se pudo calcular la ruta. Comprueba tu conexión o intenta de nuevo. Detalle: '+(err?.message||String(err)); }
}

function openDeliverDialog(o) {
  const code = h('input', { name: 'code', inputMode: 'numeric', pattern: '[0-9]{4}', maxLength: 4, required: true, class: 'code-input', autocomplete: 'off', placeholder: '0000' });
  const form = h('form', {
    class: 'sheet-body narrow',
    onsubmit: async e => {
      e.preventDefault();
      const btn = form.querySelector('button[type=submit]');
      const r = await act(btn, () => API.post('/courier/orders/' + o.id + '/deliver', { code: code.value }), 'Entrega confirmada');
      if (r) { d.close(); refreshAll(); }
    }
  },
    h('h3', null, 'Confirma la entrega'),
    h('p', { class: 'muted' }, 'Pídele al cliente su código de 4 dígitos cuando tenga el pedido en la mano.'),
    field('Código del cliente', code),
    h('div', { class: 'actions' },
      h('button', { type: 'button', class: 'btn ghost', onclick: () => d.close() }, 'Volver'),
      h('button', { type: 'submit', class: 'btn primary' }, 'Confirmar entrega')));
  const d = openDialog(form);
  code.focus();
}
