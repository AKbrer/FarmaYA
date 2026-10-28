/* Autenticación conectada con la API real de FarmaYa. */
function authAlert(text, kind = 'bad') {
  const box = document.getElementById('authAlert');
  if (!box) return;
  box.className = 'notice ' + kind;
  box.textContent = text;
  box.hidden = !text;
}

function renderLogin() {
  const app = document.getElementById('app-container');
  app.replaceChildren(h('section', { class: 'auth-layout' },
    h('div', { class: 'auth-promo', id: 'loginAnimation' }),
    h('section', { class: 'auth-card' },
      h('div', { class: 'auth-card-heading' }, h('span', { class: 'auth-icon' }, h('img', { class: 'fy-cross', src: FY_CROSS_SRC, alt: '' })), h('h2', null, '¡Qué bueno tenerte aquí!'), h('p', null, 'Inicia sesión para continuar')),
      h('form', { id: 'loginForm', class: 'form-stack' },
        field('Correo electrónico', h('input', { id: 'loginEmail', type: 'email', autocomplete: 'username', placeholder: 'tu@correo.com', required: true })),
        field('Contraseña', h('input', { id: 'loginPassword', type: 'password', autocomplete: 'current-password', placeholder: 'Tu contraseña', required: true })),
        h('div', { id: 'authAlert', hidden: true }),
        h('button', { id: 'btnLogin', class: 'btn primary block', type: 'submit' }, 'Iniciar sesión')),
      h('div', { class: 'auth-footer' }, '¿Todavía no tienes cuenta? ', h('button', { class: 'btn link', type: 'button', onclick: () => { location.hash = '#register'; } }, 'Crear cuenta')))));
  // Escena animada del login (HTML + SVG + CSS, sin imágenes ni GIF)
  document.getElementById('loginAnimation').innerHTML = loginSceneMarkup();
  document.getElementById('loginForm').addEventListener('submit', handleLoginSubmit);
}

/* Escena: avión de papel → farmacia FarmaYa → domiciliario en moto → casa.
   Todo el ciclo (16 s) está sincronizado desde CSS (.ls en styles.css). */
