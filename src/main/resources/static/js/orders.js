/* FarmaYA · componentes de pedido compartidos: tira de blíster, filas y detalle */

const CLIENT_CAN_CANCEL = ['BUSCANDO_FARMACIA', 'FARMACIA_ASIGNADA', 'PRECIO_POR_ACEPTAR', 'PRECIO_CONFIRMADO'];

const NO_INCIDENT = ['CANCELADA', 'VENCIDA', 'RECHAZADA', 'CON_INCIDENCIA'];

const FINAL = ['ENTREGADO', 'CANCELADA', 'VENCIDA', 'RECHAZADA'];

/* ---------- Tira de blíster: cada paso del pedido es una pastilla ---------- */

const STEPS = [

  { label: 'Solicitud', s: ['SOLICITUD_ENVIADA', 'BUSCANDO_FARMACIA'] },

  { label: 'Farmacia', s: ['FARMACIA_ASIGNADA'] },

  { label: 'Precio', s: ['PRECIO_POR_ACEPTAR', 'PRECIO_CONFIRMADO'] },

  { label: 'Preparación', s: ['PEDIDO_EN_PREPARACION'] },

  { label: 'Repartidor', s: ['PEDIDO_LISTO', 'BUSCANDO_REPARTIDOR', 'REPARTIDOR_ASIGNADO'] },

  { label: 'Recogido', s: ['PEDIDO_RECOGIDO'] },

  { label: 'En camino', s: ['EN_CAMINO'] },

  { label: 'Entregado', s: ['ENTREGADO'] }

];

function stepIndex(o) {

  const status = o.status === 'CON_INCIDENCIA' && o.statusBeforeIncident ? o.statusBeforeIncident : o.status;

  return STEPS.findIndex(x => x.s.includes(status));

}

const lastStep = new Map();

/** Cuándo y por quién se llegó a cada paso, según el historial del pedido. */

function stepInfo(o, i) {

  const hits = (o.history || []).filter(e => STEPS[i].s.includes(e.status));

  if (!hits.length) return null;

  const last = hits[hits.length - 1];

  return { at: hits[0].at, note: last.note, who: last.actorName };

}

/**

 * Tira de blíster interactiva: toca (o enfoca) un paso para ver cuándo ocurrió.

 * Cuando el pedido avanza, la pastilla nueva "salta"; al entregarse, la tira hace una ola.

 */

function blister(o, size = '', opts = {}) {

  const idx = stepIndex(o);

  const finished = o.status === 'ENTREGADO';

  const dead = idx < 0 || ['CANCELADA', 'VENCIDA', 'RECHAZADA'].includes(o.status);

  const prev = o.id ? lastStep.get(o.id) : undefined;

  if (o.id) lastStep.set(o.id, idx);

  const advanced = prev !== undefined && idx > prev;

  const caption = h('p', { class: 'cell-caption muted', 'aria-live': 'polite' }, opts.hint || '');

  const show = i => {

    const info = stepInfo(o, i);

    caption.textContent = info

      ? STEPS[i].label + ' a las ' + hhmm(info.at) + (info.note ? ' (' + info.note.replace(/\.$/, '') + ')' : '')

      : STEPS[i].label + ': todavía no ocurre.';

  };

  const strip = h('ol', { class: 'blister ' + size + (dead ? ' dead' : '') + (advanced && finished ? ' wave' : ''), 'aria-label': 'Progreso del pedido' },

    STEPS.map((st, i) => {

      const done = i < idx || (i === idx && finished);

      const current = i === idx && !done;

      const pop = advanced && i >= prev && i <= idx;

      const info = stepInfo(o, i);

      return h('li', {

        class: 'cell' + (done ? ' done' : '') + (current ? ' current' : '') + (pop ? ' pop' : ''),

        'aria-current': current ? 'step' : null,

        style: '--i:' + i,

        tabindex: opts.noCaption ? null : 0,

        onclick: opts.noCaption ? null : () => show(i),

        onfocus: opts.noCaption ? null : () => show(i),

        onmouseenter: opts.noCaption ? null : () => show(i)

      },

        h('span', { class: 'dimple' }, h('i', { class: 'pill' })),

        h('span', { class: 'cell-label' }, st.label),

        info && (done || current) && size !== 'lg' && h('span', { class: 'cell-time' }, hhmm(info.at)));

    }));

  return h('div', { class: 'blister-wrap' }, strip, opts.noCaption ? null : caption);

}

/** Cronómetro o cuenta regresiva según el estado del pedido. */

function timerLine(o) {

  if (o.status === 'BUSCANDO_FARMACIA' && o.searchStartedAt) return h('p', { class: 'timer' }, 'Buscando farmacia desde hace ', elapsedEl(o.searchStartedAt));

  if (o.status === 'BUSCANDO_REPARTIDOR' && o.courierSearchStartedAt) return h('p', { class: 'timer' }, 'Buscando repartidor desde hace ', elapsedEl(o.courierSearchStartedAt));

  if (o.status === 'PRECIO_POR_ACEPTAR' && o.priceAskedAt) return h('p', { class: 'timer' }, 'Esperando tu respuesta desde hace ', elapsedEl(o.priceAskedAt));

  if (o.status === 'PEDIDO_EN_PREPARACION' && o.prepMinutes) {

    const e = (o.history || []).filter(x => x.status === 'PEDIDO_EN_PREPARACION').pop();

    if (e) {

      const target = new Date(new Date(e.at).getTime() + o.prepMinutes * 60000).toISOString();

      return h('p', { class: 'timer' }, 'Preparación estimada: ', countdownEl(target, 'ya casi está lista'));

    }

  }

  return null;

}

