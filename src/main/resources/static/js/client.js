/* FarmaYA · Experiencia de Salud a Domicilio y Catálogo Farmacéutico
   Diseño inspirado en el sistema Clinical Vitality de Google Stitch (Pantallas 8, 4, 5 y 3).
   Conserva 100% de la funcionalidad reactiva (API, Carrito, Leaflet Maps, Perfil, Estados). */

let clientCart = [];
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
    placeholder: 'Buscar medicamentos con o sin receta, laboratorios, principio activo...',
    value: clientSearch,
    'aria-label': 'Buscar medicamentos o productos de cuidado personal',
    oninput: () => {
      clientSearch = searchInput.value;
      drawProducts();
    }
  });

  const productGrid = h('div', { class: 'products-grid stitch-products-grid' });
  const cartBox = h('section', { class: 'block cart-panel stitch-cart-panel' });

  // Red de farmacias cercanas verificadas
  const pharmacyBox = h('section', { class: 'block stitch-pharmacies-block' },
    h('div', { class: 'section-heading' },
      h('div', null,
        h('span', { class: 'eyebrow' }, 'RED DE FARMACIAS ASISTENCIALES'),
        h('h2', null, 'Droguerías de turno en tu cobertura')
      )
    ),
    live(() => API.get('/pharmacies'), pharmacies => {
      if (!pharmacies.length) {
        return empty('Aún no hay farmacias aliadas en tu zona', 'Apenas una farmacia autorizada se conecte en tu cuadrante, aparecerá aquí.');
      }
      return h('div', { class: 'pharmacy-grid' }, pharmacies.map(p =>
        h('article', { class: 'pharmacy-tile' },
          h('div', { class: 'pharmacy-avatar' },
            h('img', { class: 'fy-cross', src: FY_CROSS_SRC, alt: '' })
          ),
          h('div', { class: 'pharmacy-tile-info' },
            h('strong', null, p.name || 'Farmacia Aliada'),
            h('p', null, p.address || p.zone),
            h('small', { class: p.open ? 'text-success' : 'muted' }, p.open ? '● Recibiendo despachos' : '○ Fuera de turno'),
            h('small', { class: 'muted block-line' }, 'Horario: ' + p.openFrom + '–' + p.openTo)
          ),
          p.sameZone && h('span', { class: 'tag' }, 'Tu sector')
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

    productGrid.replaceChildren(...(items.length ? items.map(p => {
      const inCart = clientCart.find(i => i.name === p.name);
      const count = inCart ? inCart.quantity : 0;

      return h('article', { class: 'product-card stitch-card' },
        // Cabecera de la tarjeta con badges clínicos
        h('div', { class: 'product-top-badges' },
          p.rx
            ? h('span', { class: 'badge-rx' }, 'Requiere Fórmula (Rx)')
            : h('span', { class: 'badge-otc' }, 'Venta Libre'),
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
            hasRx && h('div', { class: 'cart-rx-notice' },
              h('strong', null, 'Contiene medicamentos bajo prescripción'),
              h('p', null, 'Un químico farmacéutico validará tu fórmula médica antes de proceder con el cobro y despacho.')
            ),
            clientCart.map(item =>
              h('div', { class: 'cart-item stitch-cart-item' },
                h('div', { class: 'cart-item-info' },
                  h('strong', { class: 'cart-item-name' }, item.name),
                  item.rx && h('span', { class: 'badge-rx inline' }, 'Rx Fórmula médica'),
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
      }, 'Solicitar despacho a farmacias')
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

    // Barra flotante de carrito para móviles / pantallas reducidas
    const mobileBar = document.getElementById('fy_mobile_cart_bar');
    if (clientCart.length > 0) {
      let bar = mobileBar;
      if (!bar) {
        bar = h('div', { id: 'fy_mobile_cart_bar', class: 'mobile-cart-float-bar' });
        document.body.appendChild(bar);
      }
      bar.style.display = 'flex';
      bar.replaceChildren(
        h('div', { class: 'm-cart-info' },
          h('span', { class: 'm-cart-title' }, qty + (qty === 1 ? ' artículo en canasta' : ' artículos en canasta')),
          h('span', { class: 'm-cart-total' }, money(total))
        ),
        h('button', {
          type: 'button',
          class: 'm-cart-btn',
          onclick: () => {
            if (window.innerWidth <= 820) {
              openMobileCartSheet();
            } else {
              cartBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
              cartBox.classList.add('cart-highlight-glow');
              setTimeout(() => cartBox.classList.remove('cart-highlight-glow'), 1400);
            }
          }
        }, 'Ver Canasta')
      );
    } else {
      // Cuando no hay productos en el carrito, eliminar por completo la barra flotante de compras
      if (mobileBar) {
        mobileBar.remove();
      }
      document.querySelectorAll('#fy_mobile_cart_bar, .mobile-cart-float-bar').forEach(el => el.remove());
      if (window.activeMobileCartDialog) {
        try { window.activeMobileCartDialog.close(); } catch(e) {}
      }
    }
  }

  function openMobileCartSheet() {
    if (!clientCart.length) {
      document.querySelectorAll('#fy_mobile_cart_bar, .mobile-cart-float-bar').forEach(el => el.remove());
      toast('Tu canasta está vacía');
      return;
    }
    const sheetBody = h('div', { class: 'sheet-body mobile-cart-modal-body' },
      h('div', { class: 'mobile-sheet-drag-handle' }),
      h('div', { class: 'mobile-cart-header-row' },
        h('div', null,
          h('span', { class: 'eyebrow' }, 'CANASTA DE ENTREGA'),
          h('h3', { style: 'margin: 2px 0 0;' }, 'Tus medicamentos')
        ),
        h('button', { class: 'btn ghost small', type: 'button', onclick: () => cartDialog.close() }, 'Cerrar')
      ),
      h('div', { id: 'mobileSheetCartItemsContainer' })
    );

    function refreshSheet() {
      const container = sheetBody.querySelector('#mobileSheetCartItemsContainer');
      if (!container) return;
      if (!clientCart.length) {
        document.querySelectorAll('#fy_mobile_cart_bar, .mobile-cart-float-bar').forEach(el => el.remove());
        try { cartDialog.close(); } catch(e) {}
        drawCart();
        drawProducts();
        return;
      }
      const qty = clientCart.reduce((n, i) => n + i.quantity, 0);
      const subtotal = clientCart.reduce((n, i) => n + i.quantity * i.price, 0);
      const deliveryFee = 4500;
      const total = subtotal + deliveryFee;
      const hasRx = clientCart.some(i => i.rx);

      container.replaceChildren(
        hasRx ? h('div', { class: 'cart-rx-notice' },
          h('strong', null, 'Requiere prescripción médica'),
          h('p', null, 'Un químico farmacéutico validará tu fórmula médica antes de proceder.')
        ) : '',
        h('div', { class: 'cart-items stitch-cart-items' },
          clientCart.map(item =>
            h('div', { class: 'cart-item stitch-cart-item' },
              h('div', { class: 'cart-item-info' },
                h('strong', { class: 'cart-item-name' }, item.name),
                item.rx && h('span', { class: 'badge-rx inline' }, 'Rx Fórmula médica'),
                h('small', { class: 'muted block-line' }, money(item.price) + ' c/u · sugerido'),
                h('div', { class: 'quantity-control' },
                  h('button', {
                    type: 'button',
                    class: 'qty-btn',
                    'aria-label': 'Quitar uno',
                    onclick: () => {
                      item.quantity--;
                      if (item.quantity <= 0) clientCart = clientCart.filter(x => x !== item);
                      refreshSheet();
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
                      refreshSheet();
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
        h('div', { class: 'cart-breakdown', style: 'margin-top: 16px;' },
          h('div', { class: 'breakdown-row' },
            h('span', null, 'Subtotal:'),
            h('strong', null, money(subtotal))
          ),
          h('div', { class: 'breakdown-row' },
            h('span', null, 'Envío seguro (<45 min):'),
            h('span', { class: 'delivery-fee-badge' }, money(deliveryFee))
          ),
          h('div', { class: 'breakdown-row total-row' },
            h('span', null, 'Total aproximado:'),
            h('strong', { class: 'cart-total-amount' }, money(total))
          ),
          h('p', { class: 'muted small text-center mt-2' }, 'La farmacia asignada confirmará el inventario real y emitirá la factura.')
        ),
        h('button', {
          class: 'btn primary block stitch-checkout-btn',
          type: 'button',
          style: 'margin-top: 16px; min-height: 48px; border-radius: 14px; font-weight: 700;',
          onclick: () => {
            cartDialog.close();
            checkout();
          }
        }, 'Solicitar despacho a farmacias')
      );
    }

    const cartDialog = openDialog(sheetBody, {
      onClose: () => {
        window.activeMobileCartDialog = null;
        if (!clientCart.length) {
          document.querySelectorAll('#fy_mobile_cart_bar, .mobile-cart-float-bar').forEach(el => el.remove());
        }
        drawCart();
        drawProducts();
      }
    });
    cartDialog.classList.add('mobile-cart-bottom-dialog');
    window.activeMobileCartDialog = cartDialog;
    refreshSheet();
  }
  window.openMobileCartSheet = openMobileCartSheet;

  async function checkout() {
    const address = h('input', { required: true, minlength: 5, maxlength: 200, placeholder: 'Barrio, calle, número, apto o casa...', value: user.address || '' });
    const cityInput = h('input', { required: true, maxlength: 100, placeholder: 'Ciudad o municipio (ej. Barranquilla, Bogotá)', value: user.city || 'Barranquilla' });
    const latInput = h('input', { type: 'hidden', value: '' });
    const lngInput = h('input', { type: 'hidden', value: '' });
    const notes = h('textarea', { rows: 2, maxlength: 400, placeholder: 'Indicaciones de entrega (ej. timbre 201, portería, preguntar por...)' });
    const mapStatus = h('p', { class: 'muted small' }, 'Mapa georreferenciado de entrega. Haz clic en el mapa o arrastra el marcador para fijar la dirección exacta.');
    const mapNode = h('div', { class: 'farmaya-map', role: 'application', 'aria-label': 'Mapa para seleccionar la entrega' });

    let map, marker;
    const coverageNoticeBox = h('div', { class: 'checkout-coverage-notice', style: 'margin: 12px 0;' });
    const submitBtn = h('button', { class: 'btn primary', type: 'submit' }, 'Confirmar y solicitar');
    let coverageCheckTimer = null;

    async function checkCoverage() {
      const lat = Number(latInput.value);
      const lng = Number(lngInput.value);
      const city = cityInput.value.trim() || user.city || 'Barranquilla';
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return true;
      try {
        const res = await API.get('/orders/check-availability?city=' + encodeURIComponent(city) + '&lat=' + lat + '&lng=' + lng);
        if (res && res.available === false) {
          coverageNoticeBox.replaceChildren(
            notice('warn', 'Sin farmacia cerca de tu zona', res.message || 'No hay farmacias disponibles en tu zona en este momento.')
          );
          submitBtn.disabled = true;
          submitBtn.textContent = 'Sin farmacia en tu zona';
          return false;
        } else {
          coverageNoticeBox.replaceChildren();
          submitBtn.disabled = false;
          submitBtn.textContent = 'Confirmar y solicitar';
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
      mapStatus.textContent = 'Ubicación seleccionada (' + lat.toFixed(5) + ', ' + lng.toFixed(5) + '). Puedes afinar arrastrando el marcador.';
      clearTimeout(coverageCheckTimer);
      coverageCheckTimer = setTimeout(checkCoverage, 400);
    }

    cityInput.addEventListener('change', () => {
      clearTimeout(coverageCheckTimer);
      coverageCheckTimer = setTimeout(checkCoverage, 400);
    });

    const locateBtn = h('button', {
      class: 'btn secondary',
      type: 'button',
      onclick: async () => {
        try {
          mapStatus.textContent = 'Obteniendo coordenadas GPS de tu dispositivo...';
          const pos = await farmayaGetPosition();
          map.setView([pos.lat, pos.lng], 16);
          selectPoint(pos);
          reverseGeocode(pos).then(r => {
            if (r) {
              if (!address.value.trim()) address.value = r.address || '';
              if (!cityInput.value.trim()) cityInput.value = r.city || '';
              clearTimeout(coverageCheckTimer);
              coverageCheckTimer = setTimeout(checkCoverage, 400);
            }
          });
        } catch (err) {
          mapStatus.textContent = err.message;
        }
      }
    }, 'Usar mi ubicación actual');

    const form = h('form', {
      class: 'sheet-body narrow checkout-map-form',
      onsubmit: async ev => {
        ev.preventDefault();
        if (!latInput.value || !lngInput.value) {
          mapStatus.textContent = 'Por favor selecciona tu ubicación exacta en el mapa o pulsa «Usar mi ubicación actual».';
          return;
        }
        const hasCoverage = await checkCoverage();
        if (!hasCoverage) {
          toast('No hay farmacia disponible cerca de tu zona (radio máximo 5 km)', 'error');
          return;
        }
        const payload = {
          items: clientCart.map(i => ({ name: i.name, quantity: i.quantity, prescription: !!i.rx, note: '' })),
          address: address.value.trim(),
          zone: address.value.trim(),
          city: cityInput.value.trim() || user.city || 'Barranquilla',
          latitude: Number(latInput.value),
          longitude: Number(lngInput.value),
          phone: user.phone || '',
          notes: notes.value.trim()
        };
        try {
          const result = await act(submitBtn, () => API.post('/orders', payload), 'Solicitud enviada a la red de farmacias');
          if (result) {
            clientCart = [];
            d.close();
            refreshAll();
            drawCart();
            drawProducts();
            openOrderDetail(result.id);
          }
        } catch (err) {
          coverageNoticeBox.replaceChildren(
            notice('warn', 'Sin farmacia cerca de tu zona', err.message || 'No hay farmacias disponibles en tu zona en este momento. El pedido no se ha generado.')
          );
          submitBtn.disabled = true;
          submitBtn.textContent = 'Sin farmacia en tu zona';
          toast(err.message, 'error');
        }
      }
    },
      h('h2', null, '¿Dónde entregamos tus medicamentos?'),
      h('p', { class: 'muted' }, 'Tu pedido se asignará a la farmacia con mejor cobertura térmica y tiempo de respuesta en tu sector.'),
      field('Dirección de entrega', address),
      field('Ciudad o municipio', cityInput),
      mapNode,
      locateBtn,
      mapStatus,
      latInput,
      lngInput,
      field('Indicaciones adicionales (opcional)', notes),
      coverageNoticeBox,
      h('div', { class: 'actions' },
        h('button', { class: 'btn ghost', type: 'button', onclick: () => d.close() }, 'Volver al catálogo'),
        submitBtn
      )
    );

    const d = openDialog(form);
    try {
      await loadLeaflet();
      const fallback = [10.3997, -75.5000]; // Coordenadas predeterminadas
      map = L.map(mapNode).setView(fallback, 12);
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
              clientCategory = catSelect.value;
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
              clientSort = sortSelect.value;
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
      // Buscador clínico con símbolo de búsqueda a un lado
      h('div', { class: 'stitch-search-box' },
        h('div', { class: 'stitch-search-input-wrap' },
          h('span', { class: 'stitch-search-icon', 'aria-hidden': 'true' }, icon('search')),
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
        h('p', null, 'Revisión colegiada permanente de fórmulas por profesionales regentes.')
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
              clientCategory = categorySelect.value;
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
              clientSort = sortSelect.value;
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
      h('div', { class: 'client-main-grid' },
        h('div', { class: 'client-products-column' },
          stickyCategory,
          h('section', { class: 'block' },
            h('div', { class: 'section-heading' },
              h('div', null,
                h('span', { class: 'eyebrow' }, 'CATÁLOGO DE PRODUCTOS ASISTENCIALES'),
                h('h2', null, 'Medicamentos y Cuidado de la Salud')
              ),
              h('span', { class: 'muted small' }, 'Precios sugeridos confirmados por droguería')
            ),
            productGrid
          ),
          pharmacyBox,
          h('section', { class: 'trust-card stitch-sidebar-trust' },
            h('span', null, icon('shield')),
            h('strong', null, 'Despacho Seguro FarmaYA'),
            h('p', null, 'Fórmulas médicas auditadas por Químico Farmacéutico colegiado. Entregas con PIN de validación en mano.')
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
}

function removeClientProduct(p) {
  const existing = clientCart.find(i => i.name === p.name);
  if (existing) {
    existing.quantity--;
    if (existing.quantity <= 0) {
      clientCart = clientCart.filter(i => i !== existing);
    }
  }
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
