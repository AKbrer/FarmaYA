/* Arranque, navegación por rol y cabecera común. */
const ROUTES = { CLIENTE: '#client', FARMACIA: '#pharmacy', REPARTIDOR: '#courier', ADMIN: '#admin' };
function routeForRole(role) { return ROUTES[role] || '#login'; }

function renderNavbar() {
  if (typeof window.syncChatbotVisibility === 'function') window.syncChatbotVisibility();
  const nav = document.getElementById('navHeaderActions');
  if (!nav) return;
  nav.replaceChildren();
  const user = state.user;
  if (!user) {
    const isRegister = location.hash === '#register';
    const isLogin = location.hash === '#login';
    nav.append(
      h('a', { class: 'nav-header-pill header-auth-btn desktop-only' + (isLogin ? ' is-active' : ''), href: '#login' }, 'Iniciar sesión'),
      h('a', { class: 'nav-header-pill header-auth-btn desktop-only' + (isRegister ? ' is-active' : ''), href: '#register' }, 'Crear cuenta'),
      h('button', {
        class: 'nav-header-btn hamburger-btn',
        type: 'button',
        title: 'Menú principal (3 líneas)',
        'aria-label': 'Abrir menú de opciones',
        onclick: () => openProfile('menu')
      }, icon('menu'))
    );
    return;
  }
  const roleName = ROLE_NAMES[user.role] || user.role;
  const navItems = [];

  if (user.role === 'CLIENTE') {
    navItems.push(
      h('button', {
        id: 'navHeaderFilterBtn',
        class: 'btn ghost small mobile-header-filter-btn mobile-only',
        type: 'button',
        title: 'Filtros y categorías del catálogo',
        'aria-label': 'Filtros de catálogo',
        onclick: () => {
          if (window.openCatalogFiltersDrawer) {
            window.openCatalogFiltersDrawer();
          }
        }
      },
        icon('filter'),
        h('span', null, 'Filtros')
      ),
      h('button', {
        id: 'navHeaderCartPill',
        class: 'nav-header-pill header-cart-pill',
        type: 'button',
        title: 'Ver canasta de compras FarmaYA',
        'aria-label': 'Canasta de compras',
        onclick: () => {
          if (window.openCartPreviewOverlay) {
            window.openCartPreviewOverlay();
          } else if (window.openMobileCartSheet) {
            window.openMobileCartSheet();
          }
        }
      },
        h('span', { class: 'header-cart-icon', innerHTML: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>' }),
        h('span', { class: 'header-cart-text desktop-only' }, 'Canasta'),
        h('span', { id: 'navHeaderCartCount', class: 'header-cart-badge' }, '0'),
        h('span', { id: 'navHeaderCartTotal', class: 'header-cart-total' }, '$0')
      ),
      h('button', {
        id: 'navHeaderOrdersBtn',
        class: 'nav-header-pill nav-header-orders-btn desktop-only',
        type: 'button',
        title: 'Ver mis pedidos y seguimiento',
        'aria-label': 'Mis pedidos',
        onclick: () => {
          if (location.hash === '#orders') {
            renderApp();
          } else {
            location.hash = '#orders';
          }
        }
      },
        icon('truck'),
        h('span', { class: 'nav-orders-text' }, 'Mis Pedidos'),
        h('span', { id: 'navHeaderOrdersBadge', class: 'header-orders-badge', style: 'display:none;' }, '0')
      )
    );
  }

  if (user.role === 'CLIENTE') {
    // Para CLIENTE: en celular NO se muestra en la barra superior (solo en desktop con desktop-only)
    // El usuario aparece exclusivamente en el panel derecho desplegable (menú de 3 líneas)
    navItems.push(
      h('button', {
        class: 'nav-header-pill user-pill-btn desktop-only',
        type: 'button',
        title: 'Ver perfil (' + user.name + ')',
        onclick: () => openProfile('profile')
      },
        h('span', { class: 'user-avatar' }, (user.name || 'U').slice(0, 1).toUpperCase()),
        h('span', { class: 'user-pill-info' }, h('strong', null, user.name), h('small', null, roleName))
      )
    );
  } else {
    navItems.push(
      h('button', {
        class: 'nav-header-pill user-pill-btn',
        type: 'button',
        title: 'Ver perfil (' + user.name + ')',
        onclick: () => openProfile('profile')
      },
        h('span', { class: 'user-avatar' }, (user.name || 'U').slice(0, 1).toUpperCase()),
        h('span', { class: 'user-pill-info' }, h('strong', null, user.name), h('small', null, roleName))
      )
    );
  }

  navItems.push(
    h('button', {
      class: 'nav-header-btn hamburger-btn',
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

  // Carga paralela ultra-rapida de configuracion inicial y sesion activa
  const bootstrapTasks = [];
  if (!state.metaLoaded) {
    bootstrapTasks.push(
      fetch('/api/meta')
        .then(r => r.ok ? r.json() : { statuses: {}, demo: false })
        .then(data => { state.meta = data; state.metaLoaded = true; })
        .catch(() => { state.meta = { statuses: {}, demo: false }; state.metaLoaded = true; })
    );
  }
  if (API.token && !state.user) {
    bootstrapTasks.push(
      API.get('/auth/me')
        .then(u => { state.user = u; })
        .catch(() => { API.setToken(null); state.user = null; })
    );
  }
  if (bootstrapTasks.length) {
    await Promise.all(bootstrapTasks);
  }
  const hash = location.hash || (state.user ? routeForRole(state.user.role) : '#home');
  if (state.user && ['#home', '#login', '#register', ''].includes(hash)) location.hash = routeForRole(state.user.role);
  document.querySelectorAll('dialog').forEach(d => {
    try { d.close(); } catch (_) {}
    d.remove();
  });
  const route = location.hash || hash;
  renderNavbar();
  if (!state.user || state.user.role !== 'CLIENTE') {
    document.getElementById('fy_mobile_cart_bar')?.remove();
  }
  if (!state.user) {
    if (route === '#register') {
      renderRegister();
    } else if (route === '#login') {
      renderLogin();
    } else {
      if (typeof renderLandingPage === 'function') {
        renderLandingPage();
      } else {
        renderLogin();
      }
    }
    mountGlobalFooter();
    applyViewTransition();
    return;
  }
  const expected = routeForRole(state.user.role);
  if (route.startsWith('#payment')) {
    document.title = 'FarmaYa · Pasarela de Pago Seguro';
    const params = new URLSearchParams(route.split('?')[1] || '');
    const orderId = params.get('order') || route.split('/')[1] || null;
    if (orderId && typeof renderPaymentPage === 'function') {
      renderPaymentPage(orderId);
      mountGlobalFooter();
      renderNavbar();
      applyViewTransition();
      return;
    } else {
      location.hash = '#orders';
      return;
    }
  }
  if (route === '#orders') {
    document.title = 'FarmaYa · Pedidos';
    renderOrdersPage();
    mountGlobalFooter();
    renderNavbar();
    applyViewTransition();
    return;
  }
  if (route !== expected) { location.hash = expected; return; }
  document.title = 'FarmaYa · ' + (state.user.name || 'Inicio');
  if (state.user.role === 'CLIENTE') { renderClientDashboard(); }
  else if (state.user.role === 'FARMACIA') app.replaceChildren(pharmacyView(state.user));
  else if (state.user.role === 'REPARTIDOR') app.replaceChildren(courierView(state.user));
  else if (state.user.role === 'ADMIN') app.replaceChildren(adminView(state.user));
  mountGlobalFooter();
  renderNavbar();
  if (!state.user || state.user.role !== 'CLIENTE') {
    document.getElementById('fy_mobile_cart_bar')?.remove();
  }
  syncHeaderHeight();
  if (typeof window.syncChatbotVisibility === 'function') {
    window.syncChatbotVisibility();
  }
  applyViewTransition();
}

function applyViewTransition() {
  const app = document.getElementById('app-container');
  if (app && app.firstElementChild) {
    const el = app.firstElementChild;
    if (el.querySelector && el.querySelector('.side-nav-layout')) {
      el.classList.remove('fy-view-transition');
      return;
    }
    el.classList.remove('fy-view-transition');
    void el.offsetWidth;
    el.classList.add('fy-view-transition');
    el.addEventListener('animationend', () => {
      el.classList.remove('fy-view-transition');
    }, { once: true });
  }
}
window.applyViewTransition = applyViewTransition;

/* Altura real de la cabecera: el menú lateral fijo se ubica justo debajo. */
function syncHeaderHeight() {
  const header = document.querySelector('.site-header');
  if (header) document.documentElement.style.setProperty('--header-h', header.offsetHeight + 'px');
}
window.addEventListener('resize', syncHeaderHeight);

window.addEventListener('hashchange', () => { renderApp(); });
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { renderApp(); });
} else {
  renderApp();
}

/* Cabecera: la línea divisoria solo aparece cuando hay contenido pasando por debajo. */
(function () {
  const sync = () => {
    const header = document.querySelector('.site-header');
    if (header) header.classList.toggle('is-scrolled', window.scrollY > 6);
  };
  window.addEventListener('scroll', sync, { passive: true });
  window.addEventListener('load', sync);
})();


/* Monta el pie de soporte dividido 50/50 a ancho completo universal */
function mountGlobalFooter() {
  let f = document.getElementById('fy_global_footer');
  if (!f) {
    f = h('div', { id: 'fy_global_footer' });
    document.body.appendChild(f);
  }
  f.replaceChildren(farmayaSupportFooter());
}
