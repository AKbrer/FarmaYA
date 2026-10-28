/* Inicio de cliente: catálogo orientativo + pedidos reales en la API. */
let clientCart = [];
let clientCategory = '';
let clientSearch = '';
let clientSort = 'featured';
let clientCategories = CATEGORIES.map(c => ({ id: c.id, label: c.label }));

function renderClientDashboard() {
  const app = document.getElementById('app-container');
  const user = state.user;
  const search = h('input', { type: 'search', class: 'search-input', placeholder: 'Busca medicamentos o productos de cuidado personal…', value: clientSearch, 'aria-label': 'Buscar productos', oninput: () => { clientSearch = search.value; drawProducts(); } });
  const productGrid = h('div', { class: 'products-grid' });
  const cartBox = h('section', { class: 'block cart-panel' });
  const pharmacyBox = h('section', { class: 'block' }, h('div', { class: 'section-heading' }, h('div', null, h('span', { class: 'eyebrow' }, 'RED FARMA YA'), h('h2', null, 'Farmacias cercanas'))), live(() => API.get('/pharmacies'), pharmacies => {
    if (!pharmacies.length) return empty('Aún no hay farmacias verificadas', 'Cuando se registren y sean verificadas, aparecerán aquí.');
    return h('div', { class: 'pharmacy-grid' }, pharmacies.map(p => h('article', { class: 'pharmacy-tile' },
      h('div', { class: 'pharmacy-avatar' }, h('img', { class: 'fy-cross', src: FY_CROSS_SRC, alt: '' })), h('div', { class: 'pharmacy-tile-info' }, h('strong', null, p.name || 'Farmacia'), h('p', null, p.address || p.zone), h('small', { class: p.open ? 'text-success' : 'muted' }, p.open ? '● Recibiendo pedidos' : '○ Fuera de horario'), h('small', { class: 'muted block-line' }, p.openFrom + '–' + p.openTo)), p.sameZone && h('span', { class: 'tag' }, 'Tu zona'))));
  }));
  function drawProducts() {
    const q = norm(clientSearch);
    const items = CATALOG.filter(p => (!clientCategory || p.cat === clientCategory) && (!q || norm(p.name).includes(q)));
    const sorters = {
      featured: (a, b) => Number(!!b.featured) - Number(!!a.featured) || a.name.localeCompare(b.name, 'es'),
      priceAsc: (a, b) => Number(a.price) - Number(b.price) || a.name.localeCompare(b.name, 'es'),
      priceDesc: (a, b) => Number(b.price) - Number(a.price) || a.name.localeCompare(b.name, 'es'),
      nameAsc: (a, b) => a.name.localeCompare(b.name, 'es'),
      nameDesc: (a, b) => b.name.localeCompare(a.name, 'es')
    };
    items.sort(sorters[clientSort] || sorters.featured);
    productGrid.replaceChildren(...(items.length ? items.map(p => {
      const count = clientCart.filter(i => i.name === p.name).reduce((n, i) => n + i.quantity, 0);
      return h('article', { class: 'product-card' }, h('div', { class: 'product-art-wrap' }, productArt(p)),
        h('span', { class: 'product-pharmacy' }, 'Precio orientativo'), h('h3', { class: 'product-title' }, p.name),
        p.rx && h('p', { class: 'prescription-note' }, 'Puede requerir fórmula médica'),
        h('div', { class: 'product-bottom' }, h('strong', { class: 'product-price' }, money(p.price)), h('button', { class: 'btn primary small', type: 'button', onclick: () => { addClientProduct(p); drawProducts(); drawCart(); toast('Producto agregado al pedido'); } }, count ? '+ Agregar (' + count + ')' : '+ Agregar')));
    }) : [empty('No encontramos productos', 'Prueba con otro nombre o categoría.') ]));
  }
  function drawCart() {
    const qty = clientCart.reduce((n, i) => n + i.quantity, 0);
    const total = clientCart.reduce((n, i) => n + i.quantity * i.price, 0);
    cartBox.replaceChildren(h('div', { class: 'section-heading' }, h('div', null, h('span', { class: 'eyebrow' }, 'TU SOLICITUD'), h('h2', null, 'Mi pedido')), h('span', { class: 'count-pill' }, qty + ' artículos')),
      !clientCart.length ? empty('Tu carrito está vacío', 'Agrega productos para solicitar disponibilidad y precio a una farmacia.') : h('div', { class: 'cart-items' }, clientCart.map(item => h('div', { class: 'cart-item' }, h('div', null, h('strong', null, item.name), h('small', { class: 'muted block-line' }, money(item.price) + ' · precio orientativo'), h('div', { class: 'quantity-control' }, h('button', { type: 'button', class: 'qty-btn', 'aria-label': 'Quitar uno', onclick: () => { item.quantity--; if (item.quantity <= 0) clientCart = clientCart.filter(x => x !== item); drawCart(); drawProducts(); } }, '−'), h('span', null, item.quantity), h('button', { type: 'button', class: 'qty-btn', 'aria-label': 'Agregar uno', onclick: () => { item.quantity = Math.min(99, item.quantity + 1); drawCart(); drawProducts(); } }, '+'))), h('strong', null, money(item.price * item.quantity))))),
      clientCart.length ? h('div', { class: 'cart-total' }, h('span', null, 'Subtotal orientativo'), h('strong', null, money(total))) : null,
      clientCart.length ? h('p', { class: 'muted small' }, 'La farmacia confirmará existencias y precio final antes de preparar el pedido.') : null,
      h('button', { class: 'btn primary block', type: 'button', disabled: !clientCart.length, onclick: checkout }, 'Solicitar a farmacias →'));
  }
  async function checkout(e) {
    const address = h('input', { required: true, minlength: 5, maxlength: 200, placeholder: 'Escribe barrio, calle o dirección…', value: user.address || '' });
    const cityInput = h('input', { required: true, maxlength: 100, placeholder: 'Ciudad (ej. Turbaco)' });
    const latInput = h('input', { type: 'hidden', value: '' });
    const lngInput = h('input', { type: 'hidden', value: '' });
    const notes = h('textarea', { rows: 2, maxlength: 400, placeholder: 'Indicaciones adicionales (opcional)' });
    const mapStatus = h('p', { class: 'muted small' }, 'Mapa gratuito de OpenStreetMap. Pulsa en el mapa o arrastra el marcador para elegir la entrega.');
    const mapNode = h('div', { class: 'farmaya-map', role: 'application', 'aria-label': 'Mapa para seleccionar la entrega' });
    let map, marker;
    function selectPoint(pos) {
      const lat=Number(pos.lat), lng=Number(pos.lng);
      if(!Number.isFinite(lat)||!Number.isFinite(lng)) return;
      latInput.value=String(lat); lngInput.value=String(lng);
      if(marker) marker.setLatLng([lat,lng]);
      mapStatus.textContent='Ubicación seleccionada ('+lat.toFixed(5)+', '+lng.toFixed(5)+'). Puedes mover el marcador.';
    }
    const locateBtn = h('button', { class: 'btn secondary', type: 'button', onclick: async () => {
      try { mapStatus.textContent='Solicitando permiso de ubicación…'; const pos=await farmayaGetPosition(); map.setView([pos.lat,pos.lng],16); selectPoint(pos); reverseGeocode(pos).then(r=>{if(r){if(!address.value.trim()) address.value=r.address||''; if(!cityInput.value.trim()) cityInput.value=r.city||'';}}); }
      catch(err) { mapStatus.textContent=err.message; }
    } }, 'Usar mi ubicación');
    const form = h('form', { class: 'sheet-body narrow checkout-map-form', onsubmit: async ev => {
      ev.preventDefault();
      if (!latInput.value || !lngInput.value) { mapStatus.textContent='Selecciona tu ubicación en el mapa o pulsa «Usar mi ubicación».'; return; }
      const btn = form.querySelector('button[type=submit]');
      const payload = { items: clientCart.map(i => ({ name: i.name, quantity: i.quantity, prescription: !!i.rx, note: '' })), address: address.value.trim(), zone: cityInput.value.trim(), city: cityInput.value.trim(), latitude: Number(latInput.value), longitude: Number(lngInput.value), phone: user.phone || '', notes: notes.value.trim() };
      const result = await act(btn, () => API.post('/orders', payload), 'Solicitud enviada a las farmacias');
      if (result) { clientCart = []; d.close(); refreshAll(); drawCart(); drawProducts(); openOrderDetail(result.id); }
    } }, h('h2', null, '¿Dónde lo entregamos?'), h('p', { class: 'muted' }, 'El mapa no necesita clave de Google. Permite el acceso a tu ubicación o selecciona el punto manualmente.'), field('Dirección de entrega', address), field('Ciudad', cityInput), mapNode, locateBtn, mapStatus, latInput, lngInput, field('Indicaciones adicionales', notes), h('div', { class: 'actions' }, h('button', { class: 'btn ghost', type: 'button', onclick: () => d.close() }, 'Volver'), h('button', { class: 'btn primary', type: 'submit' }, 'Enviar solicitud')));
    const d = openDialog(form);
    try {
      await loadLeaflet();
      const fallback = [10.3997,-75.5000]; // área de Cartagena/Turbaco
      map = L.map(mapNode).setView(fallback,12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19, attribution:'© OpenStreetMap contributors' }).addTo(map);
      marker = L.marker(fallback,{draggable:true}).addTo(map);
      marker.on('dragend',()=>{const p=marker.getLatLng();selectPoint(p);});
      map.on('click',ev=>selectPoint(ev.latlng));
      selectPoint({lat:fallback[0],lng:fallback[1]});
      setTimeout(()=>map.invalidateSize(),150);
      // Intentar geolocalización; si se deniega, el usuario puede elegir el punto manualmente.
      locateBtn.click();
    } catch(err) { mapNode.textContent='No se pudo cargar el mapa gratuito. Comprueba tu conexión a Internet.'; mapStatus.textContent=err.message||String(err); }
  }

  const stickyCategory = h('div', { class: 'client-sticky-categories' },
    h('div', { class: 'client-sticky-inner' },
      h('strong', null, 'Categorías'),
      h('label', { class: 'catalog-control' }, h('span', null, 'Filtrar por categoría'), (() => { const categorySelect = h('select', { class: 'catalog-select', 'aria-label': 'Filtrar productos por categoría', onchange: () => { clientCategory = categorySelect.value; drawProducts(); } }, h('option', { value: '' }, 'Todas las categorías'), clientCategories.map(c => h('option', { value: c.id }, c.label))); categorySelect.value = clientCategory; window.clientCategorySelect = categorySelect; return categorySelect; })()),
      h('label', { class: 'catalog-control' }, h('span', null, 'Ordenar productos'), (() => { const sortSelect = h('select', { class: 'catalog-select', 'aria-label': 'Ordenar productos', onchange: () => { clientSort = sortSelect.value; drawProducts(); } }, h('option', { value: 'featured' }, 'Destacados'), h('option', { value: 'priceAsc' }, 'Precio: menor a mayor'), h('option', { value: 'priceDesc' }, 'Precio: mayor a menor'), h('option', { value: 'nameAsc' }, 'Nombre: A–Z'), h('option', { value: 'nameDesc' }, 'Nombre: Z–A')); sortSelect.value = clientSort; return sortSelect; })())
    ));
  app.replaceChildren(h('div', { class: 'client-home stack' }, stickyCategory,
    h('section', { class: 'welcome-banner' }, h('div', null, h('span', { class: 'eyebrow' }, 'CUIDAMOS DE TI'), h('h1', null, 'Hola, ' + (user.name || 'bienvenido').split(' ')[0] + ' 👋'), h('p', null, 'Pide tus productos de salud desde casa. La farmacia confirma el precio antes de preparar tu pedido.'), h('div', { class: 'welcome-pills' }, h('span', null, '✓ Precio confirmado por farmacia'), h('span', null, '✓ Seguimiento del pedido'))), h('div', { class: 'welcome-art', 'aria-hidden': 'true' }, h('img', { class: 'fy-cross', src: FY_CROSS_SRC, alt: '' }))),
    h('div', { class: 'client-search-row' }, h('div', { class: 'search-wrap' }, h('span', null, '⌕'), search), h('button', { class: 'btn secondary', type: 'button', onclick: () => openProfile() }, 'Mi perfil')),
    h('div', { class: 'client-main-grid' }, h('div', { class: 'client-products-column' },
      h('section', { class: 'block' }, h('div', { class: 'section-heading' }, h('div', null, h('span', { class: 'eyebrow' }, 'EXPLORA'), h('h2', null, '¿Qué necesitas hoy?')))),
      h('section', { class: 'block' }, h('div', { class: 'section-heading' }, h('div', null, h('span', { class: 'eyebrow' }, 'CATÁLOGO REFERENCIAL'), h('h2', null, 'Productos populares')), h('span', { class: 'muted small' }, 'Valores aproximados')), productGrid), pharmacyBox),
      h('aside', { class: 'client-side-column' }, cartBox, h('section', { class: 'trust-card' }, h('span', null, '♡'), h('strong', null, 'Tu salud primero'), h('p', null, 'Los medicamentos que requieren fórmula deben validarse con la farmacia antes de la entrega.'))))));
  drawProducts(); drawCart();
  // La colección MongoDB `categories` es la fuente principal del filtro de categorías.
  // Si la API no está disponible, se conserva el catálogo local como alternativa.
  API.get('/categories').then(rows => {
    if (!Array.isArray(rows) || !rows.length) return;
    clientCategories = rows.filter(c => c && c.active !== false && c.code && c.name)
      .map(c => ({ id: c.code, label: c.name }));
    if (clientCategory && !clientCategories.some(c => c.id === clientCategory)) clientCategory = '';
    const select = window.clientCategorySelect;
    if (select) {
      const current = clientCategory;
      select.replaceChildren(h('option', { value: '' }, 'Todas las categorías'),
        ...clientCategories.map(c => h('option', { value: c.id }, c.label)));
      select.value = current;
    }
  }).catch(err => console.warn('No se pudieron cargar las categorías desde la base de datos; se usa el catálogo local.', err));
}

function addClientProduct(p) {
  const existing = clientCart.find(i => i.name === p.name);
  if (existing) existing.quantity = Math.min(99, existing.quantity + 1);
  else clientCart.push({ name: p.name, price: p.price, quantity: 1, rx: !!p.rx });
}