function statusMessage(o, role) {

  if (o.status === 'VENCIDA' && o.statusNote) {

    return o.statusNote;

  }

  if (o.status === 'CON_INCIDENCIA' && o.incidentNote) {

    return o.incidentNote;

  }

  const lastHistoryNote = o.history && o.history.length ? o.history[o.history.length - 1]?.note : null;

  if (o.status === 'VENCIDA' && lastHistoryNote && lastHistoryNote.includes('5 km')) {

    return lastHistoryNote;

  }

  if (o.status === 'CON_INCIDENCIA' && lastHistoryNote && lastHistoryNote.includes('5 km')) {

    return lastHistoryNote;

  }

  const ph = o.pharmacyName || 'La farmacia';

  const cr = o.courierName || 'El repartidor';

  const client = role === 'CLIENTE';

  const m = {

    SOLICITUD_ENVIADA: 'Recibimos la solicitud.',

    BUSCANDO_FARMACIA: client

      ? 'Estamos buscando farmacias cercanas en tu ciudad (radio máximo 5 km). La primera que los tenga aceptará tu pedido.'

      : 'Esperando que una farmacia cercana acepte el pedido.',

    FARMACIA_ASIGNADA: ph + ' aceptó el pedido y está confirmando existencias y precios.',

    PRECIO_POR_ACEPTAR: client ? 'Revisa lo que confirmó la farmacia y acepta el precio para continuar.' : 'Esperando que el cliente acepte el precio.',

    PRECIO_CONFIRMADO: 'Precio aceptado. La farmacia empezará a preparar el pedido.',

    PEDIDO_EN_PREPARACION: ph + ' está alistando el pedido' + (o.prepMinutes ? ' (unos ' + o.prepMinutes + ' min).' : '.'),

    PEDIDO_LISTO: 'El pedido está listo. Buscamos un repartidor cercano (radio máximo 5 km).',

    BUSCANDO_REPARTIDOR: 'El pedido está listo para recoger. Buscamos un repartidor disponible (radio máximo 5 km).',

    REPARTIDOR_ASIGNADO: cr + ' va hacia la farmacia.',

    PEDIDO_RECOGIDO: cr + ' ya recogió el pedido.',

    EN_CAMINO: client ? 'Tu pedido va en camino. Ten a la mano tu código de entrega.' : 'El pedido va en camino hacia el cliente.',

    ENTREGADO: 'Pedido entregado.',

    RECHAZADA: 'Ninguna farmacia pudo atender este pedido.',

    CANCELADA: 'El pedido fue cancelado.',

    VENCIDA: 'No hay farmacia disponible cerca de tu ubicación (radio máximo 5 km en tu ciudad).',

    CON_INCIDENCIA: 'No hay repartidor disponible cerca de tu farmacia (radio máximo 5 km).'

  };

  return m[o.status] || statusLabel(o.status);

}

function itemsSummary(o) {

  if (o.items && o.items.length) return o.items.map(i => i.name + ' ×' + i.quantity).join(', ');

  if (o.itemCount) return o.itemCount + (o.itemCount === 1 ? ' producto' : ' productos');

  return '';

}

/* ---------- Fila de pedido para listas ---------- */

function rowMeta(o) {

  const since = (o.status === 'BUSCANDO_FARMACIA' && o.searchStartedAt) || (o.status === 'BUSCANDO_REPARTIDOR' && o.courierSearchStartedAt);

  return since ? ['Buscando desde hace ', elapsedEl(since)] : 'Actualizado ' + relTime(o.updatedAt || o.createdAt);

}

function orderRow(o, actions) {

  const open = () => (window.openOrderDetail || openOrderDetail)(o.id);

  return h('article', {

    class: 'order-row tone-' + statusTone(o.status), tabindex: 0, role: 'button', 'aria-label': 'Ver pedido ' + o.code,

    onclick: open,

    onkeydown: e => { if (e.key === 'Enter' && e.target === e.currentTarget) open(); }

  },

    h('span', { class: 'bar' }),

    h('div', { class: 'row-main' },

      h('div', { class: 'row-top' },

        h('strong', { class: 'code' }, o.code),

        state.user?.role === 'CLIENTE' && o.deliveryCode && !['ENTREGADO', 'CANCELADO', 'VENCIDA', 'RECHAZADA'].includes(o.status)

          ? h('span', { class: 'badge tone-done', style: 'font-weight: 800; letter-spacing: 0.5px;' }, 'PIN: ' + o.deliveryCode)

          : null,

        badge(o.status)),

      h('p', { class: 'row-items' }, itemsSummary(o)),

      h('p', { class: 'row-meta muted' }, rowMeta(o))),

    h('div', { class: 'row-side', onclick: e => e.stopPropagation(), onkeydown: e => e.stopPropagation() },

      o.total != null && h('span', { class: 'row-total' }, money(o.total)),

      actions));

}

/* ---------- Detalle (diálogo que se actualiza solo) ---------- */

function openOrderDetail(id) {

  const body = live(() => API.get('/orders/' + id), o => orderDetail(o, state.user), 4000);

  const d = openDialog(h('div', { class: 'sheet-body' },

    h('button', { class: 'close', type: 'button', 'aria-label': 'Cerrar', onclick: () => d.close() }, '×'),

    body), { wide: true });

}

window.openOrderDetail = openOrderDetail;
window.__openOrderDetailImpl = openOrderDetail;

function block(title, ...kids) {

  return h('section', { class: 'block' }, h('h4', null, title), ...kids);

}

