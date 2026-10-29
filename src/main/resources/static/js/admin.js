/* FarmaYA · panel de administración */

let adminFilter = '';

function adminHeaderCard(user) {
  return h('div', { class: 'pharmacy-header-card admin-header-card' },
    h('div', { class: 'pharmacy-header-info' },
      h('h1', { class: 'pharmacy-header-title' }, 'Panel de Administración'),
      h('span', { class: 'pharmacy-header-address muted' }, (user.name || 'Administrador') + (user.email ? ' · ' + user.email : '') + ' · Control Central FarmaYA')
    ),
    h('div', { class: 'admin-header-status-box' },
      h('span', { class: 'header-tag' }, 'Operación Central Activa')
    )
  );
}

let adminDemandFilter = 'TODAS';
let adminDemandSearch = '';

function adminView(user) {
  let root;
  root = h('div', { class: 'stack admin-root' }, adminHeaderCard(user), sideNavigation([
    { label: 'Predicción de Demanda (IA)', icon: 'trending-up', render: adminDemandForecast },
    { label: 'Pedidos', icon: 'package', render: adminOrders },
    { label: 'Verificaciones', icon: 'prescriptions', render: adminVerificationCenter },
    { label: 'Farmacias', icon: 'store', render: () => adminUsers('FARMACIA') },
    { label: 'Repartidores', icon: 'bike', render: () => adminUsers('REPARTIDOR') },
    { label: 'Clientes', icon: 'users', render: () => adminUsers('CLIENTE') },
    { label: 'Administradores', icon: 'shield', render: () => adminAdministratorsView(user) },
    { label: 'Catálogo de Productos', icon: 'capsule', render: adminCatalogManager },
    { label: 'Movimientos', icon: 'history', render: adminMovements }
  ], 0));
  return root;
}

/**
 * Modelo Predictivo de Demanda Mensual de Medicamentos (Machine Learning)
 * Reemplaza el dashboard anterior con la clasificación de demanda en ALTA, MEDIA y BAJA
 * utilizando los pedidos históricos de MongoDB.
 */
