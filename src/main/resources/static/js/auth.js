/* Autenticación conectada con la API real de FarmaYa. */
let regPharmacyMapInstance = null;
let regPharmacyMarkerInstance = null;
let currentAuthMode = 'login';
let currentRegStep = 1;

function authAlert(text, kind = 'bad') {
  const boxes = [document.getElementById('loginAlert'), document.getElementById('authAlert')].filter(Boolean);
  boxes.forEach(box => {
    box.className = 'notice ' + kind;
    box.textContent = text;
    box.hidden = !text;
  });
}

function renderLogin() {
  renderAuth('login');
}

function renderRegister() {
  renderAuth('register');
}

let isAuthTransitioning = false;

function renderAuth(mode = 'login') {
  const app = document.getElementById('app-container');
  if (!app) return;

  const existingLayout = document.getElementById('authLayout');
  if (existingLayout && app.contains(existingLayout)) {
    switchAuthMode(mode, false, true);
    return;
  }

  currentAuthMode = mode;
  const layout = buildUnifiedAuthLayout(mode);
  app.replaceChildren(layout);
  switchAuthMode(mode, false, false);
}

function switchAuthMode(mode, triggerHash = false, animate = true) {
  currentAuthMode = mode;
  const layout = document.getElementById('authLayout');
  if (!layout) return;

  const isRegister = layout.classList.contains('mode-register');
  const targetIsRegister = mode === 'register';
  if (isRegister === targetIsRegister && !layout.classList.contains('auth-transition-out')) return;

  if (triggerHash) {
    if (mode === 'register' && location.hash !== '#register') location.hash = '#register';
    if (mode === 'login' && location.hash !== '#login') location.hash = '#login';
  }

  if (!animate) {
    applyModeClasses(layout, mode);
    return;
  }

  if (isAuthTransitioning) return;
  isAuthTransitioning = true;

  // FASE 1: El panel y la animación desaparecen suavemente con transición de salida
  layout.classList.remove('auth-transition-in');
  layout.classList.add('auth-transition-out');

  setTimeout(() => {
    // FASE 2: Se intercambian las posiciones en el layout
    applyModeClasses(layout, mode);

    // FASE 3: Emergen suavemente en su nueva ubicación con transición de entrada
    layout.classList.remove('auth-transition-out');
    layout.classList.add('auth-transition-in');

    if (mode === 'register' && currentRegStep === 2 && document.getElementById('regRole')?.value === 'FARMACIA') {
      setTimeout(() => {
        initRegPharmacyMap();
        if (regPharmacyMapInstance) regPharmacyMapInstance.invalidateSize();
      }, 150);
    }

    setTimeout(() => {
      layout.classList.remove('auth-transition-in');
      isAuthTransitioning = false;
    }, 400);
  }, 220);
}

function applyModeClasses(layout, mode) {
  if (mode === 'register') {
    layout.classList.remove('mode-login');
    layout.classList.add('mode-register');
    document.title = 'FarmaYa · Crear cuenta';
  } else {
    layout.classList.remove('mode-register');
    layout.classList.add('mode-login');
    document.title = 'FarmaYa · Iniciar sesión';
  }
}

function buildUnifiedAuthLayout(initialMode) {
  const layout = h('section', {
    id: 'authLayout',
    class: 'auth-layout ' + (initialMode === 'register' ? 'mode-register' : 'mode-login')
  });

  // Panel de animación continua del domiciliario (lado izquierdo en Login, derecho en Register)
  const promoPanel = h('div', { class: 'auth-promo', id: 'authPromo' });
  promoPanel.innerHTML = loginSceneMarkup();

  // Contenedor que agrupa ambas tarjetas con transición suave
  const formsPane = h('div', { class: 'auth-forms-pane', id: 'authFormsPane' },
    buildLoginCard(),
    buildRegisterCard()
  );

  layout.append(promoPanel, formsPane);
  return layout;
}

function googleIcon() {
  return h('span', { class: 'google-icon-svg', 'aria-hidden': 'true', innerHTML: '<svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>' });
}

function strHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

function handleGoogleLogin() {
  const clientId = state.meta?.googleClientId || localStorage.getItem('farmaya_google_client_id') || window.FARMAYA_GOOGLE_CLIENT_ID;

  if (clientId) {
    launchGoogleOAuthPopup(clientId);
    return;
  }

  // Si no está registrado el Client ID de Google Cloud Console, abrir selector de conexión con Google
  openGoogleOAuthConnectModal();
}

function launchGoogleOAuthPopup(clientId) {
  const btn = document.getElementById('btnGoogleLogin');

  // Si la librería oficial de Google Identity Services está cargada en la página
  if (window.google?.accounts?.oauth2) {
    try {
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'email profile openid',
        callback: async (tokenResponse) => {
          if (tokenResponse.error) {
            toast('Google: ' + (tokenResponse.error_description || tokenResponse.error), 'error');
            return;
          }
          await act(btn, async () => {
            // Consultar datos verificados del usuario en Google
            const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
            });
            if (!userInfoRes.ok) throw new Error('No se pudo verificar el perfil en los servidores de Google.');
            const profile = await userInfoRes.json();

            // Iniciar sesión / registrar automáticamente en FarmaYA
            const authRes = await API.post('/auth/google', {
              email: profile.email,
              name: profile.name,
              googleId: profile.sub,
              avatarUrl: profile.picture || ''
            });

            API.setToken(authRes.token);
            state.user = authRes.user;
            toast('Bienvenido, ' + authRes.user.name + '. Has iniciado sesión con Google.');
            location.hash = routeForRole(authRes.user.role);
            renderApp();
          });
        }
      });

      // Abre la ventana oficial de autenticación de Google
      tokenClient.requestAccessToken({ prompt: 'select_account' });
      return;
    } catch (e) {
      console.warn('Fallo al inicializar Google Token Client:', e);
    }
  }

  // Fallback de ventana popup a accounts.google.com
  const redirectUri = window.location.origin + '/';
  const googleAuthUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'token',
    scope: 'email profile openid',
    prompt: 'select_account'
  });

  const width = 520, height = 640;
  const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2);
  const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2);
  window.open(googleAuthUrl, 'google_auth_window', `width=${width},height=${height},left=${left},top=${top},status=no,toolbar=no,menubar=no`);
}

function openGoogleOAuthConnectModal() {
  const lastClientId = localStorage.getItem('farmaya_google_client_id') || '';

  const clientIdInput = h('input', {
    type: 'text',
    placeholder: 'ej. 123456789-abcdefg.apps.googleusercontent.com',
    value: lastClientId,
    style: 'font-family: monospace; font-size: 13px;'
  });

  const errBox = h('div', { class: 'notice bad', hidden: true });

  const modal = h('div', { class: 'sheet-body narrow' },
    h('div', { class: 'google-modal-header' },
      googleIcon(),
      h('div', null,
        h('h3', null, 'Autenticación con Google'),
        h('p', { class: 'muted small' }, 'Conecta con los servidores oficiales de accounts.google.com')
      )
    ),
    h('p', { class: 'small muted', style: 'line-height: 1.5;' },
      'Para que la ventana oficial de Google (',
      h('strong', null, 'accounts.google.com'),
      ') abra la autenticación con tu proyecto, ingresa tu ',
      h('strong', null, 'Client ID de Google Cloud'),
      ':'
    ),
    field('Google OAuth Client ID', clientIdInput),
    h('div', { class: 'google-help-box', style: 'background: var(--surface-soft); padding: 12px 14px; border-radius: 12px; border: 1px solid var(--line); font-size: 12px; margin-bottom: 14px;' },
      h('strong', { class: 'block-line', style: 'margin-bottom: 4px; color: var(--primary);' }, 'Pasos en Google Cloud Console:'),
      h('p', { class: 'muted', style: 'margin: 0 0 4px;' }, '1. En console.cloud.google.com crea credenciales OAuth 2.0 (Aplicación web).'),
      h('p', { class: 'muted', style: 'margin: 0;' }, '2. Agrega como origen JavaScript autorizado: ', h('code', null, window.location.origin))
    ),
    errBox,
    h('div', { class: 'actions' },
      h('button', { class: 'btn ghost', type: 'button', onclick: () => d.close() }, 'Cancelar'),
      h('button', {
        class: 'btn primary',
        type: 'button',
        onclick: () => {
          const cid = clientIdInput.value.trim();
          if (!cid) {
            errBox.hidden = false;
            errBox.textContent = 'Por favor ingresa tu Client ID de Google.';
            return;
          }
          localStorage.setItem('farmaya_google_client_id', cid);
          window.FARMAYA_GOOGLE_CLIENT_ID = cid;
          d.close();
          // Lanza inmediatamente la ventana oficial de autenticación de Google
          launchGoogleOAuthPopup(cid);
        }
      }, 'Abrir autenticación Google')
    )
  );

  const d = openDialog(modal);
}

