/* FarmaYA · panel de administración */

let adminFilter = '';

function adminView(user) {
  let root;
  root = h('div', { class: 'stack' }, h('h1', { class: 'page-title' }, 'Administración'), sideNavigation([
    { label: 'Dashboard', icon: 'layout-dashboard', render: () => adminSummary(status => { adminFilter = status; root.querySelectorAll('.side-nav-item')[1]?.click(); }) },
    { label: 'Pedidos', icon: 'package', render: adminOrders },
    { label: 'Farmacias', icon: 'store', render: () => adminUsers('FARMACIA') },
    { label: 'Repartidores', icon: 'truck', render: () => adminUsers('REPARTIDOR') },
    { label: 'Clientes', icon: 'users', render: () => adminUsers('CLIENTE') },
    { label: 'Movimientos', icon: 'history', render: adminMovements }
  ], 0));
  return root;
}

function adminSummary(go) {
  return live(() => API.get('/admin/stats'), s => {
    const total = Object.values(s.byStatus).reduce((a, b) => a + b, 0);
    const max = Math.max(1, ...Object.values(s.byStatus));
    const rows = Object.entries(s.byStatus).filter(([, n]) => n > 0);
    return h('div', { class: 'summary' },
      h('section', { class: 'block' }, h('h3', null, 'Pedidos por estado'),
        total === 0 ? h('p', { class: 'muted' }, 'Todavía no hay pedidos.') :
          h('div', null,
            h('p', { class: 'muted small' }, 'Toca un estado para ver esos pedidos.'),
            h('ul', { class: 'bars' }, rows.map(([k, n]) => {
              const fill = h('span', { class: 'bar-fill tone-' + statusTone(k), style: 'width:0%' });
              requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = (n / max * 100) + '%'; }));
              return h('li', null, h('button', {
                class: 'bar-link', type: 'button', onclick: () => go(k),
                'aria-label': statusLabel(k) + ': ' + n + '. Ver pedidos'
              }, h('span', { class: 'bar-label' }, statusLabel(k)), h('span', { class: 'bar-track' }, fill), h('span', { class: 'bar-n' }, n)));
            })))),
      h('section', { class: 'block' }, h('h3', null, 'La red'),
        h('dl', { class: 'facts stacked' },
          h('div', null, h('dt', null, 'Farmacias verificadas'), h('dd', null, s.pharmacies.verified, s.pharmacies.pending > 0 && h('span', { class: 'attention' }, s.pharmacies.pending + ' por verificar'))),
          h('div', null, h('dt', null, 'Repartidores verificados'), h('dd', null, s.couriers.verified, s.couriers.pending > 0 && h('span', { class: 'attention' }, s.couriers.pending + ' por verificar'))),
          h('div', null, h('dt', null, 'Clientes registrados'), h('dd', null, s.clients)),
          h('div', null, h('dt', null, 'Valor de pedidos entregados'), h('dd', null, money(s.revenue))))));
  });
}

function adminOrders() {
  let status = adminFilter;
  adminFilter = '';
  const holder = h('div');
  const select = h('select', { 'aria-label': 'Filtrar por estado', onchange: () => { status = select.value; draw(); } },
    h('option', { value: '' }, 'Todos los estados'),
    Object.entries(state.meta.statuses).map(([k, v]) => h('option', { value: k }, v)));
  select.value = status;
  const draw = () => holder.replaceChildren(live(() => API.get('/admin/orders' + (status ? '?status=' + status : '')), orders => {
    if (!orders.length) return empty('No hay pedidos con este filtro', 'Prueba con otro estado o muestra todos.');
    return h('div', { class: 'list' }, orders.map(o => orderRow(o, h('span', { class: 'muted small' }, o.zone))));
  }));
  draw();
  return h('div', { class: 'stack' }, h('div', { class: 'toolbar' }, select), holder);
}