function adminDemandForecast() {
  return live(() => API.get('/demand-forecast'), data => {
    const list = data.forecasts || [];
    const summary = data.summary || { totalMedicines: list.length, alta: 0, media: 0, baja: 0 };
    const period = data.period || 'Próximo Mes';

    // Banner explicativo del Modelo ML
    const banner = notice('info',
      'Modelo Predictivo de Demanda Mensual (Machine Learning con MongoDB)',
      'Clasificación predictiva de la demanda mensual de medicamentos en tres categorías (ALTA, MEDIA, BAJA) utilizando los registros históricos de pedidos, series temporales y estacionalidad. Permite a la red de farmacias FarmaYA planificar existencias y evitar roturas de stock.'
    );

    // 4 Tarjetas de KPIs estilo Stitch Admin
    const kpiSection = h('div', { class: 'stitch-admin-kpis-grid' },
      h('div', { class: 'stitch-admin-kpi-card' },
        h('div', { class: 'kpi-top' },
          h('span', { class: 'kpi-lbl' }, 'Periodo Proyectado'),
          h('span', { class: 'badge-flash' }, 'IA FarmaYA')
        ),
        h('div', { class: 'kpi-amt-row' },
          h('strong', { class: 'kpi-amt', style: 'font-size: 1.35rem; color: var(--primary);' }, period),
          h('small', null, 'pronóstico mensual')
        ),
        h('div', { class: 'kpi-footer-note' },
          h('span', null, 'Total en catálogo analizado: <strong>' + summary.totalMedicines + '</strong>')
        )
      ),

      h('div', { class: 'stitch-admin-kpi-card' },
        h('div', { class: 'kpi-top' },
          h('span', { class: 'kpi-lbl' }, 'Demanda ALTA'),
          h('span', { class: 'kpi-sub-tag', style: 'background: rgba(217, 56, 58, 0.15); color: #c5221f; font-weight: 700;' }, 'Rotación Crítica')
        ),
        h('div', { class: 'kpi-amt-row' },
          h('strong', { class: 'kpi-amt', style: 'color: #d9383a;' }, String(summary.alta || 0)),
          h('small', null, 'medicamentos con muchas solicitudes')
        ),
        h('div', { class: 'kpi-footer-note' },
          h('span', null, 'Stock de seguridad recomendado: <strong>+35%</strong>')
        )
      ),

      h('div', { class: 'stitch-admin-kpi-card' },
        h('div', { class: 'kpi-top' },
          h('span', { class: 'kpi-lbl' }, 'Demanda MEDIA'),
          h('span', { class: 'kpi-sub-tag tone-teal', style: 'font-weight: 700;' }, 'Rotación Moderada')
        ),
        h('div', { class: 'kpi-amt-row' },
          h('strong', { class: 'kpi-amt tone-teal' }, String(summary.media || 0)),
          h('small', null, 'demanda estándar y predecible')
        ),
        h('div', { class: 'kpi-footer-note' },
          h('span', null, 'Ciclo de reposición quincenal sugerido')
        )
      ),

      h('div', { class: 'stitch-admin-kpi-card' },
        h('div', { class: 'kpi-top' },
          h('span', { class: 'kpi-lbl' }, 'Demanda BAJA'),
          h('span', { class: 'kpi-sub-tag', style: 'background: rgba(100, 116, 139, 0.15); color: #475569; font-weight: 700;' }, 'Bajo Movimiento')
        ),
        h('div', { class: 'kpi-amt-row' },
          h('strong', { class: 'kpi-amt', style: 'color: #64748b;' }, String(summary.baja || 0)),
          h('small', null, 'pocas solicitudes mensuales')
        ),
        h('div', { class: 'kpi-footer-note' },
          h('span', null, 'Compra bajo pedido para prevenir vencimientos')
        )
      )
    );

    // Botones de filtro
    const filterBtn = (label, cat) => {
      const active = adminDemandFilter === cat;
      return h('button', {
        class: 'btn ' + (active ? 'primary' : 'secondary'),
        style: 'font-size: 0.85rem; padding: 0.35rem 0.85rem;',
        onclick: () => {
          adminDemandFilter = cat;
          refreshAll();
        }
      }, label);
    };

    const filters = h('div', { class: 'flex items-center gap-2', style: 'flex-wrap: wrap;' },
      filterBtn('Todos (' + list.length + ')', 'TODAS'),
      filterBtn('🔥 ALTA (' + summary.alta + ')', 'ALTA'),
      filterBtn('📊 MEDIA (' + summary.media + ')', 'MEDIA'),
      filterBtn('💤 BAJA (' + summary.baja + ')', 'BAJA')
    );

    // Buscador interactivo
    const searchInput = h('input', {
      type: 'search',
      placeholder: 'Buscar medicamento...',
      value: adminDemandSearch,
      style: 'max-width: 260px; font-size: 0.85rem; padding: 0.4rem 0.75rem;',
      oninput: e => {
        adminDemandSearch = e.target.value;
        const term = adminDemandSearch.toLowerCase().trim();
        const rows = document.querySelectorAll('.admin-forecast-row');
        rows.forEach(r => {
          const name = (r.getAttribute('data-name') || '').toLowerCase();
          r.style.display = (!term || name.includes(term)) ? '' : 'none';
        });
      }
    });

    // Botón de reentrenamiento/recálculo en tiempo real
    const recalculateBtn = h('button', {
      class: 'btn secondary',
      style: 'font-size: 0.85rem; display: inline-flex; align-items: center; gap: 0.4rem;',
      onclick: async e => {
        await act(e.currentTarget, async () => {
          const res = await API.post('/demand-forecast/recalculate', {});
          toast(res.message || 'Pronóstico recalculado exitosamente con IA.');
          refreshAll();
        }, 'Modelo reentrenado');
      }
    }, '🔄 Recalcular y Reentrenar con MongoDB');

    const toolbar = h('div', { class: 'flex items-center justify-between', style: 'flex-wrap: wrap; gap: 1rem; margin: 1.25rem 0;' },
      h('div', { class: 'flex items-center gap-2', style: 'flex-wrap: wrap;' }, filters, searchInput),
      recalculateBtn
    );

    // Filtrar lista
    const filtered = list.filter(item => {
      const matchCat = adminDemandFilter === 'TODAS' || (item.category || '').toUpperCase() === adminDemandFilter;
      const matchSearch = !adminDemandSearch || (item.medicineName || '').toLowerCase().includes(adminDemandSearch.toLowerCase().trim());
      return matchCat && matchSearch;
    });

    // Insignia de categoría (ALTA, MEDIA, BAJA)
    const categoryBadge = cat => {
      const c = (cat || '').toUpperCase();
      let bg = 'rgba(100, 116, 139, 0.15)', color = '#475569', label = 'BAJA';
      if (c === 'ALTA') {
        bg = 'rgba(217, 56, 58, 0.15)';
        color = '#c5221f';
        label = '🔥 ALTA';
      } else if (c === 'MEDIA') {
        bg = 'rgba(2, 132, 199, 0.15)';
        color = '#0284c7';
        label = '📊 MEDIA';
      } else {
        label = '💤 BAJA';
      }
      return h('span', {
        class: 'tag',
        style: 'background: ' + bg + '; color: ' + color + '; font-weight: 700; border-radius: 999px; padding: 0.25rem 0.7rem; font-size: 0.85rem;'
      }, label);
    };

    const trendBadge = trend => {
      const t = trend || 'Estable';
      let icon = '➡️ Estable';
      if (t === 'Creciente') icon = '📈 Creciente';
      else if (t === 'Decreciente') icon = '📉 Decreciente';
      return h('span', { class: 'text-xs muted', style: 'font-weight: 600;' }, icon);
    };

    // Tabla de pronóstico detallada
    const tableHeader = h('thead', null,
      h('tr', null,
        h('th', { style: 'text-align: left; padding: 0.75rem 1rem;' }, 'Medicamento'),
        h('th', { style: 'text-align: center; padding: 0.75rem 0.5rem;' }, 'Demanda Prevista'),
        h('th', { style: 'text-align: center; padding: 0.75rem 0.5rem;' }, 'Confianza'),
        h('th', { style: 'text-align: right; padding: 0.75rem 0.75rem;' }, 'Solicitudes Est.'),
        h('th', { style: 'text-align: right; padding: 0.75rem 0.75rem;' }, 'Unidades Proy.'),
        h('th', { style: 'text-align: right; padding: 0.75rem 0.75rem;' }, 'Stock Sugerido'),
        h('th', { style: 'text-align: center; padding: 0.75rem 0.5rem;' }, 'Tendencia'),
        h('th', { style: 'text-align: left; padding: 0.75rem 1rem;' }, 'Recomendación de Planificación de Existencias')
      )
    );

    const tableRows = filtered.map(item => {
      return h('tr', { class: 'admin-forecast-row', 'data-name': item.medicineName, style: 'border-bottom: 1px solid var(--border);' },
        h('td', { style: 'padding: 0.75rem 1rem; font-weight: 600;' }, item.medicineName),
        h('td', { style: 'text-align: center; padding: 0.75rem 0.5rem;' }, categoryBadge(item.category)),
        h('td', { style: 'text-align: center; padding: 0.75rem 0.5rem; font-size: 0.85rem;', class: 'muted' }, (item.confidence ? item.confidence.toFixed(1) : '90.0') + '%'),
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

    return h('div', { class: 'stack stitch-admin-demand-view' },
      banner,
      kpiSection,
      toolbar,
      filtered.length ? table : empty('Sin coincidencias', 'No se encontraron medicamentos para el criterio seleccionado.')
    );
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
    return h('div', { class: 'list' }, orders.map(o => {
      const profit = o.platformEarnings != null ? o.platformEarnings : (o.total ? Math.round(o.total * 0.10) : 0);
      return orderRow(o, h('div', { style: 'display:flex;flex-direction:column;align-items:flex-end;gap:4px;' },
        h('span', { class: 'muted small' }, o.address || o.city || 'Barranquilla'),
        o.total != null ? h('span', { class: 'tag tone-teal', style: 'font-weight:700;' }, 'Ganancia FarmaYA: ' + money(profit)) : null
      ));
    }));
  }));
  draw();
  return h('div', { class: 'stack' }, h('div', { class: 'toolbar' }, select), holder);
}

function adminUsers(role) {
  const titles = { FARMACIA: 'farmacias', REPARTIDOR: 'repartidores', CLIENTE: 'clientes' };
  let query = '';
  let timer;
  const search = h('input', {
    type: 'search', placeholder: 'Buscar por nombre, correo o dirección', 'aria-label': 'Buscar ' + titles[role],
    oninput: () => { clearTimeout(timer); timer = setTimeout(() => { query = search.value.trim().toLowerCase(); refreshAll(); }, 150); }
  });

  const list = live(() => API.get('/admin/users?role=' + role), users => {
    if (!users.length) return empty('Aún no hay ' + titles[role]);
    const shown = users.filter(u => !query ||
      [u.name, u.email, u.address, u.pharmacyName, u.phone].filter(Boolean).join(' ').toLowerCase().includes(query));
    if (!shown.length) return empty('Sin resultados', 'No encontramos ' + titles[role] + ' que coincidan con la búsqueda.');
    const needsVerify = role !== 'CLIENTE';
    const toggle = (u, kind, value, ok) => async e => {
      const updated = await act(e.currentTarget, () => API.post('/admin/users/' + u.id + '/' + kind, { value }), ok);
      if (updated) {
        Object.assign(u, updated);
      } else {
        u[kind] = value;
      }
      refreshAll();
    };
    return h('div', { class: 'table-wrap' }, h('table', { class: 'users' },
      h('thead', null, h('tr', null,
        h('th', null, role === 'FARMACIA' ? 'Farmacia' : 'Nombre'), h('th', null, 'Contacto'), h('th', null, 'Ubicación'), h('th', null, 'Estado'), h('th', null, 'Acciones'))),
      h('tbody', null, shown.map(u => h('tr', { class: u.enabled ? '' : 'disabled' },
        h('td', null,
          h('strong', null, role === 'FARMACIA' ? u.pharmacyName : u.name),
          role === 'FARMACIA' && h('small', { class: 'block-line muted' }, u.address),
          role === 'FARMACIA' && h('small', { class: 'block-line muted' }, 'Licencia ' + u.licenseNumber + ', atiende de ' + u.openFrom + ' a ' + u.openTo),
          role === 'REPARTIDOR' && h('small', { class: 'block-line muted' }, u.vehicle),
          role === 'FARMACIA' && h('small', { class: 'block-line muted' }, 'Responsable: ' + u.name)),
        h('td', null, u.email, h('small', { class: 'block-line muted' }, u.phone)),
        h('td', null, u.address || u.city || 'Ciudad completa'),
        h('td', null,
          !u.enabled ? h('span', { class: 'badge tone-bad' }, 'Deshabilitada')
            : needsVerify ? h('span', { class: 'badge ' + (u.verified ? 'tone-done' : 'tone-wait') }, u.verified ? 'Verificada' : 'Por verificar')
              : h('span', { class: 'badge tone-done' }, 'Activa'),
          role === 'FARMACIA' && u.editPermissionRequested && !u.canEditProfile && h('small', { class: 'block-line attention', style: 'margin-top:5px;font-weight:700;' }, 'Solicitó editar datos / número' + (u.editRequestNote ? ': ' + u.editRequestNote : '')),
          role === 'FARMACIA' && u.canEditProfile && h('small', { class: 'block-line text-success', style: 'margin-top:5px;font-weight:700;' }, 'Edición autorizada por admin')),
        h('td', { class: 'row-actions' },
          u.verificationDocuments && u.verificationDocuments.length
            ? h('button', { class: 'btn link small', onclick: () => openUserDocumentsModal(u) }, 'Expediente (' + u.verificationDocuments.length + ' PDFs)')
            : null,
          needsVerify && (u.verified
            ? h('button', { class: 'btn ghost small', onclick: toggle(u, 'verified', false, 'Verificación retirada') }, 'Quitar verificación')
            : h('button', { class: 'btn primary small', onclick: toggle(u, 'verified', true, 'Cuenta verificada') }, 'Verificar')),
          role === 'FARMACIA' && (u.canEditProfile
            ? h('button', { class: 'btn ghost small', onclick: toggle(u, 'edit-permission', false, 'Permiso de edición revocado') }, 'Revocar permiso edición')
            : h('button', { class: 'btn ' + (u.editPermissionRequested ? 'primary' : 'ghost') + ' small', onclick: toggle(u, 'edit-permission', true, 'Permiso de edición concedido') }, u.editPermissionRequested ? 'Autorizar edición' : 'Permitir editar datos')),
          u.enabled
            ? h('button', { class: 'btn danger-ghost small', onclick: toggle(u, 'enabled', false, 'Cuenta deshabilitada') }, 'Deshabilitar')
            : h('button', { class: 'btn ghost small', onclick: toggle(u, 'enabled', true, 'Cuenta habilitada') }, 'Habilitar')))))));
  });
  return h('div', { class: 'stack' }, h('div', { class: 'toolbar' }, search), list);
}

function openPdfViewerDialog(title, dataUrl, filename) {
  const content = h('div', { class: 'sheet-body', style: 'padding: 16px; max-width: 900px; width: 92vw;' },
    h('div', { style: 'display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px;' },
      h('div', null,
        h('h3', { style: 'margin:0;' }, title),
        h('span', { class: 'small muted' }, filename || 'Documento PDF oficial')
      ),
      h('div', { style: 'display:flex; gap:8px;' },
        h('a', { class: 'btn ghost small', href: dataUrl, download: filename || 'documento.pdf', target: '_blank' }, 'Descargar'),
        h('button', { class: 'btn ghost small', onclick: () => d.close() }, 'Cerrar')
      )
    ),
    h('div', { style: 'width:100%; height:72vh; border-radius:10px; overflow:hidden; border:1px solid var(--line); background:#525659;' },
      h('iframe', {
        src: dataUrl,
        style: 'width:100%; height:100%; border:none;',
        title: title
      })
    )
  );
  const d = openDialog(content, { wide: true });
}

function openUserDocumentsModal(user) {
  const docs = user.verificationDocuments || [];
  const list = docs.length
    ? h('div', { class: 'doc-pdf-list' }, docs.map(doc => h('div', { class: 'doc-pdf-item' },
        h('div', { class: 'doc-pdf-left' },
          h('span', { class: 'doc-pdf-icon' }, icon('prescriptions')),
          h('div', null,
            h('strong', { class: 'block-line' }, doc.title || doc.docType),
            h('span', { class: 'small muted' }, doc.filename || 'Documento PDF')
          )
        ),
        h('div', { class: 'doc-pdf-actions' },
          h('button', { class: 'btn primary small', onclick: () => openPdfViewerDialog(doc.title, doc.dataUrl, doc.filename) }, 'Ver PDF'),
          h('a', { class: 'btn ghost small', href: doc.dataUrl, download: doc.filename, target: '_blank' }, 'Descargar')
        )
      )))
    : empty('Sin documentos PDF', 'Este usuario no adjuntó archivos PDF al momento de su registro.');

  const body = h('div', { class: 'sheet-body', style: 'max-width:680px; width:90vw;' },
    h('div', { style: 'display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;' },
      h('div', null,
        h('span', { class: 'eyebrow' }, 'EXPEDIENTE DIGITAL DE VERIFICACIÓN'),
        h('h3', { style: 'margin:2px 0 0;' }, user.pharmacyName || user.name),
        h('p', { class: 'muted small', style: 'margin:0;' }, user.role === 'FARMACIA' ? ('Licencia: ' + (user.licenseNumber || 'No especificada')) : ('Vehículo: ' + (user.vehicle || 'No especificado') + (user.plate ? ' · Placa: ' + user.plate : '')))
      ),
      h('button', { class: 'close', onclick: () => d.close() }, '×')
    ),
    list
  );
  const d = openDialog(body);
}

function adminVerificationCenter() {
  let filterRole = '';
  const filterButtons = [
    { label: 'Todas las solicitudes', role: '', iconName: 'clipboard-list' },
    { label: 'Farmacias pendientes', role: 'FARMACIA', iconName: 'building' },
    { label: 'Repartidores pendientes', role: 'REPARTIDOR', iconName: 'bike' }
  ];

  const toolbar = h('div', { class: 'filter-tabs-bar verification-tabs-bar' });
  const container = h('div', { class: 'stack verification-center-root' });

  function renderView() {
    toolbar.replaceChildren(...filterButtons.map(fb => h('button', {
      type: 'button',
      class: 'btn tab-pill-btn ' + (filterRole === fb.role ? 'primary' : 'secondary'),
      onclick: () => { filterRole = fb.role; renderView(); }
    }, icon(fb.iconName), h('span', null, fb.label))));

    const content = live(() => API.get('/admin/verifications'), users => {
      let filtered = users;
      if (filterRole) filtered = users.filter(u => u.role === filterRole);

      if (!filtered.length) {
        return empty('No hay solicitudes pendientes', filterRole
          ? 'No hay cuentas de ' + (filterRole === 'FARMACIA' ? 'farmacias' : 'repartidores') + ' pendientes por verificar.'
          : 'Todas las cuentas de farmacias y repartidores han sido revisadas y verificadas.');
      }

      const sliderHint = h('div', { class: 'verification-slider-hint' },
        h('span', { class: 'small muted' }, 'Desliza horizontalmente para revisar las solicitudes pendientes (' + filtered.length + ') →')
      );

      const cardsContainer = h('div', { class: 'verification-cards-carousel' }, filtered.map(u => {
        const isPh = u.role === 'FARMACIA';
        const docs = u.verificationDocuments || [];

        const actVerify = async (val) => {
          await act(null, () => API.post('/admin/users/' + u.id + '/verified', { value: val }),
            val ? 'Cuenta verificada y autorizada para operar' : 'Verificación rechazada');
          u.verified = val;
          refreshAll();
        };

        const actDisable = async () => {
          if (await confirmBox({ title: '¿Rechazar esta solicitud?', message: 'La cuenta quedará deshabilitada y no podrá operar.', ok: 'Rechazar y Deshabilitar', danger: true })) {
            await act(null, () => API.post('/admin/users/' + u.id + '/enabled', { value: false }), 'Cuenta deshabilitada');
            u.enabled = false;
            refreshAll();
          }
        };

        return h('article', { class: 'block verification-item-card' },
          h('div', { class: 'verification-card-header' },
            h('div', null,
              h('div', { style: 'display:flex; align-items:center; gap:8px;' },
                h('strong', { style: 'font-size:16px;' }, isPh ? (u.pharmacyName || u.name) : u.name),
                h('span', { class: 'badge ' + (isPh ? 'tone-teal' : 'tone-blue'), style: 'display:inline-flex; align-items:center; gap:4px;' },
                  icon(isPh ? 'building' : 'bike'),
                  h('span', null, isPh ? 'Farmacia' : 'Repartidor')
                )
              ),
              h('span', { class: 'muted small block-line', style: 'margin-top:4px;' }, 'Registrado ' + relTime(u.createdAt) + ' · ' + (u.city || u.zone || 'Barranquilla'))
            ),
            h('span', { class: 'badge tone-wait' }, 'Pendiente')
          ),

          h('div', { class: 'verification-details-grid' },
            h('div', null,
              h('span', { class: 'small muted block-line' }, 'Responsable / Titular:'),
              h('strong', null, u.name),
              h('span', { class: 'small muted block-line' }, u.email),
              h('span', { class: 'small muted block-line' }, 'Tel: ' + (u.phone || 'No registrado'))
            ),
            isPh ? h('div', null,
              h('span', { class: 'small muted block-line' }, 'Establecimiento y Licencia:'),
              h('strong', null, u.address || 'Sin dirección física'),
              h('span', { class: 'small muted block-line' }, 'Registro Sanitario: ' + (u.licenseNumber || 'No registrada')),
              h('span', { class: 'small muted block-line' }, 'Horario: ' + (u.openFrom || '08:00') + ' a ' + (u.openTo || '22:00')),
              u.latitude && u.longitude ? h('span', { class: 'small text-success block-line' }, 'Ubicación en OpenStreetMap (' + u.latitude.toFixed(4) + ', ' + u.longitude.toFixed(4) + ')') : null
            ) : h('div', null,
              h('span', { class: 'small muted block-line' }, 'Datos del Repartidor:'),
              h('strong', null, 'Vehículo: ' + (u.vehicle || 'Moto')),
              h('span', { class: 'small muted block-line' }, 'Placa: ' + (u.plate || 'No registrada'))
            )
          ),

          h('div', { class: 'verification-pdf-section' },
            h('strong', { class: 'small bold block-line', style: 'margin-bottom:6px; color:var(--text);' },
              'Documentos adjuntos en PDF (' + docs.length + '):'),
            docs.length ? h('div', { class: 'doc-pdf-badges-wrap' }, docs.map(doc => h('div', { class: 'doc-pdf-pill' },
              h('span', { class: 'doc-pdf-pill-title' }, doc.title || doc.docType),
              h('button', {
                type: 'button',
                class: 'btn primary sm-btn',
                onclick: () => openPdfViewerDialog(doc.title, doc.dataUrl, doc.filename),
                style: 'display:inline-flex; align-items:center; gap:4px;'
              }, icon('prescriptions'), h('span', null, 'Ver PDF')),
              h('a', {
                class: 'btn ghost sm-btn',
                href: doc.dataUrl,
                download: doc.filename || 'documento.pdf',
                target: '_blank',
                style: 'display:inline-flex; align-items:center; gap:4px;'
              }, icon('download'), h('span', null, 'Descargar'))
            ))) : h('p', { class: 'muted small', style: 'margin:0;' }, 'No se adjuntaron archivos PDF al momento de crear la cuenta.')
          ),

          h('div', { class: 'verification-actions-bar', style: 'margin-top:auto;' },
            h('button', {
              class: 'btn primary',
              type: 'button',
              onclick: () => actVerify(true),
              style: 'display:inline-flex; align-items:center; gap:6px;'
            }, icon('check'), h('span', null, 'Aprobar y Verificar')),
            h('button', {
              class: 'btn danger-ghost',
              type: 'button',
              onclick: actDisable,
              style: 'display:inline-flex; align-items:center; gap:6px;'
            }, icon('x'), h('span', null, 'Rechazar / Deshabilitar'))
          )
        );
      }));

      return h('div', { class: 'stack' }, sliderHint, cardsContainer);
    });

    container.replaceChildren(toolbar, content);
  }

  renderView();
  return container;
}

/* Auditoría administrativa: acciones sobre aliados, catálogo, usuarios y sistema. */
function adminMovements() {
  let query = '';
  let type = '';
  const holder = h('div', { class: 'stack' });
  const search = h('input', { type: 'search', placeholder: 'Buscar código, usuario, acción o detalle administrativo', 'aria-label': 'Buscar movimientos administrativos', oninput: () => { query = search.value.trim().toLowerCase(); draw(); } });
  const filter = h('select', { 'aria-label': 'Filtrar movimientos administrativos', onchange: () => { type = filter.value; draw(); } },
    h('option', { value: '' }, 'Todos los movimientos administrativos'),
    h('option', { value: 'USUARIO' }, 'Cuentas de usuario'),
    h('option', { value: 'PRODUCTO' }, 'Catálogo y productos'),
    h('option', { value: 'VERIFICACION' }, 'Verificaciones y permisos'),
    h('option', { value: 'SISTEMA' }, 'Sistema'));
  const draw = () => {
    holder.replaceChildren(live(() => API.get('/admin/movements'), movements => {
      const filtered = movements.filter(m => {
        // Excluir eventos estándar de delivery / pedidos ordinarios de clientes
        if (m.orderCode && !String(m.type).startsWith('ADMIN') && !String(m.type).includes('VERIFICACION')) {
          return false;
        }
        const searchable = [m.code, m.type, m.description, m.actorName, m.actorRole].filter(Boolean).join(' ').toLowerCase();
        let typeOk = true;
        if (type === 'USUARIO') typeOk = String(m.type).startsWith('USUARIO_') || String(m.type).includes('USUARIO');
        else if (type === 'PRODUCTO') typeOk = String(m.type).includes('PRODUCTO');
        else if (type === 'VERIFICACION') typeOk = String(m.type).includes('VERIFICACION') || String(m.type).includes('PERMISO');
        else if (type === 'SISTEMA') typeOk = m.actorRole === 'SISTEMA' || String(m.type).includes('SISTEMA');
        return typeOk && (!query || searchable.includes(query));
      });
      if (!filtered.length) return empty('No hay movimientos administrativos', 'Las acciones de administración sobre usuarios, verificaciones, catálogo y configuración del sistema aparecerán aquí.');
      return h('div', { class: 'table-wrap movement-table' }, h('table', { class: 'users' },
        h('thead', null, h('tr', null, h('th', null, 'Código'), h('th', null, 'Acción Administrativa'), h('th', null, 'Detalle'), h('th', null, 'Responsable'), h('th', null, 'Fecha y hora'))),
        h('tbody', null, filtered.map(m => h('tr', null,
          h('td', null, h('strong', { class: 'movement-code' }, m.code || '—')),
          h('td', null, h('strong', null, movementTypeLabel(m.type))),
          h('td', null, h('span', { class: 'movement-description' }, m.description || 'Sin descripción')),
          h('td', null, h('strong', null, m.actorName || 'Administrador'), h('small', { class: 'block-line muted' }, m.actorRole || 'ADMIN')),
          h('td', null, formatMovementDate(m.createdAt)))))));
    }));
  };
  draw();
  return h('div', { class: 'stack' }, h('div', { class: 'toolbar movement-toolbar' }, search, filter), holder);
}

function movementTypeLabel(type) {
  const labels = {
    USUARIO_VERIFICACION: 'Verificación de aliado',
    USUARIO_ESTADO: 'Estado de usuario',
    USUARIO_PERMISO_EDICION: 'Permiso de edición',
    ADMIN_CREACION: 'Creación de administrador',
    ADMIN_ESTADO: 'Estado de administrador',
    ADMIN_PRODUCTO_CREADO: 'Nuevo producto en catálogo',
    ADMIN_PRODUCTO_ACTUALIZADO: 'Producto editado',
    ADMIN_PRODUCTO_ELIMINADO: 'Producto eliminado',
    ADMIN_PRODUCTO_IMAGEN: 'Foto de producto actualizada'
  };
  return labels[type] || String(type || 'Acción administrativa').replaceAll('_', ' ').toLowerCase().replace(/^./, c => c.toUpperCase());
}
function formatMovementDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

/* ==========================================================================
   Gestión de Cuentas de Administradores (Admin)
   ========================================================================== */
function adminAdministratorsView(currentUser) {
  let query = '';
  let timer;
  const holder = h('div', { class: 'stack' });

  const search = h('input', {
    type: 'search',
    placeholder: 'Buscar administrador por nombre, correo o teléfono...',
    'aria-label': 'Buscar administradores',
    oninput: () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        query = search.value.trim().toLowerCase();
        refreshAll();
      }, 150);
    }
  });

  const list = live(() => API.get('/admin/users?role=ADMIN'), admins => {
    if (!admins.length) return empty('Aún no hay administradores registrados');
    const shown = admins.filter(u => !query ||
      [u.name, u.email, u.phone].filter(Boolean).join(' ').toLowerCase().includes(query)
    );
    if (!shown.length) return empty('Sin resultados', 'No encontramos administradores que coincidan con la búsqueda.');

    const toggle = (u, kind, value, ok) => async e => {
      const updated = await act(e.currentTarget, () => API.post('/admin/users/' + u.id + '/' + kind, { value }), ok);
      if (updated) {
        Object.assign(u, updated);
      } else {
        u[kind] = value;
      }
      refreshAll();
    };

    return h('div', { class: 'table-wrap' }, h('table', { class: 'users' },
      h('thead', null, h('tr', null,
        h('th', null, 'Administrador'),
        h('th', null, 'Contacto Institucional'),
        h('th', null, 'Colección / Permisos'),
        h('th', null, 'Estado'),
        h('th', { style: 'text-align:right' }, 'Acciones')
      )),
      h('tbody', null, shown.map(u => {
        const isSelf = (currentUser && (currentUser.id === u.id || currentUser.email === u.email)) ||
                       (state.user && (state.user.id === u.id || state.user.email === u.email));

        return h('tr', { class: u.enabled ? '' : 'disabled' },
          h('td', null,
            h('div', { style: 'display:flex;align-items:center;gap:8px;' },
              h('strong', { style: 'font-size:16px;' }, u.name),
              isSelf && h('span', { class: 'badge tone-done', style: 'font-size:12px;padding:3px 8px;font-weight:700;' }, 'Tú (Sesión actual)')
            ),
            h('small', { class: 'block-line muted', style: 'font-size:13px;' }, 'ID de cuenta: ' + (u.id || '—'))
          ),
          h('td', null,
            h('span', { style: 'font-size:15px;font-weight:600;' }, u.email),
            h('small', { class: 'block-line muted', style: 'font-size:13px;' }, u.phone ? ('Tel: ' + u.phone) : 'Sin teléfono registrado')
          ),
          h('td', null,
            h('span', { class: 'badge tone-teal', style: 'font-size:12.5px;' }, 'Rol: Administrador General'),
            h('small', { class: 'block-line muted', style: 'font-size:13px;' }, 'Colección: administradores (Acceso Total)')
          ),
          h('td', null,
            u.enabled
              ? h('span', { class: 'badge tone-done' }, 'Activo')
              : h('span', { class: 'badge tone-bad' }, 'Deshabilitado')
          ),
          h('td', { class: 'row-actions', style: 'justify-content:flex-end;' },
            isSelf ? h('span', { class: 'muted small' }, 'Sesión en curso') : (
              u.enabled
                ? h('button', {
                    class: 'btn danger-ghost small',
                    onclick: toggle(u, 'enabled', false, 'Administrador deshabilitado')
                  }, 'Deshabilitar')
                : h('button', {
                    class: 'btn ghost small',
                    onclick: toggle(u, 'enabled', true, 'Administrador habilitado')
                  }, 'Habilitar')
            )
          )
        );
      }))
    ));
  });

  return h('div', { class: 'stack' },
    h('div', { class: 'section-heading' },
      h('div', null,
        h('h2', null, 'Cuentas de Administradores'),
        h('p', { class: 'muted small' }, 'Crea y gestiona cuentas administrativas guardadas en la colección oficial de administradores de FarmaYA.')
      ),
      h('button', {
        class: 'btn primary',
        type: 'button',
        onclick: () => openCreateAdminModal(() => refreshAll())
      }, '+ Crear Administrador')
    ),
    h('div', { class: 'toolbar' }, search),
    list
  );
}

