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
  const ph = o.pharmacyName || 'La farmacia';
  const cr = o.courierName || 'El repartidor';
  const client = role === 'CLIENTE';
  const m = {
    SOLICITUD_ENVIADA: 'Recibimos la solicitud.',
    BUSCANDO_FARMACIA: client
      ? 'Estamos preguntando a las farmacias si tienen tus productos. La primera que los tenga aceptará tu pedido.'
      : 'Esperando que una farmacia acepte el pedido.',
    FARMACIA_ASIGNADA: ph + ' aceptó el pedido y está confirmando existencias y precios.',
    PRECIO_POR_ACEPTAR: client ? 'Revisa lo que confirmó la farmacia y acepta el precio para continuar.' : 'Esperando que el cliente acepte el precio.',
    PRECIO_CONFIRMADO: 'Precio aceptado. La farmacia empezará a preparar el pedido.',
    PEDIDO_EN_PREPARACION: ph + ' está alistando el pedido' + (o.prepMinutes ? ' (unos ' + o.prepMinutes + ' min).' : '.'),
    PEDIDO_LISTO: 'El pedido está listo. Buscamos un repartidor.',
    BUSCANDO_REPARTIDOR: 'El pedido está listo para recoger. Buscamos un repartidor disponible.',
    REPARTIDOR_ASIGNADO: cr + ' va hacia la farmacia.',
    PEDIDO_RECOGIDO: cr + ' ya recogió el pedido.',
    EN_CAMINO: client ? 'Tu pedido va en camino. Ten a la mano tu código de entrega.' : 'El pedido va en camino hacia el cliente.',
    ENTREGADO: 'Pedido entregado.',
    RECHAZADA: 'Ninguna farmacia pudo atender este pedido.',
    CANCELADA: 'El pedido fue cancelado.',
    VENCIDA: 'Ninguna farmacia disponible lo aceptó a tiempo, o el precio no se confirmó. Puedes volver a pedirlo.',
    CON_INCIDENCIA: 'Hay una incidencia abierta. La administración la está revisando.'
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
  const open = () => openOrderDetail(o.id);
  return h('article', {
    class: 'order-row tone-' + statusTone(o.status), tabindex: 0, role: 'button', 'aria-label': 'Ver pedido ' + o.code,
    onclick: open,
    onkeydown: e => { if (e.key === 'Enter' && e.target === e.currentTarget) open(); }
  },
    h('span', { class: 'bar' }),
    h('div', { class: 'row-main' },
      h('div', { class: 'row-top' }, h('strong', { class: 'code' }, o.code), badge(o.status)),
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

function block(title, ...kids) {
  return h('section', { class: 'block' }, h('h4', null, title), ...kids);
}

function orderDetail(o, viewer) {
  const role = viewer.role;
  const codeVisible = o.deliveryCode && ['REPARTIDOR_ASIGNADO', 'PEDIDO_RECOGIDO', 'EN_CAMINO'].includes(o.status);
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
          h('tfoot', null, h('tr', null, h('td', { colspan: 3 }, 'Total'), h('td', null, money(o.total)))))),
        o.pharmacyNote && h('p', { class: 'muted' }, 'Nota de la farmacia: ' + o.pharmacyNote))
    : (o.items && o.items.length
      ? block('Productos solicitados', h('ul', { class: 'plain' }, o.items.map(i => h('li', null,
          h('span', null, i.name + ' ×' + i.quantity), i.prescription && h('span', { class: 'tag' }, 'Con fórmula médica'), i.note && h('small', { class: 'muted' }, i.note)))))
      : null);

  const delivery = (o.address || o.zone) && block('Entrega',
    h('div', null, o.clientName && h('strong', null, o.clientName), o.address && h('span', { class: 'block-line' }, o.address), h('span', { class: 'muted block-line' }, o.zone),
      o.clientPhone && h('span', { class: 'muted block-line' }, o.clientPhone), o.notes && h('span', { class: 'muted block-line' }, 'Nota: ' + o.notes)));

  return h('div', { class: 'detail' },
    h('div', { class: 'detail-head' }, h('h2', null, 'Pedido ' + o.code), badge(o.status)),
    blister(o, '', { hint: 'Toca un paso para ver cuándo ocurrió.' }),
    h('p', { class: 'status-line' }, statusMessage(o, role)),
    timerLine(o),
    o.status === 'CON_INCIDENCIA' && h('div', { class: 'notice bad' }, h('strong', null, 'Incidencia reportada por ' + (o.incidentBy || '')), h('span', null, o.incidentNote)),
    codeVisible && h('div', { class: 'code-card' },
      h('div', { class: 'digits', 'aria-label': 'Código de entrega ' + o.deliveryCode.split('').join(' ') }, o.deliveryCode.split('').map(d => h('span', null, d))),
      h('p', null, 'Es tu código de entrega. Díctaselo al repartidor solo cuando tengas el pedido en la mano.')),
    (parts.length || courier) && block('Quiénes participan', parts, courier),
    itemsBlock,
    delivery,
    detailActions(o, viewer),
    block('Historial', h('ol', { class: 'timeline' }, (o.history || []).map(e => h('li', null,
      h('time', null, clock(e.at)),
      h('div', null, h('strong', null, statusLabel(e.status)), e.note && h('span', null, e.note), h('small', { class: 'muted' }, e.actorName)))))));
}

function detailActions(o, viewer) {
  const done = () => refreshAll();
  const btns = [];
  const post = (path, ok, body) => btn => act(btn, async () => { await API.post(path, body); done(); }, ok);
  const run = (fn) => e => fn(e.currentTarget);

  if (viewer.role === 'CLIENTE') {
    if (o.status === 'PRECIO_POR_ACEPTAR') {
      btns.push(h('button', { class: 'btn primary', onclick: run(post('/orders/' + o.id + '/accept-price', 'Precio aceptado')) }, 'Aceptar precio de ' + money(o.total)));
      btns.push(h('button', { class: 'btn ghost', onclick: async e => {
        if (await confirmBox({ title: '¿Buscar otra farmacia?', message: 'No continuaremos con esta farmacia. Enviaremos tu pedido a las demás.', ok: 'Buscar otra' }))
          post('/orders/' + o.id + '/decline-price', 'Buscando otra farmacia')(e.target);
      } }, 'No acepto, buscar otra farmacia'));
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
      btns.push(h('button', { class: 'btn primary', onclick: run(post('/admin/orders/' + o.id + '/resolve', 'Incidencia resuelta', { action: 'RESTAURAR' })) }, 'Continuar el pedido'));
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