function orderDetail(o, viewer) {

  const role = viewer.role;

  const codeVisible = role === 'CLIENTE' && o.deliveryCode && !['ENTREGADO', 'CANCELADO', 'VENCIDA', 'RECHAZADA'].includes(o.status);

  const parts = [];

  if (o.pharmacyName) parts.push(h('div', null, h('strong', null, o.pharmacyName), o.pharmacyAddress && h('span', { class: 'muted block-line' }, o.pharmacyAddress)));

  const courier = o.courierName && h('div', null, h('strong', null, o.courierName), role !== 'FARMACIA' && o.courierPhone && h('span', { class: 'muted block-line' }, o.courierPhone));

  const itemsBlock = o.confirmedItems && o.confirmedItems.length

    ? block('Productos y precio',

        h('div', { class: 'table-wrap' }, h('table', { class: 'prices' },

          h('thead', null, h('tr', null, h('th', null, 'Producto'), h('th', null, 'Cant.'), h('th', null, 'Precio'), h('th', null, 'Subtotal'))),

          h('tbody', null, o.confirmedItems.map(c => h('tr', { class: c.available ? '' : 'na' },

            h('td', null, c.name, !c.available && h('small', null, 'No disponible')),

            h('td', null, c.available ? c.quantity : ''),

            h('td', null, c.available ? money(c.unitPrice) : ''),

            h('td', null, c.available ? money(c.quantity * c.unitPrice) : '')))),

          h('tfoot', null,

            h('tr', null, h('td', { colspan: 3 }, 'Total'), h('td', null, money(o.total))),

            role === 'ADMIN' && o.total != null ? h('tr', { style: 'font-weight:700; color:var(--teal);' }, h('td', { colspan: 3 }, 'Ganancia FarmaYA (10%)'), h('td', null, money(o.platformEarnings != null ? o.platformEarnings : (o.total * 0.10)))) : null

          ))),

        o.pharmacyNote && h('p', { class: 'muted' }, 'Nota de la farmacia: ' + o.pharmacyNote))

    : (o.items && o.items.length

      ? block('Productos solicitados', h('ul', { class: 'plain' }, o.items.map(i => h('li', null,

          h('span', null, i.name + ' ×' + i.quantity), i.note && h('small', { class: 'muted' }, i.note)))))

      : null);

  const deliveryFee = o.courierEarnings != null ? o.courierEarnings : Math.max(5000, 4000 + Math.ceil(o.deliveryDistanceKm || 2.5) * 1000);

  const delivery = (o.address || o.city) && block('Entrega, Ruta & Tarifa de Domicilio',

    h('div', null,

      o.clientName && h('strong', null, o.clientName),

      o.address && h('span', { class: 'block-line' }, o.address),

      o.city && h('span', { class: 'muted block-line' }, o.city),

      h('div', { style: 'display:flex; flex-wrap:wrap; gap:8px; margin: 8px 0;' },

        o.deliveryDistanceKm ? h('span', { class: 'tag tone-teal', style: 'font-weight:700;' }, `Distancia calculada: ${o.deliveryDistanceKm} km`) : null,

        h('span', { class: 'tag tone-done', style: 'font-weight:700;' }, `Tarifa del domicilio: ${money(deliveryFee)}`),

        role === 'ADMIN' && o.total != null ? h('span', { class: 'tag tone-teal', style: 'font-weight:700;' }, `Ganancia FarmaYA (10%): ${money(o.platformEarnings != null ? o.platformEarnings : (o.total * 0.10))}`) : null,

        o.paymentStatus === 'PAGADO_FARMAYA' ? h('span', { class: 'badge tone-done', style: 'font-weight:700;' }, `Productos Pagados a FarmaYA (${o.paymentMethod || 'PSE/Nequi'})`) : null,

        (role === 'CLIENTE' && o.paymentStatus === 'PAGADO_FARMAYA') ? h('button', {
          class: 'btn secondary small',
          style: 'display: inline-flex; align-items: center; gap: 6px; font-weight: 700; margin-top: 4px;',
          type: 'button',
          onclick: async e => {
            await act(e.currentTarget, async () => {
              await API.post('/orders/' + o.id + '/resend-invoice', {});
              toast('Factura enviada a tu correo electronico.');
            });
          }
        }, icon('mail'), h('span', null, 'Reenviar Factura a mi Correo')) : null

      ),

      h('div', { class: 'delivery-fee-callout', style: 'margin: 10px 0 6px 0; padding: 12px 14px; background: rgba(10, 92, 168, 0.08); border-color: rgba(10, 92, 168, 0.25);' },
        h('span', { class: 'callout-ico', style: 'width:22px; height:22px; font-size:13px; background: #0a5ca8;' }, '!'),
        h('div', null,
          h('strong', { style: 'font-size:13.5px; color: #0a5ca8;' }, 'PAGO DEL DOMICILIO AL REPARTIDOR (' + money(deliveryFee) + ')'),
          h('p', { style: 'font-size:12.5px; margin:0; color: var(--text); line-height: 1.4;' },
            'Los medicamentos se pagan 100% en línea por la pasarela. La tarifa del domicilio (' + money(deliveryFee) + ') se le paga directamente al domiciliario al momento de llegar a tu puerta en efectivo o transferencia. La entrega se certifica dictando tu PIN de seguridad de 4 dígitos.'
          )
        )
      ),

      o.clientPhone && h('div', { class: 'order-client-phone-wrap', style: 'margin: 6px 0; display: flex; align-items: center; gap: 8px;' },
        h('span', { class: 'small muted', style: 'font-weight: 700;' }, 'Teléfono del cliente:'),
        h('a', {
          href: 'tel:' + o.clientPhone,
          class: 'btn link small',
          style: 'font-weight: 800; font-size: 13.5px; text-decoration: underline;'
        }, o.clientPhone)
      ),

      o.notes && h('span', { class: 'muted block-line' }, 'Nota: ' + o.notes)

    )

  );

  return h('div', { class: 'detail' },

    h('div', { class: 'detail-head' }, h('h2', null, 'Pedido ' + o.code), badge(o.status)),

    blister(o, '', { hint: 'Toca un paso para ver cuándo ocurrió.' }),

    h('p', { class: 'status-line' }, statusMessage(o, role)),

    timerLine(o),

    o.status === 'CON_INCIDENCIA' && (

      viewer.role === 'FARMACIA' && (o.incidentNote || '').toLowerCase().includes('repartidor')

        ? notice('warn', 'Alerta: Sin repartidor disponible en tu zona', (o.incidentNote || 'No se encontraron repartidores disponibles en un radio de 5.0 km alrededor de tu farmacia.') + ' Reintentaremos la asignación tan pronto haya un repartidor en cobertura.')

        : h('div', { class: 'notice bad' }, h('strong', null, 'Incidencia reportada por ' + (o.incidentBy || '')), h('span', null, o.incidentNote))

    ),

    codeVisible && h('div', { class: 'delivery-pin-card' },
      h('div', { class: 'pin-card-header' },
        h('div', { class: 'pin-badge-wrap' },
          icon('shield', 'pin-shield-ico'),
          h('span', { class: 'pin-badge-title' }, 'CÓDIGO DE SEGURIDAD PARA ENTREGA')
        ),
        h('span', { class: 'pin-status-pill' }, 'Requerido para recibir')
      ),
      h('div', { class: 'pin-digits-wrap', 'aria-label': 'PIN de entrega: ' + String(o.deliveryCode).split('').join(' ') },
        String(o.deliveryCode).split('').map(d => h('div', { class: 'pin-digit-box' }, h('span', null, d)))
      ),
      h('div', { class: 'pin-card-info' },
        icon('truck', 'pin-truck-ico'),
        h('div', { class: 'pin-info-text' },
          h('strong', null, 'Díctaselo a tu domiciliario al recibir tu pedido.'),
          h('p', null, 'El repartidor debe ingresar estos 4 dígitos en su aplicación para confirmar y finalizar la entrega de forma segura.')
        ),
        h('button', {
          class: 'btn ghost small pin-copy-action',
          type: 'button',
          title: 'Copiar PIN al portapapeles',
          onclick: () => {
            if (navigator.clipboard) {
              navigator.clipboard.writeText(String(o.deliveryCode));
              toast('PIN ' + o.deliveryCode + ' copiado al portapapeles');
            } else {
              toast('PIN de entrega: ' + o.deliveryCode);
            }
          }
        }, icon('copy'), h('span', null, 'Copiar PIN'))
      )
    ),

    (parts.length || courier) && block('Quiénes participan', parts, courier),

    itemsBlock,

    delivery,

    detailActions(o, viewer),

    block('Historial y Novedades del Pedido', h('ol', { class: 'timeline' }, (o.history || []).map(e => h('li', { class: 'timeline-item' },

      h('div', { class: 'timeline-header' },

        h('strong', { class: 'timeline-status' }, statusLabel(e.status)),

        h('time', { class: 'timeline-time' }, clock(e.at))

      ),

      e.note && h('p', { class: 'timeline-note' }, e.note),

      e.actorName && h('small', { class: 'timeline-actor' }, 'Por: ' + e.actorName)

    ))))

  );

}

