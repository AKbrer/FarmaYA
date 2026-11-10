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
        h('span', { class: 'avatar avatar-cross', 'aria-hidden': 'true', style: 'background:transparent;display:flex;align-items:center;justify-content:center;' }, h('img', { src: '/images/farmaya-cross.png?v=1', alt: 'FarmaYA', style: 'height:36px;width:auto;max-width:100%;object-fit:contain;' })),
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
        u.role === 'CLIENTE' && item('Dirección habitual', u.address ? (u.address + (u.city ? (', ' + u.city) : '')) : 'Sin dirección guardada'),
        u.role === 'CLIENTE' && u.city && item('Ciudad', u.city),
        u.role === 'FARMACIA' && item('Establecimiento', u.pharmacyName),
        u.role === 'FARMACIA' && item('Dirección', u.address),
        u.role === 'FARMACIA' && item('Cuenta Bancaria para Pagos', u.bankName ? (u.bankName + ' · ' + (u.accountType || 'Ahorros') + ' · ' + u.accountNumber + (u.accountHolder ? ' (' + u.accountHolder + ')' : '')) : 'Sin cuenta bancaria registrada'),
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
        u.role === 'FARMACIA' && !u.canEditProfile ? 'Gestionar datos' : 'Editar mis datos'));
  }

  function editForm() {
    const u = user();
    const isPharmacy = u.role === 'FARMACIA';
    const canEdit = !isPharmacy || u.canEditProfile === true;

    const f = {
      name: h('input', { name: 'name', required: true, minLength: 2, value: u.name || '', autocomplete: 'name', disabled: !canEdit }),
      phone: h('input', { name: 'phone', type: 'tel', required: true, minLength: 7, value: u.phone || '', autocomplete: 'tel', disabled: !canEdit }),
      email: h('input', { name: 'email', type: 'email', required: true, value: u.email || '', autocomplete: 'email', disabled: !canEdit })
    };

    const extra = [];
    let permBanner = null;

    if (isPharmacy) {
      const bankOptions = ['Bancolombia', 'Nequi', 'Daviplata', 'Davivienda', 'Banco de Bogotá', 'BBVA Colombia', 'Banco de Occidente', 'Scotiabank Colpatria', 'Banco Popular', 'Itaú Colombia', 'Dale!', 'Lulo Bank', 'Ualá', 'Otro Banco'];
      f.bankName = h('select', { name: 'bankName' }, bankOptions.map(b => h('option', { value: b, selected: b === (u.bankName || 'Bancolombia') }, b)));
      f.accountType = h('select', { name: 'accountType' }, ['Ahorros', 'Corriente', 'Depósito Electrónico (Nequi/Daviplata)'].map(t => h('option', { value: t, selected: t === (u.accountType || 'Ahorros') }, t)));
      f.accountNumber = h('input', { name: 'accountNumber', placeholder: 'Ej. 031-892138-12 o Celular Nequi', value: u.accountNumber || '' });
      f.accountHolder = h('input', { name: 'accountHolder', placeholder: 'Ej. Farmacia Droguería Central S.A.S.', value: u.accountHolder || '' });
      f.accountDocNumber = h('input', { name: 'accountDocNumber', placeholder: 'Ej. NIT 900.123.456-7 o C.C.', value: u.accountDocNumber || '' });
      f.pharmacyName = h('input', { name: 'pharmacyName', required: true, value: u.pharmacyName || '', disabled: !canEdit });
      f.address = h('input', { name: 'address', required: true, minLength: 5, value: u.address || '', placeholder: 'Ej. Calle 72 #50-10' });
      f.latitude = h('input', { name: 'latitude', type: 'hidden', value: (u.latitude != null) ? String(u.latitude) : '10.9878' });
      f.longitude = h('input', { name: 'longitude', type: 'hidden', value: (u.longitude != null) ? String(u.longitude) : '-74.7889' });
      f.openFrom = h('input', { name: 'openFrom', type: 'time', required: true, value: u.openFrom || '08:00' });
      f.openTo = h('input', { name: 'openTo', type: 'time', required: true, value: u.openTo || '22:00' });

      const phGpsStatus = h('p', {
        id: 'pharmacyProfileGpsStatus',
        class: 'muted small',
        style: 'margin: 6px 0 0;'
      }, '');

      const phGpsBtn = h('button', {
        class: 'btn secondary small',
        type: 'button',
        style: 'height:36px; padding:0 14px; border-radius:8px; font-weight:600; white-space:nowrap; display:inline-flex; align-items:center; gap:6px; margin: 6px 0 10px;',
        onclick: async () => {
          const prev = phGpsBtn.innerHTML;
          phGpsBtn.disabled = true;
          phGpsBtn.innerHTML = '<span class="spinner" style="width:13px;height:13px;border-width:2px;"></span> Calibrando...';
          phGpsStatus.textContent = 'Buscando satélites de alta precisión...';
          try {
            const pos = await farmayaGetPosition();
            f.latitude.value = String(pos.lat);
            f.longitude.value = String(pos.lng);
            const geo = await reverseGeocode(pos);
            if (geo && geo.address) {
              f.address.value = geo.address;
              phGpsStatus.textContent = 'Ubicación fijada: ' + geo.address + ' (GPS: ±' + Math.round(pos.accuracy || 10) + 'm).';
            } else {
              phGpsStatus.textContent = 'Ubicación calibrada en el mapa (±' + Math.round(pos.accuracy || 10) + 'm).';
            }
            toast('Ubicación GPS obtenida con éxito');
          } catch (err) {
            phGpsStatus.textContent = err.message;
            toast(err.message, 'error');
          } finally {
            phGpsBtn.disabled = false;
            phGpsBtn.innerHTML = prev;
          }
        }
      }, icon('my_location'), 'Calibrar GPS');

      extra.push(
        field('Nombre comercial de la farmacia', f.pharmacyName),
        h('div', { class: 'field bank-account-section', style: 'margin: 12px 0; padding: 14px 16px; border: 1px solid #d5ebdd; border-radius: 12px; background: var(--surface-soft);' },
          h('strong', { style: 'font-size: 13.5px; display: block; margin-bottom: 2px; color: var(--primary-dark);' }, 'Cuenta Bancaria para Recibir Pagos de Pedidos'),
          h('p', { class: 'muted small', style: 'margin-bottom: 10px; font-size: 11.5px;' }, 'FarmaYA utiliza estos datos para transferir las ganancias correspondientes a los pedidos despachados.'),
          h('div', { class: 'two-fields', style: 'gap: 10px; margin-bottom: 8px;' },
            field('Entidad Financiera / Billetera', f.bankName),
            field('Tipo de Cuenta', f.accountType)
          ),
          field('Número de Cuenta o Celular Nequi/Daviplata', f.accountNumber),
          h('div', { class: 'two-fields', style: 'gap: 10px; margin-top: 8px;' },
            field('Nombre o Razón Social del Titular', f.accountHolder),
            field('Cédula o NIT del Titular', f.accountDocNumber)
          )
        ),
        h('div', { class: 'field' },
          h('span', { class: 'field-label' }, 'Dirección y ubicación'),
          f.address,
          phGpsBtn,
          phGpsStatus
        ),
        f.latitude,
        f.longitude,
        h('div', { class: 'two' }, field('Apertura', f.openFrom), field('Cierre', f.openTo)),
        h('p', { class: 'muted small' }, 'Número de licencia sanitaria (' + (u.licenseNumber || 'RS-0000') + '). Solo modificable por la entidad reguladora o administración.')
      );

      if (!canEdit) {
        if (u.editPermissionRequested) {
          permBanner = h('div', { class: 'perm-box pending' },
            h('strong', null, 'Solicitud enviada al Administrador'),
            h('span', null, 'Tu solicitud para modificar los datos y el número de contacto de tu farmacia se encuentra en revisión.' + (u.editRequestNote ? ' Motivo: "' + u.editRequestNote + '".' : '')),
            h('small', { class: 'muted' }, 'En cuanto el administrador conceda la autorización, estos campos se desbloquearán automáticamente.'));
        } else {
          permBanner = h('div', { class: 'perm-box required' },
            h('strong', null, 'Permiso de Administrador requerido'),
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
            }, 'Solicitar permiso al Administrador'));
        }
      } else {
        permBanner = h('div', { class: 'perm-box granted' },
          h('strong', null, 'Permiso de edición concedido por el Administrador'),
          h('span', null, 'Cuentas con autorización activa para modificar los datos de tu establecimiento y cambiar tu número de contacto. Recuerda pulsar "Guardar cambios autorizados" para aplicar la actualización.'));
      }
    } else if (u.role === 'REPARTIDOR') {
      f.vehicle = h('select', { name: 'vehicle', required: true },
        ['Moto', 'Bicicleta', 'Carro', 'A pie'].map(v => h('option', { value: v, selected: v === u.vehicle }, v)));
      extra.push(field('Medio de transporte', f.vehicle));
    } else if (u.role === 'CLIENTE') {
      f.address = h('input', {
        name: 'address',
        placeholder: 'Ej. Carrera 53 #76-12',
        value: u.address || ''
      });
      f.latitude = h('input', { name: 'latitude', type: 'hidden', value: (u.latitude != null) ? String(u.latitude) : '' });
      f.longitude = h('input', { name: 'longitude', type: 'hidden', value: (u.longitude != null) ? String(u.longitude) : '' });

      const gpsStatus = h('p', {
        id: 'profileGpsStatus',
        class: 'muted small',
        style: 'margin: 6px 0 0;'
      }, '');

      const gpsBtn = h('button', {
        class: 'btn secondary small',
        type: 'button',
        style: 'height:36px; padding:0 14px; border-radius:8px; font-weight:600; white-space:nowrap; display:inline-flex; align-items:center; gap:6px; margin-top: 6px;',
        onclick: async () => {
          const prev = gpsBtn.innerHTML;
          gpsBtn.disabled = true;
          gpsBtn.innerHTML = '<span class="spinner" style="width:13px;height:13px;border-width:2px;"></span> Obteniendo GPS...';
          gpsStatus.textContent = 'Buscando satélites de alta precisión...';
          try {
            const pos = await farmayaGetPosition();
            f.latitude.value = String(pos.lat);
            f.longitude.value = String(pos.lng);
            const geo = await reverseGeocode(pos);
            if (geo && geo.address) {
              f.address.value = geo.address;
              gpsStatus.textContent = 'Ubicación fijada: ' + geo.address + ' (GPS: ±' + Math.round(pos.accuracy || 10) + 'm).';
            } else {
              gpsStatus.textContent = 'Ubicación fijada en el mapa (GPS: ±' + Math.round(pos.accuracy || 10) + 'm).';
            }
            toast('Ubicación GPS obtenida con éxito');
          } catch (err) {
            gpsStatus.textContent = err.message;
            toast(err.message, 'error');
          } finally {
            gpsBtn.disabled = false;
            gpsBtn.innerHTML = prev;
          }
        }
      }, icon('my_location'), 'Fijar por GPS');

      extra.push(
        h('div', { class: 'field' },
          h('span', { class: 'field-label' }, 'Dirección y ubicación'),
          f.address,
          f.latitude,
          f.longitude,
          gpsBtn,
          gpsStatus,
          h('small', { class: 'muted' }, 'Tu ubicación se usará de forma predeterminada al pedir medicamentos a domicilio.')
        )
      );
    }

    const form = h('form', {
      class: 'form-stack',
      onsubmit: async e => {
        e.preventDefault();
        const payload = {};
        Object.entries(f).forEach(([k, el]) => { payload[k] = el.value; });
        if (f.latitude && f.latitude.value.trim() !== '') {
          payload.latitude = Number(f.latitude.value);
        } else if (f.latitude) {
          payload.latitude = null;
        }
        if (f.longitude && f.longitude.value.trim() !== '') {
          payload.longitude = Number(f.longitude.value);
        } else if (f.longitude) {
          payload.longitude = null;
        }
        if (f.address) {
          payload.address = f.address.value.trim();
        }
        payload.email = f.email.value.trim();
        const saved = await act(form.querySelector('button[type=submit]'), () => API.put('/auth/profile', payload), 'Datos y ubicación guardados correctamente');
        if (!saved) return;
        Object.assign(state.user, saved);
        view = 'profile';
        draw();
        renderNavbar();
        if (u.role === 'FARMACIA' || u.role === 'REPARTIDOR') renderApp();
        refreshAll();
      }
    },
      h('h3', null, isPharmacy ? 'Datos de la farmacia y ubicación' : 'Editar mis datos y número'),
      permBanner,
      field('Nombre completo de contacto', f.name),
      h('div', { class: 'phone-highlight-field' },
        field('Teléfono de contacto / Celular (cambiar número)', f.phone, 'Se utiliza para notificaciones, pedidos y soporte directo.')),
      field('Correo electrónico', f.email, 'Dirección para inicio de sesión y comprobantes.'),
      ...extra,
      h('div', { class: 'actions' },
        h('button', { class: 'btn ghost', type: 'button', onclick: go('profile') }, 'Cancelar'),
        h('button', {
          class: 'btn primary',
          type: 'submit',
          disabled: isPharmacy ? false : !canEdit
        }, canEdit ? 'Guardar cambios' : 'Guardar datos')));

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
          u.role === 'FARMACIA' && !u.canEditProfile && h('small', { class: 'block-line attention' }, 'Edición sujeta a permiso del administrador')),
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