function adminUsers(role) {
  const titles = { FARMACIA: 'farmacias', REPARTIDOR: 'repartidores', CLIENTE: 'clientes' };
  let query = '';
  let timer;
  const search = h('input', {
    type: 'search', placeholder: 'Buscar por nombre, correo o zona', 'aria-label': 'Buscar ' + titles[role],
    oninput: () => { clearTimeout(timer); timer = setTimeout(() => { query = search.value.trim().toLowerCase(); refreshAll(); }, 150); }
  });

  const list = live(() => API.get('/admin/users?role=' + role), users => {
    if (!users.length) return empty('Aún no hay ' + titles[role]);
    const shown = users.filter(u => !query ||
      [u.name, u.email, u.zone, u.pharmacyName, u.phone].filter(Boolean).join(' ').toLowerCase().includes(query));
    if (!shown.length) return empty('Sin resultados', 'No encontramos ' + titles[role] + ' que coincidan con la búsqueda.');
    const needsVerify = role !== 'CLIENTE';
    const toggle = (u, kind, value, ok) => async e => {
      await act(e.currentTarget, () => API.post('/admin/users/' + u.id + '/' + kind, { value }), ok);
      refreshAll();
    };
    return h('div', { class: 'table-wrap' }, h('table', { class: 'users' },
      h('thead', null, h('tr', null,
        h('th', null, role === 'FARMACIA' ? 'Farmacia' : 'Nombre'), h('th', null, 'Contacto'), h('th', null, 'Zona'), h('th', null, 'Estado'), h('th', null, 'Acciones'))),
      h('tbody', null, shown.map(u => h('tr', { class: u.enabled ? '' : 'disabled' },
        h('td', null,
          h('strong', null, role === 'FARMACIA' ? u.pharmacyName : u.name),
          role === 'FARMACIA' && h('small', { class: 'block-line muted' }, u.address),
          role === 'FARMACIA' && h('small', { class: 'block-line muted' }, 'Licencia ' + u.licenseNumber + ', atiende de ' + u.openFrom + ' a ' + u.openTo),
          role === 'REPARTIDOR' && h('small', { class: 'block-line muted' }, u.vehicle),
          role === 'FARMACIA' && h('small', { class: 'block-line muted' }, 'Responsable: ' + u.name)),
        h('td', null, u.email, h('small', { class: 'block-line muted' }, u.phone)),
        h('td', null, u.zone),
        h('td', null,
          !u.enabled ? h('span', { class: 'badge tone-bad' }, 'Deshabilitada')
            : needsVerify ? h('span', { class: 'badge ' + (u.verified ? 'tone-done' : 'tone-wait') }, u.verified ? 'Verificada' : 'Por verificar')
              : h('span', { class: 'badge tone-done' }, 'Activa'),
          role === 'FARMACIA' && u.editPermissionRequested && !u.canEditProfile && h('small', { class: 'block-line attention', style: 'margin-top:5px;font-weight:700;' }, '🔔 Solicitó editar datos / número' + (u.editRequestNote ? ': ' + u.editRequestNote : '')),
          role === 'FARMACIA' && u.canEditProfile && h('small', { class: 'block-line text-success', style: 'margin-top:5px;font-weight:700;' }, '🔓 Edición autorizada por admin')),
        h('td', { class: 'row-actions' },
          needsVerify && (u.verified
            ? h('button', { class: 'btn ghost small', onclick: toggle(u, 'verified', false, 'Verificación retirada') }, 'Quitar verificación')
            : h('button', { class: 'btn primary small', onclick: toggle(u, 'verified', true, 'Cuenta verificada') }, 'Verificar')),
          role === 'FARMACIA' && (u.canEditProfile
            ? h('button', { class: 'btn ghost small', onclick: toggle(u, 'edit-permission', false, 'Permiso de edición revocado') }, 'Revocar permiso edición')
            : h('button', { class: 'btn ' + (u.editPermissionRequested ? 'primary' : 'ghost') + ' small', onclick: toggle(u, 'edit-permission', true, 'Permiso de edición concedido') }, u.editPermissionRequested ? '✓ Autorizar edición' : 'Permitir editar datos')),
          u.enabled
            ? h('button', { class: 'btn danger-ghost small', onclick: toggle(u, 'enabled', false, 'Cuenta deshabilitada') }, 'Deshabilitar')
            : h('button', { class: 'btn ghost small', onclick: toggle(u, 'enabled', true, 'Cuenta habilitada') }, 'Habilitar')))))));
  });
  return h('div', { class: 'stack' }, h('div', { class: 'toolbar' }, search), list);
}