function openCreateAdminModal(onCreated) {
  const nameInput = h('input', {
    type: 'text',
    required: true,
    placeholder: 'Ej: Dra. Carmen Morales',
    'aria-label': 'Nombre completo'
  });

  const emailInput = h('input', {
    type: 'email',
    required: true,
    placeholder: 'carmen.admin@farmaya.com',
    'aria-label': 'Correo electrónico institucional'
  });

  const phoneInput = h('input', {
    type: 'tel',
    required: true,
    placeholder: 'Ej: 300 123 4567',
    'aria-label': 'Teléfono de contacto'
  });

  const passwordInput = h('input', {
    type: 'password',
    required: true,
    minLength: 6,
    placeholder: 'Mínimo 6 caracteres con mayúsculas y números',
    'aria-label': 'Contraseña'
  });

  const togglePassBtn = h('button', {
    type: 'button',
    class: 'btn ghost small',
    style: 'align-self:flex-start;margin-top:4px;',
    onclick: () => {
      if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        togglePassBtn.textContent = 'Ocultar contraseña';
      } else {
        passwordInput.type = 'password';
        togglePassBtn.textContent = 'Ver contraseña';
      }
    }
  }, 'Ver contraseña');

  const errorBox = h('div', { class: 'attention', style: 'display:none;margin-top:10px;' });

  const form = h('form', {
    class: 'form-stack',
    onsubmit: async e => {
      e.preventDefault();
      errorBox.style.display = 'none';
      errorBox.textContent = '';

      const name = nameInput.value.trim();
      const email = emailInput.value.trim().toLowerCase();
      const phone = phoneInput.value.trim();
      const password = passwordInput.value;

      if (!name || name.length < 3) {
        errorBox.textContent = 'Ingresa un nombre válido (al menos 3 caracteres).';
        errorBox.style.display = 'block';
        nameInput.focus();
        return;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errorBox.textContent = 'Ingresa un correo electrónico institucional válido.';
        errorBox.style.display = 'block';
        emailInput.focus();
        return;
      }

      if (!password || password.length < 6) {
        errorBox.textContent = 'La contraseña debe contener al menos 6 caracteres.';
        errorBox.style.display = 'block';
        passwordInput.focus();
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      await act(submitBtn, async () => {
        const created = await API.post('/admin/administrators', { name, email, phone, password });
        d.close();
        toast('Administrador ' + created.name + ' guardado en la colección de administradores.');
        if (onCreated) onCreated();
      });
    }
  },
    h('div', { class: 'field' },
      h('label', { class: 'field-label' }, 'Nombre Completo:'),
      nameInput
    ),
    h('div', { class: 'field' },
      h('label', { class: 'field-label' }, 'Correo Electrónico Institucional:'),
      emailInput
    ),
    h('div', { class: 'field' },
      h('label', { class: 'field-label' }, 'Número de Teléfono:'),
      phoneInput
    ),
    h('div', { class: 'field' },
      h('label', { class: 'field-label' }, 'Contraseña de Acceso:'),
      passwordInput,
      togglePassBtn
    ),
    errorBox,
    h('div', { class: 'actions', style: 'margin-top:20px;' },
      h('button', { class: 'btn ghost', type: 'button', onclick: () => d.close() }, 'Cancelar'),
      h('button', { class: 'btn primary', type: 'submit' }, 'Guardar Administrador')
    )
  );

  const dialogContent = h('div', { class: 'sheet-body', style: 'max-width:520px;' },
    h('div', { style: 'display:flex;align-items:center;gap:12px;margin-bottom:12px;' },
      h('span', { class: 'badge tone-done', style: 'font-weight:700;padding:6px 10px;' }, 'Admin'),
      h('div', null,
        h('h3', { style: 'margin:0;' }, 'Crear Nuevo Administrador'),
        h('p', { class: 'muted small', style: 'margin:2px 0 0;' }, 'La cuenta se registrará y persistirá en la colección oficial de administradores.')
      )
    ),
    form
  );

  const d = openDialog(dialogContent);
  setTimeout(() => nameInput.focus(), 100);
}