function loginSceneMarkup() {
  const awning = Array.from({ length: 6 }, (_, i) => {
    const w = 190 / 6, x = 50 + i * w, c = i % 2 ? '#ffffff' : '#1fbf6b';
    return `<rect x="${x.toFixed(2)}" y="326" width="${(w + .3).toFixed(2)}" height="20" fill="${c}"/><circle cx="${(x + w / 2).toFixed(2)}" cy="346" r="${(w / 2 + .15).toFixed(2)}" fill="${c}"/>`;
  }).join('');
  const route = 'M-30 150 C60 90 330 70 410 150 C470 215 330 245 300 300 C285 335 255 350 247 392';
  return `
  <div class="ls" role="img" aria-label="Animación: un avión de papel lleva tu pedido a la farmacia FarmaYa; luego un domiciliario en moto lo lleva hasta tu vivienda y aparece el mensaje ¡Tu salud, hasta tu puerta!">
    <h1 class="ls-sr">FarmaYa: tu salud, hasta tu puerta</h1>
    <svg class="ls-svg" viewBox="-50 75 660 470" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="lsRoadFade" gradientUnits="userSpaceOnUse" x1="-50" y1="0" x2="610" y2="0"><stop offset="0" stop-color="#0f6b47" stop-opacity="0"/><stop offset=".2" stop-color="#0f6b47" stop-opacity="1"/><stop offset=".8" stop-color="#0f6b47" stop-opacity="1"/><stop offset="1" stop-color="#0f6b47" stop-opacity="0"/></linearGradient>
        <radialGradient id="lsGlow"><stop offset="0" stop-color="#22e07a" stop-opacity=".5"/><stop offset="1" stop-color="#22e07a" stop-opacity="0"/></radialGradient>
        <radialGradient id="lsWarm"><stop offset="0" stop-color="#ffd84d" stop-opacity=".7"/><stop offset="1" stop-color="#ffd84d" stop-opacity="0"/></radialGradient>
        <linearGradient id="lsWinLight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e6fff2"/><stop offset="1" stop-color="#7ff0b4"/></linearGradient>
        <linearGradient id="lsBeam" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffd84d" stop-opacity=".55"/><stop offset="1" stop-color="#ffd84d" stop-opacity="0"/></linearGradient>
        <g id="lsPkg"><rect x="-17" y="-10" width="34" height="22" rx="3" fill="#fff" stroke="#0f6b47" stroke-width="1.6"/><rect x="-19" y="-17" width="38" height="8" rx="2.5" fill="#22e07a" stroke="#0f6b47" stroke-width="1.6"/><image href="${FY_CROSS_SRC}" x="-7" y="-3.2" width="14" height="12.3"/></g>
      </defs>

      <!-- Calle (translúcida: se adapta a cualquier fondo) -->
      <rect x="-50" y="466" width="660" height="54" fill="url(#lsRoadFade)" opacity=".1"/>
      <line x1="-50" y1="466" x2="610" y2="466" stroke="url(#lsRoadFade)" stroke-opacity=".3" stroke-width="2"/>
      <line x1="-50" y1="494" x2="610" y2="494" stroke="url(#lsRoadFade)" stroke-opacity=".35" stroke-width="3" stroke-dasharray="24 18"/>

      <!-- ESCENA 1: avión de papel → farmacia -->
      <g class="ls-sceneA">
        <g transform="translate(135 0)" class="ls-pharmacy">
          <ellipse cx="145" cy="459" rx="108" ry="6" fill="#0f6b47" opacity=".2"/>
          <g class="ls-cross-wrap">
            <circle cx="145" cy="236" r="46" fill="url(#lsGlow)" class="ls-cross-halo"/>
            <g class="ls-cross"><circle cx="145" cy="236" r="29" fill="#fff" stroke="#22e07a" stroke-width="3"/><image href="${FY_CROSS_SRC}" x="128" y="220.5" width="34" height="30"/></g>
          </g>
          <rect x="50" y="270" width="190" height="185" rx="10" fill="#eaf8f0" stroke="#0f6b47" stroke-width="2.5"/>
          <rect x="51" y="438" width="188" height="16" fill="#bfe3cf"/>
          <rect x="42" y="262" width="206" height="14" rx="5" fill="#0f6b47"/>
          <rect x="72" y="284" width="146" height="36" rx="8" fill="#0b3d2b"/>
          <text x="145" y="310" text-anchor="middle" font-family="Manrope, DM Sans, sans-serif" font-size="22" font-weight="800" fill="#fff">Farma<tspan fill="#22e07a">Ya</tspan></text>
          ${awning}
          <rect x="64" y="372" width="100" height="70" rx="8" fill="#0a2e21" stroke="#0f6b47" stroke-width="4"/>
          <rect class="ls-win-light" x="67" y="375" width="94" height="64" rx="6" fill="url(#lsWinLight)"/>
          <g fill="#2a7f5c"><rect x="72" y="408" width="9" height="20" rx="2"/><rect x="85" y="413" width="9" height="15" rx="2"/><rect x="138" y="406" width="11" height="22" rx="2"/><rect x="125" y="414" width="9" height="14" rx="2"/></g>
          <rect x="68" y="428" width="88" height="3" fill="#1f7a55"/>
          <g class="ls-ticket"><rect x="102" y="378" width="24" height="30" rx="3" fill="#fff"/><path d="M107 386h14M107 392h14M107 398h8" stroke="#17c46a" stroke-width="2" stroke-linecap="round"/></g>
          <g transform="translate(114 418)"><g class="ls-box">
            <rect x="-17" y="-10" width="34" height="22" rx="3" fill="#fff"/>
            <rect class="ls-item ls-i1" x="-12" y="-9" width="7" height="12" rx="2" fill="#7be8ae"/>
            <rect class="ls-item ls-i2" x="-3" y="-9" width="7" height="12" rx="2" fill="#22e07a"/>
            <rect class="ls-item ls-i3" x="6" y="-9" width="7" height="12" rx="2" fill="#bdf5d6"/>
            <g class="ls-lid"><rect x="-19" y="-17" width="38" height="8" rx="2.5" fill="#22e07a"/></g>
            <image href="${FY_CROSS_SRC}" x="-7" y="-1.2" width="14" height="12.3" class="ls-box-cross"/>
          </g></g>
          <g class="ls-check"><circle cx="150" cy="384" r="10" fill="#22e07a"/><path d="M145 384l4 4 7-8" fill="none" stroke="#04180f" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></g>
          <rect x="176" y="372" width="50" height="83" rx="6" fill="#0f6b47"/>
          <rect x="183" y="380" width="36" height="44" rx="4" fill="#0a2e21"/>
          <rect class="ls-win-light" x="183" y="380" width="36" height="44" rx="4" fill="url(#lsWinLight)" opacity=".35"/>
          <circle cx="216" cy="436" r="2.5" fill="#22e07a"/>
          <ellipse class="ls-ripple" cx="114" cy="392" rx="30" ry="12" fill="none" stroke="#22e07a" stroke-width="2.5"/>
          <circle cx="38" cy="446" r="12" fill="#14503a"/><circle cx="28" cy="450" r="8" fill="#1c6b4c"/>
        </g>
        <path class="ls-trail" d="${route}" pathLength="1" fill="none" stroke="#17c46a" stroke-width="2.6" stroke-linecap="round" stroke-opacity=".6"/>
        <g class="ls-plane"><g class="ls-plane-fade"><g class="ls-plane-wob"><g transform="scale(1.55)">
          <path d="M20 0L-16 -13L-7 0Z" fill="#22e07a"/><path d="M20 0L-16 13L-7 0Z" fill="#12a25a"/><path d="M20 0L-7 0L-10 6Z" fill="#0b6b45"/>
        </g></g></g></g>
      </g>

      <!-- ESCENA 2: domiciliario → vivienda -->
      <g class="ls-sceneB">
        <g class="ls-house">
          <ellipse cx="470" cy="459" rx="80" ry="5" fill="#0f6b47" opacity=".2"/>
          <rect x="505" y="330" width="14" height="30" fill="#0f6b47"/>
          <rect x="412" y="372" width="116" height="83" fill="#eaf8f0" stroke="#0f6b47" stroke-width="2.5"/>
          <rect x="413" y="440" width="114" height="14" fill="#bfe3cf"/>
          <polygon points="398,376 470,314 542,376" fill="#1fbf6b"/>
          <polygon points="470,314 542,376 524,376 470,328" fill="#17a05a"/>
          <rect x="426" y="392" width="30" height="28" rx="4" fill="#0a2e21"/>
          <rect class="ls-win-warm" x="426" y="392" width="30" height="28" rx="4" fill="#ffe98a"/>
          <path d="M441 392v28M426 406h30" stroke="#eaf8f0" stroke-width="2"/>
          <circle class="ls-porch-glow" cx="510" cy="404" r="30" fill="url(#lsWarm)"/>
          <rect x="468" y="396" width="34" height="59" rx="5" fill="#0f6b47"/>
          <circle cx="495" cy="428" r="2.5" fill="#22e07a"/>
          <circle class="ls-porch-lamp" cx="510" cy="404" r="3.5" fill="#ffd84d"/>
          <rect x="460" y="452" width="50" height="6" rx="2" fill="#bfe3cf" stroke="#0f6b47" stroke-width="1"/>
          <ellipse class="ls-ripple ls-ripple-b" cx="485" cy="452" rx="34" ry="9" fill="none" stroke="#22e07a" stroke-width="2.5"/>
          <g class="ls-done"><circle cx="470" cy="282" r="15" fill="#22e07a"/><circle cx="470" cy="282" r="21" fill="none" stroke="#22e07a" stroke-opacity=".4" stroke-width="2"/><path d="M463 282l5 5 9-10" fill="none" stroke="#04180f" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></g>
          <circle cx="548" cy="436" r="14" fill="#14503a"/><circle cx="556" cy="444" r="9" fill="#1c6b4c"/>
          <g transform="translate(485 444)"><use class="ls-pkg-b" href="#lsPkg"/></g>
        </g>

        <g transform="translate(200 490)"><g class="ls-c-fade"><g class="ls-c-move">
          <ellipse cx="0" cy="1" rx="54" ry="4" fill="#0f6b47" opacity=".28"/>
          <polygon class="ls-beam" points="50,-58 132,-86 132,-28" fill="url(#lsBeam)"/>
          <g class="ls-speed"><g class="ls-speed-in"><path d="M-62 -70h-22M-58 -52h-30M-62 -34h-20" stroke="#17c46a" stroke-width="2.4" stroke-linecap="round" opacity=".6"/></g></g>
          <g class="ls-c-bob">
            <g transform="translate(-34 -16)"><circle r="16" fill="#0e1f18" stroke="#0a1511" stroke-width="2"/><circle r="9.5" fill="none" stroke="#b9e6cf" stroke-width="2"/><g class="ls-spin"><path d="M-9 0H9M-4.5 -7.8L4.5 7.8M-4.5 7.8L4.5 -7.8" stroke="#8fd9b2" stroke-width="1.4"/></g><circle r="3" fill="#22e07a"/></g>
            <g transform="translate(34 -16)"><circle r="16" fill="#0e1f18" stroke="#0a1511" stroke-width="2"/><circle r="9.5" fill="none" stroke="#b9e6cf" stroke-width="2"/><g class="ls-spin"><path d="M-9 0H9M-4.5 -7.8L4.5 7.8M-4.5 7.8L4.5 -7.8" stroke="#8fd9b2" stroke-width="1.4"/></g><circle r="3" fill="#22e07a"/></g>
            <path d="M14 -24A20 20 0 0 1 52 -24" fill="none" stroke="#22e07a" stroke-width="4" stroke-linecap="round"/>
            <path d="M34 -16L41 -66" stroke="#5f8f79" stroke-width="4" stroke-linecap="round"/>
            <path d="M-42 -26C-40 -46 -14 -50 4 -46L26 -40C32 -38 34 -32 32 -24L26 -17L-28 -17C-38 -17 -43 -20 -42 -26Z" fill="#17c46a"/>
            <path d="M-30 -40C-20 -45 -6 -45 4 -42" fill="none" stroke="#6df0a8" stroke-width="2" stroke-linecap="round" opacity=".7"/>
            <rect x="-10" y="-17" width="26" height="9" rx="3" fill="#12261d"/>
            <rect x="-40" y="-52" width="38" height="7" rx="3.5" fill="#0b1f17"/>
            <rect x="-45" y="-38" width="4" height="7" rx="1.5" fill="#ff6b6b"/>
            <path d="M38 -64l8 -5" stroke="#0b1f17" stroke-width="5" stroke-linecap="round"/>
            <circle cx="46" cy="-55" r="5" fill="#ffe98a" stroke="#0f6b47" stroke-width="1.5"/>
            <g class="ls-rider">
              <g class="ls-bag"><rect x="-52" y="-100" width="32" height="32" rx="6" fill="#22e07a" stroke="#0f6b47" stroke-width="1.6"/><g class="ls-flap"><rect x="-52" y="-100" width="32" height="10" rx="4" fill="#17c46a" stroke="#0f6b47" stroke-width="1.6"/></g><circle cx="-36" cy="-77" r="9" fill="#fff"/><image href="${FY_CROSS_SRC}" x="-42" y="-82" width="12" height="10.6"/></g>
              <polyline points="-16,-54 6,-46 8,-24" fill="none" stroke="#2f6f56" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
              <rect x="3" y="-27" width="14" height="6" rx="3" fill="#0b1f17"/>
              <path d="M-16 -56L6 -86" stroke="#0f9f5c" stroke-width="21" stroke-linecap="round"/>
              <path d="M-13 -62L-1 -78" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".85"/>
              <polyline points="4,-84 24,-76 38,-66" fill="none" stroke="#0f9f5c" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="39" cy="-66" r="4" fill="#fff" stroke="#0f6b47" stroke-width="1.2"/>
              <circle cx="12" cy="-99" r="12" fill="#fff" stroke="#0f6b47" stroke-width="1.6"/>
              <path d="M2 -101Q12 -113 23 -101" fill="none" stroke="#22e07a" stroke-width="3" stroke-linecap="round"/>
              <path d="M14 -105Q26 -105 25 -94L14 -93Z" fill="#0b3d2b"/>
            </g>
          </g>
        </g></g></g>
      </g>
    </svg>

    <div class="ls-msg" aria-hidden="true"><span class="ls-msg-pill">✓ Pedido entregado</span><p>¡Tu salud, <em>hasta tu puerta!</em></p></div>
    <ol class="ls-steps" aria-hidden="true">
      <li class="ls-s1"><i></i><span>Pedido</span></li>
      <li class="ls-s2"><i></i><span>Preparación</span></li>
      <li class="ls-s3"><i></i><span>En camino</span></li>
      <li class="ls-s4"><i></i><span>Entregado</span></li>
    </ol>
  </div>`;
}