function buildLoginCard() {
  const card = h('section', { class: 'auth-card', id: 'cardLogin' },
    h('div', { class: 'auth-card-heading' },
      h('span', { class: 'auth-icon' }, h('img', { class: 'fy-cross', src: FY_CROSS_SRC, alt: '' })),
      h('h2', null, '¡Qué bueno tenerte aquí!'),
      h('p', null, 'Inicia sesión para continuar con FarmaYA')
    ),
    h('form', { id: 'loginForm', class: 'form-stack' },
      field('Correo electrónico', h('input', { id: 'loginEmail', type: 'email', autocomplete: 'username', placeholder: 'tu@correo.com', required: true })),
      field('Contraseña', h('input', { id: 'loginPassword', type: 'password', autocomplete: 'current-password', placeholder: 'Tu contraseña', required: true })),
      h('div', { id: 'loginAlert', class: 'notice bad', hidden: true }),
      h('button', { id: 'btnLogin', class: 'btn primary block', type: 'submit' }, 'Iniciar sesión'),
      h('div', { class: 'auth-divider' }, h('span', null, 'o')),
      h('button', {
        id: 'btnGoogleLogin',
        class: 'btn-google block',
        type: 'button',
        onclick: handleGoogleLogin
      },
        googleIcon(),
        h('span', null, 'Iniciar sesión con Google')
      )
    ),
    h('div', { class: 'auth-footer' },
      '¿Todavía no tienes cuenta? ',
      h('button', {
        class: 'btn link',
        type: 'button',
        onclick: () => switchAuthMode('register', true)
      }, 'Crear cuenta')
    )
  );

  card.querySelector('#loginForm').addEventListener('submit', handleLoginSubmit);
  return card;
}

