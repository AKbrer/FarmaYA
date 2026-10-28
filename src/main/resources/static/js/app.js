/* Arranque, navegación por rol y cabecera común. */
const ROUTES = { CLIENTE: '#client', FARMACIA: '#pharmacy', REPARTIDOR: '#courier', ADMIN: '#admin' };
function routeForRole(role) { return ROUTES[role] || '#login'; }

function renderNavbar() {
  const nav = document.getElementById('navHeaderActions');
  if (!nav) return;
  nav.replaceChildren();
  const user = state.user;
  if (!user) {
    const isRegister = location.hash === '#register';
    nav.append(
      h('span', { class: 'header-tag desktop-only' }, 'Tu farmacia y salud a un clic'),
      h('a', { class: isRegister ? 'btn ghost small' : 'btn primary small', href: '#login' }, 'Iniciar sesión'),
      h('a', { class: isRegister ? 'btn primary small' : 'btn ghost small', href: '#register' }, 'Crear cuenta'),
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
  const navItems = [
    h('span', { class: 'header-tag desktop-only' }, h('i', { class: 'live-dot', 'aria-hidden': 'true' }), 'Servicio activo')
  ];

  if (user.role === 'CLIENTE') {
    navItems.push(
      h('button', {
        id: 'navHeaderCartPill',
        class: 'header-cart-pill',
        type: 'button',
        title: 'Ver canasta de compras FarmaYA',
        'aria-label': 'Canasta de compras',
        onclick: () => {
          const cart = document.querySelector('.cart-panel');
          if (cart) {
            cart.scrollIntoView({ behavior: 'smooth', block: 'center' });
            cart.classList.add('cart-highlight-glow');
            setTimeout(() => cart.classList.remove('cart-highlight-glow'), 1400);
          }
        }
      },
        h('span', { class: 'header-cart-icon', innerHTML: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>' }),
        h('span', { class: 'header-cart-text desktop-only' }, 'Canasta'),
        h('span', { id: 'navHeaderCartCount', class: 'header-cart-badge' }, '0'),
        h('span', { id: 'navHeaderCartTotal', class: 'header-cart-total' }, '$0')
      )
    );
  }

  navItems.push(
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

  nav.append(...navItems);
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
    catch (_) { state.meta = { zones: [], statuses: {}, demo: false }; }
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
  if (!state.user || state.user.role !== 'CLIENTE') {
    document.getElementById('fy_mobile_cart_bar')?.remove();
  }
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
  if (!state.user || state.user.role !== 'CLIENTE') {
    document.getElementById('fy_mobile_cart_bar')?.remove();
  }
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

/* Cabecera: la línea divisoria solo aparece cuando hay contenido pasando por debajo. */
(function () {
  const sync = () => {
    const header = document.querySelector('.site-header');
    if (header) header.classList.toggle('is-scrolled', window.scrollY > 6);
  };
  window.addEventListener('scroll', sync, { passive: true });
  window.addEventListener('load', sync);
})();