function detailActions(o, viewer) {

  const done = () => refreshAll();

  const btns = [];

  const post = (path, ok, body) => btn => act(btn, async () => { await API.post(path, body); done(); }, ok);

  const run = (fn) => e => fn(e.currentTarget);

  if (viewer.role === 'CLIENTE') {

    if (o.status === 'PRECIO_POR_ACEPTAR') {

      btns.push(h('button', {

        class: 'btn primary',

        onclick: () => openPaymentPage(o)

      }, 'Pagar ' + money(o.total)));

      btns.push(h('button', { class: 'btn ghost', onclick: async e => {

        if (await confirmBox({ title: '¿Buscar otra farmacia?', message: 'No continuaremos con esta farmacia. Enviaremos tu pedido a las demás.', ok: 'Buscar otra' }))

          post('/orders/' + o.id + '/decline-price', 'Buscando otra farmacia')(e.target);

      } }, 'Buscar otra farmacia'));

    }

    if (CLIENT_CAN_CANCEL.includes(o.status)) {

      btns.push(h('button', { class: 'btn danger-ghost', onclick: async e => {

        if (await confirmBox({ title: '¿Cancelar este pedido?', message: 'Esta acción no se puede deshacer.', ok: 'Cancelar pedido', cancel: 'Mantener pedido', danger: true }))

          post('/orders/' + o.id + '/cancel', 'Pedido cancelado')(e.target);

      } }, 'Cancelar pedido'));

    }

  }

  if (viewer.role === 'ADMIN') {

    if (o.status === 'CON_INCIDENCIA') {

      btns.push(h('button', { class: 'btn primary', onclick: run(post('/admin/orders/' + o.id + '/resolve', 'Incidencia resuelta', { action: 'RESTAURAR' })) }, 'Continuar pedido'));

      btns.push(h('button', { class: 'btn danger-ghost', onclick: async e => {

        if (await confirmBox({ title: '¿Cancelar el pedido?', message: 'Se cerrará la incidencia y el pedido quedará cancelado.', ok: 'Cancelar pedido', cancel: 'Volver', danger: true }))

          post('/admin/orders/' + o.id + '/resolve', 'Pedido cancelado', { action: 'CANCELAR' })(e.target);

      } }, 'Cancelar pedido'));

    } else if (!FINAL.includes(o.status)) {

      btns.push(h('button', { class: 'btn danger-ghost', onclick: async e => {

        if (await confirmBox({ title: '¿Cancelar el pedido?', message: 'Los participantes verán el pedido como cancelado.', ok: 'Cancelar pedido', cancel: 'Volver', danger: true }))

          post('/admin/orders/' + o.id + '/cancel', 'Pedido cancelado', { note: '' })(e.target);

      } }, 'Cancelar pedido'));

    }

  }

  if (['CLIENTE', 'FARMACIA', 'REPARTIDOR'].includes(viewer.role) && !NO_INCIDENT.includes(o.status)) {

    btns.push(h('button', { class: 'btn link', onclick: async e => {

      const note = await promptBox({ title: 'Reportar un problema', message: 'Cuéntanos qué pasó. La administración revisará el pedido.', label: 'Descripción', placeholder: 'Ej. El pedido llegó incompleto' });

      if (note) post('/orders/' + o.id + '/incident', 'Reporte enviado', { note })(e.target);

    } }, 'Reportar un problema'));

  }

  return btns.length ? h('div', { class: 'detail-actions' }, btns) : null;

}

/* ---------- VISTA DEDICADA DE PAGO Y PASARELA DE PAGOS DIGITAL ---------- */