function buildRegisterCard() {
  currentRegStep = 1;

  const roleSelect = h('select', { id: 'regRole', required: true },
    h('option', { value: 'CLIENTE', selected: true }, 'Paciente / Cliente'),
    h('option', { value: 'FARMACIA' }, 'Farmacia o Droguería'),
    h('option', { value: 'REPARTIDOR' }, 'Domiciliario / Repartidor (Toda la ciudad)')
  );

  const vehicleSelect = h('select', { id: 'regVehicle' },
    h('option', { value: 'Motocicleta', selected: true }, 'Motocicleta'),
    h('option', { value: 'Bicicleta' }, 'Bicicleta'),
    h('option', { value: 'Automóvil' }, 'Automóvil')
  );

  // --- Elementos del Mapa OpenStreetMap ---
  const mapContainer = h('div', {
    id: 'regPharmacyMap',
    style: 'height:210px; width:100%; border-radius:12px; border:1px solid var(--line); margin-top:8px; position:relative; z-index:1; background:var(--surface);'
  });

  const gpsBtn = h('button', {
    id: 'btnRegGps',
    class: 'btn secondary sm',
    type: 'button',
    style: 'display:inline-flex; align-items:center; gap:6px; font-weight:600;',
    onclick: async () => {
      gpsBtn.disabled = true;
      const prevText = gpsBtn.innerHTML;
      gpsBtn.textContent = 'Buscando GPS...';
      try {
        const pos = await farmayaGetPosition();
        updateRegMapPosition(pos.lat, pos.lng, true);
        toast('Ubicación GPS fijada en el mapa');
      } catch (err) {
        toast(err.message || 'No pudimos obtener la ubicación GPS.', 'error');
      } finally {
        gpsBtn.disabled = false;
        gpsBtn.innerHTML = prevText;
      }
    }
  }, 'Usar ubicación automática (GPS)');

  const mapHelp = h('p', {
    id: 'regMapHelp',
    style: 'font-size:0.78rem; color:var(--muted); margin:6px 0 0;'
  }, 'Mueve el mapa o arrastra el marcador para fijar la ubicación exacta de tu droguería.');

  const latInput = h('input', { id: 'regLatitude', type: 'hidden' });
  const lngInput = h('input', { id: 'regLongitude', type: 'hidden' });
  const coordsLabel = h('span', { id: 'regCoordsBadge', style: 'font-size:0.75rem; color:var(--teal); font-family:monospace;' }, 'Sin coordenadas fijadas');

  // PASO 1: Datos Personales y de Acceso
  const step1Box = h('div', { id: 'regStep1', class: 'form-stack' },
    field('¿Cómo usarás FarmaYA?', roleSelect),
    field('Nombre completo', h('input', { id: 'regName', type: 'text', autocomplete: 'name', placeholder: 'Tu nombre y apellido', required: true })),
    field('Correo electrónico', h('input', { id: 'regEmail', type: 'email', autocomplete: 'username', placeholder: 'tu@correo.com', required: true })),
    field('Teléfono de contacto', h('input', { id: 'regPhone', type: 'tel', autocomplete: 'tel', placeholder: 'Ej. 300 123 4567', required: true })),
    field('Contraseña segura', h('input', { id: 'regPassword', type: 'password', autocomplete: 'new-password', placeholder: 'Mínimo 6 caracteres', required: true, minlength: 6 })),
    h('div', { id: 'step1Actions', class: 'actions' },
      h('button', {
        id: 'btnStep1Next',
        class: 'btn primary block',
        type: 'button',
        onclick: () => handleStep1Next()
      }, 'Crear mi cuenta')
    )
  );

  // PASO 2 FARMACIA: Nombre de Farmacia y Ubicación en Mapa
  const step2PhBox = h('div', { id: 'regStep2Ph', class: 'form-stack', style: 'display:none;' },
    h('div', { class: 'reg-step-subheading' },
      h('h3', null, 'Establecimiento y Ubicación'),
      h('p', null, 'Indica el nombre de tu farmacia y la ubicación física en el mapa.')
    ),
    field('Nombre comercial del establecimiento', h('input', { id: 'regPharmacyName', type: 'text', placeholder: 'Ej. Droguería Farma Central' })),
    field('Calle o dirección física de la farmacia', h('input', { id: 'regAddress', type: 'text', placeholder: 'Calle, carrera o avenida' })),
    h('div', { class: 'field' },
      h('div', { style: 'display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;' },
        h('label', { class: 'label', style: 'margin:0;' }, 'Ubicación en OpenStreetMap'),
        gpsBtn
      ),
      mapContainer,
      h('div', { style: 'display:flex; justify-content:space-between; align-items:center; margin-top:4px;' },
        mapHelp,
        coordsLabel
      ),
      latInput,
      lngInput
    ),
    h('div', { class: 'reg-wizard-actions' },
      h('button', { class: 'btn ghost', type: 'button', onclick: () => showStep(1) }, '← Atrás'),
      h('button', {
        class: 'btn primary',
        type: 'button',
        style: 'flex:1;',
        onclick: () => handleStep2PhNext()
      }, 'Siguiente: Licencia y Horarios →')
    )
  );

  // PASO 3 FARMACIA: Registro Sanitario / Licencia y Horarios
  const step3PhBox = h('div', { id: 'regStep3Ph', class: 'form-stack', style: 'display:none;' },
    h('div', { class: 'reg-step-subheading' },
      h('h3', null, 'Verificación Sanitaria y Horarios'),
      h('p', null, 'Para verificar que la droguería sea real, ingresa su licencia y horario comercial.')
    ),
    field('Registro sanitario INVIMA / Licencia', h('input', { id: 'regLicense', type: 'text', placeholder: 'Ej. LIC-2024-FARM-089' })),
    h('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:12px;' },
      field('Abre a las', h('input', { id: 'regFrom', type: 'time', value: '08:00' })),
      field('Cierra a las', h('input', { id: 'regTo', type: 'time', value: '22:00' }))
    ),
    h('div', { class: 'reg-wizard-actions' },
      h('button', { class: 'btn ghost', type: 'button', onclick: () => showStep(2) }, '← Atrás'),
      h('button', {
        id: 'btnSubmitPharmacy',
        class: 'btn primary',
        type: 'submit',
        style: 'flex:1;'
      }, 'Crear cuenta de Droguería')
    )
  );

  // PASO 2 REPARTIDOR: Vehículo y Cobertura
  const step2CourierBox = h('div', { id: 'regStep2Courier', class: 'form-stack', style: 'display:none;' },
    h('div', { class: 'reg-step-subheading' },
      h('h3', null, 'Vehículo de Entrega'),
      h('p', null, 'Como repartidor recibirás pedidos en toda la ciudad por proximidad.')
    ),
    field('Vehículo de entrega rápida', vehicleSelect),
    h('div', { class: 'reg-wizard-actions' },
      h('button', { class: 'btn ghost', type: 'button', onclick: () => showStep(1) }, '← Atrás'),
      h('button', {
        id: 'btnSubmitCourier',
        class: 'btn primary',
        type: 'submit',
        style: 'flex:1;'
      }, 'Crear cuenta de Repartidor')
    )
  );

  // Stepper superior
  const stepperContainer = h('div', { id: 'regStepper', class: 'reg-wizard-steps' });

  function updateStepper() {
    const role = roleSelect.value;
    stepperContainer.innerHTML = '';

    let steps = [];
    if (role === 'FARMACIA') {
      steps = [
        { num: 1, label: '1. Tu cuenta' },
        { num: 2, label: '2. Establecimiento' },
        { num: 3, label: '3. Licencia y Horarios' }
      ];
    } else if (role === 'REPARTIDOR') {
      steps = [
        { num: 1, label: '1. Tu cuenta' },
        { num: 2, label: '2. Vehículo' }
      ];
    } else {
      steps = [
        { num: 1, label: 'Datos de la cuenta' }
      ];
    }

    if (steps.length <= 1) {
      stepperContainer.style.display = 'none';
      return;
    }
    stepperContainer.style.display = 'flex';

    steps.forEach(s => {
      const pill = h('span', {
        class: 'reg-step-pill' + (s.num === currentRegStep ? ' active' : s.num < currentRegStep ? ' completed' : '')
      }, s.label);
      stepperContainer.appendChild(pill);
    });
  }

  function showStep(stepNumber) {
    currentRegStep = stepNumber;
    const role = roleSelect.value;

    step1Box.style.display = (stepNumber === 1) ? '' : 'none';
    step2PhBox.style.display = (stepNumber === 2 && role === 'FARMACIA') ? '' : 'none';
    step3PhBox.style.display = (stepNumber === 3 && role === 'FARMACIA') ? '' : 'none';
    step2CourierBox.style.display = (stepNumber === 2 && role === 'REPARTIDOR') ? '' : 'none';

    updateStepper();

    if (stepNumber === 2 && role === 'FARMACIA') {
      setTimeout(() => {
        initRegPharmacyMap();
        if (regPharmacyMapInstance) {
          regPharmacyMapInstance.invalidateSize();
        }
      }, 150);
    }
  }

  function validateStep1() {
    const name = document.getElementById('regName');
    const email = document.getElementById('regEmail');
    const phone = document.getElementById('regPhone');
    const pass = document.getElementById('regPassword');

    if (!name.value.trim()) { name.focus(); toast('Por favor escribe tu nombre y apellido.', 'error'); return false; }
    if (!email.value.trim() || !email.checkValidity()) { email.focus(); toast('Por favor ingresa un correo electrónico válido.', 'error'); return false; }
    if (!phone.value.trim()) { phone.focus(); toast('Por favor ingresa tu teléfono de contacto.', 'error'); return false; }
    if (!pass.value || pass.value.length < 6) { pass.focus(); toast('La contraseña debe tener al menos 6 caracteres.', 'error'); return false; }
    return true;
  }

  function handleStep1Next() {
    if (!validateStep1()) return;
    const role = roleSelect.value;
    if (role === 'CLIENTE') {
      document.getElementById('registerForm').requestSubmit();
    } else {
      showStep(2);
    }
  }

  function handleStep2PhNext() {
    const phName = document.getElementById('regPharmacyName');
    const phAddr = document.getElementById('regAddress');
    if (!phName.value.trim()) {
      phName.focus();
      toast('Ingresa el nombre comercial de la farmacia.', 'error');
      return;
    }
    if (!phAddr.value.trim()) {
      phAddr.focus();
      toast('Ingresa la dirección o selecciona el punto en el mapa.', 'error');
      return;
    }
    showStep(3);
  }

  function syncRoleFields() {
    const role = roleSelect.value;
    const btnNext = document.getElementById('btnStep1Next');
    if (btnNext) {
      if (role === 'CLIENTE') {
        btnNext.textContent = 'Crear mi cuenta';
      } else if (role === 'FARMACIA') {
        btnNext.textContent = 'Siguiente: Ubicación de Farmacia →';
      } else {
        btnNext.textContent = 'Siguiente: Vehículo de entrega →';
      }
    }
    showStep(1);
  }

  roleSelect.addEventListener('change', syncRoleFields);

  const card = h('section', { class: 'auth-card', id: 'cardRegister' },
    h('div', { class: 'auth-card-heading' },
      h('span', { class: 'auth-icon' }, h('img', { class: 'fy-cross', src: FY_CROSS_SRC, alt: '' })),
      h('h2', null, 'Crea tu cuenta FarmaYA'),
      h('p', null, 'Salud a domicilio, medicamentos originales y seguimiento en vivo')
    ),
    stepperContainer,
    h('form', { id: 'registerForm', class: 'form-stack' },
      step1Box,
      step2PhBox,
      step3PhBox,
      step2CourierBox,
      h('div', { id: 'authAlert', hidden: true })
    ),
    h('div', { class: 'auth-footer' },
      '¿Ya tienes cuenta? ',
      h('button', {
        class: 'btn link',
        type: 'button',
        onclick: () => switchAuthMode('login', true)
      }, 'Iniciar sesión')
    )
  );

  card.querySelector('#registerForm').addEventListener('submit', handleRegisterSubmit);
  setTimeout(syncRoleFields, 50);
  return card;
}

