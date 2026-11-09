/* FarmaYA · Experiencia de Salud a Domicilio y Catálogo Farmacéutico

   Diseño inspirado en el sistema Clinical Vitality de Google Stitch (Pantallas 8, 4, 5 y 3).

   Conserva 100% de la funcionalidad reactiva (API, Carrito, Leaflet Maps, Perfil, Estados). */

let clientCart = []; persistClientCart(); syncClientCartUI();
try {
  const _savedCart = localStorage.getItem('farmaya_client_cart');
  if (_savedCart) {
    const _parsed = JSON.parse(_savedCart);
    if (Array.isArray(_parsed)) clientCart = _parsed;
  }
} catch (_) {
  clientCart = [];
}

function persistClientCart() {
  try {
    localStorage.setItem('farmaya_client_cart', JSON.stringify(clientCart));
  } catch (_) {}
}

function syncClientCartUI() {
  const qty = clientCart.reduce((n, i) => n + (i.quantity || 1), 0);
  const total = clientCart.reduce((n, i) => n + (i.quantity || 1) * (i.price || 0), 0);

  const headerCount = document.getElementById('navHeaderCartCount');
  const headerTotal = document.getElementById('navHeaderCartTotal');
  const headerPill = document.getElementById('navHeaderCartPill');

  if (headerCount) headerCount.textContent = String(qty);
  if (headerTotal && typeof money === 'function') headerTotal.textContent = money(total);
  if (headerPill) {
    if (qty > 0) headerPill.classList.add('has-items');
    else headerPill.classList.remove('has-items');
  }

  if (typeof drawCart === 'function') {
    try { drawCart(); } catch (_) {}
  }
  if (typeof drawProducts === 'function') {
    try { drawProducts(); } catch (_) {}
  }
}
window.persistClientCart = persistClientCart;
window.syncClientCartUI = syncClientCartUI;

let clientCategory = '';

let clientSearch = '';

let clientSort = 'featured';

let clientRxFilter = 'all'; // 'all' | 'rx' | 'otc'

let clientCategories = CATEGORIES.map(c => ({ id: c.id, label: c.label }));