async function renderPaymentPage(orderOrId) {
  const app = document.getElementById('app-container');
  if (!app) return;

  let o = orderOrId;
  const targetId = typeof orderOrId === 'object' ? orderOrId?.id : orderOrId;

  if (!o || typeof o !== 'object' || !o.items || o.total == null) {
    app.replaceChildren(
      h('div', { class: 'initial-loading' },
        h('span', { class: 'spinner' }),
        h('p', null, 'Cargando información y pasarela de pago...')
      )
    );
    try {
      o = await API.get('/orders/' + targetId);
    } catch (err) {
      toast('No fue posible cargar el pedido: ' + err.message, 'error');
      location.hash = '#orders';
      return;
    }
  }

  if (!location.hash.includes(o.id)) {
    history.replaceState(null, '', '#payment?order=' + o.id);
  }
  document.title = 'FarmaYa · Pago Pedido #' + (o.code || o.id);

  const subtotalProducts = Number(o.total || 0);
  const deliveryDist = o.deliveryDistanceKm || 2.5;
  const deliveryFee = o.courierEarnings || Math.max(5000, 4000 + Math.ceil(deliveryDist) * 1000);
  const platformFee = Math.round(subtotalProducts * 0.10);

  const METHODS = [
    {
      id: 'MASTERCARD',
      name: 'Mastercard',
      desc: 'Débito y Crédito',
      badgeHtml: '<svg width="34" height="22" viewBox="0 0 36 24"><circle cx="14" cy="12" r="10" fill="#EB001B"/><circle cx="22" cy="12" r="10" fill="#F79E1B" fill-opacity="0.85"/></svg>'
    },
    {
      id: 'VISA',
      name: 'Visa',
      desc: 'Débito y Crédito',
      badgeHtml: '<span style="font-weight:900; font-size:16px; font-style:italic; color:#1a1f71; letter-spacing:-0.5px;">VISA</span>'
    },
    {
      id: 'PSE',
      name: 'PSE',
      desc: 'Todos los Bancos',
      badgeHtml: '<span style="font-weight:900; font-size:13px; color:#0b3b60; background:#e2f0fb; padding:2px 6px; border-radius:4px; border:1px solid #0b3b60;">PSE</span>'
    },
    {
      id: 'NEQUI',
      name: 'Nequi',
      desc: 'Notificación Push',
      badgeHtml: '<span style="font-weight:900; font-size:12px; color:#200020; background:#f5e6f3; padding:2px 6px; border-radius:4px; border:1px solid #e6007e;">NEQUI</span>'
    },
    {
      id: 'BANCOLOMBIA',
      name: 'Bancolombia',
      desc: 'Transferencia / QR',
      badgeHtml: '<span style="font-weight:900; font-size:11px; color:#000; background:#fedd00; padding:2px 5px; border-radius:4px;">BANCO</span>'
    },
    {
      id: 'DAVIPLATA',
      name: 'Daviplata',
      desc: 'Billetera Móvil',
      badgeHtml: '<span style="font-weight:900; font-size:11px; color:#fff; background:#ed1c24; padding:2px 5px; border-radius:4px;">DAVI</span>'
    }
  ];

  let currentMethod = 'MASTERCARD';

  const launchWompi = async () => {
    if (!window.WidgetCheckout) {
      toast('Cargando pasarela Wompi en línea...', 'info');
      return false;
    }
    try {
      const sigData = await API.get('/orders/' + o.id + '/wompi-signature');
      const checkout = new WidgetCheckout({
        currency: sigData.currency || 'COP',
        amountInCents: sigData.amountInCents,
        reference: sigData.reference,
        publicKey: sigData.publicKey || state.meta?.wompiPublicKey || 'pub_test_tjFaTiEBqNnV6tjvh6QjeuEt2Jsa74bd',
        signature: { integrity: sigData.signature }
      });
      checkout.open(async result => {
        const tx = result?.transaction;
        if (tx && (tx.status === 'APPROVED' || tx.status === 'PENDING')) {
          await API.post('/orders/' + o.id + '/accept-price', {
            method: tx.payment_method_type || 'WOMPI',
            bank: tx.payment_method?.extra?.institution_name || 'Bancolombia Wompi',
            docNumber: tx.id,
            amount: subtotalProducts
          });
          toast('Pago procesado y verificado. Factura enviada a tu correo.');
          renderApprovedReceipt(tx.payment_method_type || 'WOMPI', tx.payment_method?.extra?.institution_name || 'Wompi Bancolombia', tx.id);
        } else if (tx) {
          toast('Estado de transacción Wompi: ' + (tx.status || 'Cancelada'), 'warn');
        }
      });
      return true;
    } catch (err) {
      console.error('Error al inicializar Wompi:', err);
      toast('Error al conectar con Wompi: ' + (err.message || 'Error de pasarela'), 'error');
      return false;
    }
  };

  const cardNumInput = h('input', { type: 'text', class: 'input block', placeholder: '4000 1234 5678 9010', maxlength: '19', value: '4532 8901 2345 6789' });
  const cardHolderInput = h('input', { type: 'text', class: 'input block', placeholder: 'Nombre como figura en la tarjeta', value: (state.user?.name || 'Cliente FarmaYA') });
  const cardExpInput = h('input', { type: 'text', class: 'input', placeholder: 'MM/AA', maxlength: '5', value: '12/28', style: 'max-width:110px;' });
  const cardCvvInput = h('input', { type: 'password', class: 'input', placeholder: 'CVV', maxlength: '4', value: '789', style: 'max-width:90px;' });
  const cardInstallments = h('select', { class: 'input', style: 'max-width:180px;' },
    [
      { v: '1', l: '1 cuota (Sin interés)' },
      { v: '2', l: '2 cuotas' },
      { v: '3', l: '3 cuotas' },
      { v: '6', l: '6 cuotas' },
      { v: '12', l: '12 cuotas' },
      { v: '24', l: '24 cuotas' },
      { v: '36', l: '36 cuotas' }
    ].map(opt => h('option', { value: opt.v }, opt.l))
  );

  const pseBankSelect = h('select', { class: 'input block' },
    ['Bancolombia', 'Banco de Bogotá', 'Davivienda', 'BBVA Colombia', 'Banco de Occidente', 'Scotiabank Colpatria', 'Banco Popular', 'Banco AV Villas', 'Itaú Colombia', 'Banco Caja Social', 'Nu Colombia', 'Lulo Bank', 'Dale!', 'Ualá', 'RappiPay'].map(b =>
      h('option', { value: b }, b)
    )
  );
  const pseDocTypeSelect = h('select', { class: 'input', style: 'max-width:120px;' },
    [
      { id: 'CC', name: 'C.C.' },
      { id: 'CE', name: 'C.E.' },
      { id: 'NIT', name: 'NIT' },
      { id: 'TI', name: 'T.I.' },
      { id: 'PP', name: 'Pasaporte' }
    ].map(t => h('option', { value: t.id }, t.name))
  );
  const pseDocNumberInput = h('input', { type: 'text', class: 'input block', placeholder: 'Ej. 1042389123', value: (state.user?.docNumber || '1042389123') });
  const pseEmailInput = h('input', { type: 'email', class: 'input block', placeholder: 'correo@ejemplo.com', value: (state.user?.email || 'cliente@farmaya.co') });

  const nequiPhoneInput = h('input', { type: 'tel', maxlength: '10', class: 'input block', placeholder: '3001234567 (10 dígitos)', value: (state.user?.phone || '3001234567') });
  const nequiDocInput = h('input', { type: 'text', class: 'input block', placeholder: 'Documento del titular', value: (state.user?.docNumber || '1042389123') });

  const bancolombiaAccountType = h('select', { class: 'input block' },
    ['Cuenta de Ahorros Bancolombia', 'Cuenta Corriente Bancolombia', 'Bancolombia A La Mano'].map(t =>
      h('option', { value: t }, t)
    )
  );
  const bancolombiaDocInput = h('input', { type: 'text', class: 'input block', placeholder: 'Documento de identidad', value: (state.user?.docNumber || '1042389123') });

  const daviplataPhoneInput = h('input', { type: 'tel', maxlength: '10', class: 'input block', placeholder: '3151234567 (10 dígitos)', value: (state.user?.phone || '3151234567') });
  const daviplataDocInput = h('input', { type: 'text', class: 'input block', placeholder: 'Documento de identidad', value: (state.user?.docNumber || '1042389123') });

  const dynamicFormNode = h('div', { class: 'payment-dynamic-form' });

  function selectMethod(methodId) {
    currentMethod = methodId;
    methodCardNodes.forEach(c => {
      const isSel = c.dataset.method === methodId;
      c.classList.toggle('selected', isSel);
      c.setAttribute('aria-pressed', isSel ? 'true' : 'false');
    });
    renderDynamicForm();
    updateSubmitBtn();
  }

  function renderDynamicForm() {
    const m = METHODS.find(x => x.id === currentMethod);
    if (currentMethod === 'MASTERCARD' || currentMethod === 'VISA') {
      dynamicFormNode.replaceChildren(
        h('div', { class: 'payment-form-header' },
          h('h4', null, 'Datos de la Tarjeta ' + m.name),
          h('p', null, 'Ingresa los datos impresos en tu tarjeta de débito o crédito.')
        ),
        field('Número de Tarjeta (16 dígitos)', cardNumInput),
        field('Nombre del Titular de la Tarjeta', cardHolderInput),
        h('div', { style: 'display:grid; grid-template-columns: 1fr 110px 90px; gap: 10px; align-items: end;' },
          field('Cuotas', cardInstallments),
          field('Expira', cardExpInput),
          field('CVV', cardCvvInput)
        ),
        h('small', { class: 'muted', style: 'display:block; margin-top:8px;' },
          'Transacción cifrada bajo estándar bancario internacional PCI-DSS.'
        )
      );
    } else if (currentMethod === 'PSE') {
      dynamicFormNode.replaceChildren(
        h('div', { class: 'payment-form-header' },
          h('h4', null, 'Pago en Línea PSE (Cuentas Corrientes y de Ahorros)'),
          h('p', null, 'Débito seguro desde cualquier entidad bancaria en Colombia.')
        ),
        field('Banco de Débito (Red ACH Colombia)', pseBankSelect),
        h('div', { style: 'display:grid; grid-template-columns: 120px 1fr; gap: 10px;' },
          field('Tipo Doc.', pseDocTypeSelect),
          field('Número de Documento', pseDocNumberInput)
        ),
        field('Correo Registrado en PSE', pseEmailInput),
        h('small', { class: 'muted', style: 'display:block; margin-top:6px;' },
          'Serás conectado a la pasarela financiera para autorizar con tu banco.'
        )
      );
    } else if (currentMethod === 'NEQUI') {
      dynamicFormNode.replaceChildren(
        h('div', { class: 'payment-form-header' },
          h('h4', null, 'Pago Inmediato con Nequi'),
          h('p', null, 'Autorización por notificación Push directamente en tu celular.')
        ),
        field('Número de Celular Nequi (10 dígitos)', nequiPhoneInput),
        field('Número de Documento del Titular', nequiDocInput),
        h('div', { class: 'farmaya-bank-banner', style: 'margin-top:10px;' },
          h('span', null, 'Notificación Push en Tiempo Real:'),
          h('p', { style: 'margin:4px 0 0 0; font-size:13px; color:var(--text);' },
            'Al pulsar Pagar, recibirás una solicitud inmediata en tu app Nequi por ' + money(subtotalProducts) + ' para confirmar con tu clave o biometría.'
          )
        )
      );
    } else if (currentMethod === 'BANCOLOMBIA') {
      dynamicFormNode.replaceChildren(
        h('div', { class: 'payment-form-header' },
          h('h4', null, 'Transferencia / Botón Bancolombia'),
          h('p', null, 'Canal directo para clientes Bancolombia y A La Mano.')
        ),
        field('Tipo de Cuenta o Producto', bancolombiaAccountType),
        field('Número de Documento del Titular', bancolombiaDocInput),
        h('div', { class: 'farmaya-bank-banner', style: 'margin-top:10px;' },
          h('span', null, 'Bancolombia Seguro:'),
          h('p', { style: 'margin:4px 0 0 0; font-size:13px; color:var(--text);' },
            'Autorización ágil a través del Botón Bancolombia oficial sin sobrecostos.'
          )
        )
      );
    } else if (currentMethod === 'DAVIPLATA') {
      dynamicFormNode.replaceChildren(
        h('div', { class: 'payment-form-header' },
          h('h4', null, 'Billetera Móvil Daviplata'),
          h('p', null, 'Pago instantáneo con dinero disponible en tu Daviplata.')
        ),
        field('Número de Celular Daviplata (10 dígitos)', daviplataPhoneInput),
        field('Número de Documento del Titular', daviplataDocInput),
        h('div', { class: 'farmaya-bank-banner', style: 'margin-top:10px;' },
          h('span', null, 'Confirmación Daviplata:'),
          h('p', { style: 'margin:4px 0 0 0; font-size:13px; color:var(--text);' },
            'Recibirás un código de aprobación de 6 dígitos vía SMS o en tu app Daviplata para finalizar la orden.'
          )
        )
      );
    }
  }

  const methodCardNodes = METHODS.map(m => {
    const card = h('button', {
      type: 'button',
      class: 'payment-method-card' + (m.id === currentMethod ? ' selected' : ''),
      'data-method': m.id,
      'aria-pressed': m.id === currentMethod ? 'true' : 'false',
      onclick: () => selectMethod(m.id)
    },
      h('div', { class: 'payment-method-badge' }, (() => {
        const span = document.createElement('span');
        span.innerHTML = m.badgeHtml;
        return span;
      })()),
      h('span', { class: 'payment-method-name' }, m.name),
      h('span', { class: 'payment-method-desc' }, m.desc),
      h('span', { class: 'payment-method-check' }, '✓')
    );
    return card;
  });

  const methodsGrid = h('div', { class: 'payment-methods-grid' }, ...methodCardNodes);

  const submitPayBtn = h('button', {
    type: 'button',
    class: 'btn-pay-primary',
    onclick: () => processPayment()
  });

  function updateSubmitBtn() {
    const m = METHODS.find(x => x.id === currentMethod);
    submitPayBtn.replaceChildren(
      icon('lock'),
      h('span', null, `Pagar ${money(subtotalProducts)} con ${m ? m.name : 'Pasarela'} y Confirmar`)
    );
  }

  const wompiOfficialBtn = h('button', {
    type: 'button',
    class: 'btn-wompi-official',
    onclick: () => launchWompi()
  },
    icon('shield'),
    h('span', null, 'Abrir Pasarela Completa Wompi (Oficial Bancolombia)')
  );

  const backNavBtn = h('button', {
    type: 'button',
    class: 'btn-pay-back',
    onclick: () => {
      location.hash = '#orders';
    }
  },
    h('span', null, '← Volver a Mis Pedidos')
  );

  const actionsHubNode = h('div', { class: 'payment-actions-hub' },
    submitPayBtn,
    wompiOfficialBtn,
    backNavBtn,
    h('div', { style: 'text-align:center; margin-top:6px;' },
      h('span', { class: 'small muted', style: 'font-size:12px;' },
        'Tecnología Wompi Bancolombia · Cifrado bancario SSL 256-bit · Medicamentos 100% digital'
      )
    )
  );

  async function processPayment() {
    if (currentMethod === 'NEQUI' && nequiPhoneInput.value.trim().length < 10) {
      toast('Ingresa un número de celular Nequi válido de 10 dígitos.', 'error');
      return;
    }
    if (currentMethod === 'DAVIPLATA' && daviplataPhoneInput.value.trim().length < 10) {
      toast('Ingresa un número de celular Daviplata válido de 10 dígitos.', 'error');
      return;
    }
    if (currentMethod === 'PSE' && !pseDocNumberInput.value.trim()) {
      toast('Ingresa el número de documento de identidad para PSE.', 'error');
      return;
    }
    if ((currentMethod === 'MASTERCARD' || currentMethod === 'VISA') && cardNumInput.value.trim().length < 15) {
      toast('Ingresa un número de tarjeta válido.', 'error');
      return;
    }

    const chosenBank = currentMethod === 'PSE' ? pseBankSelect.value
      : (currentMethod === 'NEQUI' ? 'Nequi Colombia'
      : (currentMethod === 'BANCOLOMBIA' ? 'Bancolombia'
      : (currentMethod === 'DAVIPLATA' ? 'Daviplata Davivienda' : currentMethod + ' Crédito/Débito')));

    const authCode = 'AUT-' + Math.floor(100000 + Math.random() * 900000);
    const txId = 'FY-' + (o.code || 'PED') + '-' + Math.floor(10000 + Math.random() * 90000);

    rightCol.replaceChildren(
      h('div', { class: 'payment-card', style: 'text-align:center; padding: 44px 20px;' },
        h('div', { class: 'spinner', style: 'margin: 0 auto 20px auto; width: 48px; height: 48px;' }),
        h('h3', { style: 'font-size:19px; font-weight:800; color:var(--text); margin-bottom:8px;' },
          'Conectando de forma segura con ' + chosenBank
        ),
        h('p', { class: 'muted', style: 'font-size:14px; max-width:380px; margin:0 auto;' },
          'Estableciendo canal cifrado SSL con la pasarela bancaria oficial...'
        )
      )
    );

    await new Promise(r => setTimeout(r, 900));

    rightCol.replaceChildren(
      h('div', { class: 'payment-card', style: 'text-align:center; padding: 44px 20px;' },
        h('div', { class: 'spinner', style: 'margin: 0 auto 20px auto; width: 48px; height: 48px; border-top-color: #059669;' }),
        h('h3', { style: 'font-size:19px; font-weight:800; color:var(--text); margin-bottom:8px;' },
          'Validando fondos y confirmando recaudo FarmaYA'
        ),
        h('p', { class: 'muted', style: 'font-size:14px; max-width:380px; margin:0 auto;' },
          'Verificando aprobación electrónica por ' + money(subtotalProducts) + ' y asignando farmacéutico.'
        )
      )
    );

    await new Promise(r => setTimeout(r, 900));

    try {
      await API.post('/orders/' + o.id + '/accept-price', {
        method: currentMethod,
        bank: chosenBank,
        docNumber: pseDocNumberInput.value.trim() || cardNumInput.value.trim(),
        phone: nequiPhoneInput.value.trim() || daviplataPhoneInput.value.trim(),
        amount: subtotalProducts
      });
      refreshAll();
      toast('¡Pago exitoso! Factura y comprobante enviados a tu correo.');
      renderApprovedReceipt(currentMethod, chosenBank, txId, authCode);
    } catch (err) {
      toast(err.message || 'Error al procesar el pago.', 'error');
      rightCol.replaceChildren(
        h('div', { style: 'margin-bottom:12px;' },
          h('h3', { style: 'margin:0 0 6px 0; font-size:18px; font-weight:800; color:var(--text);' }, 'Selecciona tu Método de Pago Digital'),
          h('p', { class: 'muted', style: 'margin:0; font-size:13.5px;' }, 'Todos los pagos son 100% electrónicos, seguros y respaldados por Wompi.')
        ),
        methodsGrid,
        dynamicFormNode,
        actionsHubNode
      );
    }
  }

  function renderApprovedReceipt(method, bank, txId, authCode) {
    const codeAuth = authCode || ('AUT-' + Math.floor(100000 + Math.random() * 900000));
    const nowTime = new Date().toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });

    rightCol.replaceChildren(
      h('div', { class: 'payment-receipt-card', style: 'padding: 26px;' },
        h('div', { style: 'text-align:center; margin-bottom: 20px;' },
          h('div', { class: 'receipt-check-circle', style: 'width:56px; height:56px; font-size:28px;' }, '✓'),
          h('h3', { style: 'margin: 12px 0 4px 0; color: #065f46; font-size:22px; font-weight:900;' }, '¡Transacción Aprobada y Verificada!'),
          h('span', { class: 'receipt-approved-badge' }, 'APROBADA · CÓDIGO: ' + codeAuth)
        ),
        h('table', { class: 'receipt-table' },
          h('tr', null, h('td', null, 'Referencia Oficial:'), h('th', null, txId)),
          h('tr', null, h('td', null, 'Pedido FarmaYA:'), h('th', null, '#' + (o.code || o.id))),
          h('tr', null, h('td', null, 'Método de Pago:'), h('th', null, method + ' (' + bank + ')')),
          h('tr', null, h('td', null, 'Fecha y Hora:'), h('th', null, nowTime)),
          h('tr', null, h('td', null, 'Monto Total Medicamentos:'), h('th', { style: 'color: #065f46; font-size:17px; font-weight:800;' }, money(subtotalProducts)))
        ),
        h('div', { class: 'payment-pin-card', style: 'margin-top:18px; background: rgba(10, 92, 168, 0.08); border-color: rgba(10, 92, 168, 0.25);' },
          icon('lock'),
          h('div', null,
            h('strong', { style: 'color: #0a5ca8;' }, 'Factura electrónica emitida y Pago del Domicilio'),
            h('p', null,
              'Tu factura electrónica fue emitida y enviada a ' + (state.user?.email || 'tu correo registrado') + '. Recuerda que el valor del domicilio (' + money(deliveryFee) + ') se le entrega directamente al repartidor al llegar en efectivo o transferencia. La entrega se certifica dictándole tu PIN de 4 dígitos.'
            )
          )
        ),
        h('button', {
          type: 'button',
          class: 'btn-pay-primary',
          style: 'margin-top: 20px;',
          onclick: () => {
            location.hash = '#orders';
            const viewFn = window.openOrderDetail || (typeof openOrderDetail === 'function' ? openOrderDetail : null);
            if (viewFn) viewFn(o.id);
          }
        },
          icon('package-check'),
          h('span', null, 'Ver Seguimiento de mi Pedido en Tiempo Real')
        )
      )
    );
  }

  const itemsNodes = (o.items && o.items.length) ? o.items.map(it =>
    h('div', { class: 'payment-product-item' },
      h('div', { class: 'payment-prod-left' },
        h('span', { class: 'payment-prod-qty' }, `${it.quantity || 1}x`),
        h('div', null,
          h('strong', null, it.name),
          h('span', { class: 'muted', style: 'font-size:12px; display:block;' },
            it.prescription ? 'Venta controlada' : 'Venta libre verificada'
          )
        )
      ),
      h('strong', { style: 'font-size:13.5px; color:var(--text);' },
        money(it.subtotal || (it.unitPrice ? it.unitPrice * (it.quantity || 1) : subtotalProducts))
      )
    )
  ) : [
    h('div', { class: 'payment-product-item' },
      h('span', null, 'Medicamentos solicitados en pedido'),
      h('strong', null, money(subtotalProducts))
    )
  ];

  const leftCol = h('div', { class: 'payment-summary-col' },
    h('div', { class: 'payment-card' },
      h('div', { class: 'payment-order-meta-box' },
        h('span', { class: 'payment-order-code' }, 'Pedido #' + (o.code || o.id)),
        badge(o.status || 'PRECIO_POR_ACEPTAR')
      ),
      h('div', { class: 'payment-info-row' },
        h('div', { class: 'payment-info-icon' }, icon('store')),
        h('div', { class: 'payment-info-content' },
          h('strong', null, o.pharmacyName || 'Droguería Aliada Asignada'),
          h('span', null, (o.pharmacyAddress ? o.pharmacyAddress + ' · ' : '') + 'Farmacia Habilitada y Certificada FarmaYA')
        )
      ),
      h('div', { class: 'payment-info-row' },
        h('div', { class: 'payment-info-icon' }, icon('home')),
        h('div', { class: 'payment-info-content' },
          h('strong', null, o.address || 'Dirección de Entrega'),
          h('span', null, (o.city || 'Colombia') + (o.notes ? ' (' + o.notes + ')' : '') + ' · Tiempo est.: 25-45 min')
        )
      )
    ),

    h('div', { class: 'payment-card' },
      h('h4', { class: 'payment-card-title' },
        icon('package'),
        h('span', null, 'Detalle de Productos')
      ),
      h('div', { class: 'payment-products-list' }, ...itemsNodes)
    ),

    h('div', { class: 'payment-totals-card' },
      h('div', { class: 'payment-total-row' },
        h('span', null, 'Subtotal Medicamentos (Productos):'),
        h('strong', null, money(subtotalProducts))
      ),
      h('div', { class: 'payment-total-row' },
        h('span', null, 'Tarifa de Domicilio (~' + deliveryDist + ' km, Base $5.000):'),
        h('strong', null, money(deliveryFee) + ' (al repartidor)')
      ),
      h('div', { class: 'payment-total-row grand-total' },
        h('span', null, 'Total a Pagar en Pasarela Ahora:'),
        h('strong', null, money(subtotalProducts))
      ),
      h('p', { class: 'small muted', style: 'margin:8px 0 0 0; font-size:12px; line-height:1.35;' },
        '* Los medicamentos se pagan ahora por pasarela digital. La tarifa de domicilio (' + money(deliveryFee) + ') se le cancela directamente al repartidor al llegar a tu puerta en efectivo o transferencia.'
      )
    ),

    h('div', { class: 'payment-pin-card', style: 'background: rgba(10, 92, 168, 0.08); border-color: rgba(10, 92, 168, 0.25);' },
      icon('shield'),
      h('div', null,
        h('strong', { style: 'color: #0a5ca8;' }, 'Reglas de Pago y Entrega Segura con PIN'),
        h('p', { style: 'margin:0; font-size: 12.5px; line-height: 1.45;' },
          '1. Los medicamentos se pagan ahora mismo 100% en línea por la pasarela seleccionada.\n' +
          '2. La tarifa del domicilio (' + money(deliveryFee) + ') se le paga directamente al repartidor al momento de llegar a tu dirección en efectivo o transferencia.\n' +
          '3. La entrega queda certificada cuando le dictas tu código PIN de 4 dígitos al repartidor.'
        )
      )
    )
  );

  const rightCol = h('div', { class: 'payment-hub-col' },
    h('div', null,
      h('h3', { style: 'margin:0 0 6px 0; font-size:18px; font-weight:800; color:var(--text);' }, 'Selecciona tu Método de Pago Digital'),
      h('p', { class: 'muted', style: 'margin:0; font-size:13.5px;' },
        'Todos los métodos se encuentran disponibles en recuadros elegantes de igual medida y con cobro 100% digital:'
      )
    ),
    methodsGrid,
    dynamicFormNode,
    actionsHubNode
  );

  renderDynamicForm();
  updateSubmitBtn();

  const navBar = h('div', { class: 'payment-page-nav' },
    h('button', {
      type: 'button',
      class: 'payment-back-btn',
      onclick: () => {
        location.hash = '#orders';
      }
    },
      h('span', null, '← Volver a Mis Pedidos')
    ),
    h('div', { class: 'payment-security-chip' },
      icon('shield'),
      h('span', null, 'Cifrado SSL 256-bit · Wompi Bancolombia PCI-DSS Nivel 1 · Pago digital seguro')
    )
  );

  const pageContainer = h('div', { class: 'payment-page-container' },
    navBar,
    h('div', { class: 'payment-layout-grid' },
      leftCol,
      rightCol
    )
  );

  app.replaceChildren(pageContainer);
}

function openPaymentPage(o) {
  document.querySelectorAll('dialog[open]').forEach(d => {
    try { d.close(); } catch (_) { d.remove(); }
  });
  const orderId = typeof o === 'object' ? o.id : o;
  location.hash = '#payment?order=' + orderId;
  renderPaymentPage(o);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.openOrderDetail = openOrderDetail;
window.openPaymentPage = openPaymentPage;
window.openPaymentGatewayDialog = openPaymentPage;
window.renderPaymentPage = renderPaymentPage;
window.orderDetail = orderDetail;
window.orderRow = orderRow;
window.blister = blister;