async function initRegPharmacyMap() {
  const container = document.getElementById('regPharmacyMap');
  if (!container) return;
  try {
    await loadLeaflet();
    if (regPharmacyMapInstance) {
      regPharmacyMapInstance.invalidateSize();
      return;
    }
    const defaultCoords = [4.6534, -74.0836]; // Bogotá / Colombia
    regPharmacyMapInstance = L.map(container).setView(defaultCoords, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(regPharmacyMapInstance);

    regPharmacyMarkerInstance = L.marker(defaultCoords, { draggable: true }).addTo(regPharmacyMapInstance);

    const onPointSelected = async (lat, lng) => {
      updateRegMapPosition(lat, lng, false);
      const geo = await reverseGeocode({ lat, lng });
      if (geo && geo.address) {
        const addrInput = document.getElementById('regAddress');
        if (addrInput && !addrInput.value) {
          addrInput.value = geo.address.split(',').slice(0, 3).join(',');
        }
      }
    };

    regPharmacyMarkerInstance.on('dragend', () => {
      const p = regPharmacyMarkerInstance.getLatLng();
      onPointSelected(p.lat, p.lng);
    });

    regPharmacyMapInstance.on('click', ev => {
      onPointSelected(ev.latlng.lat, ev.latlng.lng);
    });

    updateRegMapPosition(defaultCoords[0], defaultCoords[1], false);
    setTimeout(() => {
      if (regPharmacyMapInstance) regPharmacyMapInstance.invalidateSize();
    }, 200);
  } catch (err) {
    container.textContent = 'No se pudo cargar el mapa OpenStreetMap. Ingresa tu dirección manualmente.';
  }
}

function updateRegMapPosition(lat, lng, pan) {
  const latEl = document.getElementById('regLatitude');
  const lngEl = document.getElementById('regLongitude');
  const badgeEl = document.getElementById('regCoordsBadge');
  if (latEl) latEl.value = Number(lat).toFixed(6);
  if (lngEl) lngEl.value = Number(lng).toFixed(6);
  if (badgeEl) badgeEl.textContent = `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`;

  if (regPharmacyMarkerInstance) {
    regPharmacyMarkerInstance.setLatLng([lat, lng]);
  }
  if (pan && regPharmacyMapInstance) {
    regPharmacyMapInstance.setView([lat, lng], 15);
    regPharmacyMapInstance.invalidateSize();
  }
}

function loginSceneMarkup() {
  return `
    <div class="login-sequence login-courier-only" role="img" aria-label="Domiciliario de FarmaYa en su moto, con movimiento activo de conducción y líneas de velocidad en vivo.">
      <div class="login-motion-lines" aria-hidden="true">
        <i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>
      </div>
      <div class="login-stage login-stage-courier" aria-hidden="true">
        <img src="/images/login-stage-3.png?v=20261027loginrestore1" alt="Domiciliario de FarmaYA en moto">
        <div class="courier-ground-shadow" aria-hidden="true"></div>
      </div>
      <div class="courier-road-strip" aria-hidden="true"></div>
    </div>`;
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  const btn = document.getElementById('btnLogin');
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  await act(btn, async () => {
    const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'No pudimos iniciar sesión. Revisa tus datos.');
    API.setToken(data.token); state.user = data.user;
    location.hash = routeForRole(data.user.role);
    renderApp();
    return data;
  });
}