function renderClientDashboard() {

  const app = document.getElementById('app-container');

  const user = state.user;

  // Search input element

  const searchInput = h('input', {

    type: 'search',

    class: 'search-input stitch-search-input',

    placeholder: 'Buscar medicamentos o código de pedido (FY-...)',

    value: clientSearch,

    'aria-label': 'Buscar medicamentos o productos de cuidado personal',

    oninput: () => {

      clientSearch = searchInput.value;

      clientPage = 1;

      drawProducts();

      if (typeof window.triggerActiveOrdersSearch === 'function') {

        window.triggerActiveOrdersSearch();

      }

    }

  });

  let clientPage = 1;
  const CLIENT_PAGE_SIZE = 30;

  const productGrid = h('div', { class: 'products-grid stitch-products-grid' });
  const productPagination = h('div', { class: 'catalog-pagination-wrap' });

  const cartBox = h('section', { class: 'block cart-panel stitch-cart-panel' });

  // Red de farmacias cercanas verificadas


  // Sincronización silenciosa en segundo plano de la insignia de pedidos activos en la cabecera
  const activeOrdersWatcher = live(() => API.get('/orders/mine'), orders => {
    const list = Array.isArray(orders) ? orders : [];
    const active = list.filter(o => !['ENTREGADA', 'ENTREGADO', 'CANCELADA', 'CANCELADO', 'VENCIDA', 'RECHAZADA'].includes(o.status));
    const badge = document.getElementById('navHeaderOrdersBadge');
    if (badge) {
      badge.textContent = String(active.length);
      badge.style.display = active.length > 0 ? 'inline-flex' : 'none';
    }
    return h('div', { style: 'display:none;' });
  }, 3500);

  const pharmacyBox = h('section', { class: 'block stitch-pharmacies-block' },

    h('div', { class: 'section-heading' },

      h('div', null,

        h('span', { class: 'eyebrow' }, 'RED DE FARMACIAS ASISTENCIALES'),

        h('h2', null, 'Droguerías de turno en tu cobertura')

      )

    ),

    live(() => API.get('/pharmacies'), pharmacies => {

      if (!pharmacies.length) {

        return empty('Aún no hay farmacias aliadas disponibles', 'Apenas una farmacia autorizada se conecte en tu cuadrante, aparecerá aquí.');

      }

      return h('div', { class: 'pharmacy-grid' }, pharmacies.map(p =>

        h('article', { class: 'pharmacy-tile' },

          h('div', { class: 'pharmacy-avatar' },

            h('img', { class: 'fy-cross', src: FY_CROSS_SRC, alt: '' })

          ),

          h('div', { class: 'pharmacy-tile-info' },

            h('strong', null, p.name || 'Farmacia Aliada'),

            h('p', null, p.address || p.city || 'Barranquilla'),

            h('small', { class: p.open ? 'text-success' : 'muted' }, p.open ? '● Recibiendo despachos' : '○ Fuera de turno'),

            h('small', { class: 'muted block-line' }, 'Horario: ' + p.openFrom + '–' + p.openTo)

          ),

          

        )

      ));

    })

  );

  function drawProducts() {

    const q = norm(clientSearch);

    const items = CATALOG.filter(p => {

      if (clientCategory && p.cat !== clientCategory) return false;

      if (!q) return true;

      const haystack = norm((p.name || '') + ' ' + (p.lab || '') + ' ' + (p.active || '') + ' ' + (p.presentation || ''));

      return haystack.includes(q);

    });

    const sorters = {

      featured: (a, b) => Number(!!b.featured) - Number(!!a.featured) || a.name.localeCompare(b.name, 'es'),

      priceAsc: (a, b) => Number(a.price) - Number(b.price) || a.name.localeCompare(b.name, 'es'),

      priceDesc: (a, b) => Number(b.price) - Number(a.price) || a.name.localeCompare(b.name, 'es'),

      nameAsc: (a, b) => a.name.localeCompare(b.name, 'es'),

      nameDesc: (a, b) => b.name.localeCompare(a.name, 'es')

    };

    items.sort(sorters[clientSort] || sorters.featured);

    const totalItems = items.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / CLIENT_PAGE_SIZE));
    if (clientPage > totalPages) clientPage = 1;
    if (clientPage < 1) clientPage = 1;

    const startIdx = (clientPage - 1) * CLIENT_PAGE_SIZE;
    const endIdx = Math.min(startIdx + CLIENT_PAGE_SIZE, totalItems);
    const pageItems = items.slice(startIdx, endIdx);

    productGrid.replaceChildren(...(pageItems.length ? pageItems.map(p => {

      const inCart = clientCart.find(i => i.name === p.name);

      const count = inCart ? inCart.quantity : 0;

      return h('article', { class: 'product-card stitch-card' },

        // Cabecera de la tarjeta con badges clínicos

        h('div', { class: 'product-top-badges' },

          h('span', { class: 'badge-otc' }, 'Venta Libre'),

          h('span', { class: 'badge-flash' }, '45 min')

        ),

        // Imagen / Ilustración farmacéutica

        h('div', { class: 'product-art-wrap stitch-art', onclick: () => openProductModal(p), title: 'Ver ficha farmacéutica completa' },

          productArt(p)

        ),

        // Metadatos clínicos

        h('div', { class: 'product-meta-block' },

          h('span', { class: 'product-lab' }, p.lab || 'Laboratorio Certificado'),

          h('h3', { class: 'product-title', onclick: () => openProductModal(p) }, p.name),

          h('span', { class: 'product-presentation' }, p.presentation || 'Presentación oficial')

        ),

        // Precio y disponibilidad

        h('div', { class: 'product-pricing-row' },

          h('div', { class: 'price-stack' },

            h('span', { class: 'price-label' }, 'Precio sugerido'),

            h('strong', { class: 'product-price' }, money(p.price))

          ),

          h('span', { class: 'stock-badge' }, '● En bodega')

        ),

        // Fila de acciones (Stepper + Botón de Agregar + Ficha)

        h('div', { class: 'product-actions-row' + (count ? ' has-qty' : ' no-qty') },

          h('div', { class: 'quantity-control stitch-stepper' + (count === 0 ? ' zero-count' : '') },

            h('button', {

              type: 'button',

              class: 'qty-btn',

              'aria-label': 'Quitar uno',

              onclick: () => {

                if (count > 0) {

                  removeClientProduct(p);

                  drawProducts();

                  drawCart();

                }

              }

            }, '−'),

            h('span', { class: 'qty-value' }, count),

            h('button', {

              type: 'button',

              class: 'qty-btn',

              'aria-label': 'Agregar uno',

              onclick: () => {

                addClientProduct(p);

                drawProducts();

                drawCart();

              }

            }, '+')

          ),

          h('button', {

            class: 'btn primary small stitch-add-btn' + (count ? ' added' : ''),

            type: 'button',

            onclick: () => {

              addClientProduct(p);

              drawProducts();

              drawCart();

              toast(p.name + ' añadido al pedido');

            }

          }, count ? 'Listo (' + count + ')' : '+ Agregar'),

          h('button', {

            class: 'btn ghost small stitch-info-btn',

            type: 'button',

            title: 'Ver ficha farmacéutica',

            onclick: () => openProductModal(p)

          }, 'Ficha')

        )

      );

    }) : [

      empty('No se encontraron medicamentos o productos', 'Intenta con otro término, principio activo, marca comercial o ajusta los filtros.')

    ]));

    renderCatalogPagination(totalItems, totalPages, startIdx, endIdx);

  }

  function renderCatalogPagination(totalItems, totalPages, startIdx, endIdx) {
    if (!productPagination) return;
    if (totalPages <= 1) {
      productPagination.style.display = 'none';
      productPagination.replaceChildren();
      return;
    }
    productPagination.style.display = 'flex';

    const prevBtn = h('button', {
      type: 'button',
      class: 'catalog-page-btn catalog-page-nav-btn',
      disabled: clientPage <= 1,
      onclick: () => {
        if (clientPage > 1) {
          clientPage--;
          drawProducts();
          scrollToCatalogTop();
        }
      }
    }, '← Anterior');

    const nextBtn = h('button', {
      type: 'button',
      class: 'catalog-page-btn catalog-page-nav-btn',
      disabled: clientPage >= totalPages,
      onclick: () => {
        if (clientPage < totalPages) {
          clientPage++;
          drawProducts();
          scrollToCatalogTop();
        }
      }
    }, 'Siguiente →');

    const pagePills = [];
    for (let p = 1; p <= totalPages; p++) {
      const pageNum = p;
      pagePills.push(h('button', {
        type: 'button',
        class: 'catalog-page-btn catalog-page-num' + (pageNum === clientPage ? ' active' : ''),
        onclick: () => {
          if (pageNum !== clientPage) {
            clientPage = pageNum;
            drawProducts();
            scrollToCatalogTop();
          }
        }
      }, String(pageNum)));
    }

    const summaryText = h('div', { class: 'catalog-pagination-summary' },
      h('span', null, 'Página ' + clientPage + ' de ' + totalPages),
      h('span', { class: 'catalog-pagination-dot' }, '•'),
      h('span', null, 'Mostrando ' + (startIdx + 1) + '–' + endIdx + ' de ' + totalItems + ' productos')
    );

    const navControls = h('div', { class: 'catalog-pagination-nav' },
      prevBtn,
      ...pagePills,
      nextBtn
    );

    productPagination.replaceChildren(navControls, summaryText);
  }

  function scrollToCatalogTop() {
    const el = document.querySelector('.catalog-showcase-block') || productGrid;
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function drawCart() {

    const qty = clientCart.reduce((n, i) => n + i.quantity, 0);

    const subtotal = clientCart.reduce((n, i) => n + i.quantity * i.price, 0);

    const deliveryFee = qty > 0 ? 4500 : 0;

    const total = subtotal + deliveryFee;

    const hasRx = clientCart.some(i => i.rx);

    cartBox.replaceChildren(

      h('div', { class: 'section-heading' },

        h('div', null,

          h('span', { class: 'eyebrow' }, 'TU SOLICITUD CLÍNICA'),

          h('h2', null, 'Canasta de entrega')

        ),

        h('span', { class: 'count-pill' }, qty + (qty === 1 ? ' artículo' : ' artículos'))

      ),

      !clientCart.length

        ? empty('Tu carrito está vacío', 'Explora el catálogo y agrega los medicamentos que requieres para cotizar con farmacias aliadas.')

        : h('div', { class: 'cart-items stitch-cart-items' },

            clientCart.map(item =>

              h('div', { class: 'cart-item stitch-cart-item' },

                h('div', { class: 'cart-item-info' },

                  h('strong', { class: 'cart-item-name' }, item.name),

                  h('small', { class: 'muted block-line' }, money(item.price) + ' c/u · precio sugerido'),

                  h('div', { class: 'quantity-control' },

                    h('button', {

                      type: 'button',

                      class: 'qty-btn',

                      'aria-label': 'Quitar uno',

                      onclick: () => {

                        item.quantity--;

                        if (item.quantity <= 0) clientCart = clientCart.filter(x => x !== item);

                        drawCart();

                        drawProducts();

                      }

                    }, '−'),

                    h('span', null, item.quantity),

                    h('button', {

                      type: 'button',

                      class: 'qty-btn',

                      'aria-label': 'Agregar uno',

                      onclick: () => {

                        item.quantity = Math.min(99, item.quantity + 1);

                        drawCart();

                        drawProducts();

                      }

                    }, '+')

                  )

                ),

                h('strong', { class: 'cart-item-subtotal' }, money(item.price * item.quantity))

              )

            )

          ),

      clientCart.length ? h('div', { class: 'cart-breakdown' },

        h('div', { class: 'breakdown-row' },

          h('span', null, 'Subtotal sugerido:'),

          h('strong', null, money(subtotal))

        ),

        h('div', { class: 'breakdown-row' },

          h('span', null, 'Envío farmacéutico seguro (SLA <45 min):'),

          h('span', { class: 'delivery-fee-badge' }, money(deliveryFee))

        ),

        h('div', { class: 'breakdown-row total-row' },

          h('span', null, 'Total aproximado:'),

          h('strong', { class: 'cart-total-amount' }, money(total))

        ),

        h('p', { class: 'muted small text-center mt-2' }, 'La farmacia que tome tu pedido confirmará el inventario real y emitirá la factura oficial.')

      ) : '',

      h('button', {

        class: 'btn primary block stitch-checkout-btn',

        type: 'button',

        disabled: !clientCart.length,

        onclick: checkout

      }, 'Pedir a farmacias')

    );

    // Actualización de canasta en la barra fija superior (site-header)

    const headerCount = document.getElementById('navHeaderCartCount');

    const headerTotal = document.getElementById('navHeaderCartTotal');

    const headerPill = document.getElementById('navHeaderCartPill');

    if (headerCount) headerCount.textContent = String(qty);

    if (headerTotal) headerTotal.textContent = money(total);

    if (headerPill) {

      if (qty > 0) {

        headerPill.classList.add('has-items');

      } else {

        headerPill.classList.remove('has-items');

      }

    }

    // Desactivada la barra flotante de carrito: se mantiene fija en el recuadro superior

    const mobileBar = document.getElementById('fy_mobile_cart_bar');

    if (mobileBar) mobileBar.remove();

    document.querySelectorAll('#fy_mobile_cart_bar, .mobile-cart-float-bar').forEach(el => el.remove());

    if (clientCart.length === 0 && window.activeMobileCartDialog) {

      try { window.activeMobileCartDialog.close(); } catch(e) {}

    }

  }

  /* Vista preliminar/resumen flotante encimita con todas las funciones conectadas (sin scroll hacia arriba) */

  function openCartPreviewOverlay() {

    const existingCard = document.getElementById('fy_cart_preview_card');

    const existingBackdrop = document.getElementById('fy_cart_preview_backdrop');

    if (existingCard) {

      existingCard.remove();

      if (existingBackdrop) existingBackdrop.remove();

      return;

    }

    const backdrop = h('div', {

      id: 'fy_cart_preview_backdrop',

      class: 'cart-preview-backdrop',

      onclick: closeCartPreview

    });

    const card = h('aside', {

      id: 'fy_cart_preview_card',

      class: 'cart-preview-card',

      role: 'dialog',

      'aria-label': 'Resumen flotante de canasta FarmaYA'

    });

    function closeCartPreview() {

      const c = document.getElementById('fy_cart_preview_card');

      const b = document.getElementById('fy_cart_preview_backdrop');

      if (c) c.remove();

      if (b) b.remove();

    }

    function refreshPreview() {

      const qty = clientCart.reduce((n, i) => n + i.quantity, 0);

      const subtotal = clientCart.reduce((n, i) => n + i.quantity * i.price, 0);

      const deliveryFee = qty > 0 ? 4500 : 0;

      const total = subtotal + deliveryFee;

      const header = h('div', { class: 'cart-preview-header' },

        h('div', { class: 'cart-preview-title-wrap' },

          h('span', { class: 'cart-preview-eyebrow' }, 'TU CANASTA · VISTA RÁPIDA'),

          h('h3', { class: 'cart-preview-title' },

            'Resumen de Canasta',

            h('span', { class: 'cart-preview-badge' }, qty + (qty === 1 ? ' artículo' : ' artículos'))

          )

        ),

        h('button', {

          type: 'button',

          class: 'cart-preview-close-btn',

          'aria-label': 'Cerrar resumen',

          title: 'Cerrar',

          onclick: closeCartPreview

        }, '✕')

      );

      let bodyContent;

      if (!clientCart.length) {

        bodyContent = h('div', { class: 'cart-preview-empty' },

          h('div', { style: 'font-size: 36px; margin-bottom: 8px;' }, '🧺'),

          h('strong', { style: 'display: block; font-size: 15px; margin-bottom: 4px; color: var(--text);' }, 'Tu canasta está vacía'),

          h('p', { class: 'muted small', style: 'margin: 0;' }, 'Explora el catálogo y agrega los medicamentos que requieras.')

        );

      } else {

        bodyContent = h('div', { class: 'cart-preview-items' },

          clientCart.map(item =>

            h('div', { class: 'cart-preview-item' },

              h('div', { class: 'cart-preview-item-info' },

                h('strong', { class: 'cart-preview-item-name', title: item.name }, item.name),

                h('span', { class: 'cart-preview-item-price' }, money(item.price) + ' c/u · sugerido')

              ),

              h('div', { class: 'cart-preview-item-right' },

                h('div', { class: 'cart-preview-qty-control' },

                  h('button', {

                    type: 'button',

                    class: 'cart-preview-qty-btn',

                    'aria-label': 'Quitar uno',

                    onclick: (e) => {

                      e.stopPropagation();

                      item.quantity--;

                      if (item.quantity <= 0) clientCart = clientCart.filter(x => x !== item);

                      refreshPreview();

                      drawCart();

                      drawProducts();

                    }

                  }, '−'),

                  h('span', { class: 'cart-preview-qty-num' }, item.quantity),

                  h('button', {

                    type: 'button',

                    class: 'cart-preview-qty-btn',

                    'aria-label': 'Agregar uno',

                    onclick: (e) => {

                      e.stopPropagation();

                      item.quantity = Math.min(99, item.quantity + 1);

                      refreshPreview();

                      drawCart();

                      drawProducts();

                    }

                  }, '+')

                ),

                h('strong', { class: 'cart-preview-item-subtotal' }, money(item.price * item.quantity))

              )

            )

          )

        );

      }

      const body = h('div', { class: 'cart-preview-body' }, bodyContent);

      const footer = h('div', { class: 'cart-preview-footer' },

        clientCart.length ? h('div', { class: 'cart-preview-breakdown' },

          h('div', { class: 'cart-preview-row' },

            h('span', null, 'Subtotal sugerido:'),

            h('strong', null, money(subtotal))

          ),

          h('div', { class: 'cart-preview-row' },

            h('span', null, 'Envío farmacéutico seguro (<45 min):'),

            h('span', { class: 'delivery-fee-badge' }, money(deliveryFee))

          ),

          h('div', { class: 'cart-preview-row cart-preview-total-row' },

            h('span', null, 'Total aproximado:'),

            h('strong', { class: 'cart-preview-total-amount' }, money(total))

          ),

          h('p', { class: 'muted small text-center', style: 'margin: 6px 0 0; font-size: 11px;' },

            'La farmacia aliada confirmará el inventario real y emitirá la factura oficial.'

          )

        ) : '',

        h('button', {

          type: 'button',

          class: 'btn primary block cart-preview-checkout-btn',

          disabled: !clientCart.length,

          onclick: () => {

            closeCartPreview();

            checkout();

          }

        }, 'Pedir a farmacias')

      );

      card.replaceChildren(header, body, footer);

    }

    refreshPreview();

    document.body.appendChild(backdrop);

    document.body.appendChild(card);

  }

  window.openCartPreviewOverlay = openCartPreviewOverlay;

  window.openMobileCartSheet = openCartPreviewOverlay;

  async function checkout() {

    const address = h('input', { required: true, minlength: 5, maxlength: 200, placeholder: 'Calle, carrera, número, barrio...', value: user.address || '' });

    const cityInput = h('input', { placeholder: 'Ciudad o municipio', value: user.city || '' });

    const latInput = h('input', { type: 'hidden', value: (user.latitude != null) ? String(user.latitude) : '' });

    const lngInput = h('input', { type: 'hidden', value: (user.longitude != null) ? String(user.longitude) : '' });

    const notes = h('input', { maxlength: 400, placeholder: 'Ej. Torre 2 apto 401, portería, llamar al llegar...', value: '' });

    const mapStatus = h('p', { class: 'muted small' }, 'Mapa georreferenciado de entrega. Haz clic en el mapa o arrastra el marcador para fijar la dirección exacta.');

    const mapNode = h('div', { class: 'farmaya-map', role: 'application', 'aria-label': 'Mapa para seleccionar la entrega', style: 'height:220px; min-height:200px; margin: 6px 0; border-radius:12px;' });

    let map, marker;

    const coverageNoticeBox = h('div', { class: 'checkout-coverage-notice', style: 'margin: 12px 0;' });

    const submitBtn = h('button', { class: 'btn primary', type: 'submit' }, 'Confirmar pedido');

    let coverageCheckTimer = null;

    async function checkCoverage() {

      const lat = Number(latInput.value);

      const lng = Number(lngInput.value);

      const city = cityInput.value.trim() || user.city || '';

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return true;

      try {

        const res = await API.get('/orders/check-availability?city=' + encodeURIComponent(city) + '&lat=' + lat + '&lng=' + lng);

        if (res && res.available === false) {

          coverageNoticeBox.replaceChildren(

            notice('warn', 'Sin farmacias disponibles', res.message || 'No hay farmacias disponibles en este momento.')

          );

          submitBtn.disabled = true;

          submitBtn.textContent = 'Sin cobertura';

          return false;

        } else {

          coverageNoticeBox.replaceChildren();

          submitBtn.disabled = false;

          submitBtn.textContent = 'Confirmar pedido';

          return true;

        }

      } catch (e) {

        return true;

      }

    }

    function selectPoint(pos) {

      const lat = Number(pos.lat), lng = Number(pos.lng);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      latInput.value = String(lat);

      lngInput.value = String(lng);

      if (marker) marker.setLatLng([lat, lng]);

      mapStatus.textContent = 'Ubicación seleccionada en el mapa. Puedes afinar arrastrando el marcador.';

      clearTimeout(coverageCheckTimer);

      coverageCheckTimer = setTimeout(checkCoverage, 400);

    }

    cityInput.addEventListener('change', () => {

      clearTimeout(coverageCheckTimer);

      coverageCheckTimer = setTimeout(checkCoverage, 400);

    });

    const locateBtn = h('button', {

      class: 'btn secondary small',

      type: 'button',

      style: 'height:36px; padding:0 12px; border-radius:8px; font-weight:600; white-space:nowrap; display:inline-flex; align-items:center; gap:6px;',

      onclick: async () => {

        const prev = locateBtn.innerHTML;

        locateBtn.disabled = true;

        locateBtn.innerHTML = '<span class="spinner" style="width:13px;height:13px;border-width:2px;"></span> GPS...';

        mapStatus.textContent = 'Obteniendo satélites de alta precisión...';

        try {

          const pos = await farmayaGetPosition();

          map.setView([pos.lat, pos.lng], 17);

          selectPoint(pos);

          const geo = await reverseGeocode(pos);

          if (geo && geo.address) {

            address.value = geo.address;

            if (geo.city && !cityInput.value) cityInput.value = geo.city;

            mapStatus.textContent = 'Ubicación fijada: ' + geo.address + ' (GPS: ±' + Math.round(pos.accuracy || 10) + 'm).';

          } else {

            mapStatus.textContent = 'Ubicación fijada en el mapa. Precisión: ±' + Math.round(pos.accuracy || 10) + 'm.';

          }

          clearTimeout(coverageCheckTimer);

          coverageCheckTimer = setTimeout(checkCoverage, 400);

          toast('Ubicación GPS obtenida con éxito');

        } catch (err) {

          mapStatus.textContent = err.message;

          toast(err.message, 'error');

        } finally {

          locateBtn.disabled = false;

          locateBtn.innerHTML = prev;

        }

      }

    }, icon('my_location'), 'Detectar GPS');

    let isOrderSubmitting = false;

    const form = h('form', {

      class: 'sheet-body narrow checkout-map-form',

      onsubmit: async ev => {

        ev.preventDefault();

        if (isOrderSubmitting) return;

        if (!clientCart || !clientCart.length) {

          toast('Tu canasta está vacía. Agrega al menos un producto.', 'error');

          return;

        }

        const cleanAddress = address.value.trim();

        if (!cleanAddress || cleanAddress.length < 5) {

          mapStatus.textContent = 'Escribe la dirección de entrega completa (mínimo 5 caracteres).';

          address.focus();

          toast('Escribe la dirección de entrega completa (mínimo 5 caracteres).', 'error');

          return;

        }

        const latVal = Number(latInput.value);

        const lngVal = Number(lngInput.value);

        if (!Number.isFinite(latVal) || !Number.isFinite(lngVal) || (latVal === 0 && lngVal === 0)) {

          mapStatus.textContent = 'Por favor selecciona tu ubicación exacta en el mapa o pulsa «Detectar GPS».';

          toast('Por favor selecciona tu ubicación exacta en el mapa o pulsa Detectar GPS.', 'error');

          return;

        }

        const hasCoverage = await checkCoverage();

        if (!hasCoverage) {

          toast('No hay farmacias disponibles en este momento', 'error');

          return;

        }

        isOrderSubmitting = true;

        submitBtn.disabled = true;

        const prevText = submitBtn.innerHTML;

        submitBtn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;"></span> Enviando...';

        const payload = {

          items: clientCart.map(i => ({ name: i.name, quantity: i.quantity, prescription: !!i.rx, note: '' })),

          address: cleanAddress,
city: cityInput.value.trim() || user.city || '',

          latitude: latVal,

          longitude: lngVal,

          phone: user.phone || '',

          notes: notes.value.trim()

        };

        try {

          const result = await API.post('/orders', payload);

          if (result) {

            clientCart = [];

            d.close();

            refreshAll();

            drawCart();

            drawProducts();

            location.hash = '#orders';
            const viewFn = window.openOrderDetail || (typeof openOrderDetail === 'function' ? openOrderDetail : null);
            if (viewFn) viewFn(result.id);

            toast('Solicitud enviada a la red de farmacias');

          }

        } catch (err) {

          const errMsg = err.message || 'No fue posible generar el pedido. Intenta de nuevo.';

          coverageNoticeBox.replaceChildren(

            notice('warn', 'Atención con la solicitud', errMsg)

          );

          submitBtn.disabled = false;

          submitBtn.innerHTML = prevText;

          toast(errMsg, 'error');

        } finally {

          isOrderSubmitting = false;

        }

      }

    },

      h('h2', null, 'Punto de entrega'),

      h('p', { class: 'muted', style: 'font-size:12.5px; margin-bottom: 4px;' }, 'Ingresa tu dirección o detecta tu ubicación satelital con el botón GPS.'),

      h('div', { class: 'checkout-location-bar', style: 'display:flex; justify-content:space-between; align-items:center; gap:10px; margin-top:2px;' },

        h('strong', { style: 'font-size:13px; color:var(--text);' }, 'Datos de dirección'),

        locateBtn

      ),

      h('div', { class: 'checkout-grid-two' },

        field('Dirección de entrega', address),

        field('Ciudad o municipio', cityInput)

      ),

      h('div', { class: 'checkout-map-wrap' },

        mapNode,

        mapStatus

      ),

      latInput,

      lngInput,

      field('Indicaciones adicionales (opcional)', notes),

      h('div', { class: 'delivery-fee-callout', style: 'margin: 8px 0; padding: 10px 14px; border-radius: 10px;' },

        h('span', { class: 'callout-ico' }, '!'),

        h('div', null,

          h('strong', { style: 'font-size:11.5px; display:block; margin-bottom:2px;' }, 'PAGO DEL DOMICILIO'),

          h('p', { style: 'margin:0; font-size:11.5px;' }, 'El costo de envío se cancela directamente al domiciliario al recibir el pedido.')

        )

      ),

      coverageNoticeBox,

      h('div', { class: 'actions', style: 'margin-top:10px;' },

        h('button', { class: 'btn ghost', type: 'button', onclick: () => d.close() }, 'Volver al catálogo'),

        submitBtn

      )

    );

    const d = openDialog(form);

    try {

      await loadLeaflet();

      const fallback = (user.latitude && user.longitude)

        ? [Number(user.latitude), Number(user.longitude)]

        : [10.9878, -74.7889]; // Barranquilla (Plaza de la Paz)

      const initialZoom = (user.latitude && user.longitude) ? 16 : 14;

      map = L.map(mapNode).setView(fallback, initialZoom);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(map);

      marker = L.marker(fallback, { draggable: true }).addTo(map);

      marker.on('dragend', () => { const p = marker.getLatLng(); selectPoint(p); });

      map.on('click', ev => selectPoint(ev.latlng));

      selectPoint({ lat: fallback[0], lng: fallback[1] });

      setTimeout(() => map.invalidateSize(), 150);

      locateBtn.click();

    } catch (err) {

      mapNode.textContent = 'No se pudo cargar el mapa. Verifica tu conexión.';

      mapStatus.textContent = err.message || String(err);

    }

  }

  // --- SECCIÓN 1: Barra Superior Destacada ---

  const institutionalBar = h('div', { class: 'stitch-assurance-bar elevated-top-banner' },

    h('div', { class: 'stitch-assurance-inner banner-centered' },

      h('span', { class: 'assurance-headline' }, 'Envíos farmacéuticos seguros con cobertura nacional')

    )

  );

  // --- SECCIÓN 2: Hero Banner Clínico con buscador FarmaYA (Stitch Screen 8) ---

  function openCatalogFiltersDrawer() {

    const drawerBody = h('div', { class: 'drawer-body client-filters-drawer-content' },

      h('div', { class: 'drawer-head', style: 'margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between;' },

        h('div', null,

          h('span', { class: 'eyebrow' }, 'CATÁLOGO FARMAYA'),

          h('h3', { style: 'margin: 2px 0 0;' }, 'Filtros de Catálogo')

        ),

        h('button', { class: 'close', type: 'button', 'aria-label': 'Cerrar', onclick: () => d.close() }, '×')

      ),

      h('div', { class: 'filter-drawer-group' },

        h('label', { class: 'small bold', style: 'display: block; margin-bottom: 6px; color: var(--text);' }, 'Categoría terapéutica'),

        (() => {

          const catSelect = h('select', {

            class: 'catalog-select',

            onchange: () => {

              clientCategory = catSelect.value; clientPage = 1;

              if (window.clientCategorySelect) window.clientCategorySelect.value = catSelect.value;

              drawProducts();

            }

          },

            h('option', { value: '' }, 'Todas las categorías'),

            clientCategories.map(c => h('option', { value: c.id, selected: c.id === clientCategory }, c.label))

          );

          return catSelect;

        })()

      ),

      h('div', { class: 'filter-drawer-group', style: 'margin-top: 16px;' },

        h('label', { class: 'small bold', style: 'display: block; margin-bottom: 6px; color: var(--text);' }, 'Ordenar por'),

        (() => {

          const sortSelect = h('select', {

            class: 'catalog-select',

            onchange: () => {

              clientSort = sortSelect.value; clientPage = 1;

              if (window.clientSortSelect) window.clientSortSelect.value = sortSelect.value;

              drawProducts();

            }

          },

            h('option', { value: 'featured', selected: clientSort === 'featured' }, 'Destacados clínicos'),

            h('option', { value: 'priceAsc', selected: clientSort === 'priceAsc' }, 'Precio: menor a mayor'),

            h('option', { value: 'priceDesc', selected: clientSort === 'priceDesc' }, 'Precio: mayor a menor'),

            h('option', { value: 'nameAsc', selected: clientSort === 'nameAsc' }, 'Nombre: A–Z'),

            h('option', { value: 'nameDesc', selected: clientSort === 'nameDesc' }, 'Nombre: Z–A')

          );

          return sortSelect;

        })()

      ),

      h('div', { style: 'margin-top: 24px; display: flex; flex-direction: column; gap: 10px;' },

        h('button', {

          class: 'btn primary block',

          type: 'button',

          onclick: () => d.close()

        }, 'Ver medicamentos'),

        h('button', {

          class: 'btn ghost block',

          type: 'button',

          onclick: () => {

            clientCategory = '';

            clientSort = 'featured';

            clientSearch = '';

            searchInput.value = '';

            if (window.clientCategorySelect) window.clientCategorySelect.value = '';

            if (window.clientSortSelect) window.clientSortSelect.value = 'featured';

            drawProducts();

            d.close();

            toast('Filtros restablecidos');

          }

        }, 'Limpiar filtros')

      )

    );

    const d = openDialog(h('div', { class: 'sheet-body' }, drawerBody), { drawer: true });

  }

  window.openCatalogFiltersDrawer = openCatalogFiltersDrawer;

  const heroSection = h('section', { class: 'welcome-banner stitch-hero' },

    h('div', { class: 'stitch-hero-left' },

      h('div', { class: 'stitch-hero-kicker' },

        h('span', null, 'Red de Domicilios Clínicos · Cadena de Frío Controlada')

      ),

      h('h1', null, 'Hola, ' + (user.name || 'bienvenido').split(' ')[0]),

      h('p', null, 'Tu farmacia de confianza directo a tu hogar. Consulta farmacéutica y despacho asistencial en tiempo real.'),

      // Buscador clínico con botón integrado a un lado

      h('div', { class: 'stitch-search-box' },

        h('div', { class: 'stitch-search-input-wrap' },

          searchInput

        ),

        h('button', {

          class: 'btn primary stitch-search-action',

          type: 'button',

          title: 'Buscar medicamentos',

          'aria-label': 'Buscar',

          onclick: () => drawProducts()

        }, icon('search'), h('span', { class: 'search-btn-label' }, 'Buscar'))

      )

    ),

    h('div', { class: 'welcome-art', 'aria-hidden': 'true' },

      h('img', { class: 'fy-cross', src: FY_CROSS_SRC, alt: 'FarmaYA' })

    )

  );

  // --- SECCIÓN 3: 3 Sellos de Confianza Institucional (Stitch Screen 8) ---

  const trustSection = h('div', { class: 'stitch-trust-grid' },

    h('article', { class: 'stitch-trust-card' },

      h('div', { class: 'trust-card-icon tone-teal', innerHTML: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>' }),

      h('div', null,

        h('strong', null, '100% Originales y Certificados'),

        h('p', null, 'Directos de laboratorios vigilados por INVIMA y con registro sanitario verificado.')

      )

    ),

    h('article', { class: 'stitch-trust-card' },

      h('div', { class: 'trust-card-icon tone-lime', innerHTML: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>' }),

      h('div', null,

        h('strong', null, 'Entrega en menos de 45 minutos'),

        h('p', null, 'Rutas geolocalizadas con aislamiento térmico y control de 2°C a 8°C.')

      )

    ),

    h('article', { class: 'stitch-trust-card' },

      h('div', { class: 'trust-card-icon tone-blue', innerHTML: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>' }),

      h('div', null,

        h('strong', null, 'Respaldo Farmacéutico'),

        h('p', null, 'Medicamentos originales despachados por farmacias autorizadas.')

      )

    )

  );

  // --- SECCIÓN 4: Filtros de Categorías y Ordenamiento ---

  const stickyCategory = h('div', { class: 'client-sticky-categories stitch-filter-bar' },

    h('div', { class: 'client-sticky-inner' },

      h('strong', null, 'Filtros de Catálogo'),

      h('label', { class: 'catalog-control' },

        h('span', null, 'Categoría terapéutica'),

        (() => {

          const categorySelect = h('select', {

            class: 'catalog-select',

            'aria-label': 'Filtrar productos por categoría',

            onchange: () => {

              clientCategory = categorySelect.value; clientPage = 1;

              drawProducts();

            }

          },

            h('option', { value: '' }, 'Todas las categorías'),

            clientCategories.map(c => h('option', { value: c.id }, c.label))

          );

          categorySelect.value = clientCategory;

          window.clientCategorySelect = categorySelect;

          return categorySelect;

        })()

      ),

      h('label', { class: 'catalog-control' },

        h('span', null, 'Ordenar por'),

        (() => {

          const sortSelect = h('select', {

            class: 'catalog-select',

            'aria-label': 'Ordenar productos',

            onchange: () => {

              clientSort = sortSelect.value; clientPage = 1;

              drawProducts();

            }

          },

            h('option', { value: 'featured' }, 'Destacados clínicos'),

            h('option', { value: 'priceAsc' }, 'Precio: menor a mayor'),

            h('option', { value: 'priceDesc' }, 'Precio: mayor a menor'),

            h('option', { value: 'nameAsc' }, 'Nombre: A–Z'),

            h('option', { value: 'nameDesc' }, 'Nombre: Z–A')

          );

          sortSelect.value = clientSort;

          return sortSelect;

        })()

      ),

      h('button', {

        class: 'btn secondary small',

        type: 'button',

        onclick: () => {

          clientSearch = '';

          clientCategory = '';

          clientRxFilter = 'all';

          searchInput.value = '';

          if (window.clientCategorySelect) window.clientCategorySelect.value = '';

          drawProducts();

        }

      }, 'Limpiar filtros')

    )

  );

  // Armado del DOM del Dashboard de Cliente (diseño clínico limpio y canasta persistente)

  app.replaceChildren(

    h('div', { class: 'client-home stack stitch-home' },

      institutionalBar,

      heroSection,

      activeOrdersWatcher,

      h('div', { class: 'client-main-grid' },

        h('div', { class: 'client-products-column' },

          stickyCategory,

          h('section', { class: 'block catalog-showcase-block' },

            h('div', { class: 'catalog-header-card' },

              h('div', { class: 'catalog-header-info' },

                h('div', { class: 'catalog-header-pill' },

                  icon('shield'),

                  h('span', null, 'Catálogo Oficial FarmaYA')

                ),

                h('h2', { class: 'catalog-title-main' }, 'Medicamentos y Cuidado de la Salud'),

                h('p', { class: 'catalog-subtitle-desc' }, 'Productos originales con despacho prioritario garantizado por droguerías autorizadas.')

              ),

              h('div', { class: 'catalog-pricing-tag-box' },

                h('span', { class: 'catalog-price-badge' }, icon('shopping-bag'), h('strong', null, 'Precios sugeridos')),

                h('small', { class: 'catalog-price-hint' }, 'Confirmados directamente por la droguería asignada')

              )

            ),

            productGrid,
            productPagination

          ),

          pharmacyBox,

          h('section', { class: 'trust-card stitch-sidebar-trust' },

            h('span', null, icon('shield')),

            h('strong', null, 'Despacho Seguro FarmaYA'),

            h('p', null, 'Medicamentos certificados despachados por farmacias autorizadas. Entregas con PIN de validación en mano.')

          )

        ),

        h('aside', { class: 'client-side-column' },

          cartBox

        )

      )

    )

  );

  drawProducts();

  drawCart();

  // Escuchar cambios de catálogo y fotos de medicamentos desde admin

  window.addEventListener('farmaya:product-images-updated', () => drawProducts(), { once: false });

  window.addEventListener('farmaya:catalog-synced', () => drawProducts(), { once: false });

  window.addEventListener('farmaya:catalog-refresh', () => drawProducts(), { once: false });

  // Sincronización con colección de categorías de la base de datos

  API.get('/categories').then(rows => {

    if (!Array.isArray(rows) || !rows.length) return;

    clientCategories = rows.filter(c => c && c.active !== false && c.code && c.name)

      .map(c => ({ id: c.code, label: c.name }));

    if (clientCategory && !clientCategories.some(c => c.id === clientCategory)) clientCategory = '';

    const select = window.clientCategorySelect;

    if (select) {

      const current = clientCategory;

      select.replaceChildren(

        h('option', { value: '' }, 'Todas las categorías'),

        ...clientCategories.map(c => h('option', { value: c.id }, c.label))

      );

      select.value = current;

    }

  }).catch(err => console.warn('Categorías de base de datos no cargadas, se mantiene el catálogo predeterminado.', err));

}

function addClientProduct(p) {

  const existing = clientCart.find(i => i.name === p.name);

  if (existing) {

    existing.quantity = Math.min(99, existing.quantity + 1);

  } else {

    clientCart.push({ name: p.name, price: p.price, quantity: 1, rx: !!p.rx });

  }
  persistClientCart();
  syncClientCartUI();
}

function removeClientProduct(p) {

  const existing = clientCart.find(i => i.name === p.name);

  if (existing) {

    existing.quantity--;

    if (existing.quantity <= 0) {

      clientCart = clientCart.filter(i => i !== existing);

    }

  }
  persistClientCart();
  syncClientCartUI();
}

/**

 * Modal Detalle del Producto (Stitch Screen 5: Detalle del Producto)

 * Ficha farmacéutica completa con especificaciones clínicas, advertencias, lote y modo de empleo.

 */

function openProductModal(p) {

  let modalQty = 1;

  const inCart = clientCart.find(i => i.name === p.name);

  if (inCart) modalQty = inCart.quantity;

  const qtyDisplay = h('span', { class: 'stitch-modal-qty' }, modalQty);

  const content = h('div', { class: 'stitch-product-detail-modal' },

    // Cabecera del modal

    h('header', { class: 'stitch-modal-head' },

      h('div', null,

        p.rx

          ? h('span', { class: 'badge-rx' }, 'Requiere Fórmula Médica')

          : h('span', { class: 'badge-otc' }, 'Venta Libre (OTC)'),

        h('span', { class: 'badge-invima' }, p.invima || 'Registro Sanitario INVIMA Vigente')

      ),

      h('button', { class: 'close-btn', type: 'button', onclick: () => d.close() }, '×')

    ),

    // Cuerpo en 2 columnas estilo Stitch

    h('div', { class: 'stitch-modal-body-grid' },

      // Columna izquierda: Ilustración e indicador de temperatura

      h('div', { class: 'stitch-modal-art-col' },

        h('div', { class: 'stitch-modal-art-frame' }, productArt(p)),

        h('div', { class: 'stitch-modal-storage-card' },

          h('span', { class: 'storage-icon' }, icon('shield')),

          h('div', null,

            h('strong', null, 'Conservación Farmacéutica'),

            h('p', null, p.storage || 'Almacenamiento a temperatura ambiente controlada (15°C a 25°C). Proteger de la humedad.')

          )

        )

      ),

      // Columna derecha: Datos clínicos y compra

      h('div', { class: 'stitch-modal-info-col' },

        h('span', { class: 'stitch-modal-lab' }, p.lab || 'Laboratorio Farmacéutico'),

        h('h2', { class: 'stitch-modal-title' }, p.name),

        h('p', { class: 'stitch-modal-pres' }, p.presentation || 'Presentación oficial'),

        h('div', { class: 'stitch-modal-pill-info' },

          h('div', null,

            h('strong', null, 'Principio Activo:'),

            h('p', null, p.active || p.name)

          ),

          h('div', null,

            h('strong', null, 'Indicación Terapéutica:'),

            h('p', null, p.indication || 'Consulte a su médico o al farmacéutico antes de consumir este medicamento.')

          )

        ),

        // Precio y compra

        h('div', { class: 'stitch-modal-buy-box' },

          h('div', null,

            h('span', { class: 'price-label' }, 'Precio sugerido'),

            h('strong', { class: 'stitch-modal-price' }, money(p.price))

          ),

          h('div', { class: 'stitch-modal-stepper' },

            h('button', {

              type: 'button',

              class: 'qty-btn',

              onclick: () => {

                if (modalQty > 1) {

                  modalQty--;

                  qtyDisplay.textContent = modalQty;

                }

              }

            }, '−'),

            qtyDisplay,

            h('button', {

              type: 'button',

              class: 'qty-btn',

              onclick: () => {

                modalQty = Math.min(99, modalQty + 1);

                qtyDisplay.textContent = modalQty;

              }

            }, '+')

          )

        ),

        // Botones de acción

        h('div', { class: 'stitch-modal-actions' },

          h('button', {

            class: 'btn primary block',

            type: 'button',

            onclick: () => {

              const existing = clientCart.find(i => i.name === p.name);

              if (existing) {

                existing.quantity = modalQty;

              } else {

                clientCart.push({ name: p.name, price: p.price, quantity: modalQty, rx: !!p.rx });

              }

              d.close();

              refreshAll();

              toast(p.name + ' agregado (' + modalQty + ')');

            }

          }, 'Agregar al pedido (' + money(p.price * modalQty) + ')')

        )

      )

    )

  );

  const d = openDialog(content, { wide: true });

}