/* ==========================================================================
   Gestión de Catálogo e Imágenes de Medicamentos (Admin)
   ========================================================================== */
function adminCatalogManager() {
  let query = '';
  let category = '';
  const holder = h('div', { class: 'stack' });

  const search = h('input', {
    type: 'search',
    placeholder: 'Buscar medicamento por nombre, componente o laboratorio...',
    'aria-label': 'Buscar medicamento',
    oninput: () => {
      query = search.value.trim().toLowerCase();
      draw();
    }
  });

  const catSelect = h('select', {
    'aria-label': 'Filtrar por categoría',
    onchange: () => {
      category = catSelect.value;
      draw();
    }
  },
    h('option', { value: '' }, 'Todas las categorías'),
    CATEGORIES.map(c => h('option', { value: c.id }, c.label))
  );

  const countPill = h('span', { class: 'product-counter-pill' }, 'Cargando catálogo...');

  const draw = () => {
    const customImages = typeof getCustomProductImages === 'function' ? getCustomProductImages() : {};
    const filtered = CATALOG.filter(p => {
      const matchCat = !category || p.cat === category;
      const searchable = [p.name, p.active, p.lab, p.presentation, p.invima].filter(Boolean).join(' ').toLowerCase();
      const matchQ = !query || searchable.includes(query);
      return matchCat && matchQ;
    });

    countPill.textContent = `${filtered.length} de ${CATALOG.length} productos`;

    if (!filtered.length) {
      holder.replaceChildren(empty('No se encontraron medicamentos', 'Prueba modificando los términos de búsqueda o agrega un nuevo producto con el botón superior.'));
      return;
    }

    const tableWrap = h('div', { class: 'table-wrap stitch-admin-catalog-wrap' },
      h('table', { class: 'users admin-catalog-table' },
        h('thead', null,
          h('tr', null,
            h('th', { style: 'width:90px' }, 'Imagen'),
            h('th', null, 'Medicamento / Ficha Técnica'),
            h('th', null, 'Categoría'),
            h('th', null, 'Precio Sugerido'),
            h('th', null, 'Estado Foto'),
            h('th', { style: 'text-align:right' }, 'Acciones')
          )
        ),
        h('tbody', null, filtered.map(p => {
          const hasCustom = !!(p.imageUrl || customImages[p.name]);
          const artWrapper = h('div', {
            class: 'admin-product-thumb',
            style: 'cursor:pointer;',
            title: 'Haz clic para cambiar la fotografía',
            onclick: () => openProductImageModal(p, () => {
              if (typeof syncCatalogWithBackend === 'function') syncCatalogWithBackend();
              draw();
            })
          }, productArt(p));

          return h('tr', null,
            h('td', null, artWrapper),
            h('td', null,
              h('div', { style: 'display:flex;align-items:center;gap:6px;' },
                h('strong', { class: 'admin-med-title' }, p.name),
                p.rx && h('span', { class: 'badge-rx inline', style: 'font-size:11px;' }, 'Rx'),
                p.featured && h('span', { class: 'badge tone-teal inline', style: 'font-size:10px;' }, 'Destacado')
              ),
              h('small', { class: 'block-line text-secondary' }, p.presentation || 'Sin presentación definida'),
              h('small', { class: 'block-line muted' }, (p.lab || 'Laboratorio estándar') + (p.invima ? ' · ' + p.invima : '')),
              p.active && h('small', { class: 'block-line muted' }, 'Principio: ' + p.active)
            ),
            h('td', null,
              h('span', { class: 'badge' }, CATEGORIES.find(c => c.id === p.cat)?.label || p.cat)
            ),
            h('td', null,
              h('strong', { class: 'product-price' }, money(p.price))
            ),
            h('td', null,
              hasCustom
                ? h('span', { class: 'badge tone-done' }, 'Foto personalizada')
                : h('span', { class: 'badge tone-wait' }, 'Ilustración médica')
            ),
            h('td', { class: 'row-actions', style: 'justify-content:flex-end;gap:8px;' },
              h('button', {
                class: 'btn ghost small',
                type: 'button',
                title: 'Editar información y características del producto',
                onclick: () => openAdminProductModal(p, () => {
                  if (typeof syncCatalogWithBackend === 'function') syncCatalogWithBackend();
                  draw();
                })
              }, 'Editar'),
              h('button', {
                class: 'btn primary small',
                type: 'button',
                title: 'Gestionar foto del producto',
                onclick: () => openProductImageModal(p, () => {
                  if (typeof syncCatalogWithBackend === 'function') syncCatalogWithBackend();
                  draw();
                })
              }, hasCustom ? 'Foto' : '+ Foto'),
              h('button', {
                class: 'btn danger-ghost small',
                type: 'button',
                title: 'Eliminar este producto del catálogo',
                onclick: async () => {
                  const ok = await confirmBox({
                    title: 'Eliminar producto',
                    message: `¿Estás seguro de que deseas eliminar permanentemente "${p.name}" del catálogo institucional y de la base de datos?`,
                    ok: 'Eliminar',
                    danger: true
                  });
                  if (!ok) return;

                  try {
                    const targetId = p.id || encodeURIComponent(p.name);
                    await API.delete('/products/' + targetId);
                  } catch (err) {
                    console.debug('Error deleting product from backend:', err);
                  }

                  const idx = CATALOG.findIndex(item => item === p || (p.id && item.id === p.id) || norm(item.name) === norm(p.name));
                  if (idx >= 0) CATALOG.splice(idx, 1);
                  if (typeof saveProductImage === 'function') saveProductImage(p.name, null);

                  toast(`Producto "${p.name}" eliminado del catálogo.`);
                  window.dispatchEvent(new CustomEvent('farmaya:catalog-refresh'));
                  draw();
                }
              }, 'Eliminar')
            )
          );
        }))
      )
    );

    holder.replaceChildren(tableWrap);
  };

  // Escuchar actualizaciones de catálogo
  window.addEventListener('farmaya:catalog-synced', draw);
  window.addEventListener('farmaya:product-images-updated', draw);

  draw();

  return h('div', { class: 'stack' },
    h('div', { class: 'section-heading' },
      h('div', null,
        h('h2', null, 'Catálogo de Medicamentos y Productos'),
        h('p', { class: 'muted small' }, 'Ingresa nuevos medicamentos, edita los existentes y administra sus fotos y fichas técnicas en tiempo real.')
      ),
      h('button', {
        class: 'btn primary',
        type: 'button',
        onclick: () => openAdminProductModal(null, () => {
          if (typeof syncCatalogWithBackend === 'function') syncCatalogWithBackend();
          draw();
        })
      }, '+ Ingresar Nuevo Producto')
    ),
    h('div', { class: 'toolbar', style: 'display:flex;align-items:center;gap:12px;flex-wrap:wrap;' },
      search,
      catSelect,
      countPill
    ),
    holder
  );
}