async function handleRegisterSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const role = document.getElementById('regRole').value;
  const btn = event.submitter || form.querySelector('button[type=submit]') || document.getElementById('btnStep1Next');
  const body = {
    name: document.getElementById('regName').value.trim(),
    email: document.getElementById('regEmail').value.trim(),
    password: document.getElementById('regPassword').value,
    phone: document.getElementById('regPhone').value.trim(),
    role
  };
  if (role === 'FARMACIA') {
    const latVal = document.getElementById('regLatitude')?.value;
    const lngVal = document.getElementById('regLongitude')?.value;
    Object.assign(body, {
      pharmacyName: document.getElementById('regPharmacyName').value.trim(),
      address: document.getElementById('regAddress').value.trim(),
      licenseNumber: document.getElementById('regLicense').value.trim(),
      openFrom: document.getElementById('regFrom').value,
      openTo: document.getElementById('regTo').value,
      latitude: latVal ? parseFloat(latVal) : null,
      longitude: lngVal ? parseFloat(lngVal) : null
    });
  }
  if (role === 'REPARTIDOR') {
    body.vehicle = document.getElementById('regVehicle').value;
  }
  await act(btn, async () => {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'No pudimos crear la cuenta. Revisa los datos.');
    API.setToken(data.token);
    state.user = data.user;
    toast(role === 'CLIENTE' ? 'Cuenta creada. ¡Bienvenido a FarmaYa!' : 'Cuenta creada. Quedará pendiente de verificación.');
    location.hash = routeForRole(data.user.role);
    renderApp();
    return data;
  });
}
