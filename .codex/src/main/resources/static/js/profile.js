/* FarmaYA · Panel desplegable de opciones (Menú de 3 líneas tipo Rappi):
   Navegación rápida, Configuración (Cambiar tema, Cambiar datos / número con regla de permisos para farmacias, Contraseña) y Cerrar sesión. */

const initialsOf = name => (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

function openProfile(initialView = 'menu') {
  let view = initialView; // menu | profile | edit | password | settings
  const body = h('div', { class: 'drawer-body' });
  const d = openDialog(h('div', { class: 'sheet-body' },
    h('button', { class: 'close', type: 'button', 'aria-label': 'Cerrar panel', onclick: () => d.close() }, '×'),
    body), { drawer: true });

  const user = () => state.user;
  const go = v => () => { view = v; draw(); };

  function header() {
    const u = user();
    if (!u) {
      return h('header', { class: 'profile-head' },
        h('span', { class: 'avatar', 'aria-hidden': 'true' }, '+'),
        h('div', { class: 'profile-meta' },
          h('h2', { class: 'profile-name' }, 'FarmaYa'),
          h('p', { class: 'profile-sub' }, 'Salud y farmacia a domicilio')));
    }
    const roleName = ROLE_NAMES[u.role] || u.role;
    let subtitle = roleName;
    if (u.role === 'FARMACIA') {
      subtitle = (u.pharmacyName || 'Farmacia') + ' · ' + (u.verified ? 'Verificada' : 'Por verificar');
    } else if (u.role === 'REPARTIDOR') {
      subtitle = (u.vehicle || 'Repartidor') + ' · ' + (u.verified ? 'Verificado' : 'Por verificar');
    } else if (u.phone) {
      subtitle = roleName + ' · ' + u.phone;
    }
    return h('header', { class: 'profile-head' },
      h('span', { class: 'avatar', 'aria-hidden': 'true' }, initialsOf(u.name)),
      h('div', { class: 'profile-meta' },
        h('h2', { class: 'profile-name' }, u.name),
        h('p', { class: 'profile-sub' }, subtitle)));
  }

  function menuItem(iconName, label, onclick, opts = {}) {
    return h('button', {
      type: 'button',
      class: 'menu-item' + (opts.on ? ' on' : '') + (opts.danger ? ' danger' : ''),
      onclick,
      'aria-current': opts.on ? 'page' : null
    },
      iconName ? icon(iconName, 'mi-ico') : h('span', { class: 'mi-dot' }),
      h('span', { class: 'mi-label' }, label),
      opts.badge ? h('span', { class: 'badge tone-wait' }, opts.badge) : null,
      opts.danger ? null : icon('chevR', 'mi-chev'));
  }

  function themeSwitcher() {
    const cur = theme.current;
    const btn = (mode, label, icoName) => h('button', {
      type: 'button',
      class: 'theme-pill-btn' + (cur === mode ? ' active' : ''),
      onclick: () => {
        theme.apply(mode);
        draw();
        toast('Tema ' + label.toLowerCase() + ' activado');
      }
    }, icon(icoName), h('span', null, label));

    return h('div', { class: 'theme-switcher-box' },
      btn('light', 'Claro', 'sun'),
      btn('dark', 'Oscuro', 'moon'),
      btn('auto', 'Auto', 'device'));
  }

  function item(label, value) {
    if (value == null || value === '') return null;
    return h('div', null, h('dt', null, label), h('dd', null, value));
  }

  function viewList() {
    const u = user();
    const verifies = u.role === 'FARMACIA' || u.role === 'REPARTIDOR';
    return h('section', { class: 'profile-section' },
      h('h3', null, 'Mi perfil'),
      h('dl', { class: 'profile-list' },
        item('Nombre', u.name),
        item('Teléfono de contacto', u.phone),
        item('Correo electrónico', u.email),
        item('Zona asignada', u.zone),
        u.role === 'FARMACIA' && item('Establecimiento', u.pharmacyName),
        u.role === 'FARMACIA' && item('Dirección', u.address),
        u.role === 'FARMACIA' && item('Horario de atención', u.openFrom === u.openTo ? 'Abierta las 24 horas' : u.openFrom + ' a ' + u.openTo),
        u.role === 'FARMACIA' && item('Registro / Licencia', u.licenseNumber),
        u.role === 'FARMACIA' && h('div', null,
          h('dt', null, 'Permiso de edición de datos y número'),
          h('dd', null, u.canEditProfile
            ? h('span', { class: 'badge tone-done' }, 'Autorizado por administrador')
            : u.editPermissionRequested
              ? h('span', { class: 'badge tone-wait' }, 'Solicitud en revisión')
              : h('span', { class: 'badge tone-bad' }, 'Requiere permiso del administrador'))),
        u.role === 'REPARTIDOR' && item('Vehículo de entrega', u.vehicle),
        verifies && h('div', null,
          h('dt', null, 'Estado en la red'),
          h('dd', null, h('span', { class: 'badge ' + (u.verified ? 'tone-done' : 'tone-wait') }, u.verified ? 'Cuenta verificada' : 'Verificación pendiente'))),
        u.createdAt && item('Registrado desde', new Date(u.createdAt).toLocaleDateString(CONFIG.locale, { day: 'numeric', month: 'long', year: 'numeric' }))),
      h('button', { class: 'btn primary block', type: 'button', onclick: go('edit') },
        u.role === 'FARMACIA' && !u.canEditProfile ? 'Gestionar datos y permisos' : 'Editar mis datos / Cambiar número'));
  }

  function editForm() {
    const u = user();
    const isPharmacy = u.role === 'FARMACIA';
    const canEdit = !isPharmacy || u.canEditProfile === true;

    const f = {
      name: h('input', { name: 'name', required: true, minLength: 2, value: u.name || '', autocomplete: 'name', disabled: !canEdit }),
      phone: h('input', { name: 'phone', type: 'tel', required: true, minLength: 7, value: u.phone || '', autocomplete: 'tel', disabled: !canEdit }),
      email: h('input', { name: 'email', type: 'email', required: true, value: u.email || '', autocomplete: 'email', disabled: !canEdit }),
      zone: isPharmacy && !canEdit
        ? h('input', { name: 'zone', value: u.zone || '', disabled: true })
        : zoneSelect('zone', u.zone)
    };

    const extra = [];
    let permBanner = null;

    if (isPharmacy) {
      f.pharmacyName = h('input', { name: 'pharmacyName', required: true, value: u.pharmacyName || '', disabled: !canEdit });
      f.address = h('input', { name: 'address', required: true, minLength: 5, value: u.address || '', disabled: !canEdit });
      f.latitude = h('input', { name: 'latitude', type: 'number', step: 'any', min: -90, max: 90, value: u.latitude ?? '', disabled: !canEdit, placeholder: 'Ej. 10.3997' });
      f.longitude = h('input', { name: 'longitude', type: 'number', step: 'any', min: -180, max: 180, value: u.longitude ?? '', disabled: !canEdit, placeholder: 'Ej. -75.5000' });
      f.openFrom = h('input', { name: 'openFrom', type: 'time', required: true, value: u.openFrom || '08:00', disabled: !canEdit });
      f.openTo = h('input', { name: 'openTo', type: 'time', required: true, value: u.openTo || '22:00', disabled: !canEdit });

      extra.push(
        field('Nombre comercial de la farmacia', f.pharmacyName),
        field('Dirección física', f.address),
        h('div', { class: 'two' }, field('Latitud del establecimiento', f.latitude), field('Longitud del establecimiento', f.longitude)),
        h('p', { class: 'muted small' }, 'Las coordenadas son necesarias para calcular la distancia estimada y las ganancias del repartidor. Puedes copiarlas desde el pin de la farmacia en el mapa. Déjalas ambas vacías si aún no las tienes.'),
        h('div', { class: 'two' }, field('Apertura', f.openFrom), field('Cierre', f.openTo)),
        h('p', { class: 'muted small' }, 'Número de licencia sanitaria (' + (u.licenseNumber || 'RS-0000') + '). Solo modificable por la entidad reguladora o administración.')
      );

      if (!canEdit) {
        if (u.editPermissionRequested) {
          permBanner = h('div', { class: 'perm-box pending' },
            h('strong', null, '⏳ Solicitud enviada al Administrador'),
            h('span', null, 'Tu solicitud para modificar los datos y el número de contacto de tu farmacia se encuentra en revisión.' + (u.editRequestNote ? ' Motivo: "' + u.editRequestNote + '".' : '')),
            h('small', { class: 'muted' }, 'En cuanto el administrador conceda la autorización, estos campos se desbloquearán automáticamente.'));
        } else {
          permBanner = h('div', { class: 'perm-box required' },
            h('strong', null, '🔒 Permiso de Administrador requerido'),
            h('span', null, 'Como farmacia aliada, tus datos comerciales y número de teléfono están bajo protocolo de seguridad. Para modificarlos o cambiar tu número de contacto, requieres la autorización previa de un administrador.'),
            h('button', {
              class: 'btn primary small',
              type: 'button',
              onclick: async () => {
                const reason = await promptBox({
                  title: 'Solicitar autorización de edición',
                  message: 'Describe el motivo de la modificación (por ejemplo: "Actualizar número de teléfono/WhatsApp y horario de atención").',
                  label: 'Motivo de la solicitud',
                  placeholder: 'Ej. Cambio de número de contacto de la farmacia',
                  ok: 'Enviar al Administrador',
                  minLength: 4,
                  multiline: true
                });
                if (!reason) return;
                try {
                  const res = await API.post('/auth/request-edit-permission', { reason });
                  Object.assign(state.user, res);
                  toast('Solicitud enviada al administrador exitosamente');
                  draw();
                } catch (err) {
                  toast(err.message, 'error');
                }
              }
            }, '📩 Solicitar permiso al Administrador'));
        }
      } else {
        permBanner = h('div', { class: 'perm-box granted' },
          h('strong', null, '✅ Permiso de edición concedido por el Administrador'),
          h('span', null, 'Cuentas con autorización activa para modificar los datos de tu establecimiento y cambiar tu número de contacto. Recuerda pulsar "Guardar cambios autorizados" para aplicar la actualización.'));
      }
    } else if (u.role === 'REPARTIDOR') {
      f.vehicle = h('select', { name: 'vehicle', required: true },
        ['Moto', 'Bicicleta', 'Carro', 'A pie'].map(v => h('option', { value: v, selected: v === u.vehicle }, v)));
      extra.push(field('Medio de transporte', f.vehicle));
    }

    const form = h('form', {
      class: 'form-stack',
      onsubmit: async e => {
        e.preventDefault();
        if (isPharmacy && !u.canEditProfile) {
          toast('Requieres autorización del administrador para guardar cambios.', 'error');
          return;
        }
        const payload = {};
        Object.entries(f).forEach(([k, el]) => { payload[k] = el.value; });
        if (isPharmacy) { payload.latitude = f.latitude.value.trim() === '' ? null : Number(f.latitude.value); payload.longitude = f.longitude.value.trim() === '' ? null : Number(f.longitude.value); }
        payload.email = f.email.value.trim();
        const saved = await act(form.querySelector('button[type=submit]'), () => API.put('/auth/profile', payload), 'Datos y número actualizados correctamente');
        if (!saved) return;
        Object.assign(state.user, saved);
        view = 'profile';
        draw();
        renderNavbar();
        if (u.role === 'FARMACIA' || u.role === 'REPARTIDOR') renderApp();
        refreshAll();
      }
    },
      h('h3', null, isPharmacy ? 'Datos de la farmacia y contacto' : 'Editar mis datos y número'),
      permBanner,
      field('Nombre completo de contacto', f.name),
      h('div', { class: 'phone-highlight-field' },
        field('Teléfono de contacto / Celular (cambiar número)', f.phone, 'Se utiliza para notificaciones, pedidos y soporte directo.')),
      field('Correo electrónico', f.email, 'Dirección para inicio de sesión y comprobantes.'),
      field('Zona de servicio', f.zone),
      ...extra,
      h('div', { class: 'actions' },
        h('button', { class: 'btn ghost', type: 'button', onclick: go('profile') }, 'Cancelar'),
        h('button', {
          class: 'btn primary',
          type: 'submit',
          disabled: !canEdit
        }, canEdit ? 'Guardar cambios' : 'Requiere autorización')));

    return h('section', { class: 'profile-section' }, form);
  }

  function passwordView() {
    const cur = h('input', { name: 'current', type: 'password', required: true, autocomplete: 'current-password' });
    const nxt = h('input', { name: 'next', type: 'password', required: true, minLength: 8, autocomplete: 'new-password' });
    const rep = h('input', { name: 'repeat', type: 'password', required: true, minLength: 8, autocomplete: 'new-password' });
    const form = h('form', {
      class: 'form-stack',
      onsubmit: async e => {
        e.preventDefault();
        if (nxt.value !== rep.value) { toast('Las contraseñas nuevas no coinciden.', 'error'); rep.focus(); return; }
        const ok = await act(form.querySelector('button[type=submit]'),
          () => API.post('/auth/password', { current: cur.value, next: nxt.value }),
          'Contraseña actualizada exitosamente.');
        if (ok) { view = 'menu'; draw(); }
      }
    },
      h('h3', null, 'Cambiar contraseña'),
      field('Contraseña actual', cur),
      field('Contraseña nueva', nxt, 'Mínimo 8 caracteres.'),
      field('Repite la contraseña nueva', rep),
      h('div', { class: 'actions' },
        h('button', { class: 'btn ghost', type: 'button', onclick: go('settings') }, 'Cancelar'),
        h('button', { class: 'btn primary', type: 'submit' }, 'Actualizar contraseña')));
    return h('section', { class: 'profile-section' }, form);
  }

  function settingsView() {
    const u = user();
    return h('section', { class: 'profile-section settings-view' },
      h('h3', null, 'Configuración'),
      h('p', { class: 'muted' }, 'Personaliza la apariencia y preferencias de tu cuenta FarmaYa.'),

      // Cambiar tema de la página
      h('div', { class: 'settings-option', style: 'flex-direction:column;align-items:stretch;' },
        h('div', null,
          h('strong', null, 'Tema de la página'),
          h('p', { class: 'muted small' }, 'Selecciona el aspecto visual de FarmaYa en tu pantalla.')),
        themeSwitcher()),

      // Acceso directo a datos y número
      u && h('div', { class: 'settings-option' },
        h('div', null,
          h('strong', null, 'Datos del usuario y número'),
          h('p', { class: 'muted small' }, u.name + ' · Tel: ' + (u.phone || 'Sin número')),
          u.role === 'FARMACIA' && !u.canEditProfile && h('small', { class: 'block-line attention' }, '🔒 Edición sujeta a permiso del administrador')),
        h('button', { class: 'btn secondary small', type: 'button', onclick: go('edit') }, 'Editar')),

      // Seguridad
      u && h('div', { class: 'settings-option' },
        h('div', null,
          h('strong', null, 'Seguridad de la cuenta'),
          h('p', { class: 'muted small' }, 'Cambia periódicamente tu clave de acceso.')),
        h('button', { class: 'btn secondary small', type: 'button', onclick: go('password') }, 'Cambiar clave')),

      // Sonido
      h('div', { class: 'settings-option' },
        h('div', null,
          h('strong', null, 'Sonido de avisos y pedidos'),
          h('p', { class: 'muted small' }, 'Reproduce alertas sonoras ante nuevos pedidos o cambios de estado.')),
        switchControl(sound.on, input => { sound.on = input.checked; if (input.checked) beep(); }, 'Sonido de avisos')));
  }

  function openOrdersView() {
    d.close();
    location.hash = '#orders';
  }

  function menuView() {
    const u = user();
    if (!u) {
      return h('div', { class: 'menu' },
        h('nav', { class: 'menu-group', 'aria-label': 'Acceso' },
          h('h3', null, 'Bienvenido a FarmaYa'),
          menuItem('user', 'Iniciar sesión', () => { d.close(); location.hash = '#login'; }),
          menuItem('pencil', 'Crear una cuenta', () => { d.close(); location.hash = '#register'; })),
        h('nav', { class: 'menu-group', 'aria-label': 'Configuración' },
          h('h3', null, 'Apariencia'),
          h('div', { style: 'padding: 0 4px;' },
            h('p', { class: 'muted small' }, 'Cambiar tema de la página:'),
            themeSwitcher())));
    }

    const sectionsNav = () => {
      const bar = document.querySelector('.tabs-root > .tabs');
      const tabs = bar ? [...bar.querySelectorAll('.tab')] : [];
      if (!tabs.length) return null;
      return h('nav', { class: 'menu-group', 'aria-label': 'Secciones de la vista' },
        h('h3', null, 'Secciones activas'),
        tabs.map(t => menuItem(null, t.textContent, () => { d.close(); t.click(); }, { on: t.classList.contains('on') })));
    };

    const homeRoute = routeForRole(u.role);
    const pharmacyEditNotice = u.role === 'FARMACIA' && u.editPermissionRequested && !u.canEditProfile
      ? 'Pendiente'
      : (u.role === 'FARMACIA' && u.canEditProfile ? 'Autorizado' : null);

    return h('div', { class: 'menu' },
      h('nav', { class: 'menu-group', 'aria-label': 'Navegación principal' },
        h('h3', null, 'Navegación'),
        menuItem('home', 'Inicio (' + (ROLE_NAMES[u.role] || u.role) + ')', () => { d.close(); location.hash = homeRoute; }),
        menuItem('package', 'Mis pedidos y seguimiento', openOrdersView)),

      sectionsNav(),

      h('nav', { class: 'menu-group', 'aria-label': 'Mi cuenta y configuración' },
        h('h3', null, 'Mi cuenta y configuración'),
        menuItem('user', 'Mi perfil', go('profile')),
        menuItem('pencil', 'Editar datos / Cambiar número', go('edit'), { badge: pharmacyEditNotice }),
        menuItem('settings', 'Configuración y tema', go('settings')),
        menuItem('lock', 'Cambiar contraseña', go('password'))),

      h('nav', { class: 'menu-group', 'aria-label': 'Sesión' },
        menuItem('logout', 'Cerrar sesión', async () => {
          const yes = await confirmBox({
            title: '¿Cerrar sesión?',
            message: '¿Estás seguro de que deseas salir de tu cuenta FarmaYa?',
            ok: 'Cerrar sesión',
            cancel: 'Permanecer',
            danger: true
          });
          if (yes) {
            d.close();
            logoutCurrent();
          }
        }, { danger: true }))
    );
  }

  function draw() {
    const back = h('button', { class: 'drawer-back-btn', type: 'button', onclick: go('menu') }, icon('chevL'), 'Menú principal');
    const views = {
      menu: () => [header(), menuView()],
      profile: () => [back, header(), viewList()],
      edit: () => [back, header(), editForm()],
      password: () => [back, header(), passwordView()],
      settings: () => [back, header(), settingsView()]
    };
    body.replaceChildren(...views[view]());
  }

  draw();
}

/* Pantalla independiente de pedidos, accesible desde el menú de opciones. */
function renderOrdersPage() {
  const app = document.getElementById('app-container');
  const role = state.user && state.user.role;
  const heading = role === 'CLIENTE' ? 'Mis pedidos' : role === 'FARMACIA' ? 'Pedidos de mi farmacia' : role === 'REPARTIDOR' ? 'Mis entregas' : 'Todos los pedidos';
  const back = h('button', { class: 'btn secondary', type: 'button', onclick: () => { location.hash = routeForRole(role); } }, '← Volver al inicio');
  const intro = h('section', { class: 'block orders-page-intro' },
    h('span', { class: 'eyebrow' }, 'FARMAYA · SEGUIMIENTO'),
    h('h1', { class: 'page-title' }, heading),
    h('p', { class: 'muted' }, 'Consulta el estado de tus pedidos y selecciona uno para ver su detalle y seguimiento.'));
  let content;
  if (role === 'ADMIN') content = adminOrders();
  else if (role === 'FARMACIA') content = pharmacyOrders();
  else if (role === 'REPARTIDOR') content = courierOrders();
  else content = live(() => API.get('/orders/mine'), orders => {
    if (!orders || !orders.length) return empty('Todavía no tienes pedidos', 'Cuando solicites un domicilio, podrás consultar aquí su estado y seguimiento.');
    return h('div', { class: 'list' }, orders.map(o => orderRow(o, h('span', { class: 'muted small' }, o.zone || ''))));
  }, 5000);
  app.replaceChildren(h('div', { class: 'stack orders-page' }, back, intro, h('section', { class: 'block' }, content)));
}