/* Pantalla independiente de pedidos, accesible desde el menú de opciones o cabecera. */
function clientOrdersView() {
  const FINAL = ['ENTREGADA', 'ENTREGADO', 'CANCELADA', 'CANCELADO', 'VENCIDA', 'RECHAZADA'];

  return live(() => API.get('/orders/mine'), orders => {
    const list = Array.isArray(orders) ? orders : [];

    if (!list.length) {
      return empty(
        'Todavía no tienes pedidos',
        'Cuando solicites un domicilio en el catálogo, podrás consultar aquí su estado y seguimiento en tiempo real.',
        h('button', {
          class: 'btn primary',
          type: 'button',
          style: 'margin-top: 14px;',
          onclick: () => { location.hash = '#client'; }
        }, 'Ir al Catálogo de Medicamentos')
      );
    }

    const activeOrders = list.filter(o => !FINAL.includes(o.status));
    const pastOrders = list.filter(o => FINAL.includes(o.status));

    /* Actualizar insignia en cabecera */
    const ordersBadgeEl = document.getElementById('navHeaderOrdersBadge');
    if (ordersBadgeEl) {
      ordersBadgeEl.textContent = String(activeOrders.length);
      ordersBadgeEl.style.display = activeOrders.length > 0 ? 'inline-flex' : 'none';
    }

    const parts = [];

    /* 1. SECCIÓN DE PEDIDOS EN CURSO */
    if (activeOrders.length > 0) {
      parts.push(
        h('section', { class: 'block client-active-orders-section', style: 'padding: 0; background: transparent; border: none; box-shadow: none;' },
          h('div', { class: 'active-orders-banner-card' },
            h('div', { class: 'active-orders-banner-header' },
              h('div', { class: 'active-orders-live-badge' },
                h('span', { class: 'pulse-dot' }),
                h('span', null, activeOrders.length > 1 ? (activeOrders.length + ' PEDIDOS EN CURSO') : 'PEDIDO EN SEGUIMIENTO EN VIVO')
              ),
              h('span', { class: 'small muted desktop-only' }, 'Actualización automática en vivo')
            ),
            h('div', { class: 'active-orders-cards-list', style: 'display: grid; gap: 16px;' },
              activeOrders.map(o => {
                const isQuoted = o.status === 'PRECIO_POR_ACEPTAR';
                const isSearching = o.status === 'BUSCANDO_FARMACIA' || o.status === 'SOLICITUD_ENVIADA';
                const isAssigned = o.status === 'FARMACIA_ASIGNADA';
                const isPaid = ['PRECIO_CONFIRMADO', 'PEDIDO_EN_PREPARACION', 'PEDIDO_LISTO', 'BUSCANDO_REPARTIDOR', 'REPARTIDOR_ASIGNADO', 'PEDIDO_RECOGIDO'].includes(o.status);
                const isEnCamino = o.status === 'EN_CAMINO';

                let statusTitle = 'Buscando droguería aliada cercana...';
                let statusColor = '#0284c7';
                if (isAssigned) { statusTitle = 'Farmacia asignada · Verificando inventario'; statusColor = '#0d9488'; }
                else if (isQuoted) { statusTitle = '¡Cotización lista! Esperando tu confirmación de pago'; statusColor = '#d97706'; }
                else if (o.status === 'PRECIO_CONFIRMADO') { statusTitle = 'Pago confirmado · Droguería empaquetando'; statusColor = '#059669'; }
                else if (o.status === 'PEDIDO_EN_PREPARACION') { statusTitle = 'Farmacia alistando tus medicamentos'; statusColor = '#059669'; }
                else if (['PEDIDO_LISTO', 'BUSCANDO_REPARTIDOR', 'REPARTIDOR_ASIGNADO', 'PEDIDO_RECOGIDO'].includes(o.status)) { statusTitle = 'Repartidor recogiendo pedido en droguería'; statusColor = '#0284c7'; }
                else if (isEnCamino) { statusTitle = '¡Tu pedido va en camino a tu dirección!'; statusColor = '#16865d'; }

                const step1 = true;
                const step2 = isAssigned || isQuoted || isPaid || isEnCamino;
                const step3 = isPaid || isEnCamino;
                const step4 = isEnCamino;

                const itemsText = (o.items && o.items.length)
                  ? o.items.map(i => (i.name || 'Medicamento') + ' ×' + (i.quantity || 1)).join(', ')
                  : (o.itemCount ? (o.itemCount + ' productos') : '');

                return h('div', { class: 'active-order-item-card' },
                  h('div', { class: 'active-order-item-top' },
                    h('div', { class: 'active-order-main-info' },
                      h('span', { class: 'active-order-code' }, 'PEDIDO #' + (o.code || (o.id || '').slice(-6))),
                      h('h4', { class: 'active-order-status-title', style: 'color: ' + statusColor }, statusTitle),
                      h('p', { class: 'small muted', style: 'margin: 3px 0 0 0;' }, o.address ? (o.address + (o.city ? (' · ' + o.city) : '')) : 'Dirección de entrega'),
                      itemsText ? h('p', { class: 'small muted', style: 'margin: 3px 0 0 0;' }, 'Productos: ' + itemsText) : null
                    ),
                    (isEnCamino || isPaid) && o.deliveryCode ? h('div', { class: 'active-order-pin-pill' },
                      h('span', { class: 'pin-label' }, 'PIN ENTREGA'),
                      h('strong', { class: 'pin-value' }, o.deliveryCode)
                    ) : null
                  ),
                  h('div', { class: 'active-order-stepper' },
                    h('div', { class: 'stepper-col' + (step1 ? ' done' : '') },
                      h('div', { class: 'stepper-node' },
                        h('div', { class: 'stepper-spacer' }),
                        h('div', { class: 'step-dot' }, '1'),
                        h('div', { class: 'stepper-line' + (step2 ? ' done' : '') })
                      ),
                      h('span', { class: 'step-lbl' }, 'Solicitado')
                    ),
                    h('div', { class: 'stepper-col' + (step2 ? ' done' : '') },
                      h('div', { class: 'stepper-node' },
                        h('div', { class: 'stepper-line' + (step2 ? ' done' : '') }),
                        h('div', { class: 'step-dot' }, '2'),
                        h('div', { class: 'stepper-line' + (step3 ? ' done' : '') })
                      ),
                      h('span', { class: 'step-lbl' }, 'Cotizado')
                    ),
                    h('div', { class: 'stepper-col' + (step3 ? ' done' : '') },
                      h('div', { class: 'stepper-node' },
                        h('div', { class: 'stepper-line' + (step3 ? ' done' : '') }),
                        h('div', { class: 'step-dot' }, '3'),
                        h('div', { class: 'stepper-line' + (step4 ? ' done' : '') })
                      ),
                      h('span', { class: 'step-lbl' }, 'Pagado')
                    ),
                    h('div', { class: 'stepper-col' + (step4 ? ' done' : '') },
                      h('div', { class: 'stepper-node' },
                        h('div', { class: 'stepper-line' + (step4 ? ' done' : '') }),
                        h('div', { class: 'step-dot' }, '4'),
                        h('div', { class: 'stepper-spacer' })
                      ),
                      h('span', { class: 'step-lbl' }, 'En camino')
                    )
                  ),
                  h('div', { class: 'active-order-actions-row' },
                    isQuoted ? h('button', {
                      class: 'btn primary', type: 'button',
                      style: 'font-weight: 800; padding: 10px 18px;',
                      onclick: () => {
                        const fn = window.openPaymentPage || window.openPaymentGatewayDialog;
                        if (typeof fn === 'function') fn(o);
                      }
                    }, 'Pagar ' + money(o.total || 0) + ' con Pasarela Digital') : null,
                    isQuoted ? h('button', {
                      class: 'btn ghost', type: 'button',
                      onclick: async e => {
                        if (confirm('¿Deseas rechazar esta cotización? Buscaremos otra droguería disponible para tu pedido.')) {
                          await act(e.currentTarget, async () => {
                            await API.post('/orders/' + o.id + '/decline-price', {});
                            toast('Cotización rechazada. Buscando farmacia alternativa...');
                            refreshAll();
                          });
                        }
                      }
                    }, 'Rechazar precio') : null,
                    h('button', {
                      class: 'btn ' + (isQuoted ? 'secondary' : 'primary'), type: 'button',
                      onclick: () => {
                        const fn = window.openOrderDetail || openOrderDetail;
                        if (typeof fn === 'function') fn(o.id);
                      }
                    }, 'Ver Detalle y Seguimiento'),
                    (!isPaid && !isEnCamino && !isQuoted) ? h('button', {
                      class: 'btn ghost', type: 'button',
                      onclick: async e => {
                        if (confirm('¿Seguro que deseas cancelar esta solicitud de pedido?')) {
                          await act(e.currentTarget, async () => {
                            await API.post('/orders/' + o.id + '/cancel', {});
                            toast('Pedido cancelado.');
                            refreshAll();
                          });
                        }
                      }
                    }, 'Cancelar Solicitud') : null
                  )
                );
              })
            )
          )
        )
      );
    } else {
      parts.push(
        h('div', { class: 'empty-active-orders-card', style: 'background: var(--surface); border: 1.5px dashed var(--line); border-radius: 16px; padding: 22px; text-align: center;' },
          h('div', { style: 'margin-bottom: 8px;' }, icon('package', 'text-muted')),
          h('h4', { style: 'margin: 0 0 4px 0; font-size: 16px; font-weight: 700; color: var(--text);' }, 'No tienes pedidos en curso en este momento'),
          h('p', { class: 'muted', style: 'margin: 0 0 14px 0; font-size: 13.5px;' }, 'Todos tus pedidos anteriores han sido finalizados. Puedes consultar el historial abajo o solicitar nuevos medicamentos en el catálogo.'),
          h('button', {
            class: 'btn secondary small',
            type: 'button',
            onclick: () => { location.hash = '#client'; }
          }, 'Explorar Catálogo de Medicamentos')
        )
      );
    }

    /* 2. SECCIÓN DE HISTORIAL DE PEDIDOS FINALIZADOS */
    if (pastOrders.length > 0) {
      parts.push(
        h('section', { class: 'block past-orders-section', style: 'margin-top: 14px;' },
          h('div', { class: 'section-heading', style: 'margin-bottom: 14px;' },
            h('div', null,
              h('span', { class: 'eyebrow' }, 'HISTORIAL DE COMPRAS'),
              h('h3', { style: 'margin: 2px 0 0 0; font-size: 18px; font-weight: 800;' }, 'Pedidos Finalizados (' + pastOrders.length + ')')
            )
          ),
          h('div', { class: 'list' }, pastOrders.map(o => orderRow(o, h('span', { class: 'muted small' }, o.city || o.address || ''))))
        )
      );
    }

    return h('div', { class: 'stack', style: 'gap: 22px;' }, ...parts);
  }, 4000);
}

