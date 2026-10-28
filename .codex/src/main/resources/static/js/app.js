/* Arranque, navegación por rol y cabecera común. */
const ROUTES = { CLIENTE: '#client', FARMACIA: '#pharmacy', REPARTIDOR: '#courier', ADMIN: '#admin' };
function routeForRole(role) { return ROUTES[role] || '#login'; }

function renderNavbar() {
  const nav = document.getElementById('navHeaderActions');
  if (!nav) return;
  nav.replaceChildren();
  const user = state.user;
  if (!user) {
    nav.append(
      h('span', { class: 'header-tag desktop-only' }, 'Tu farmacia y salud a un clic'),
      h('a', { class: 'btn primary small', href: '#login' }, 'Iniciar sesión'),
      h('button', {
        class: 'icon-button hamburger-btn',
        type: 'button',
        title: 'Menú principal (3 líneas)',
        'aria-label': 'Abrir menú de opciones',
        onclick: () => openProfile('menu')
      }, icon('menu'))
    );
    return;
  }
  const roleName = ROLE_NAMES[user.role] || user.role;
  nav.append(
    h('span', { class: 'header-tag desktop-only' }, '● Servicio activo'),
    h('button', {
      class: 'user-pill-btn',
      type: 'button',
      title: 'Ver perfil (' + user.name + ')',
      onclick: () => openProfile('profile')
    },
      h('span', { class: 'user-avatar' }, (user.name || 'U').slice(0, 1).toUpperCase()),
      h('span', null, h('strong', null, user.name), h('small', null, roleName))
    ),
    h('button', {
      class: 'icon-button hamburger-btn',
      type: 'button',
      title: 'Menú principal (3 líneas)',
      'aria-label': 'Abrir panel desplegable de opciones',
      onclick: () => openProfile('menu')
    }, icon('menu'))
  );
}

async function logoutCurrent() {
  try { if (API.token) await API.post('/auth/logout'); } catch (_) { /* se limpia localmente incluso si expiró */ }
  API.setToken(null); state.user = null; location.hash = '#login'; renderApp();
}
function logout() { return logoutCurrent(); }
window.logout = logout;

async function renderApp() {
  const app = document.getElementById('app-container');
  if (!app) return;
  if (!state.metaLoaded) {
    try { state.meta = await fetch('/api/meta').then(r => { if (!r.ok) throw new Error('No se pudo cargar la configuración'); return r.json(); }); }
    catch (_) { state.meta = { zones: ['Zona Norte', 'Zona Centro', 'Zona Sur', 'Zona Oriente', 'Zona Occidente'], statuses: {}, demo: false }; }
    state.metaLoaded = true;
  }
  if (API.token && !state.user) {
    try { state.user = await API.get('/auth/me'); }
    catch (_) { API.setToken(null); state.user = null; }
  }
  const hash = location.hash || (state.user ? routeForRole(state.user.role) : '#login');
  if (state.user && ['#login', '#register', ''].includes(hash)) location.hash = routeForRole(state.user.role);
  const route = location.hash || hash;
  renderNavbar();
  if (!state.user) {
    if (route === '#register') renderRegister(); else renderLogin();
    return;
  }
  const expected = routeForRole(state.user.role);
  if (route === '#orders') { document.title = 'FarmaYa · Pedidos'; renderOrdersPage(); renderNavbar(); return; }
  if (route !== expected) { location.hash = expected; return; }
  document.title = 'FarmaYa · ' + (state.user.name || 'Inicio');
  if (state.user.role === 'CLIENTE') renderClientDashboard();
  else if (state.user.role === 'FARMACIA') app.replaceChildren(pharmacyView(state.user));
  else if (state.user.role === 'REPARTIDOR') app.replaceChildren(courierView(state.user));
  else if (state.user.role === 'ADMIN') app.replaceChildren(adminView(state.user));
  renderNavbar();
  syncHeaderHeight();
}

/* Altura real de la cabecera: el menú lateral fijo se ubica justo debajo. */
function syncHeaderHeight() {
  const header = document.querySelector('.site-header');
  if (header) document.documentElement.style.setProperty('--header-h', header.offsetHeight + 'px');
}
window.addEventListener('resize', syncHeaderHeight);

window.addEventListener('hashchange', () => { renderApp(); });
window.addEventListener('load', () => { renderApp(); });