/* Modal integral para INGRESAR NUEVO o EDITAR producto existente */
function openAdminProductModal(p, onSaved) {
  const isEditing = !!p;
  const customImages = typeof getCustomProductImages === 'function' ? getCustomProductImages() : {};
  let currentImageUrl = (p && (p.imageUrl || customImages[p.name])) || '';

  const nameInput = h('input', {
    type: 'text',
    required: true,
    value: p ? p.name : '',
    placeholder: 'Ej: Ibuprofeno 800 mg',
    'aria-label': 'Nombre del producto'
  });

  const catSelect = h('select', {
    required: true,
    'aria-label': 'Categoría'
  },
    CATEGORIES.map(c => h('option', { value: c.id, selected: p && p.cat === c.id }, c.label))
  );

  const priceInput = h('input', {
    type: 'number',
    required: true,
    min: 100,
    step: 100,
    value: p ? p.price : '',
    placeholder: 'Ej: 14500',
    'aria-label': 'Precio sugerido en pesos colombianos'
  });

  const labInput = h('input', {
    type: 'text',
    value: p && p.lab ? p.lab : '',
    placeholder: 'Ej: MK (Tecnoquímicas), Genfar, Bayer',
    'aria-label': 'Laboratorio farmacéutico'
  });

  const presInput = h('input', {
    type: 'text',
    value: p && p.presentation ? p.presentation : '',
    placeholder: 'Ej: Caja x 30 tabletas recubiertas, Frasco x 350 ml',
    'aria-label': 'Presentación comercial'
  });

  const invimaInput = h('input', {
    type: 'text',
    value: p && p.invima ? p.invima : '',
    placeholder: 'Ej: INVIMA 2021M-0012345-R1',
    'aria-label': 'Registro sanitario INVIMA'
  });

  const activeInput = h('input', {
    type: 'text',
    value: p && p.active ? p.active : '',
    placeholder: 'Ej: Ibuprofeno 800 mg, Acetaminofén 500 mg',
    'aria-label': 'Principio activo'
  });

  const indInput = h('textarea', {
    rows: 2,
    placeholder: 'Ej: Alivio de dolores intensos, antiinflamatorio no esteroideo...',
    'aria-label': 'Indicación terapéutica'
  }, p && p.indication ? p.indication : '');

  const storInput = h('input', {
    type: 'text',
    value: p && p.storage ? p.storage : 'Temperatura ambiente controlada (15°C - 25°C)',
    placeholder: 'Condiciones de conservación recomendadas',
    'aria-label': 'Conservación'
  });

  const rxCheckbox = h('input', {
    type: 'checkbox',
    id: 'modal_rx_check',
    checked: p ? !!p.rx : false
  });

  const featCheckbox = h('input', {
    type: 'checkbox',
    id: 'modal_feat_check',
    checked: p ? !!p.featured : false
  });

  // Sección de imagen en vivo
  const previewBox = h('div', { class: 'image-modal-preview' });
  const updateImagePreview = url => {
    currentImageUrl = url;
    if (url) {
      previewBox.innerHTML = '<img src="' + url + '" alt="Vista previa" class="admin-preview-img" style="max-height:100px;" />';
    } else {
      previewBox.replaceChildren(productArt(p || { art: 'box', color: '#16865d', name: nameInput.value || 'Medicamento' }));
    }
  };
  updateImagePreview(currentImageUrl);

  const imgUrlInput = h('input', {
    type: 'url',
    placeholder: 'https://ejemplo.com/fotos/producto.jpg',
    value: currentImageUrl && !currentImageUrl.startsWith('data:') ? currentImageUrl : '',
    oninput: () => updateImagePreview(imgUrlInput.value.trim())
  });

  const fileInput = h('input', {
    type: 'file',
    accept: 'image/*',
    style: 'display:none',
    onchange: e => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      if (file.size > 4 * 1024 * 1024) {
        toast('La fotografía no debe superar 4MB', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = ev => {
        imgUrlInput.value = '';
        updateImagePreview(ev.target.result);
      };
      reader.readAsDataURL(file);
    }
  });

  const uploadBtn = h('button', {
    class: 'btn secondary small',
    type: 'button',
    onclick: () => fileInput.click()
  }, 'Subir foto desde archivo');

  // Presets rápidos
  const presets = [
    { label: 'Cápsulas blandas', url: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=360&auto=format&fit=crop&q=80' },
    { label: 'Caja tabletas', url: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=360&auto=format&fit=crop&q=80' },
    { label: 'Jarabe', url: 'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=360&auto=format&fit=crop&q=80' },
    { label: 'Crema / Pomada', url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=360&auto=format&fit=crop&q=80' }
  ];

  const presetRow = h('div', { class: 'preset-pills-row' },
    presets.map(item => h('button', {
      type: 'button',
      class: 'btn ghost small preset-pill-btn',
      onclick: () => {
        imgUrlInput.value = item.url;
        updateImagePreview(item.url);
      }
    }, item.label))
  );

  const errorBox = h('div', { class: 'attention', style: 'display:none;margin-top:10px;' });

  const form = h('form', {
    class: 'form-stack',
    onsubmit: async e => {
      e.preventDefault();
      errorBox.style.display = 'none';

      const name = nameInput.value.trim();
      const cat = catSelect.value;
      const price = parseFloat(priceInput.value);

      if (!name) {
        errorBox.textContent = 'El nombre del producto es obligatorio.';
        errorBox.style.display = 'block';
        nameInput.focus();
        return;
      }

      if (!price || price <= 0) {
        errorBox.textContent = 'Ingresa un precio sugerido válido mayor a 0.';
        errorBox.style.display = 'block';
        priceInput.focus();
        return;
      }

      const payload = {
        name,
        cat,
        price,
        lab: labInput.value.trim(),
        presentation: presInput.value.trim(),
        invima: invimaInput.value.trim(),
        active: activeInput.value.trim(),
        indication: indInput.value.trim(),
        storage: storInput.value.trim(),
        rx: rxCheckbox.checked,
        featured: featCheckbox.checked,
        imageUrl: currentImageUrl || null,
        art: (p && p.art) || (cat === 'vital' ? 'bottle' : cat === 'derm' || cat === 'care' ? 'jar' : 'box'),
        color: (p && p.color) || '#16865d'
      };

      const submitBtn = form.querySelector('button[type="submit"]');
      await act(submitBtn, async () => {
        if (isEditing) {
          // Actualización de producto existente
          const updateId = p.id || encodeURIComponent(p.name);
          const oldName = p.name;
          try {
            const updated = await API.put('/products/' + updateId, payload);
            Object.assign(p, updated);
          } catch (err) {
            // Si el backend aún no tenía este producto en base de datos, lo creamos
            const created = await API.post('/products', payload);
            Object.assign(p, created);
          }

          if (typeof saveProductImage === 'function') {
            if (oldName && oldName !== payload.name) {
              saveProductImage(oldName, null);
            }
            saveProductImage(payload.name, payload.imageUrl);
          }

          toast(`Producto "${payload.name}" actualizado exitosamente.`);
        } else {
          // Creación de nuevo producto
          const created = await API.post('/products', payload);
          const fullProduct = Object.assign({
            id: created.id,
            ...payload
          }, created);

          CATALOG.unshift(fullProduct);

          if (payload.imageUrl && typeof saveProductImage === 'function') {
            saveProductImage(fullProduct.name, payload.imageUrl);
          }

          toast(`Producto "${payload.name}" ingresado exitosamente al catálogo.`);
        }

        window.dispatchEvent(new CustomEvent('farmaya:catalog-refresh'));
        d.close();
        if (onSaved) onSaved();
      });
    }
  },
    h('div', { class: 'product-form-grid' },
      h('div', { class: 'field' },
        h('label', { class: 'field-label' }, 'Nombre Comercial del Producto:'),
        nameInput
      ),
      h('div', { class: 'field' },
        h('label', { class: 'field-label' }, 'Categoría:'),
        catSelect
      ),
      h('div', { class: 'field' },
        h('label', { class: 'field-label' }, 'Precio Sugerido (COP):'),
        priceInput
      ),
      h('div', { class: 'field' },
        h('label', { class: 'field-label' }, 'Laboratorio Farmacéutico:'),
        labInput
      ),
      h('div', { class: 'field' },
        h('label', { class: 'field-label' }, 'Presentación Comercial:'),
        presInput
      ),
      h('div', { class: 'field' },
        h('label', { class: 'field-label' }, 'Registro Sanitario INVIMA:'),
        invimaInput
      ),
      h('div', { class: 'field full-width' },
        h('label', { class: 'field-label' }, 'Principio Activo y Concentración:'),
        activeInput
      ),
      h('div', { class: 'field full-width' },
        h('label', { class: 'field-label' }, 'Indicación Terapéutica:'),
        indInput
      ),
      h('div', { class: 'field full-width' },
        h('label', { class: 'field-label' }, 'Condiciones de Conservación:'),
        storInput
      ),
      h('div', { class: 'field full-width' },
        h('div', { class: 'product-form-switches' },
          h('label', null,
            rxCheckbox,
            h('span', null, 'Requiere Fórmula Médica Obligatoria (Rx)')
          ),
          h('label', null,
            featCheckbox,
            h('span', null, 'Destacado en pantalla de inicio')
          )
        )
      ),
      // Módulo de imagen
      h('div', { class: 'field full-width', style: 'margin-top:10px;' },
        h('label', { class: 'field-label', style: 'font-weight:700;' }, 'Fotografía del Producto:'),
        h('div', { class: 'image-modal-grid', style: 'margin:8px 0;' },
          h('div', { class: 'image-modal-preview-box', style: 'min-height:120px;' },
            h('span', { class: 'small muted', style: 'margin-bottom:6px;' }, 'Previsualización:'),
            previewBox
          ),
          h('div', { class: 'form-stack' },
            uploadBtn,
            fileInput,
            h('div', { style: 'margin-top:8px;' },
              h('span', { class: 'small muted' }, 'O escribe la URL directa:'),
              imgUrlInput
            ),
            h('div', { style: 'margin-top:8px;' },
              h('span', { class: 'small muted' }, 'Fotos sugeridas rápidas:'),
              presetRow
            )
          )
        )
      )
    ),
    errorBox,
    h('div', { class: 'actions', style: 'margin-top:20px;' },
      h('button', { class: 'btn ghost', type: 'button', onclick: () => d.close() }, 'Cancelar'),
      isEditing && h('button', {
        class: 'btn danger-ghost',
        type: 'button',
        onclick: async () => {
          const ok = await confirmBox({
            title: 'Eliminar producto',
            message: `¿Estás seguro de que deseas eliminar permanentemente "${p.name}" del catálogo institucional y de la base de datos?`,
            ok: 'Eliminar permanentemente',
            danger: true
          });
          if (!ok) return;

          try {
            const targetId = p.id || encodeURIComponent(p.name);
            await API.delete('/products/' + targetId);
          } catch (err) {
            console.debug('Error deleting product from backend:', err);
          }

          const idx = CATALOG.findIndex(item => item === p || (p.id && item.id === p.id) || norm(item.name) === norm(p.name));
          if (idx >= 0) CATALOG.splice(idx, 1);
          if (typeof saveProductImage === 'function') saveProductImage(p.name, null);

          toast(`Producto "${p.name}" eliminado del catálogo.`);
          window.dispatchEvent(new CustomEvent('farmaya:catalog-refresh'));
          d.close();
          if (onSaved) onSaved();
        }
      }, 'Eliminar Producto'),
      h('button', { class: 'btn primary', type: 'submit' }, isEditing ? 'Guardar Cambios' : 'Ingresar al Catálogo')
    )
  );

  const dialogContent = h('div', { class: 'sheet-body product-edit-sheet' },
    h('div', { style: 'display:flex;align-items:center;gap:12px;margin-bottom:12px;' },
      h('span', { class: 'badge tone-teal', style: 'font-weight:700;padding:6px 10px;' }, isEditing ? 'Edición' : 'Catálogo'),
      h('div', null,
        h('h3', { style: 'margin:0;' }, isEditing ? `Editar Producto: ${p.name}` : 'Ingresar Nuevo Producto al Catálogo'),
        h('p', { class: 'muted small', style: 'margin:2px 0 0;' }, 'Los cambios se persistirán en la base de datos y se sincronizarán con los clientes.')
      )
    ),
    form
  );

  const d = openDialog(dialogContent, { wide: true });
  setTimeout(() => nameInput.focus(), 100);
}

function openProductImageModal(p, onSaved) {
  const customImages = typeof getCustomProductImages === 'function' ? getCustomProductImages() : {};
  let selectedUrl = p.imageUrl || customImages[p.name] || '';
  const previewImg = h('div', { class: 'image-modal-preview' });

  const updatePreview = url => {
    selectedUrl = url;
    if (url) {
      previewImg.innerHTML = '<img src="' + url + '" alt="Vista previa" class="admin-preview-img" />';
    } else {
      previewImg.replaceChildren(productArt(p));
    }
  };

  updatePreview(selectedUrl);

  const urlInput = h('input', {
    type: 'url',
    placeholder: 'https://ejemplo.com/imagenes/medicamento.jpg',
    value: selectedUrl && !selectedUrl.startsWith('data:') ? selectedUrl : '',
    oninput: () => updatePreview(urlInput.value.trim())
  });

  const fileInput = h('input', {
    type: 'file',
    accept: 'image/*',
    style: 'display:none',
    onchange: e => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      if (file.size > 4 * 1024 * 1024) {
        toast('La imagen no debe superar 4MB', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = ev => {
        const dataUrl = ev.target.result;
        urlInput.value = '';
        updatePreview(dataUrl);
      };
      reader.readAsDataURL(file);
    }
  });

  const uploadBtn = h('button', {
    class: 'btn secondary',
    type: 'button',
    onclick: () => fileInput.click()
  }, 'Subir foto desde archivo');

  // Galería de fotos médicas preconfiguradas
  const presets = [
    { label: 'Cápsulas blandas', url: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=360&auto=format&fit=crop&q=80' },
    { label: 'Caja de tabletas', url: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=360&auto=format&fit=crop&q=80' },
    { label: 'Frasco jarabe', url: 'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=360&auto=format&fit=crop&q=80' },
    { label: 'Crema / Ungüento', url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=360&auto=format&fit=crop&q=80' },
    { label: 'Suero oral', url: 'https://images.unsplash.com/photo-1559757175-5700dde675bc?w=360&auto=format&fit=crop&q=80' },
    { label: 'Vitamina C efervescente', url: 'https://images.unsplash.com/photo-1576602976047-174e57a47881?w=360&auto=format&fit=crop&q=80' }
  ];

  const presetList = h('div', { class: 'preset-pills-row' },
    presets.map(item => h('button', {
      type: 'button',
      class: 'btn ghost small preset-pill-btn',
      onclick: () => {
        urlInput.value = item.url;
        updatePreview(item.url);
      }
    }, item.label))
  );

  const content = h('div', { class: 'sheet-body image-edit-sheet' },
    h('h3', null, 'Asignar Imagen a ' + p.name),
    h('p', { class: 'muted small' }, 'Sube una fotografía de empaque oficial o ingresa una dirección web. Esta imagen se visualizará en el catálogo para los pacientes.'),
    h('div', { class: 'image-modal-grid' },
      h('div', { class: 'image-modal-preview-box' },
        h('strong', { class: 'small muted block-line', style: 'margin-bottom:8px;' }, 'Vista previa actual:'),
        previewImg
      ),
      h('div', { class: 'image-modal-controls-box form-stack' },
        h('div', { class: 'field' },
          h('label', { class: 'field-label' }, 'Opción 1: Cargar desde tu archivo local'),
          uploadBtn,
          fileInput
        ),
        h('div', { class: 'field' },
          h('label', { class: 'field-label' }, 'Opción 2: O escribe la URL directa de la imagen'),
          urlInput
        ),
        h('div', { class: 'field' },
          h('label', { class: 'field-label' }, 'Opción 3: Fotos de referencia rápida'),
          presetList
        )
      )
    ),
    h('div', { class: 'actions' },
      h('button', { class: 'btn ghost', type: 'button', onclick: () => d.close() }, 'Cancelar'),
      selectedUrl && h('button', {
        class: 'btn danger-ghost',
        type: 'button',
        onclick: async () => {
          saveProductImage(p.name, null);
          p.imageUrl = null;
          try {
            const targetId = p.id || encodeURIComponent(p.name);
            await API.put('/products/' + targetId, { imageUrl: '' });
          } catch (_) {}
          d.close();
          toast('Se restableció la ilustración');
          window.dispatchEvent(new CustomEvent('farmaya:catalog-refresh'));
          if (onSaved) onSaved();
        }
      }, 'Quitar foto'),
      h('button', {
        class: 'btn primary',
        type: 'button',
        onclick: async () => {
          if (!selectedUrl) {
            toast('Por favor selecciona o sube una imagen', 'error');
            return;
          }
          saveProductImage(p.name, selectedUrl);
          p.imageUrl = selectedUrl;
          try {
            const targetId = p.id || encodeURIComponent(p.name);
            await API.put('/products/' + targetId, { imageUrl: selectedUrl });
          } catch (_) {}
          d.close();
          toast('Foto de ' + p.name + ' guardada exitosamente.');
          window.dispatchEvent(new CustomEvent('farmaya:catalog-refresh'));
          if (onSaved) onSaved();
        }
      }, 'Guardar Imagen')
    )
  );

  const d = openDialog(content, { wide: true });
}