function renderOrdersPage() {
  const app = document.getElementById('app-container');
  const role = state.user && state.user.role;
  const isClient = role === 'CLIENTE';
  const heading = isClient ? 'Mis Pedidos' : role === 'FARMACIA' ? 'Pedidos de mi farmacia' : role === 'REPARTIDOR' ? 'Mis entregas' : 'Todos los pedidos';
  const back = h('button', { class: 'btn secondary', type: 'button', onclick: () => { location.hash = isClient ? '#client' : routeForRole(role); } }, '← Volver al catálogo');
  const intro = h('section', { class: 'block orders-page-intro' },
    h('span', { class: 'eyebrow' }, 'FARMAYA · SEGUIMIENTO EN VIVO'),
    h('h1', { class: 'page-title' }, heading),
    h('p', { class: 'muted' }, isClient
      ? 'Consulta el estado de tus pedidos en curso y el historial de compras finalizadas.'
      : 'Consulta el estado de los pedidos y selecciona uno para ver su detalle y seguimiento.'));

  let content;
  if (role === 'ADMIN') content = adminOrders();
  else if (role === 'FARMACIA') content = pharmacyOrders();
  else if (role === 'REPARTIDOR') content = courierOrders();
  else content = clientOrdersView();

  app.replaceChildren(h('div', { class: 'stack orders-page' }, back, intro, content));
}