function renderRegister() {
  const app = document.getElementById('app-container');
  const role = h('select', { id: 'regRole', required: true },
    h('option', { value: 'CLIENTE' }, 'Cliente'), h('option', { value: 'FARMACIA' }, 'Farmacia'), h('option', { value: 'REPARTIDOR' }, 'Repartidor'));
  const extra = h('div', { id: 'roleFields', class: 'form-stack' });
  const zones = (state.meta.zones || []).map(z => h('option', { value: z }, z));
  const zone = h('select', { id: 'regZone', required: true }, zones);
  function drawExtra() {
    const r = role.value;
    extra.replaceChildren();
    if (r === 'FARMACIA') extra.append(
      field('Nombre comercial de la farmacia', h('input', { id: 'regPharmacyName', required: true, maxlength: 100, placeholder: 'Droguería ...' })),
      field('Dirección de la farmacia', h('input', { id: 'regAddress', required: true, maxlength: 200, placeholder: 'Dirección del local' })),
      field('Licencia o registro sanitario', h('input', { id: 'regLicense', required: true, maxlength: 100, placeholder: 'Número de registro' })),
      h('div', { class: 'two-fields' }, field('Abre', h('input', { id: 'regFrom', type: 'time', value: '08:00', required: true })), field('Cierra', h('input', { id: 'regTo', type: 'time', value: '22:00', required: true }))));
    if (r === 'REPARTIDOR') extra.append(field('Medio de transporte', h('select', { id: 'regVehicle', required: true }, h('option', { value: '' }, 'Selecciona'), h('option', { value: 'Bicicleta' }, 'Bicicleta'), h('option', { value: 'Motocicleta' }, 'Motocicleta'), h('option', { value: 'Automóvil' }, 'Automóvil'), h('option', { value: 'A pie' }, 'A pie'))));
  }
  role.addEventListener('change', drawExtra); drawExtra();
  app.replaceChildren(h('section', { class: 'auth-card register-card' },
    h('button', { class: 'btn link back-link', type: 'button', onclick: () => { location.hash = '#login'; } }, '← Volver al inicio de sesión'),
    h('div', { class: 'auth-card-heading' }, h('span', { class: 'auth-icon' }, h('img', { class: 'fy-cross', src: FY_CROSS_SRC, alt: '' })), h('h2', null, 'Crea tu cuenta'), h('p', null, 'Únete a la red de FarmaYa')),
    h('form', { id: 'registerForm', class: 'form-stack' },
      h('div', { class: 'two-fields' }, field('Nombre completo', h('input', { id: 'regName', required: true, minlength: 2, maxlength: 100, autocomplete: 'name', placeholder: 'Tu nombre' })), field('Teléfono', h('input', { id: 'regPhone', required: true, autocomplete: 'tel', placeholder: '300 000 0000' }))),
      field('Correo electrónico', h('input', { id: 'regEmail', type: 'email', required: true, autocomplete: 'email', placeholder: 'tu@correo.com' })),
      field('Contraseña (mínimo 8 caracteres)', h('input', { id: 'regPassword', type: 'password', required: true, minlength: 8, autocomplete: 'new-password', placeholder: 'Crea una contraseña segura' })),
      field('Tipo de cuenta', role), field('Zona de atención o entrega', zone), extra,
      h('div', { id: 'authAlert', hidden: true }), h('button', { id: 'btnRegister', class: 'btn primary block', type: 'submit' }, 'Crear cuenta')),
    h('p', { class: 'auth-legal' }, 'Las cuentas de farmacia y repartidor requieren verificación del administrador.')));
  document.getElementById('registerForm').addEventListener('submit', handleRegisterSubmit);
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
  const btn = document.getElementById('btnRegister');
  const role = document.getElementById('regRole').value;
  const body = {
    name: document.getElementById('regName').value.trim(), email: document.getElementById('regEmail').value.trim(),
    password: document.getElementById('regPassword').value, phone: document.getElementById('regPhone').value.trim(),
    role, zone: document.getElementById('regZone').value
  };
  if (role === 'FARMACIA') Object.assign(body, {
    pharmacyName: document.getElementById('regPharmacyName').value.trim(), address: document.getElementById('regAddress').value.trim(),
    licenseNumber: document.getElementById('regLicense').value.trim(), openFrom: document.getElementById('regFrom').value, openTo: document.getElementById('regTo').value
  });
  if (role === 'REPARTIDOR') body.vehicle = document.getElementById('regVehicle').value;
  await act(btn, async () => {
    const response = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'No pudimos crear la cuenta. Revisa los datos.');
    API.setToken(data.token); state.user = data.user;
    toast(role === 'CLIENTE' ? 'Cuenta creada. ¡Bienvenido a FarmaYa!' : 'Cuenta creada. Quedará pendiente de verificación.');
    location.hash = routeForRole(data.user.role); renderApp(); return data;
  });
}