/* Auditoría: movimientos de pedidos y acciones administrativas, con código trazable. */
function adminMovements() {
  let query = '';
  let type = '';
  const holder = h('div', { class: 'stack' });
  const search = h('input', { type: 'search', placeholder: 'Buscar código, pedido, usuario o descripción', 'aria-label': 'Buscar movimientos', oninput: () => { query = search.value.trim().toLowerCase(); draw(); } });
  const filter = h('select', { 'aria-label': 'Filtrar movimientos', onchange: () => { type = filter.value; draw(); } },
    h('option', { value: '' }, 'Todos los movimientos'),
    h('option', { value: 'PEDIDO' }, 'Pedidos'),
    h('option', { value: 'USUARIO' }, 'Usuarios'),
    h('option', { value: 'SISTEMA' }, 'Sistema'));
  const draw = () => {
    holder.replaceChildren(live(() => API.get('/admin/movements'), movements => {
      const filtered = movements.filter(m => {
        const searchable = [m.code, m.type, m.description, m.orderCode, m.actorName, m.actorRole].filter(Boolean).join(' ').toLowerCase();
        const typeOk = !type || (type === 'PEDIDO' ? !!m.orderCode : type === 'USUARIO' ? String(m.type).startsWith('USUARIO_') : m.actorRole === 'SISTEMA');
        return typeOk && (!query || searchable.includes(query));
      });
      if (!filtered.length) return empty('No hay movimientos para mostrar', 'Los cambios de estado de pedidos y las acciones administrativas aparecerán aquí.');
      return h('div', { class: 'table-wrap movement-table' }, h('table', { class: 'users' },
        h('thead', null, h('tr', null, h('th', null, 'Código'), h('th', null, 'Movimiento'), h('th', null, 'Pedido'), h('th', null, 'Responsable'), h('th', null, 'Fecha y hora'))),
        h('tbody', null, filtered.map(m => h('tr', null,
          h('td', null, h('strong', { class: 'movement-code' }, m.code || '—')),
          h('td', null, h('strong', null, movementTypeLabel(m.type)), h('small', { class: 'block-line muted movement-description' }, m.description || 'Sin descripción')),
          h('td', null, m.orderCode ? h('span', { class: 'code' }, m.orderCode) : '—'),
          h('td', null, h('strong', null, m.actorName || 'FarmaYa'), h('small', { class: 'block-line muted' }, m.actorRole || 'SISTEMA')),
          h('td', null, formatMovementDate(m.createdAt)))))));
    }));
  };
  draw();
  return h('div', { class: 'stack' }, h('div', { class: 'toolbar movement-toolbar' }, search, filter), holder);
}

function movementTypeLabel(type) {
  const labels = { SOLICITUD_ENVIADA: 'Pedido creado', BUSCANDO_FARMACIA: 'Buscando farmacia', FARMACIA_ASIGNADA: 'Farmacia asignada', PRECIO_POR_ACEPTAR: 'Precio pendiente', PRECIO_CONFIRMADO: 'Precio confirmado', BUSCANDO_REPARTIDOR: 'Buscando repartidor', REPARTIDOR_ASIGNADO: 'Repartidor asignado', PEDIDO_RECOGIDO: 'Pedido recogido', EN_CAMINO: 'En camino', ENTREGADO: 'Pedido entregado', CANCELADA: 'Pedido cancelado', VENCIDA: 'Pedido vencido', RECHAZADA: 'Pedido rechazado', CON_INCIDENCIA: 'Incidencia', USUARIO_VERIFICACION: 'Verificación de usuario', USUARIO_ESTADO: 'Estado de usuario', DISPONIBILIDAD: 'Cambio de disponibilidad', USUARIO_EDICION_FARMACIA: 'Datos de farmacia actualizados', FARMACIA_SOLICITUD_EDICION: 'Solicitud de edición' };
  return labels[type] || String(type || 'Movimiento').replaceAll('_', ' ').toLowerCase().replace(/^./, c => c.toUpperCase());
}
function formatMovementDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
