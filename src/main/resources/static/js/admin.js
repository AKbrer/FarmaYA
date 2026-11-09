/* FarmaYA · panel de administración */

let adminFilter = '';

function adminHeaderCard(user) {
  return h('div', { class: 'pharmacy-header-card admin-header-card' },
    h('div', { class: 'pharmacy-header-info' },
      h('h1', { class: 'pharmacy-header-title' }, 'Panel de Administración'),
      h('span', { class: 'pharmacy-header-address muted' }, (user.name || 'Administrador') + (user.email ? ' · ' + user.email : '') + ' · Control Central FarmaYA')
    ),
    h('div', { class: 'admin-header-status-box' },
      h('span', { class: 'header-tag' }, 'Operación Central Activa')
    )
  );
}

let adminDemandFilter = 'TODAS';
let adminDemandSearch = '';
let adminSelectedMedName = '';


let powerBiPeriod = 'ALL';
let powerBiPharmacy = 'ALL';
let pbiPharmaSearch = '';
let pbiPharmaPage = 1;
let pbiMatrixSearch = '';
let pbiMatrixPage = 1;
let powerBiStatus = 'ALL_PAID';

/**
 * Dashboard Analitico Power BI con Ganancia FarmaYA (5% fijo).
 * Disenado con estetica Power BI y optimizado para Flutter en vista movil.
 */
function adminPowerBiDashboard() {
  const PAID_STATUSES = [
    'PRECIO_CONFIRMADO', 'PEDIDO_EN_PREPARACION', 'PEDIDO_LISTO',
    'BUSCANDO_REPARTIDOR', 'REPARTIDOR_ASIGNADO', 'PEDIDO_RECOGIDO',
    'EN_CAMINO', 'ENTREGADO'
  ];

  return live(() => API.get('/admin/orders'), rawOrders => {
    const ordersList = Array.isArray(rawOrders) ? rawOrders : [];
    const wrapper = h('div', { class: 'powerbi-dashboard' });

    function draw() {
      wrapper.replaceChildren();

      // Extraer lista unica de farmacias para el slicer
      const pharmacyNames = Array.from(new Set(ordersList.map(o => o.pharmacyName).filter(Boolean))).sort();

      // Fechas de referencia
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const d7 = new Date(now.getTime() - 7 * 86400000);
      const d30 = new Date(now.getTime() - 30 * 86400000);

      // Filtrar pedidos de acuerdo a los slicers
      const filtered = ordersList.filter(o => {
        // Estado
        if (powerBiStatus === 'ALL_PAID' && !PAID_STATUSES.includes(o.status)) return false;
        if (powerBiStatus === 'ENTREGADO' && o.status !== 'ENTREGADO') return false;
        if (powerBiStatus === 'IN_PROGRESS' && (!PAID_STATUSES.includes(o.status) || o.status === 'ENTREGADO')) return false;

        // Farmacia
        if (powerBiPharmacy !== 'ALL' && o.pharmacyName !== powerBiPharmacy) return false;

        // Periodo
        if (powerBiPeriod !== 'ALL') {
          const dt = new Date(o.createdAt || o.deliveredAt || Date.now());
          if (powerBiPeriod === 'TODAY') {
            if (dt.toISOString().slice(0, 10) !== todayStr) return false;
          } else if (powerBiPeriod === '7D' && dt < d7) {
            return false;
          } else if (powerBiPeriod === '30D' && dt < d30) {
            return false;
          }
        }
        return true;
      });

      // Calculos financieros clave
      let totalGross = 0;
      let totalEarnings = 0;
      filtered.forEach(o => {
        const gross = Number(o.total) || 0;
        totalGross += gross;
        const earnings = o.platformEarnings != null ? Number(o.platformEarnings) : Math.round(gross * 0.05);
        totalEarnings += earnings;
      });
      const totalPharmacyNet = Math.max(0, totalGross - totalEarnings);
      const totalOrdersCount = filtered.length;
      const avgTicket = totalOrdersCount > 0 ? Math.round(totalGross / totalOrdersCount) : 0;
      const avgCommission = totalOrdersCount > 0 ? Math.round(totalEarnings / totalOrdersCount) : 0;
      const avgEarnings = avgCommission;

      // Banner superior Power BI
      const headerBanner = h('div', { class: 'powerbi-banner' },
        h('div', { class: 'powerbi-banner-left' },
          h('div', { class: 'powerbi-banner-title-row' },
            h('span', { class: 'powerbi-tag-bi' }, 'POWER BI ANALYTICS'),
            h('span', { class: 'powerbi-tag-live' },
              h('span', { class: 'powerbi-live-dot' }),
              'Datos en Vivo'
            )
          ),
          h('h2', { class: 'powerbi-banner-title' }, 'Dashboard Financiero FarmaYA'),
          h('p', { class: 'powerbi-banner-desc' },
            'Monitoreo ejecutivo de ingresos brutos, liquidacion a farmacias aliadas y retencion del 5% de comision de plataforma.'
          )
        ),
        h('div', { class: 'powerbi-banner-right' },
          h('div', { class: 'powerbi-commission-callout' },
            h('span', { class: 'callout-label' }, 'Comision FarmaYA'),
            h('strong', { class: 'callout-rate' }, '5%'),
            h('span', { class: 'callout-sub' }, 'Retencion por pedido')
          )
        )
      );

      // Slicers Bar (Filtros interactivos de Power BI)
      const periodSelect = h('select', {
        class: 'powerbi-slicer-select',
        'aria-label': 'Filtro de Periodo',
        onchange: e => { powerBiPeriod = e.target.value; draw(); }
      },
        h('option', { value: 'ALL', selected: powerBiPeriod === 'ALL' }, 'Historico Completo'),
        h('option', { value: 'TODAY', selected: powerBiPeriod === 'TODAY' }, 'Hoy'),
        h('option', { value: '7D', selected: powerBiPeriod === '7D' }, 'Ultimos 7 Dias'),
        h('option', { value: '30D', selected: powerBiPeriod === '30D' }, 'Ultimos 30 Dias')
      );

      const pharmacySelect = h('select', {
        class: 'powerbi-slicer-select',
        'aria-label': 'Filtro por Farmacia',
        onchange: e => { powerBiPharmacy = e.target.value; draw(); }
      },
        h('option', { value: 'ALL', selected: powerBiPharmacy === 'ALL' }, 'Todas las Farmacias Aliadas'),
        pharmacyNames.map(name => h('option', { value: name, selected: powerBiPharmacy === name }, name))
      );

      const statusSelect = h('select', {
        class: 'powerbi-slicer-select',
        'aria-label': 'Filtro por Estado',
        onchange: e => { powerBiStatus = e.target.value; draw(); }
      },
        h('option', { value: 'ALL_PAID', selected: powerBiStatus === 'ALL_PAID' }, 'Todos los Monetizados (Pagados)'),
        h('option', { value: 'ENTREGADO', selected: powerBiStatus === 'ENTREGADO' }, 'Solo Entregados con Exito'),
        h('option', { value: 'IN_PROGRESS', selected: powerBiStatus === 'IN_PROGRESS' }, 'En Curso (En preparacion / En camino)')
      );

      const resetBtn = (powerBiPeriod !== 'ALL' || powerBiPharmacy !== 'ALL' || powerBiStatus !== 'ALL_PAID')
        ? h('button', {
            class: 'btn btn-subtle powerbi-slicer-reset',
            onclick: () => {
              powerBiPeriod = 'ALL';
              powerBiPharmacy = 'ALL';
              powerBiStatus = 'ALL_PAID';
              draw();
            }
          }, 'Limpiar Filtros')
        : null;

      const slicersBar = h('div', { class: 'powerbi-slicers-bar' },
        h('div', { class: 'powerbi-slicer-group' },
          h('span', { class: 'powerbi-slicer-label' }, 'Periodo:'),
          periodSelect
        ),
        h('div', { class: 'powerbi-slicer-group' },
          h('span', { class: 'powerbi-slicer-label' }, 'Farmacia:'),
          pharmacySelect
        ),
        h('div', { class: 'powerbi-slicer-group' },
          h('span', { class: 'powerbi-slicer-label' }, 'Estado:'),
          statusSelect
        ),
        resetBtn
      );

      // 4 Power BI KPI Tiles
      const kpisGrid = h('div', { class: 'powerbi-kpis-grid' },
        // KPI 1: Ganancia Neta FarmaYA (5%)
        h('div', { class: 'powerbi-kpi-card accent-green' },
          h('div', { class: 'powerbi-kpi-top' },
            h('span', { class: 'powerbi-kpi-title' }, 'Ganancia FarmaYA (5%)'),
            h('span', { class: 'powerbi-kpi-chip chip-green' }, '5.0% Comision')
          ),
          h('div', { class: 'powerbi-kpi-value-row' },
            h('strong', { class: 'powerbi-kpi-value text-green' }, money(totalEarnings)),
            h('span', { class: 'powerbi-kpi-curr' }, 'COP')
          ),
          h('div', { class: 'powerbi-kpi-sub' },
            h('span', null, 'Retencion neta sobre ' + money(totalGross) + ' en ventas brutas')
          )
        ),

        // KPI 2: Ventas Totales GMV
        h('div', { class: 'powerbi-kpi-card accent-blue' },
          h('div', { class: 'powerbi-kpi-top' },
            h('span', { class: 'powerbi-kpi-title' }, 'Ventas Totales (GMV)'),
            h('span', { class: 'powerbi-kpi-chip chip-blue' }, '100% Bruto')
          ),
          h('div', { class: 'powerbi-kpi-value-row' },
            h('strong', { class: 'powerbi-kpi-value text-blue' }, money(totalGross)),
            h('span', { class: 'powerbi-kpi-curr' }, 'COP')
          ),
          h('div', { class: 'powerbi-kpi-sub' },
            h('span', null, 'Volumen monetizado a traves de la plataforma FarmaYA')
          )
        ),

        // KPI 3: Liquidacion Farmacias (95%)
        h('div', { class: 'powerbi-kpi-card accent-purple' },
          h('div', { class: 'powerbi-kpi-top' },
            h('span', { class: 'powerbi-kpi-title' }, 'Liquidacion Aliados (95%)'),
            h('span', { class: 'powerbi-kpi-chip chip-purple' }, '95.0% Droguerias')
          ),
          h('div', { class: 'powerbi-kpi-value-row' },
            h('strong', { class: 'powerbi-kpi-value text-purple' }, money(totalPharmacyNet)),
            h('span', { class: 'powerbi-kpi-curr' }, 'COP')
          ),
          h('div', { class: 'powerbi-kpi-sub' },
            h('span', null, 'Monto neto transferido a las farmacias aliadas')
          )
        ),

        // KPI 4: Pedidos y Ticket Promedio
        h('div', { class: 'powerbi-kpi-card accent-amber' },
          h('div', { class: 'powerbi-kpi-top' },
            h('span', { class: 'powerbi-kpi-title' }, 'Pedidos Monetizados'),
            h('span', { class: 'powerbi-kpi-chip chip-amber' }, 'Ticket Promedio')
          ),
          h('div', { class: 'powerbi-kpi-value-row' },
            h('strong', { class: 'powerbi-kpi-value text-amber' }, String(totalOrdersCount)),
            h('span', { class: 'powerbi-kpi-curr' }, 'pedidos')
          ),
          h('div', { class: 'powerbi-kpi-sub' },
            h('span', null, 'Ticket: <strong>' + money(avgTicket) + '</strong> · Ganancia/ped: <strong>' + money(avgEarnings) + '</strong>')
          )
        )
      );

      // Visual A: Ranking de Farmacias y Ganancia FarmaYA 5%
      const byPharmacy = {};
      filtered.forEach(o => {
        const pName = o.pharmacyName || 'Sin asignar / Cobertura general';
        if (!byPharmacy[pName]) byPharmacy[pName] = { name: pName, gross: 0, earnings: 0, count: 0 };
        const gross = Number(o.total) || 0;
        byPharmacy[pName].gross += gross;
        byPharmacy[pName].earnings += o.platformEarnings != null ? Number(o.platformEarnings) : Math.round(gross * 0.05);
        byPharmacy[pName].count += 1;
      });
      const pharmacyRanking = Object.values(byPharmacy).sort((a, b) => b.gross - a.gross);
      const maxPharmaGross = pharmacyRanking.length ? Math.max(...pharmacyRanking.map(p => p.gross), 1) : 1;

      const pharmaTitle = h('h3', { class: 'powerbi-visual-title' });
      const pharmaBarsHolder = h('div', { class: 'powerbi-bars-container' });
      const pharmaPaginationHolder = h('div');
      const pharmaSearchInput = h('input', {
        type: 'search',
        placeholder: 'Buscar farmacia aliada por nombre o ciudad...',
        value: pbiPharmaSearch
      });

      function updatePharmaRankView() {
        const qPharma = pbiPharmaSearch.toLowerCase().trim();
        const filteredPharmaRank = pharmacyRanking.filter(p => !qPharma || (p.name || '').toLowerCase().includes(qPharma));
        pharmaTitle.textContent = 'Rendimiento por Farmacia Aliada (' + filteredPharmaRank.length + ')';

        const totalPharmaPages = Math.max(1, Math.ceil(filteredPharmaRank.length / 30));
        if (pbiPharmaPage > totalPharmaPages) pbiPharmaPage = totalPharmaPages;
        const startPharmaIdx = (pbiPharmaPage - 1) * 30;
        const pagedPharmaRank = filteredPharmaRank.slice(startPharmaIdx, startPharmaIdx + 30);

        const pharmaBarsList = pagedPharmaRank.length ? pagedPharmaRank.map(item => {
          const pctOfMax = Math.round((item.gross / maxPharmaGross) * 100);
          return h('div', { class: 'powerbi-bar-item' },
            h('div', { class: 'powerbi-bar-info-row' },
              h('strong', { class: 'powerbi-bar-label' }, item.name),
              h('span', { class: 'powerbi-bar-meta' },
                h('span', { class: 'muted' }, item.count + (item.count === 1 ? ' pedido • ' : ' pedidos • ')),
                h('span', { class: 'text-strong' }, 'Bruto: ' + money(item.gross)),
                h('span', { class: 'powerbi-bar-commission-tag' }, 'FarmaYA 5%: ' + money(item.earnings))
              )
            ),
            h('div', { class: 'powerbi-bar-track' },
              h('div', {
                class: 'powerbi-bar-fill-pharma',
                style: 'width: ' + pctOfMax + '%;',
                title: 'Venta Bruta: ' + money(item.gross)
              }),
              h('div', {
                class: 'powerbi-bar-fill-farmaya',
                style: 'width: 5%;',
                title: '5% FarmaYA: ' + money(item.earnings)
              })
            )
          );
        }) : [h('div', { class: 'muted small text-center p-4' }, 'No se encontraron farmacias con ese criterio de búsqueda.')];

        pharmaBarsHolder.replaceChildren(...pharmaBarsList);
        pharmaPaginationHolder.replaceChildren(
          fyPagination(filteredPharmaRank.length, pbiPharmaPage, 30, (p) => {
            pbiPharmaPage = p;
            updatePharmaRankView();
          })
        );
      }

      pharmaSearchInput.addEventListener('input', (e) => {
        pbiPharmaSearch = e.target.value;
        pbiPharmaPage = 1;
        updatePharmaRankView();
      });
      updatePharmaRankView();

      const visualFarmacias = h('div', { class: 'powerbi-visual-card' },
        h('div', { class: 'powerbi-visual-header' },
          h('div', null,
            pharmaTitle,
            h('p', { class: 'powerbi-visual-subtitle' }, 'Volumen de ventas brutas vs. Ganancia retenida por FarmaYA (5%)')
          ),
          h('div', { class: 'powerbi-legend-row' },
            h('span', { class: 'powerbi-legend-item' },
              h('span', { class: 'powerbi-dot dot-pharmacy' }),
              '95% Aliado'
            ),
            h('span', { class: 'powerbi-legend-item' },
              h('span', { class: 'powerbi-dot dot-farmaya' }),
              '5% FarmaYA'
            )
          )
        ),
        // Buscador para buscar la farmacia
        h('div', { class: 'powerbi-card-search-wrap' },
          h('span', { class: 'search-ico' }, icon('search')),
          pharmaSearchInput
        ),
        pharmaBarsHolder,
        pharmaPaginationHolder
      );

      // Visual B: Canales de Pago & Conversión
      const byPayment = {};
      filtered.forEach(o => {
        let pm = (o.paymentMethod || 'Wompi / Tarjeta').toUpperCase();
        if (pm.includes('WOMPI') || pm.includes('CARD') || pm.includes('CREDIT') || pm.includes('DEBIT')) pm = 'Wompi (Bancolombia/Tarjetas)';
        else if (pm.includes('PSE')) pm = 'PSE (Debito Bancario)';
        else if (pm.includes('NEQUI')) pm = 'Nequi';
        else if (pm.includes('EFECTIVO') || pm.includes('CASH')) pm = 'Contraentrega Efectivo';
        if (!byPayment[pm]) byPayment[pm] = { label: pm, gross: 0, earnings: 0, count: 0 };
        const gross = Number(o.total) || 0;
        byPayment[pm].gross += gross;
        byPayment[pm].earnings += o.platformEarnings != null ? Number(o.platformEarnings) : Math.round(gross * 0.05);
        byPayment[pm].count += 1;
      });
      const paymentChannels = Object.values(byPayment).sort((a, b) => b.gross - a.gross);

      const paymentBarsList = paymentChannels.length ? paymentChannels.map(pm => {
        const sharePct = totalGross > 0 ? Math.round((pm.gross / totalGross) * 100) : 0;
        return h('div', { class: 'powerbi-channel-row' },
          h('div', { class: 'powerbi-channel-info' },
            h('span', { class: 'powerbi-channel-name' }, pm.label),
            h('span', { class: 'powerbi-channel-amt' }, money(pm.gross) + ' (' + sharePct + '%)')
          ),
          h('div', { class: 'powerbi-channel-track' },
            h('div', { class: 'powerbi-channel-fill', style: 'width: ' + Math.max(sharePct, 6) + '%;' })
          ),
          h('div', { class: 'powerbi-channel-sub' },
            h('span', { class: 'muted small' }, pm.count + (pm.count === 1 ? ' pedido' : ' pedidos')),
            h('span', { class: 'text-green small font-bold' }, 'Comision 5%: ' + money(pm.earnings))
          )
        );
      }) : [h('div', { class: 'muted small text-center p-4' }, 'No hay canales de pago registrados.')];

      const visualCanales = h('div', { class: 'powerbi-visual-card' },
        h('div', { class: 'powerbi-visual-header' },
          h('div', null,
            h('h3', { class: 'powerbi-visual-title' }, 'Canales de Pago & Facturacion'),
            h('p', { class: 'powerbi-visual-subtitle' }, 'Participacion de pasarelas electronicas y comisiones')
          ),
          h('span', { class: 'powerbi-tag-mini' }, 'Wompi / Digital')
        ),
        h('div', { class: 'powerbi-channels-container' }, paymentBarsList)
      );

      const visualsGrid = h('div', { class: 'powerbi-visuals-grid' }, visualFarmacias, visualCanales);

      // Table (Desktop & Flutter Mobile responsive con buscador y máximo 30 por página)
      const matrixSubtitle = h('p', { class: 'powerbi-matrix-subtitle' });
      const matrixSearchInput = h('input', {
        type: 'search',
        placeholder: 'Buscar por cliente, farmacia, código...',
        value: pbiMatrixSearch
      });
      const matrixTbody = h('tbody');
      const matrixMobileCardsHolder = h('div', { class: 'powerbi-mobile-cards-wrap mobile-only' });
      const matrixPaginationHolder = h('div');

      function updateMatrixView() {
        const qMat = pbiMatrixSearch.toLowerCase().trim();
        const filteredMatrix = filtered.filter(o => {
          if (!qMat) return true;
          return [o.code, o.clientName, o.pharmacyName, o.paymentMethod, o.status].filter(Boolean).join(' ').toLowerCase().includes(qMat);
        });

        matrixSubtitle.textContent = filteredMatrix.length
          ? 'Mostrando ' + Math.min(filteredMatrix.length, 30) + ' de ' + filteredMatrix.length + ' transacciones monetizadas.'
          : 'No se encontraron transacciones con los filtros seleccionados.';

        const totalMatrixPages = Math.max(1, Math.ceil(filteredMatrix.length / 30));
        if (pbiMatrixPage > totalMatrixPages) pbiMatrixPage = totalMatrixPages;
        const startMatIdx = (pbiMatrixPage - 1) * 30;
        const pagedMatrix = filteredMatrix.slice(startMatIdx, startMatIdx + 30);

        const tableRows = pagedMatrix.map(o => {
          const gross = Number(o.total) || 0;
          const earnings = o.platformEarnings != null ? Number(o.platformEarnings) : Math.round(gross * 0.05);
          const pharmaNet = Math.max(0, gross - earnings);
          const code = o.code || ('#' + (o.id || '').slice(-6).toUpperCase());
          const dt = new Date(o.createdAt || o.deliveredAt || Date.now());
          const dtFmt = dt.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) + ' ' + dt.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

          return h('tr', null,
            h('td', null,
              h('strong', { class: 'powerbi-table-code' }, code),
              h('span', { class: 'd-block text-muted small' }, o.clientName || 'Cliente FarmaYA')
            ),
            h('td', null,
              h('span', { class: 'font-weight-600' }, o.pharmacyName || 'Aliado FarmaYA'),
              h('small', { class: 'muted d-block' }, 'Aliado (95%): ' + money(pharmaNet))
            ),
            h('td', null,
              h('span', { class: 'powerbi-date-badge' }, dtFmt)
            ),
            h('td', null,
              h('span', { class: 'powerbi-payment-pill' }, o.paymentMethod || 'Wompi')
            ),
            h('td', { class: 'text-right font-weight-700' }, money(gross)),
            h('td', { class: 'text-right text-green font-weight-700' }, '+ ' + money(earnings)),
            h('td', { class: 'text-center' },
              h('span', { class: 'powerbi-status-badge status-' + (o.status || 'ENTREGADO').toLowerCase() },
                o.status === 'ENTREGADO' ? 'Liquidado' : (o.status || 'Completado')
              )
            )
          );
        });

        const mobileCardsList = pagedMatrix.map(o => {
          const gross = Number(o.total) || 0;
          const earnings = o.platformEarnings != null ? Number(o.platformEarnings) : Math.round(gross * 0.05);
          const pharmaNet = Math.max(0, gross - earnings);
          const code = o.code || ('#' + (o.id || '').slice(-6).toUpperCase());
          const dt = new Date(o.createdAt || o.deliveredAt || Date.now());
          const dtFmt = dt.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) + ' ' + dt.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

          return h('div', { class: 'powerbi-flutter-card' },
            h('div', { class: 'powerbi-flutter-card-top' },
              h('strong', { class: 'powerbi-flutter-card-code' }, code),
              h('span', { class: 'powerbi-status-badge status-' + (o.status || 'ENTREGADO').toLowerCase() },
                o.status === 'ENTREGADO' ? 'Liquidado' : (o.status || 'Completado')
              )
            ),
            h('div', { class: 'powerbi-flutter-card-mid' },
              h('div', { class: 'powerbi-flutter-row' },
                h('span', { class: 'muted small' }, 'Cliente:'),
                h('strong', null, o.clientName || 'Cliente FarmaYA')
              ),
              h('div', { class: 'powerbi-flutter-row' },
                h('span', { class: 'muted small' }, 'Farmacia:'),
                h('strong', null, o.pharmacyName || 'Aliado FarmaYA')
              ),
              h('div', { class: 'powerbi-flutter-row' },
                h('span', { class: 'muted small' }, 'Fecha:'),
                h('span', null, dtFmt)
              ),
              h('div', { class: 'powerbi-flutter-row' },
                h('span', { class: 'muted small' }, 'Medio:'),
                h('span', { class: 'powerbi-payment-pill' }, o.paymentMethod || 'Wompi')
              )
            ),
            h('div', { class: 'powerbi-flutter-card-fin' },
              h('div', { class: 'powerbi-flutter-fin-col' },
                h('span', { class: 'kpi-sub-label' }, 'Venta Bruta'),
                h('strong', { class: 'powerbi-flutter-amt' }, money(gross))
              ),
              h('div', { class: 'powerbi-flutter-fin-col' },
                h('span', { class: 'kpi-sub-label' }, 'Aliado (95%)'),
                h('strong', { class: 'powerbi-flutter-amt muted' }, money(pharmaNet))
              ),
              h('div', { class: 'powerbi-flutter-fin-col text-right' },
                h('span', { class: 'kpi-sub-label text-green font-bold' }, 'FarmaYA (5%)'),
                h('span', { class: 'powerbi-profit-pill' }, money(earnings))
              )
            )
          );
        });

        matrixTbody.replaceChildren(...(tableRows.length ? tableRows : [
          h('tr', null, h('td', { colspan: 7, class: 'text-center muted p-4' }, 'No hay registros para mostrar.'))
        ]));

        matrixMobileCardsHolder.replaceChildren(...(mobileCardsList.length ? mobileCardsList : [
          h('div', { class: 'text-center muted p-4' }, 'No hay registros para mostrar.')
        ]));

        matrixPaginationHolder.replaceChildren(
          fyPagination(filteredMatrix.length, pbiMatrixPage, 30, (p) => {
            pbiMatrixPage = p;
            updateMatrixView();
          })
        );
      }

      matrixSearchInput.addEventListener('input', (e) => {
        pbiMatrixSearch = e.target.value;
        pbiMatrixPage = 1;
        updateMatrixView();
      });
      updateMatrixView();

      const matrixSection = h('div', { class: 'powerbi-matrix-card' },
        h('div', { class: 'powerbi-matrix-header' },
          h('div', null,
            h('h3', { class: 'powerbi-matrix-title' }, 'Matriz Detallada de Liquidación (Comisión 5% FarmaYA)'),
            matrixSubtitle
          ),
          h('div', { class: 'powerbi-card-search-wrap', style: 'margin:0; min-width:260px;' },
            h('span', { class: 'search-ico' }, icon('search')),
            matrixSearchInput
          )
        ),
        // Desktop table wrap
        h('div', { class: 'powerbi-table-wrap desktop-only' },
          h('table', { class: 'powerbi-table' },
            h('thead', null,
              h('tr', null,
                h('th', null, 'Pedido / Cliente'),
                h('th', null, 'Farmacia Aliada'),
                h('th', null, 'Fecha'),
                h('th', null, 'Medio de Pago'),
                h('th', { class: 'text-right' }, 'Total Bruto'),
                h('th', { class: 'text-right' }, 'FarmaYA (5%)'),
                h('th', { class: 'text-center' }, 'Estado')
              )
            ),
            matrixTbody
          )
        ),
        // Mobile Flutter Cards
        matrixMobileCardsHolder,
        matrixPaginationHolder
      );

      wrapper.append(headerBanner, slicersBar, kpisGrid, visualsGrid, matrixSection);
    }

    draw();
    return wrapper;
  }, 4000);
}

function adminView(user) {
  let root;
  root = h('div', { class: 'stack admin-root' }, adminHeaderCard(user), sideNavigation([
    { label: 'Dashboard Power BI', icon: 'layout-dashboard', badge: '5%', render: adminPowerBiDashboard },
    { label: 'Desembolsos a Farmacias', icon: 'wallet', render: adminDisbursementsView },
    { label: 'Predicción de Demanda', icon: 'ai-prediction', badge: 'IA', render: adminDemandForecast },
    { label: 'Pedidos', icon: 'package', render: adminOrders },
    { label: 'Verificaciones', icon: 'prescriptions', render: adminVerificationCenter },
    { label: 'Farmacias', icon: 'store', render: () => adminUsers('FARMACIA') },
    { label: 'Repartidores', icon: 'bike', render: () => adminUsers('REPARTIDOR') },
    { label: 'Clientes', icon: 'users', render: () => adminUsers('CLIENTE') },
    { label: 'Administradores', icon: 'shield', render: () => adminAdministratorsView(user) },
    { label: 'Catalogo de Productos', icon: 'capsule', render: adminCatalogManager },
    { label: 'Movimientos', icon: 'history', render: adminMovements }
  ], 0));
  return root;
}

/**
 * Modelo Predictivo de Demanda Mensual de Medicamentos (Machine Learning)
 * Clasifica la demanda en ALTA, MEDIA y BAJA utilizando los pedidos historicos de MongoDB.
 */
function adminDemandForecast() {
  return live(() => API.get('/demand-forecast'), data => {
    const list = data.forecasts || [];
    const summary = data.summary || { totalMedicines: list.length, alta: 0, media: 0, baja: 0 };
    const period = data.period || 'Proximo Mes';

    // Banner explicativo sin emojis
    const banner = notice('info',
      'Modelo Predictivo de Demanda Mensual (Machine Learning con MongoDB)',
      'Clasificacion inteligente de la demanda mensual de medicamentos en tres categorias (ALTA, MEDIA, BAJA) utilizando los registros historicos de pedidos, series temporales y estacionalidad. Permite a las farmacias planificar compras y evitar roturas de stock.'
    );

    // 4 Tarjetas de KPIs estilo Stitch Admin
    const kpiSection = h('div', { class: 'stitch-admin-kpis-grid' },
      h('div', { class: 'stitch-admin-kpi-card' },
        h('div', { class: 'kpi-top' },
          h('span', { class: 'kpi-lbl' }, 'Periodo Proyectado'),
          h('span', { class: 'badge-flash' }, 'IA FarmaYA')
        ),
        h('div', { class: 'kpi-amt-row' },
          h('strong', { class: 'kpi-amt', style: 'font-size: 1.35rem; color: var(--primary);' }, period),
          h('small', null, 'pronostico mensual')
        ),
        h('div', { class: 'kpi-footer-note' },
          h('span', null, 'Total en catalogo analizado: <strong>' + summary.totalMedicines + '</strong>')
        )
      ),

      h('div', { class: 'stitch-admin-kpi-card' },
        h('div', { class: 'kpi-top' },
          h('span', { class: 'kpi-lbl' }, 'Demanda ALTA'),
          h('span', { class: 'kpi-sub-tag', style: 'background: rgba(217, 56, 58, 0.15); color: #c5221f; font-weight: 700;' }, 'Prioridad Suministro')
        ),
        h('div', { class: 'kpi-amt-row' },
          h('strong', { class: 'kpi-amt', style: 'color: #d9383a;' }, String(summary.alta || 0)),
          h('small', null, 'medicamentos de alta rotacion')
        ),
        h('div', { class: 'kpi-footer-note' },
          h('span', null, 'Stock de seguridad sugerido: <strong>+35%</strong>')
        )
      ),

      h('div', { class: 'stitch-admin-kpi-card' },
        h('div', { class: 'kpi-top' },
          h('span', { class: 'kpi-lbl' }, 'Demanda MEDIA'),
          h('span', { class: 'kpi-sub-tag tone-teal', style: 'font-weight: 700;' }, 'Rotacion Regular')
        ),
        h('div', { class: 'kpi-amt-row' },
          h('strong', { class: 'kpi-amt tone-teal' }, String(summary.media || 0)),
          h('small', null, 'demanda estandar predecible')
        ),
        h('div', { class: 'kpi-footer-note' },
          h('span', null, 'Ciclo de reposicion quincenal sugerido')
        )
      ),

      h('div', { class: 'stitch-admin-kpi-card' },
        h('div', { class: 'kpi-top' },
          h('span', { class: 'kpi-lbl' }, 'Demanda BAJA'),
          h('span', { class: 'kpi-sub-tag', style: 'background: rgba(100, 116, 139, 0.15); color: #475569; font-weight: 700;' }, 'Bajo Movimiento')
        ),
        h('div', { class: 'kpi-amt-row' },
          h('strong', { class: 'kpi-amt', style: 'color: #64748b;' }, String(summary.baja || 0)),
          h('small', null, 'pocas solicitudes mensuales')
        ),
        h('div', { class: 'kpi-footer-note' },
          h('span', null, 'Compra bajo pedido para prevenir vencimientos')
        )
      )
    );

    // Medicamento seleccionado para el grafico de lineas
    const selectedMed = list.find(m => m.medicineName === adminSelectedMedName) || null;

    // Selector desplegable que ocupa toda la anchura
    const medSelect = h('select', {
      class: 'input select forecast-med-select',
      style: 'width: 100%; font-size: 0.9rem; padding: 0.6rem 0.9rem; border-radius: 8px; border: 1px solid var(--line); background: var(--surface); color: var(--text);',
      onchange: e => {
        adminSelectedMedName = e.target.value;
        refreshAll();
      }
    },
      h('option', { value: '' }, '-- Comparativa global de categorias (ALTA, MEDIA, BAJA) --'),
      list.map(m => h('option', { value: m.medicineName, selected: m.medicineName === adminSelectedMedName }, m.medicineName + ' [' + m.category + ']'))
    );

    const selectorSection = h('div', {
      class: 'forecast-full-selection',
      style: 'width: 100%; display: flex; align-items: center; gap: 0.75rem; margin-top: 1rem; padding-top: 1rem; border-top: 1.5px solid var(--line);'
    },
      h('div', { style: 'flex: 1; width: 100%;' }, medSelect),
      selectedMed ? h('button', {
        class: 'btn secondary',
        style: 'white-space: nowrap; font-size: 0.85rem; padding: 0.55rem 1rem;',
        onclick: () => { adminSelectedMedName = ''; refreshAll(); }
      }, 'Ver comparativa global') : null
    );

    // Componente del Grafico de Lineas a ancho completo
    const chartCard = h('div', { class: 'card forecast-chart-card', style: 'padding: 1.25rem 1.5rem; margin-bottom: 1.25rem; width: 100%;' },
      h('div', { class: 'flex items-center justify-between', style: 'flex-wrap: wrap; gap: 0.75rem; margin-bottom: 0.75rem;' },
        h('div', null,
          h('h3', { style: 'margin: 0; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem;' },
            'Grafico de Lineas: Evolucion Historica y Proyeccion de Demanda',
            selectedMed ? h('span', { class: 'tag primary', style: 'font-size: 0.75rem;' }, selectedMed.medicineName) : null
          ),
          h('small', { class: 'muted' }, 'Linea continua: Historico de pedidos en MongoDB | Linea discontinua (- -): Proyeccion mensual con Machine Learning')
        )
      ),
      selectorSection,
(() => {
        const holder = h('div', { class: 'chart-container', style: 'width: 100%; min-height: 270px; margin-top: 0.5rem;' });
        holder.innerHTML = fyDemandLineChartSvg(data.chartSeries, selectedMed);
        return holder;
      })(),
      h('div', { class: 'forecast-chart-legend-bar', style: 'margin-top: 0.85rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--line);' },
        h('div', { class: 'flex items-center gap-2' },
          h('span', { class: 'demand-legend-pill alta' }, h('span', { class: 'legend-dot alta' }), 'Demanda ALTA'),
          h('span', { class: 'demand-legend-pill media' }, h('span', { class: 'legend-dot media' }), 'Demanda MEDIA'),
          h('span', { class: 'demand-legend-pill baja' }, h('span', { class: 'legend-dot baja' }), 'Demanda BAJA')
        ),
        h('div', {
          class: 'fy-chart-detail-banner',
          'data-original-text': 'Pasa el cursor por la curva o haz clic en la tabla para graficar un medicamento individual.',
          style: 'display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.4rem 0.95rem; border-radius: 999px; background: rgba(22, 134, 93, 0.08); color: var(--primary); font-size: 0.82rem; font-weight: 600;'
        },
          icon('chart'),
          h('span', null, 'Pasa el cursor por la curva o haz clic en la tabla para graficar un medicamento individual.')
        )
      )
    );

    // Botones de filtro de categoria
    const filterBtn = (label, cat) => {
      const active = adminDemandFilter === cat;
      return h('button', {
        class: 'btn ' + (active ? 'primary' : 'secondary'),
        style: 'font-size: 0.85rem; padding: 0.35rem 0.85rem;',
        onclick: () => {
          adminDemandFilter = cat;
          refreshAll();
        }
      }, label);
    };

    const filters = h('div', { class: 'flex items-center gap-2', style: 'flex-wrap: wrap;' },
      filterBtn('Todos (' + list.length + ')', 'TODAS'),
      filterBtn('ALTA (' + summary.alta + ')', 'ALTA'),
      filterBtn('MEDIA (' + summary.media + ')', 'MEDIA'),
      filterBtn('BAJA (' + summary.baja + ')', 'BAJA')
    );

    // Buscador interactivo que ocupa toda la anchura de la seccion
    const searchInput = h('input', {
      type: 'search',
      placeholder: 'Buscar medicamentos por nombre comercial, principio activo o indicación clínica...',
      value: adminDemandSearch,
      style: 'width: 100%; font-size: 0.95rem; padding: 0.7rem 1.1rem; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); color: var(--text);',
      oninput: e => {
        adminDemandSearch = e.target.value;
        const term = adminDemandSearch.toLowerCase().trim();
        const rows = document.querySelectorAll('.admin-forecast-row');
        rows.forEach(r => {
          const name = (r.getAttribute('data-name') || '').toLowerCase();
          r.style.display = (!term || name.includes(term)) ? '' : 'none';
        });
      }
    });

    // Boton de reentrenamiento/recalculo en tiempo real
    const recalculateBtn = h('button', {
      class: 'btn secondary',
      style: 'font-size: 0.85rem; display: inline-flex; align-items: center; gap: 0.4rem;',
      onclick: async e => {
        await act(e.currentTarget, async () => {
          const res = await API.post('/demand-forecast/recalculate', {});
          toast(res.message || 'Pronostico recalculado exitosamente con IA.');
          refreshAll();
        }, 'Modelo reentrenado');
      }
    }, 'Recalcular Modelo con MongoDB');

    // Barra de búsqueda y filtros a todo lo ancho con línea divisoria
    const toolbar = h('div', { class: 'stack forecast-search-bar-wrap', style: 'width: 100%; gap: 0.85rem; margin: 1.5rem 0 1rem;' },
      h('div', { class: 'forecast-search-row', style: 'width: 100%;' }, searchInput),
      h('div', { class: 'flex items-center justify-between', style: 'width: 100%; flex-wrap: wrap; gap: 0.75rem; padding-bottom: 0.75rem; border-bottom: 1.5px solid var(--line);' },
        filters,
        recalculateBtn
      )
    );

    // Filtrar lista
    const filtered = list.filter(item => {
      const matchCat = adminDemandFilter === 'TODAS' || (item.category || '').toUpperCase() === adminDemandFilter;
      const matchSearch = !adminDemandSearch || (item.medicineName || '').toLowerCase().includes(adminDemandSearch.toLowerCase().trim());
      return matchCat && matchSearch;
    });

    // Insignia de categoria (ALTA, MEDIA, BAJA) sin emojis
    const categoryBadge = cat => {
      const c = (cat || '').toUpperCase();
      let bg = 'rgba(100, 116, 139, 0.15)', color = '#475569', label = 'BAJA';
      if (c === 'ALTA') {
        bg = 'rgba(217, 56, 58, 0.15)';
        color = '#c5221f';
        label = 'ALTA';
      } else if (c === 'MEDIA') {
        bg = 'rgba(2, 132, 199, 0.15)';
        color = '#0284c7';
        label = 'MEDIA';
      } else {
        label = 'BAJA';
      }
      return h('span', {
        class: 'tag',
        style: 'background: ' + bg + '; color: ' + color + '; font-weight: 700; border-radius: 999px; padding: 0.25rem 0.75rem; font-size: 0.8rem;'
      }, label);
    };

    const trendBadge = trend => {
      const t = trend || 'Estable';
      let icon = '[=] Estable';
      if (t === 'Creciente') icon = '[+] Creciente';
      else if (t === 'Decreciente') icon = '[-] Decreciente';
      return h('span', { class: 'text-xs muted', style: 'font-weight: 600;' }, icon);
    };

    // Encabezado de tabla
    const tableHeader = h('thead', null,
      h('tr', { style: 'background: var(--surface-soft); border-bottom: 1.5px solid var(--line);' },
        h('th', { style: 'text-align: center; padding: 0.75rem 0.5rem; width: 90px;' }, 'Grafico'),
        h('th', { style: 'text-align: left; padding: 0.75rem 1rem;' }, 'Medicamento'),
        h('th', { style: 'text-align: center; padding: 0.75rem 0.5rem;' }, 'Demanda Prevista'),
        h('th', { style: 'text-align: center; padding: 0.75rem 0.5rem;' }, 'Confianza'),
        h('th', { style: 'text-align: right; padding: 0.75rem 0.75rem;' }, 'Solicitudes Est.'),
        h('th', { style: 'text-align: right; padding: 0.75rem 0.75rem;' }, 'Unidades Proy.'),
        h('th', { style: 'text-align: right; padding: 0.75rem 0.75rem;' }, 'Stock Sugerido'),
        h('th', { style: 'text-align: center; padding: 0.75rem 0.5rem;' }, 'Tendencia'),
        h('th', { style: 'text-align: left; padding: 0.75rem 1rem;' }, 'Recomendacion de Existencias')
      )
    );

    // Filas con seleccion interactiva
    const tableRows = filtered.map(item => {
      const isSelected = adminSelectedMedName === item.medicineName;
      const selectBtn = h('button', {
        class: 'btn ' + (isSelected ? 'primary' : 'secondary'),
        style: 'font-size: 0.75rem; padding: 0.25rem 0.55rem; width: 100%; text-align: center;',
        onclick: e => {
          e.stopPropagation();
          adminSelectedMedName = isSelected ? '' : item.medicineName;
          refreshAll();
        }
      }, isSelected ? 'Graficado' : 'Graficar');

      return h('tr', {
        class: 'admin-forecast-row',
        'data-name': item.medicineName,
        style: 'border-bottom: 1px solid var(--line); cursor: pointer; transition: background 0.15s;' + (isSelected ? ' background: var(--primary-soft); font-weight: 600;' : ''),
        onclick: () => {
          adminSelectedMedName = isSelected ? '' : item.medicineName;
          refreshAll();
        }
      },
        h('td', { style: 'padding: 0.6rem 0.5rem; text-align: center;' }, selectBtn),
        h('td', { style: 'padding: 0.75rem 1rem; font-weight: 600;' }, item.medicineName),
        h('td', { style: 'text-align: center; padding: 0.75rem 0.5rem;' }, categoryBadge(item.category)),
        h('td', { style: 'text-align: center; padding: 0.75rem 0.5rem; font-size: 0.85rem;', class: 'muted' }, (item.confidence ? item.confidence.toFixed(1) : '90.0') + '%'),
        h('td', { style: 'text-align: right; padding: 0.75rem 0.75rem; font-weight: 600;' }, String(item.estimatedOrders || 0)),
        h('td', { style: 'text-align: right; padding: 0.75rem 0.75rem;' }, String(item.predictedUnits || 0) + ' uds'),
        h('td', { style: 'text-align: right; padding: 0.75rem 0.75rem; font-weight: 700; color: var(--primary);' }, String(item.recommendedStock || 0) + ' uds'),
        h('td', { style: 'text-align: center; padding: 0.75rem 0.5rem;' }, trendBadge(item.historicalTrend)),
        h('td', { style: 'padding: 0.75rem 1rem; font-size: 0.85rem;', class: 'muted' }, item.actionRecommendation || '')
      );
    });

    // Tabla dentro de un recuadro estructurado compatible con tema oscuro y todo el ancho
    const tableFrame = h('div', {
      class: 'card forecast-table-frame',
      style: 'padding: 0; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: var(--surface); box-shadow: var(--shadow-sm, 0 2px 6px rgba(0,0,0,0.04)); margin-top: 1rem; width: 100%;'
    },
      h('div', { class: 'forecast-table-head', style: 'padding: 0.9rem 1.25rem; background: var(--surface-soft); border-bottom: 1px solid var(--line); display: flex; justify-content: space-between; align-items: center;' },
        h('strong', { style: 'font-size: 0.95rem; color: var(--text);' }, 'Planificacion y Clasificacion de Existencias'),
        h('span', { class: 'muted text-xs' }, 'Mostrando ' + filtered.length + ' de ' + list.length + ' medicamentos')
      ),
      h('div', { style: 'overflow-x: auto; width: 100%;' },
        h('table', { class: 'forecast-table', style: 'width: 100%; border-collapse: collapse;' },
          tableHeader,
          h('tbody', null, ...tableRows)
        )
      )
    );

    return h('div', { class: 'stack stitch-admin-demand-view' },
      banner,
      kpiSection,
      chartCard,
      toolbar,
      filtered.length ? tableFrame : empty('Sin coincidencias', 'No se encontraron medicamentos para el criterio seleccionado.')
    );
  });
}
function adminOrders() {
  let status = adminFilter;
  adminFilter = '';
  let searchQuery = '';
  let currentPage = 1;
  const PAGE_SIZE = 30;
  let rawOrders = [];

  const listHolder = h('div', { class: 'stack' });

  function updateOrdersView() {
    if (!rawOrders.length) {
      listHolder.replaceChildren(empty('No hay pedidos con este filtro', 'Prueba con otro estado o muestra todos.'));
      return;
    }
    const filtered = rawOrders.filter(o => {
      if (!searchQuery) return true;
      return [o.code, o.id, o.clientName, o.pharmacyName, o.courierName, o.address, o.city].filter(Boolean).join(' ').toLowerCase().includes(searchQuery);
    });

    if (!filtered.length) {
      listHolder.replaceChildren(empty('Sin resultados', 'No se encontraron pedidos que coincidan con la búsqueda.'));
      return;
    }

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;
    const startIdx = (currentPage - 1) * PAGE_SIZE;
    const paged = filtered.slice(startIdx, startIdx + PAGE_SIZE);

    listHolder.replaceChildren(
      h('div', { class: 'list' }, paged.map(o => {
        const profit = o.platformEarnings != null ? o.platformEarnings : (o.total ? Math.round(o.total * 0.05) : 0);
        return orderRow(o, h('div', { style: 'display:flex;flex-direction:column;align-items:flex-end;gap:4px;' },
          h('span', { class: 'muted small' }, o.address || o.city || 'Cobertura general'),
          o.total != null ? h('span', { class: 'tag tone-teal', style: 'font-weight:700;' }, 'Ganancia FarmaYA: ' + money(profit)) : null
        ));
      })),
      fyPagination(filtered.length, currentPage, PAGE_SIZE, (p) => {
        currentPage = p;
        updateOrdersView();
      })
    );
  }

  const searchInput = h('input', {
    type: 'search',
    placeholder: 'Buscar pedido por código, cliente, farmacia, repartidor o dirección...',
    style: 'flex: 1; min-width: 280px; height: 42px; padding: 0 14px; border-radius: 10px; border: 1.5px solid var(--line); font-size: 13.5px;',
    oninput: (e) => {
      searchQuery = e.target.value.trim().toLowerCase();
      currentPage = 1;
      updateOrdersView();
    }
  });

  const select = h('select', {
    'aria-label': 'Filtrar por estado',
    style: 'height: 42px; border-radius: 10px; border: 1.5px solid var(--line); padding: 0 12px; font-weight: 600;',
    onchange: () => {
      status = select.value;
      currentPage = 1;
      loadLive();
    }
  },
    h('option', { value: '' }, 'Todos los estados'),
    Object.entries(state.meta.statuses).map(([k, v]) => h('option', { value: k }, v)));
  select.value = status;

  const holder = h('div');
  const loadLive = () => holder.replaceChildren(live(() => API.get('/admin/orders' + (status ? '?status=' + status : '')), orders => {
    rawOrders = Array.isArray(orders) ? orders : [];
    updateOrdersView();
    return listHolder;
  }));
  loadLive();

  return h('div', { class: 'stack' }, h('div', { class: 'toolbar', style: 'display:flex; gap:12px; align-items:center; flex-wrap:wrap; margin-bottom:14px;' }, searchInput, select), holder);
}

async function promptDisableUser(user) {
  const name = user.pharmacyName || user.name || 'este usuario';
  const roleLabel = user.role === 'FARMACIA'
    ? 'la farmacia'
    : (user.role === 'REPARTIDOR' ? 'el repartidor' : (user.role === 'ADMIN' ? 'el administrador' : 'la cuenta'));

  const reason = await promptBox({
    title: 'Deshabilitar cuenta de ' + name,
    message: 'Esta accion suspendera el acceso a la plataforma para ' + roleLabel + ' (' + user.email + '). El motivo se enviara de inmediato por correo electronico al usuario.',
    label: 'Motivo de la deshabilitacion',
    placeholder: 'Ej: Suspension preventiva, documentacion pendiente, irregularidades...',
    ok: 'Deshabilitar y Enviar Correo',
    minLength: 0,
    multiline: true
  });
  if (reason === null) return null;
  return reason.trim() || 'Suspension preventiva administrativa FarmaYA';
}

function adminUsers(role) {
  const titles = { FARMACIA: 'farmacias', REPARTIDOR: 'repartidores', CLIENTE: 'clientes' };
  let query = '';
  let userPage = 1;
  const PAGE_SIZE = 30;
  let rawUsers = [];

  const listHolder = h('div', { class: 'stack', style: 'width: 100%;' });

  function updateUsersView() {
    if (!rawUsers.length) {
      listHolder.replaceChildren(empty('Aún no hay ' + titles[role]));
      return;
    }
    const shown = rawUsers.filter(u => !query ||
      [u.name, u.email, u.address, u.pharmacyName, u.phone, u.city].filter(Boolean).join(' ').toLowerCase().includes(query));
    if (!shown.length) {
      listHolder.replaceChildren(empty('Sin resultados', 'No encontramos ' + titles[role] + ' que coincidan con la búsqueda.'));
      return;
    }
    const needsVerify = role !== 'CLIENTE';

    const totalPages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
    if (userPage > totalPages) userPage = totalPages;
    const startIdx = (userPage - 1) * PAGE_SIZE;
    const pagedUsers = shown.slice(startIdx, startIdx + PAGE_SIZE);

    const toggle = (u, kind, value, ok) => async e => {
      let reason = null;
      if (kind === 'enabled' && value === false) {
        reason = await promptDisableUser(u);
        if (!reason) return;
      }
      const updated = await act(e.currentTarget, () => API.post('/admin/users/' + u.id + '/' + kind, { value, reason }), ok);
      if (updated) {
        Object.assign(u, updated);
      } else {
        u[kind] = value;
        if (reason) u.disabledReason = reason;
      }
      updateUsersView();
    };

    listHolder.replaceChildren(
      h('div', { class: 'table-wrap', style: 'width: 100%;' }, h('table', { class: 'users', style: 'width: 100%;' },
        h('thead', null, h('tr', null,
          h('th', null, 'Usuario'),
          h('th', null, 'Contacto / Ciudad'),
          needsVerify ? h('th', null, 'Verificación') : null,
          h('th', null, 'Estado'),
          h('th', null, 'Acciones'))),
        h('tbody', null, pagedUsers.map(u => {
          const isMe = state.user && state.user.id === u.id;
          const statusCell = h('td', null,
            u.enabled
              ? h('span', { class: 'badge-pill success' }, 'Activa')
              : h('span', { class: 'badge-pill error', title: u.disabledReason || 'Sin motivo' }, 'Deshabilitada')
          );

          const actionsCell = h('td', { class: 'actions' },
            isMe
              ? h('span', { class: 'muted small' }, 'Tu propia cuenta')
              : (u.enabled
                  ? h('button', {
                      class: 'btn ghost small danger',
                      title: 'Deshabilitar cuenta y notificar por correo al usuario',
                      onclick: toggle(u, 'enabled', false, 'Cuenta deshabilitada. Se notificó al usuario.')
                    }, 'Deshabilitar')
                  : h('button', {
                      class: 'btn ghost small success',
                      title: 'Rehabilitar acceso a la plataforma',
                      onclick: toggle(u, 'enabled', true, 'Cuenta rehabilitada exitosamente')
                    }, 'Habilitar')
                )
          );

          return h('tr', { class: u.enabled ? '' : 'row-disabled' },
            h('td', null,
              h('div', null,
                h('strong', null, u.pharmacyName || u.name),
                u.pharmacyName ? h('span', { class: 'muted small block-line' }, u.name) : null,
                h('span', { class: 'muted small block-line' }, 'Registrado: ' + (u.createdAt ? new Date(u.createdAt).toLocaleDateString('es-CO') : '—'))
              )
            ),
            h('td', null,
              h('span', null, u.email),
              u.phone ? h('span', { class: 'muted small block-line' }, u.phone) : null,
              h('span', { class: 'muted small block-line' }, u.address || u.city || 'Sin dirección')
            ),
            needsVerify ? h('td', null,
              u.verified
                ? h('span', { class: 'badge-pill success' }, 'Verificado')
                : h('span', { class: 'badge-pill warn' }, 'Pendiente')
            ) : null,
            statusCell,
            actionsCell
          );
        }))
      )),
      fyPagination(shown.length, userPage, PAGE_SIZE, (p) => {
        userPage = p;
        updateUsersView();
      })
    );
  }

  const search = h('input', {
    type: 'search',
    placeholder: 'Buscar por nombre, correo, teléfono o dirección...',
    'aria-label': 'Buscar ' + titles[role],
    style: 'width: 100%; font-size: 0.95rem; padding: 0.65rem 1rem; border-radius: 8px; border: 1.5px solid var(--line);',
    oninput: (e) => {
      query = e.target.value.trim().toLowerCase();
      userPage = 1;
      updateUsersView();
    }
  });

  const liveHolder = live(() => API.get('/admin/users?role=' + role), users => {
    rawUsers = Array.isArray(users) ? users : [];
    updateUsersView();
    return listHolder;
  });

  return h('div', { class: 'stack', style: 'width: 100%;' }, search, liveHolder);
}

function openPdfViewerDialog(title, dataUrl, filename) {
  const content = h('div', { class: 'sheet-body', style: 'padding: 16px; max-width: 900px; width: 92vw;' },
    h('div', { style: 'display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px;' },
      h('div', null,
        h('h3', { style: 'margin:0;' }, title),
        h('span', { class: 'small muted' }, filename || 'Documento PDF oficial')
      ),
      h('div', { style: 'display:flex; gap:8px;' },
        h('a', { class: 'btn ghost small', href: dataUrl, download: filename || 'documento.pdf', target: '_blank' }, 'Descargar'),
        h('button', { class: 'btn ghost small', onclick: () => d.close() }, 'Cerrar')
      )
    ),
    h('div', { style: 'width:100%; height:72vh; border-radius:10px; overflow:hidden; border:1px solid var(--line); background:#525659;' },
      h('iframe', {
        src: dataUrl,
        style: 'width:100%; height:100%; border:none;',
        title: title
      })
    )
  );
  const d = openDialog(content, { wide: true });
}

function openUserDocumentsModal(user) {
  const docs = user.verificationDocuments || [];
  const list = docs.length
    ? h('div', { class: 'doc-pdf-list' }, docs.map(doc => h('div', { class: 'doc-pdf-item' },
        h('div', { class: 'doc-pdf-left' },
          h('span', { class: 'doc-pdf-icon' }, icon('prescriptions')),
          h('div', null,
            h('strong', { class: 'block-line' }, doc.title || doc.docType),
            h('span', { class: 'small muted' }, doc.filename || 'Documento PDF')
          )
        ),
        h('div', { class: 'doc-pdf-actions' },
          h('button', { class: 'btn primary small', onclick: () => openPdfViewerDialog(doc.title, doc.dataUrl, doc.filename) }, 'Ver PDF'),
          h('a', { class: 'btn ghost small', href: doc.dataUrl, download: doc.filename, target: '_blank' }, 'Descargar')
        )
      )))
    : empty('Sin documentos PDF', 'Este usuario no adjuntó archivos PDF al momento de su registro.');

  const body = h('div', { class: 'sheet-body', style: 'max-width:680px; width:90vw;' },
    h('div', { style: 'display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;' },
      h('div', null,
        h('span', { class: 'eyebrow' }, 'EXPEDIENTE DIGITAL DE VERIFICACIÓN'),
        h('h3', { style: 'margin:2px 0 0;' }, user.pharmacyName || user.name),
        h('p', { class: 'muted small', style: 'margin:0;' }, user.role === 'FARMACIA' ? ('Licencia: ' + (user.licenseNumber || 'No especificada')) : ('Vehículo: ' + (user.vehicle || 'No especificado') + (user.plate ? ' · Placa: ' + user.plate : '')))
      ),
      h('button', { class: 'close', onclick: () => d.close() }, '×')
    ),
    list
  );
  const d = openDialog(body);
}

function adminVerificationCenter() {
  let filterRole = '';
  let verifyPage = 1;
  const PAGE_SIZE = 30;
  const filterButtons = [
    { label: 'Todas las solicitudes', role: '', iconName: 'clipboard-list' },
    { label: 'Farmacias pendientes', role: 'FARMACIA', iconName: 'building' },
    { label: 'Repartidores pendientes', role: 'REPARTIDOR', iconName: 'bike' }
  ];

  const toolbar = h('div', { class: 'filter-tabs-bar verification-tabs-bar' });
  const container = h('div', { class: 'stack verification-center-root' });

  function renderView() {
    toolbar.replaceChildren(...filterButtons.map(fb => h('button', {
      type: 'button',
      class: 'btn tab-pill-btn ' + (filterRole === fb.role ? 'primary' : 'secondary'),
      onclick: () => { filterRole = fb.role; verifyPage = 1; renderView(); }
    }, icon(fb.iconName), h('span', null, fb.label))));

    const content = live(() => API.get('/admin/verifications'), users => {
      let filtered = users;
      if (filterRole) filtered = users.filter(u => u.role === filterRole);

      if (!filtered.length) {
        return empty('No hay solicitudes pendientes', filterRole
          ? 'No hay cuentas de ' + (filterRole === 'FARMACIA' ? 'farmacias' : 'repartidores') + ' pendientes por verificar.'
          : 'Todas las cuentas de farmacias y repartidores han sido revisadas y verificadas.');
      }

      const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
      if (verifyPage > totalPages) verifyPage = totalPages;
      const startIdx = (verifyPage - 1) * PAGE_SIZE;
      const paged = filtered.slice(startIdx, startIdx + PAGE_SIZE);

      const cardsContainer = h('div', {
        class: 'verification-cards-grid',
        style: 'display: grid; grid-template-columns: repeat(auto-fill, minmax(420px, 1fr)); gap: 1.25rem; width: 100%;'
      }, paged.map(u => {
        const isPh = u.role === 'FARMACIA';
        const docs = u.verificationDocuments || [];

        const actVerify = async (val) => {
          await act(null, () => API.post('/admin/users/' + u.id + '/verified', { value: val }),
            val ? 'Cuenta verificada y notificada por correo al usuario' : 'Verificación retirada');
          u.verified = val;
          refreshAll();
        };

        const actDisable = async () => {
          const reason = await promptDisableUser(u);
          if (!reason) return;
          await act(null, () => API.post('/admin/users/' + u.id + '/enabled', { value: false, reason }), 'Cuenta deshabilitada');
          u.enabled = false;
          refreshAll();
        };

        return h('div', { class: 'card verification-item-card', style: 'padding: 1.25rem; border-radius: 12px; display: flex; flex-direction: column; gap: 0.85rem;' },
          h('div', { class: 'verification-card-header', style: 'display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;' },
            h('div', null,
              h('span', { class: 'tag ' + (isPh ? 'tone-teal' : 'tone-blue'), style: 'margin-bottom: 4px; display: inline-block;' },
                isPh ? 'Farmacia Aliada' : 'Repartidor / Mensajero'),
              h('h3', { style: 'margin: 0; font-size: 1.15rem; font-weight: 700;' }, isPh ? (u.pharmacyName || u.name) : u.name),
              isPh && u.pharmacyName ? h('span', { class: 'muted small block-line' }, 'Representante: ' + u.name) : null,
              h('span', { class: 'muted small block-line' }, u.email + (u.phone ? ' • ' + u.phone : ''))
            ),
            h('span', { class: 'tag tone-amber', style: 'font-weight: 700;' }, 'Pendiente de Revisión')
          ),
          h('div', { class: 'verification-details-grid', style: 'background: var(--surface-soft); padding: 0.85rem; border-radius: 8px; font-size: 0.88rem; display: grid; grid-template-columns: 1fr 1fr; gap: 6px;' },
            h('div', null, h('span', { class: 'muted' }, 'Ciudad: '), h('strong', null, u.city || 'Nacional')),
            h('div', null, h('span', { class: 'muted' }, 'Dirección: '), h('strong', null, u.address || '-')),
            isPh ? h('div', { style: 'grid-column: span 2;' }, h('span', { class: 'muted' }, 'Licencia: '), h('strong', null, u.licenseNumber || 'En trámite')) : null,
            !isPh ? h('div', null, h('span', { class: 'muted' }, 'Vehículo: '), h('strong', null, u.vehicle || 'Sin vehículo')) : null,
            !isPh ? h('div', null, h('span', { class: 'muted' }, 'Placa: '), h('strong', null, u.plate || 'N/A')) : null
          ),
          h('div', { class: 'verification-docs-preview' },
            h('strong', { style: 'font-size: 0.88rem; display: block; margin-bottom: 6px;' }, 'Documentación Adjunta (' + docs.length + '):'),
            docs.length ? h('div', { style: 'display: flex; flex-direction: column; gap: 4px;' },
              docs.map(d => h('button', {
                type: 'button',
                class: 'btn secondary small',
                style: 'justify-content: flex-start; text-align: left; font-size: 12px; padding: 6px 10px;',
                onclick: () => openPdfViewerDialog(d.url, d.name || 'Documento')
              }, icon('copy'), h('span', { style: 'overflow: hidden; text-overflow: ellipsis; white-space: nowrap;' }, d.name || 'Documento PDF'))))
              : h('p', { class: 'muted small', style: 'margin: 0;' }, 'No se adjuntaron archivos en el registro.')
          ),
          h('div', { class: 'verification-actions-row', style: 'display: flex; gap: 8px; justify-content: flex-end; margin-top: auto; padding-top: 8px; border-top: 1px solid var(--line);' },
            h('button', { class: 'btn danger small', type: 'button', onclick: actDisable }, 'Rechazar / Deshabilitar'),
            h('button', { class: 'btn primary small', type: 'button', onclick: () => actVerify(true) }, 'Aprobar y Verificar'))
        );
      }));

      return h('div', { class: 'stack' },
        cardsContainer,
        fyPagination(filtered.length, verifyPage, PAGE_SIZE, (p) => {
          verifyPage = p;
          renderView();
        })
      );
    });

    container.replaceChildren(content);
  }

  renderView();
  return h('div', { class: 'stack' }, toolbar, container);
}

function adminMovements() {
  let query = '';
  let type = '';
  let movPage = 1;
  const PAGE_SIZE = 30;
  let rawMovements = [];
  const holder = h('div', { class: 'stack' });

  function updateMovView() {
    const filtered = rawMovements.filter(m => {
      if (m.orderCode && !String(m.type).startsWith('ADMIN') && !String(m.type).includes('VERIFICACION') && !String(m.type).includes('DESEMBOLSO')) {
        return false;
      }
      const searchable = [m.code, m.type, m.description, m.actorName, m.actorRole].filter(Boolean).join(' ').toLowerCase();
      let typeOk = true;
      if (type === 'USUARIO') typeOk = String(m.type).startsWith('USUARIO_') || String(m.type).includes('USUARIO');
      else if (type === 'PRODUCTO') typeOk = String(m.type).includes('PRODUCTO');
      else if (type === 'VERIFICACION') typeOk = String(m.type).includes('VERIFICACION') || String(m.type).includes('PERMISO');
      else if (type === 'DESEMBOLSO') typeOk = String(m.type).includes('DESEMBOLSO');
      else if (type === 'SISTEMA') typeOk = m.actorRole === 'SISTEMA' || String(m.type).includes('SISTEMA');
      return typeOk && (!query || searchable.includes(query));
    });

    if (!filtered.length) {
      holder.replaceChildren(empty('No hay movimientos administrativos', 'Las acciones de administración sobre usuarios, verificaciones y catálogo se auditan aquí.'));
      return;
    }

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (movPage > totalPages) movPage = totalPages;
    const startIdx = (movPage - 1) * PAGE_SIZE;
    const paged = filtered.slice(startIdx, startIdx + PAGE_SIZE);

    holder.replaceChildren(
      h('div', { class: 'table-wrap' }, h('table', { class: 'users' },
        h('thead', null, h('tr', null,
          h('th', null, 'Acción administrativa'),
          h('th', null, 'Afectado / Objeto'),
          h('th', null, 'Responsable'),
          h('th', null, 'Fecha y hora'))),
        h('tbody', null, paged.map(m => {
          const actor = m.actorName ? (m.actorName + (m.actorRole ? ' (' + m.actorRole + ')' : '')) : (m.actorRole || 'Sistema');
          return h('tr', null,
            h('td', null,
              h('strong', null, movementTypeLabel(m.type)),
              h('small', { class: 'block-line muted movement-description' }, m.description || 'Sin detalle')),
            h('td', null,
              m.orderCode ? h('span', { class: 'tag tone-teal', style: 'font-weight: 700;' }, m.orderCode) : (m.code || 'Auditoría general')),
            h('td', null, actor),
            h('td', null, formatMovementDate(m.createdAt)));
        })))),
      fyPagination(filtered.length, movPage, PAGE_SIZE, (p) => {
        movPage = p;
        updateMovView();
      })
    );
  }

  const search = h('input', {
    type: 'search',
    placeholder: 'Buscar código, usuario, acción o detalle administrativo',
    'aria-label': 'Buscar movimientos administrativos',
    style: 'border: 1.5px solid var(--line);',
    oninput: (e) => {
      query = e.target.value.trim().toLowerCase();
      movPage = 1;
      updateMovView();
    }
  });

  const filter = h('select', {
    'aria-label': 'Filtrar movimientos administrativos',
    style: 'border: 1.5px solid var(--line);',
    onchange: () => {
      type = filter.value;
      movPage = 1;
      updateMovView();
    }
  },
    h('option', { value: '' }, 'Todos los movimientos administrativos'),
    h('option', { value: 'USUARIO' }, 'Cuentas de usuario'),
    h('option', { value: 'PRODUCTO' }, 'Catálogo y productos'),
    h('option', { value: 'VERIFICACION' }, 'Verificaciones y permisos'),
    h('option', { value: 'DESEMBOLSO' }, 'Desembolsos y liquidaciones'),
    h('option', { value: 'SISTEMA' }, 'Sistema'));

  const liveWatcher = live(() => API.get('/admin/movements'), movements => {
    rawMovements = Array.isArray(movements) ? movements : [];
    updateMovView();
    return h('div', { style: 'display:none;' });
  });

  return h('div', { class: 'stack' }, h('div', { class: 'toolbar', style: 'display:flex; gap:12px; align-items:center; flex-wrap:wrap; margin-bottom:14px;' }, search, filter), holder, liveWatcher);
}

function movementTypeLabel(type) {
  const labels = {
    USUARIO_VERIFICACION: 'Verificación de aliado',
    USUARIO_ESTADO: 'Estado de usuario',
    USUARIO_PERMISO_EDICION: 'Permiso de edición',
    ADMIN_CREACION: 'Creación de administrador',
    ADMIN_ESTADO: 'Estado de administrador',
    ADMIN_PRODUCTO_CREADO: 'Nuevo producto en catálogo',
    ADMIN_PRODUCTO_ACTUALIZADO: 'Producto editado',
    ADMIN_PRODUCTO_ELIMINADO: 'Producto eliminado',
    ADMIN_PRODUCTO_IMAGEN: 'Foto de producto actualizada'
  };
  return labels[type] || String(type || 'Acción administrativa').replaceAll('_', ' ').toLowerCase().replace(/^./, c => c.toUpperCase());
}
function formatMovementDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

/* ==========================================================================
   Gestión de Cuentas de Administradores (Admin)
   ========================================================================== */
function adminAdministratorsView(currentUser) {
  let query = '';
  let rawAdmins = [];
  const listHolder = h('div');

  function updateAdminsView() {
    if (!rawAdmins.length) {
      listHolder.replaceChildren(empty('Aún no hay administradores registrados'));
      return;
    }
    const shown = rawAdmins.filter(u => !query ||
      [u.name, u.email, u.phone].filter(Boolean).join(' ').toLowerCase().includes(query)
    );
    if (!shown.length) {
      listHolder.replaceChildren(empty('Sin resultados', 'No encontramos administradores que coincidan con la búsqueda.'));
      return;
    }

    const toggle = (u, kind, value, ok) => async e => {
      const updated = await act(e.currentTarget, () => API.post('/admin/users/' + u.id + '/' + kind, { value }), ok);
      if (updated) {
        Object.assign(u, updated);
      } else {
        u[kind] = value;
      }
      updateAdminsView();
    };

    listHolder.replaceChildren(
      h('div', { class: 'table-wrap' }, h('table', { class: 'users' },
        h('thead', null, h('tr', null,
          h('th', null, 'Administrador'),
          h('th', null, 'Contacto Institucional'),
          h('th', null, 'Colección / Permisos'),
          h('th', null, 'Estado'),
          h('th', null, 'Acciones')
        )),
        h('tbody', null, shown.map(u => {
          const isSelf = currentUser && (currentUser.id === u.id || currentUser.email === u.email);
          return h('tr', { class: u.enabled ? '' : 'row-disabled' },
            h('td', null,
              h('div', { style: 'display: flex; align-items: center; gap: 10px;' },
                h('span', { class: 'avatar', style: 'width: 38px; height: 38px; font-weight: 700; background: var(--primary); color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center;' },
                  (u.name || 'Admin').substring(0, 2).toUpperCase()
                ),
                h('div', null,
                  h('strong', null, u.name),
                  isSelf ? h('span', { class: 'badge-pill primary small', style: 'margin-left: 6px;' }, 'Tú') : null,
                  h('span', { class: 'muted small block-line' }, 'Registrado: ' + (u.createdAt ? new Date(u.createdAt).toLocaleDateString('es-CO') : 'Sistema'))
                )
              )
            ),
            h('td', null,
              h('span', null, u.email),
              u.phone ? h('span', { class: 'muted small block-line' }, u.phone) : null
            ),
            h('td', null,
              h('span', { class: 'badge-pill primary' }, 'ADMINISTRADOR')
            ),
            h('td', null,
              u.enabled
                ? h('span', { class: 'badge-pill success' }, 'Activa')
                : h('span', { class: 'badge-pill error' }, 'Deshabilitada')
            ),
            h('td', { class: 'actions' },
              isSelf
                ? h('span', { class: 'muted small' }, 'Sesión actual')
                : (u.enabled
                    ? h('button', {
                        class: 'btn ghost small danger',
                        onclick: toggle(u, 'enabled', false, 'Administrador deshabilitado')
                      }, 'Deshabilitar')
                    : h('button', {
                        class: 'btn ghost small success',
                        onclick: toggle(u, 'enabled', true, 'Administrador rehabilitado')
                      }, 'Habilitar')
                  )
            )
          );
        }))
      )),
      fyPagination(shown.length, 1, 30, () => {})
    );
  }

  const search = h('input', {
    type: 'search',
    placeholder: 'Buscar administrador por nombre, correo o teléfono...',
    'aria-label': 'Buscar administradores',
    oninput: (e) => {
      query = e.target.value.trim().toLowerCase();
      updateAdminsView();
    }
  });

  const headerActions = h('div', { class: 'toolbar', style: 'display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 14px;' },
    h('div', { style: 'flex: 1; min-width: 260px;' }, search),
    h('button', {
      class: 'btn primary',
      style: 'font-weight: 700;',
      onclick: () => openCreateAdminModal(() => refreshAll())
    }, '+ Crear Nuevo Administrador')
  );

  const liveHolder = live(() => API.get('/admin/users?role=ADMIN'), admins => {
    rawAdmins = Array.isArray(admins) ? admins : [];
    updateAdminsView();
    return listHolder;
  });

  return h('div', { class: 'stack' }, headerActions, liveHolder);
}

function openCreateAdminModal(onCreated) {
  const nameInput = h('input', {
    type: 'text',
    required: true,
    placeholder: 'Ej: Dra. Carmen Morales',
    'aria-label': 'Nombre completo'
  });

  const emailInput = h('input', {
    type: 'email',
    required: true,
    placeholder: 'carmen.admin@farmaya.com',
    'aria-label': 'Correo electrónico institucional'
  });

  const phoneInput = h('input', {
    type: 'tel',
    required: true,
    placeholder: 'Ej: 300 123 4567',
    'aria-label': 'Teléfono de contacto'
  });

  const passwordInput = h('input', {
    type: 'password',
    required: true,
    minLength: 6,
    placeholder: 'Mínimo 6 caracteres con mayúsculas y números',
    'aria-label': 'Contraseña'
  });

  const togglePassBtn = h('button', {
    type: 'button',
    class: 'btn ghost small',
    style: 'align-self:flex-start;margin-top:4px;',
    onclick: () => {
      if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        togglePassBtn.textContent = 'Ocultar contraseña';
      } else {
        passwordInput.type = 'password';
        togglePassBtn.textContent = 'Ver contraseña';
      }
    }
  }, 'Ver contraseña');

  const errorBox = h('div', { class: 'attention', style: 'display:none;margin-top:10px;' });

  const form = h('form', {
    class: 'form-stack',
    onsubmit: async e => {
      e.preventDefault();
      errorBox.style.display = 'none';
      errorBox.textContent = '';

      const name = nameInput.value.trim();
      const email = emailInput.value.trim().toLowerCase();
      const phone = phoneInput.value.trim();
      const password = passwordInput.value;

      if (!name || name.length < 3) {
        errorBox.textContent = 'Ingresa un nombre válido (al menos 3 caracteres).';
        errorBox.style.display = 'block';
        nameInput.focus();
        return;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errorBox.textContent = 'Ingresa un correo electrónico institucional válido.';
        errorBox.style.display = 'block';
        emailInput.focus();
        return;
      }

      if (!password || password.length < 6) {
        errorBox.textContent = 'La contraseña debe contener al menos 6 caracteres.';
        errorBox.style.display = 'block';
        passwordInput.focus();
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      await act(submitBtn, async () => {
        const created = await API.post('/admin/administrators', { name, email, phone, password });
        d.close();
        toast('Administrador ' + created.name + ' guardado en la colección de administradores.');
        if (onCreated) onCreated();
      });
    }
  },
    h('div', { class: 'field' },
      h('label', { class: 'field-label' }, 'Nombre Completo:'),
      nameInput
    ),
    h('div', { class: 'field' },
      h('label', { class: 'field-label' }, 'Correo Electrónico Institucional:'),
      emailInput
    ),
    h('div', { class: 'field' },
      h('label', { class: 'field-label' }, 'Número de Teléfono:'),
      phoneInput
    ),
    h('div', { class: 'field' },
      h('label', { class: 'field-label' }, 'Contraseña de Acceso:'),
      passwordInput,
      togglePassBtn
    ),
    errorBox,
    h('div', { class: 'actions', style: 'margin-top:20px;' },
      h('button', { class: 'btn ghost', type: 'button', onclick: () => d.close() }, 'Cancelar'),
      h('button', { class: 'btn primary', type: 'submit' }, 'Guardar Administrador')
    )
  );

  const dialogContent = h('div', { class: 'sheet-body', style: 'max-width:520px;' },
    h('div', { style: 'display:flex;align-items:center;gap:12px;margin-bottom:12px;' },
      h('span', { class: 'badge tone-done', style: 'font-weight:700;padding:6px 10px;' }, 'Admin'),
      h('div', null,
        h('h3', { style: 'margin:0;' }, 'Crear Nuevo Administrador'),
        h('p', { class: 'muted small', style: 'margin:2px 0 0;' }, 'La cuenta se registrará y persistirá en la colección oficial de administradores.')
      )
    ),
    form
  );

  const d = openDialog(dialogContent);
  setTimeout(() => nameInput.focus(), 100);
}

/* ==========================================================================
   Gestión de Catálogo e Imágenes de Medicamentos (Admin)
   ========================================================================== */
function adminCatalogManager() {
  let query = '';
  let category = '';
  let catalogPage = 1;
  const PAGE_SIZE = 30;
  const holder = h('div', { class: 'stack' });

  const search = h('input', {
    type: 'search',
    placeholder: 'Buscar medicamento por nombre, componente o laboratorio...',
    'aria-label': 'Buscar medicamento',
    style: 'border: 1.5px solid var(--line);',
    oninput: () => {
      query = search.value.trim().toLowerCase();
      catalogPage = 1;
      draw();
    }
  });

  const catSelect = h('select', {
    'aria-label': 'Filtrar por categoría',
    style: 'border: 1.5px solid var(--line);',
    onchange: () => {
      category = catSelect.value;
      catalogPage = 1;
      draw();
    }
  },
    h('option', { value: '' }, 'Todas las categorías'),
    CATEGORIES.map(c => h('option', { value: c.id }, c.label))
  );

  const countPill = h('span', { class: 'product-counter-pill' }, 'Cargando catálogo...');

  const draw = () => {
    const customImages = typeof getCustomProductImages === 'function' ? getCustomProductImages() : {};
    const filtered = CATALOG.filter(p => {
      const matchCat = !category || p.cat === category;
      const searchable = [p.name, p.active, p.lab, p.presentation, p.invima].filter(Boolean).join(' ').toLowerCase();
      const matchQ = !query || searchable.includes(query);
      return matchCat && matchQ;
    });

    countPill.textContent = `${filtered.length} de ${CATALOG.length} productos`;

    if (!filtered.length) {
      holder.replaceChildren(empty('No se encontraron medicamentos', 'Prueba modificando los términos de búsqueda o agrega un nuevo producto con el botón superior.'));
      return;
    }

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (catalogPage > totalPages) catalogPage = totalPages;
    const startIdx = (catalogPage - 1) * PAGE_SIZE;
    const paged = filtered.slice(startIdx, startIdx + PAGE_SIZE);

    const tableWrap = h('div', { class: 'table-wrap stitch-admin-catalog-wrap' },
      h('table', { class: 'users admin-catalog-table' },
        h('thead', null,
          h('tr', null,
            h('th', { style: 'width:90px' }, 'Imagen'),
            h('th', null, 'Medicamento / Ficha Técnica'),
            h('th', null, 'Categoría'),
            h('th', null, 'Registro INVIMA'),
            h('th', { class: 'text-right' }, 'Precio Referencia'),
            h('th', { class: 'text-center' }, 'Acciones')
          )
        ),
        h('tbody', null, paged.map(p => {
          const imgSrc = customImages[p.id] || p.img || (typeof getProductImagePlaceholder === 'function' ? getProductImagePlaceholder(p.name, p.cat) : '');
          return h('tr', null,
            h('td', { class: 'catalog-thumb-cell' },
              h('div', { class: 'admin-prod-thumb-wrap' },
                imgSrc ? h('img', {
                  src: imgSrc,
                  alt: p.name,
                  class: 'admin-prod-thumb',
                  loading: 'lazy',
                  onerror: (e) => {
                    e.currentTarget.style.display = 'none';
                    if (e.currentTarget.nextElementSibling) e.currentTarget.nextElementSibling.style.display = 'flex';
                  }
                }) : null,
                h('div', { class: 'admin-prod-thumb-fallback', style: imgSrc ? 'display:none;' : 'display:flex;' },
                  icon('capsule')
                )
              )
            ),
            h('td', null,
              h('div', { class: 'prod-title-line' },
                h('strong', { class: 'prod-name' }, p.name),
                p.rx ? h('span', { class: 'tag tone-amber rx-mini-pill', title: 'Requiere Fórmula Médica' }, 'Rx') : null
              ),
              p.active ? h('span', { class: 'prod-active muted small block-line' }, p.active) : null,
              h('span', { class: 'prod-meta muted small block-line' },
                [p.presentation, p.lab].filter(Boolean).join(' • ')
              )
            ),
            h('td', null,
              h('span', { class: 'tag tone-teal cat-tag' },
                (CATEGORIES.find(c => c.id === p.cat) || {}).label || p.cat
              )
            ),
            h('td', null,
              h('span', { class: 'invima-pill' }, p.invima || 'Trámite INVIMA')
            ),
            h('td', { class: 'text-right font-bold price-cell' },
              money(p.price)
            ),
            h('td', { class: 'text-center actions-cell' },
              h('div', { class: 'btn-group-mini' },
                h('button', {
                  type: 'button',
                  class: 'btn secondary small icon-only',
                  title: 'Cambiar imagen del producto',
                  onclick: () => openProductImageModal(p, () => draw())
                }, icon('pencil')),
                h('button', {
                  type: 'button',
                  class: 'btn secondary small icon-only',
                  title: 'Editar información del medicamento',
                  onclick: () => openAdminProductModal(p, () => draw())
                }, icon('settings'))
              )
            )
          );
        }))
      )
    );

    holder.replaceChildren(
      tableWrap,
      fyPagination(filtered.length, catalogPage, PAGE_SIZE, (p) => {
        catalogPage = p;
        draw();
      })
    );
  };

  const addBtn = h('button', {
    class: 'btn primary btn-create-prod',
    type: 'button',
    onclick: () => openAdminProductModal(null, () => draw())
  }, icon('package'), h('span', null, 'Nuevo Medicamento'));

  const toolbar = h('div', { class: 'catalog-manager-toolbar' },
    h('div', { class: 'catalog-search-wrap' }, search),
    catSelect,
    countPill,
    addBtn
  );

  draw();
  return h('div', { class: 'stack admin-catalog-root' }, toolbar, holder);
}

function openAdminProductModal(p, onSaved) {
  const isEditing = !!p;
  const customImages = typeof getCustomProductImages === 'function' ? getCustomProductImages() : {};
  let currentImageUrl = (p && (p.imageUrl || customImages[p.name])) || '';

  const nameInput = h('input', {
    type: 'text',
    required: true,
    value: p ? p.name : '',
    placeholder: 'Ej: Ibuprofeno 800 mg',
    'aria-label': 'Nombre del producto'
  });

  const catSelect = h('select', {
    required: true,
    'aria-label': 'Categoría'
  },
    CATEGORIES.map(c => h('option', { value: c.id, selected: p && p.cat === c.id }, c.label))
  );

  const priceInput = h('input', {
    type: 'number',
    required: true,
    min: 100,
    step: 100,
    value: p ? p.price : '',
    placeholder: 'Ej: 14500',
    'aria-label': 'Precio sugerido en pesos colombianos'
  });

  const labInput = h('input', {
    type: 'text',
    value: p && p.lab ? p.lab : '',
    placeholder: 'Ej: MK (Tecnoquímicas), Genfar, Bayer',
    'aria-label': 'Laboratorio farmacéutico'
  });

  const presInput = h('input', {
    type: 'text',
    value: p && p.presentation ? p.presentation : '',
    placeholder: 'Ej: Caja x 30 tabletas recubiertas, Frasco x 350 ml',
    'aria-label': 'Presentación comercial'
  });

  const invimaInput = h('input', {
    type: 'text',
    value: p && p.invima ? p.invima : '',
    placeholder: 'Ej: INVIMA 2021M-0012345-R1',
    'aria-label': 'Registro sanitario INVIMA'
  });

  const activeInput = h('input', {
    type: 'text',
    value: p && p.active ? p.active : '',
    placeholder: 'Ej: Ibuprofeno 800 mg, Acetaminofén 500 mg',
    'aria-label': 'Principio activo'
  });

  const indInput = h('textarea', {
    rows: 2,
    placeholder: 'Ej: Alivio de dolores intensos, antiinflamatorio no esteroideo...',
    'aria-label': 'Indicación terapéutica'
  }, p && p.indication ? p.indication : '');

  const storInput = h('input', {
    type: 'text',
    value: p && p.storage ? p.storage : 'Temperatura ambiente controlada (15°C - 25°C)',
    placeholder: 'Condiciones de conservación recomendadas',
    'aria-label': 'Conservación'
  });

  const rxCheckbox = h('input', {
    type: 'checkbox',
    id: 'modal_rx_check',
    checked: p ? !!p.rx : false
  });

  const featCheckbox = h('input', {
    type: 'checkbox',
    id: 'modal_feat_check',
    checked: p ? !!p.featured : false
  });

  // Sección de imagen en vivo
  const previewBox = h('div', { class: 'image-modal-preview' });
  const updateImagePreview = url => {
    currentImageUrl = url;
    if (url) {
      previewBox.innerHTML = '<img src="' + url + '" alt="Vista previa" class="admin-preview-img" style="max-height:100px;" />';
    } else {
      previewBox.replaceChildren(productArt(p || { art: 'box', color: '#16865d', name: nameInput.value || 'Medicamento' }));
    }
  };
  updateImagePreview(currentImageUrl);

  const imgUrlInput = h('input', {
    type: 'url',
    placeholder: 'https://ejemplo.com/fotos/producto.jpg',
    value: currentImageUrl && !currentImageUrl.startsWith('data:') ? currentImageUrl : '',
    oninput: () => updateImagePreview(imgUrlInput.value.trim())
  });

  const fileInput = h('input', {
    type: 'file',
    accept: 'image/*',
    style: 'display:none',
    onchange: e => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      if (file.size > 4 * 1024 * 1024) {
        toast('La fotografía no debe superar 4MB', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = ev => {
        imgUrlInput.value = '';
        updateImagePreview(ev.target.result);
      };
      reader.readAsDataURL(file);
    }
  });

  const uploadBtn = h('button', {
    class: 'btn secondary small',
    type: 'button',
    onclick: () => fileInput.click()
  }, 'Subir foto desde archivo');

  // Presets rápidos
  const presets = [
    { label: 'Cápsulas blandas', url: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=360&auto=format&fit=crop&q=80' },
    { label: 'Caja tabletas', url: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=360&auto=format&fit=crop&q=80' },
    { label: 'Jarabe', url: 'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=360&auto=format&fit=crop&q=80' },
    { label: 'Crema / Pomada', url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=360&auto=format&fit=crop&q=80' }
  ];

  const presetRow = h('div', { class: 'preset-pills-row' },
    presets.map(item => h('button', {
      type: 'button',
      class: 'btn ghost small preset-pill-btn',
      onclick: () => {
        imgUrlInput.value = item.url;
        updateImagePreview(item.url);
      }
    }, item.label))
  );

  const errorBox = h('div', { class: 'attention', style: 'display:none;margin-top:10px;' });

  const form = h('form', {
    class: 'form-stack',
    onsubmit: async e => {
      e.preventDefault();
      errorBox.style.display = 'none';

      const name = nameInput.value.trim();
      const cat = catSelect.value;
      const price = parseFloat(priceInput.value);

      if (!name) {
        errorBox.textContent = 'El nombre del producto es obligatorio.';
        errorBox.style.display = 'block';
        nameInput.focus();
        return;
      }

      if (!price || price <= 0) {
        errorBox.textContent = 'Ingresa un precio sugerido válido mayor a 0.';
        errorBox.style.display = 'block';
        priceInput.focus();
        return;
      }

      const payload = {
        name,
        cat,
        price,
        lab: labInput.value.trim(),
        presentation: presInput.value.trim(),
        invima: invimaInput.value.trim(),
        active: activeInput.value.trim(),
        indication: indInput.value.trim(),
        storage: storInput.value.trim(),
        rx: rxCheckbox.checked,
        featured: featCheckbox.checked,
        imageUrl: currentImageUrl || null,
        art: (p && p.art) || (cat === 'vital' ? 'bottle' : cat === 'derm' || cat === 'care' ? 'jar' : 'box'),
        color: (p && p.color) || '#16865d'
      };

      const submitBtn = form.querySelector('button[type="submit"]');
      await act(submitBtn, async () => {
        if (isEditing) {
          // Actualización de producto existente
          const updateId = p.id || encodeURIComponent(p.name);
          const oldName = p.name;
          try {
            const updated = await API.put('/products/' + updateId, payload);
            Object.assign(p, updated);
          } catch (err) {
            // Si el backend aún no tenía este producto en base de datos, lo creamos
            const created = await API.post('/products', payload);
            Object.assign(p, created);
          }

          if (typeof saveProductImage === 'function') {
            if (oldName && oldName !== payload.name) {
              saveProductImage(oldName, null);
            }
            saveProductImage(payload.name, payload.imageUrl);
          }

          toast(`Producto "${payload.name}" actualizado exitosamente.`);
        } else {
          // Creación de nuevo producto
          const created = await API.post('/products', payload);
          const fullProduct = Object.assign({
            id: created.id,
            ...payload
          }, created);

          CATALOG.unshift(fullProduct);

          if (payload.imageUrl && typeof saveProductImage === 'function') {
            saveProductImage(fullProduct.name, payload.imageUrl);
          }

          toast(`Producto "${payload.name}" ingresado exitosamente al catálogo.`);
        }

        window.dispatchEvent(new CustomEvent('farmaya:catalog-refresh'));
        d.close();
        if (onSaved) onSaved();
      });
    }
  },
    h('div', { class: 'product-form-grid' },
      h('div', { class: 'field' },
        h('label', { class: 'field-label' }, 'Nombre Comercial del Producto:'),
        nameInput
      ),
      h('div', { class: 'field' },
        h('label', { class: 'field-label' }, 'Categoría:'),
        catSelect
      ),
      h('div', { class: 'field' },
        h('label', { class: 'field-label' }, 'Precio Sugerido (COP):'),
        priceInput
      ),
      h('div', { class: 'field' },
        h('label', { class: 'field-label' }, 'Laboratorio Farmacéutico:'),
        labInput
      ),
      h('div', { class: 'field' },
        h('label', { class: 'field-label' }, 'Presentación Comercial:'),
        presInput
      ),
      h('div', { class: 'field' },
        h('label', { class: 'field-label' }, 'Registro Sanitario INVIMA:'),
        invimaInput
      ),
      h('div', { class: 'field full-width' },
        h('label', { class: 'field-label' }, 'Principio Activo y Concentración:'),
        activeInput
      ),
      h('div', { class: 'field full-width' },
        h('label', { class: 'field-label' }, 'Indicación Terapéutica:'),
        indInput
      ),
      h('div', { class: 'field full-width' },
        h('label', { class: 'field-label' }, 'Condiciones de Conservación:'),
        storInput
      ),
      h('div', { class: 'field full-width' },
        h('div', { class: 'product-form-switches' },
          h('label', null,
            rxCheckbox,
            h('span', null, 'Requiere Fórmula Médica Obligatoria (Rx)')
          ),
          h('label', null,
            featCheckbox,
            h('span', null, 'Destacado en pantalla de inicio')
          )
        )
      ),
      // Módulo de imagen
      h('div', { class: 'field full-width', style: 'margin-top:10px;' },
        h('label', { class: 'field-label', style: 'font-weight:700;' }, 'Fotografía del Producto:'),
        h('div', { class: 'image-modal-grid', style: 'margin:8px 0;' },
          h('div', { class: 'image-modal-preview-box', style: 'min-height:120px;' },
            h('span', { class: 'small muted', style: 'margin-bottom:6px;' }, 'Previsualización:'),
            previewBox
          ),
          h('div', { class: 'form-stack' },
            uploadBtn,
            fileInput,
            h('div', { style: 'margin-top:8px;' },
              h('span', { class: 'small muted' }, 'O escribe la URL directa:'),
              imgUrlInput
            ),
            h('div', { style: 'margin-top:8px;' },
              h('span', { class: 'small muted' }, 'Fotos sugeridas rápidas:'),
              presetRow
            )
          )
        )
      )
    ),
    errorBox,
    h('div', { class: 'actions', style: 'margin-top:20px;' },
      h('button', { class: 'btn ghost', type: 'button', onclick: () => d.close() }, 'Cancelar'),
      isEditing && h('button', {
        class: 'btn danger-ghost',
        type: 'button',
        onclick: async () => {
          const ok = await confirmBox({
            title: 'Eliminar producto',
            message: `¿Estás seguro de que deseas eliminar permanentemente "${p.name}" del catálogo institucional y de la base de datos?`,
            ok: 'Eliminar permanentemente',
            danger: true
          });
          if (!ok) return;

          try {
            const targetId = p.id || encodeURIComponent(p.name);
            await API.delete('/products/' + targetId);
          } catch (err) {
            console.debug('Error deleting product from backend:', err);
          }

          const idx = CATALOG.findIndex(item => item === p || (p.id && item.id === p.id) || norm(item.name) === norm(p.name));
          if (idx >= 0) CATALOG.splice(idx, 1);
          if (typeof saveProductImage === 'function') saveProductImage(p.name, null);

          toast(`Producto "${p.name}" eliminado del catálogo.`);
          window.dispatchEvent(new CustomEvent('farmaya:catalog-refresh'));
          d.close();
          if (onSaved) onSaved();
        }
      }, 'Eliminar Producto'),
      h('button', { class: 'btn primary', type: 'submit' }, isEditing ? 'Guardar Cambios' : 'Ingresar al Catálogo')
    )
  );

  const dialogContent = h('div', { class: 'sheet-body product-edit-sheet' },
    h('div', { style: 'display:flex;align-items:center;gap:12px;margin-bottom:12px;' },
      h('span', { class: 'badge tone-teal', style: 'font-weight:700;padding:6px 10px;' }, isEditing ? 'Edición' : 'Catálogo'),
      h('div', null,
        h('h3', { style: 'margin:0;' }, isEditing ? `Editar Producto: ${p.name}` : 'Ingresar Nuevo Producto al Catálogo'),
        h('p', { class: 'muted small', style: 'margin:2px 0 0;' }, 'Los cambios se persistirán en la base de datos y se sincronizarán con los clientes.')
      )
    ),
    form
  );

  const d = openDialog(dialogContent, { wide: true });
  setTimeout(() => nameInput.focus(), 100);
}

function openProductImageModal(p, onSaved) {
  const customImages = typeof getCustomProductImages === 'function' ? getCustomProductImages() : {};
  let selectedUrl = p.imageUrl || customImages[p.name] || '';
  const previewImg = h('div', { class: 'image-modal-preview' });

  const updatePreview = url => {
    selectedUrl = url;
    if (url) {
      previewImg.innerHTML = '<img src="' + url + '" alt="Vista previa" class="admin-preview-img" />';
    } else {
      previewImg.replaceChildren(productArt(p));
    }
  };

  updatePreview(selectedUrl);

  const urlInput = h('input', {
    type: 'url',
    placeholder: 'https://ejemplo.com/imagenes/medicamento.jpg',
    value: selectedUrl && !selectedUrl.startsWith('data:') ? selectedUrl : '',
    oninput: () => updatePreview(urlInput.value.trim())
  });

  const fileInput = h('input', {
    type: 'file',
    accept: 'image/*',
    style: 'display:none',
    onchange: e => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      if (file.size > 4 * 1024 * 1024) {
        toast('La imagen no debe superar 4MB', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = ev => {
        const dataUrl = ev.target.result;
        urlInput.value = '';
        updatePreview(dataUrl);
      };
      reader.readAsDataURL(file);
    }
  });

  const uploadBtn = h('button', {
    class: 'btn secondary',
    type: 'button',
    onclick: () => fileInput.click()
  }, 'Subir foto desde archivo');

  // Galería de fotos médicas preconfiguradas
  const presets = [
    { label: 'Cápsulas blandas', url: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=360&auto=format&fit=crop&q=80' },
    { label: 'Caja de tabletas', url: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=360&auto=format&fit=crop&q=80' },
    { label: 'Frasco jarabe', url: 'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=360&auto=format&fit=crop&q=80' },
    { label: 'Crema / Ungüento', url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=360&auto=format&fit=crop&q=80' },
    { label: 'Suero oral', url: 'https://images.unsplash.com/photo-1559757175-5700dde675bc?w=360&auto=format&fit=crop&q=80' },
    { label: 'Vitamina C efervescente', url: 'https://images.unsplash.com/photo-1576602976047-174e57a47881?w=360&auto=format&fit=crop&q=80' }
  ];

  const presetList = h('div', { class: 'preset-pills-row' },
    presets.map(item => h('button', {
      type: 'button',
      class: 'btn ghost small preset-pill-btn',
      onclick: () => {
        urlInput.value = item.url;
        updatePreview(item.url);
      }
    }, item.label))
  );

  const content = h('div', { class: 'sheet-body image-edit-sheet' },
    h('h3', null, 'Asignar Imagen a ' + p.name),
    h('p', { class: 'muted small' }, 'Sube una fotografía de empaque oficial o ingresa una dirección web. Esta imagen se visualizará en el catálogo para los pacientes.'),
    h('div', { class: 'image-modal-grid' },
      h('div', { class: 'image-modal-preview-box' },
        h('strong', { class: 'small muted block-line', style: 'margin-bottom:8px;' }, 'Vista previa actual:'),
        previewImg
      ),
      h('div', { class: 'image-modal-controls-box form-stack' },
        h('div', { class: 'field' },
          h('label', { class: 'field-label' }, 'Opción 1: Cargar desde tu archivo local'),
          uploadBtn,
          fileInput
        ),
        h('div', { class: 'field' },
          h('label', { class: 'field-label' }, 'Opción 2: O escribe la URL directa de la imagen'),
          urlInput
        ),
        h('div', { class: 'field' },
          h('label', { class: 'field-label' }, 'Opción 3: Fotos de referencia rápida'),
          presetList
        )
      )
    ),
    h('div', { class: 'actions' },
      h('button', { class: 'btn ghost', type: 'button', onclick: () => d.close() }, 'Cancelar'),
      selectedUrl && h('button', {
        class: 'btn danger-ghost',
        type: 'button',
        onclick: async () => {
          saveProductImage(p.name, null);
          p.imageUrl = null;
          try {
            const targetId = p.id || encodeURIComponent(p.name);
            await API.put('/products/' + targetId, { imageUrl: '' });
          } catch (_) {}
          d.close();
          toast('Se restableció la ilustración');
          window.dispatchEvent(new CustomEvent('farmaya:catalog-refresh'));
          if (onSaved) onSaved();
        }
      }, 'Quitar foto'),
      h('button', {
        class: 'btn primary',
        type: 'button',
        onclick: async () => {
          if (!selectedUrl) {
            toast('Por favor selecciona o sube una imagen', 'error');
            return;
          }
          saveProductImage(p.name, selectedUrl);
          p.imageUrl = selectedUrl;
          try {
            const targetId = p.id || encodeURIComponent(p.name);
            await API.put('/products/' + targetId, { imageUrl: selectedUrl });
          } catch (_) {}
          d.close();
          toast('Foto de ' + p.name + ' guardada exitosamente.');
          window.dispatchEvent(new CustomEvent('farmaya:catalog-refresh'));
          if (onSaved) onSaved();
        }
      }, 'Guardar Imagen')
    )
  );

  const d = openDialog(content, { wide: true });
}


/* =====================================================================
   MÓDULO DE DESEMBOLSOS Y LIQUIDACIONES A FARMACIAS ALIADAS (95% NETO)
   ===================================================================== */

function renderDisbursementReceiptModal(d) {
  const content = h('div', { class: 'receipt-modal-content', style: 'padding:14px 8px; font-family:system-ui, -apple-system, sans-serif;' },
    // Cabecera institucional FarmaYA
    h('div', { style: 'text-align:center; padding-bottom:16px; border-bottom:2px dashed #cbd5e1; margin-bottom:18px;' },
      h('div', { style: 'display:inline-flex; align-items:center; gap:8px; margin-bottom:6px;' },
        h('span', { style: 'font-weight:900; font-size:24px; color:var(--primary); letter-spacing:-0.5px;' }, 'Farma'),
        h('span', { style: 'font-weight:900; font-size:24px; color:var(--teal); letter-spacing:-0.5px;' }, 'YA')
      ),
      h('h2', { style: 'margin:4px 0 2px; font-size:18px; color:#0f172a; text-transform:uppercase; letter-spacing:0.5px;' }, 'Comprobante Oficial de Liquidación'),
      h('p', { class: 'muted', style: 'font-size:12px; margin:0;' }, 'FarmaYA S.A.S. · NIT 901.849.201-4 · Pasarela Bancaria Wompi'),
      h('div', { style: 'display:inline-block; margin-top:8px; background:#ecfdf5; border:1px solid #a7f3d0; color:#065f46; font-size:12px; font-weight:700; padding:4px 14px; border-radius:999px;' },
        'DESEMBOLSO BANCARIO COMPLETADO (95% DE VENTAS)'
      )
    ),

    // Datos drogueria y cuenta de abono
    h('div', { style: 'display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:18px; font-size:13px;' },
      h('div', { style: 'background:#f8fafc; padding:12px 14px; border-radius:8px; border:1px solid #e2e8f0;' },
        h('strong', { style: 'display:block; color:#64748b; font-size:11px; text-transform:uppercase; margin-bottom:4px;' }, 'Droguería Beneficiaria'),
        h('div', { style: 'font-weight:700; color:#0f172a; font-size:14.5px;' }, d.pharmacyName || 'Farmacia Aliada'),
        h('div', { class: 'muted', style: 'font-size:12px; margin-top:3px;' }, 'Ciudad: ' + (d.pharmacyCity || 'Nacional')),
        h('div', { class: 'muted', style: 'font-size:12px;' }, 'Tel: ' + (d.pharmacyPhone || '-')),
        h('div', { class: 'muted', style: 'font-size:12px;' }, 'Correo: ' + (d.pharmacyEmail || '-'))
      ),
      h('div', { style: 'background:#f8fafc; padding:12px 14px; border-radius:8px; border:1px solid #e2e8f0;' },
        h('strong', { style: 'display:block; color:#64748b; font-size:11px; text-transform:uppercase; margin-bottom:4px;' }, 'Cuenta Bancaria de Abono'),
        h('div', { style: 'font-weight:700; color:#0f172a; font-size:14px;' }, (d.bankName || 'Bancolombia') + ' · ' + (d.accountType || 'Ahorros')),
        h('div', { style: 'font-family:monospace; font-size:13px; font-weight:700; color:#0369a1; margin:3px 0;' }, 'N°: ' + (d.accountNumber || '-')),
        h('div', { class: 'muted', style: 'font-size:12px;' }, 'Titular: ' + (d.accountHolder || '-')),
        d.accountDocNumber ? h('div', { class: 'muted', style: 'font-size:12px;' }, 'NIT / C.C.: ' + d.accountDocNumber) : null
      )
    ),

    // Metadatos de la transaccion
    h('div', { style: 'display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; margin-bottom:18px; font-size:12px; background:#f1f5f9; padding:10px 14px; border-radius:8px;' },
      h('div', null, h('span', { class: 'muted', style: 'display:block;' }, 'Código Liquidación:'), h('strong', { style: 'font-family:monospace;' }, d.code || '-')),
      h('div', null, h('span', { class: 'muted', style: 'display:block;' }, 'Comprobante / Ref:'), h('strong', { style: 'font-family:monospace; color:#0a5ca8;' }, d.reference || '-')),
      h('div', null, h('span', { class: 'muted', style: 'display:block;' }, 'Fecha y Hora:'), h('strong', null, d.createdAt ? new Date(d.createdAt).toLocaleString('es-CO') : '-'))
    ),

    // Desglose contable
    h('div', { style: 'border:1px solid #e2e8f0; border-radius:8px; overflow:hidden; margin-bottom:20px;' },
      h('table', { style: 'width:100%; border-collapse:collapse; font-size:13px;' },
        h('tbody', null,
          h('tr', { style: 'border-bottom:1px solid #f1f5f9;' },
            h('td', { style: 'padding:10px 14px;' }, 'Ventas brutas de medicamentos (' + (d.orderCount || (d.orderCodes ? d.orderCodes.length : 1)) + ' pedidos entregados)'),
            h('td', { style: 'padding:10px 14px; text-align:right; font-weight:600;' }, money(d.grossTotal || 0))
          ),
          h('tr', { style: 'border-bottom:1px solid #f1f5f9; color:#991b1b; background:#fef2f2;' },
            h('td', { style: 'padding:10px 14px;' }, 'Retención por servicio tecnológico FarmaYA (5.0%)'),
            h('td', { style: 'padding:10px 14px; text-align:right; font-weight:700;' }, '- ' + money(d.platformEarnings || Math.round((d.grossTotal || 0) * 0.05)))
          ),
          h('tr', { style: 'background:#f0fdf4; font-size:15px;' },
            h('td', { style: 'padding:12px 14px; font-weight:800; color:#166534;' }, 'MONTO NETO TRANSFERIDO (95.0%)'),
            h('td', { style: 'padding:12px 14px; text-align:right; font-weight:900; color:#166534;' }, money(d.netAmount || 0) + ' COP')
          )
        )
      )
    ),

    d.notes ? h('p', { class: 'muted small', style: 'margin:0 0 16px; font-style:italic;' }, 'Notas: ' + d.notes) : null,

    // Acciones
    h('div', { style: 'display:flex; justify-content:space-between; align-items:center;' },
      h('button', {
        class: 'btn secondary',
        type: 'button',
        onclick: () => dialog.close()
      }, 'Cerrar'),
      h('button', {
        class: 'btn primary',
        type: 'button',
        onclick: () => window.print()
      }, 'Imprimir Comprobante')
    )
  );

  const dialog = openDialog(content, { wide: true });
}

function openDisbursementActionModal(ph, onSuccess) {
  const refInput = h('input', {
    type: 'text',
    value: 'ACH-' + Math.floor(100000 + Math.random() * 900000),
    placeholder: 'Ej. ACH-482910 o TRANS-1294',
    required: true
  });

  const methodSelect = h('select', null,
    h('option', { value: 'TRANSFERENCIA_BANCARIA' }, 'Transferencia Bancaria ACH (Bancolombia Empresas / PSE)'),
    h('option', { value: 'WOMPI_PAYOUT' }, 'Dispersión Automática Wompi Payouts'),
    h('option', { value: 'NEQUI_EMPRESAS' }, 'Nequi / Daviplata Negocios')
  );

  const notesInput = h('input', {
    type: 'text',
    value: 'Liquidación de ' + ph.pendingOrdersCount + ' pedidos entregados (95% neto)',
    placeholder: 'Notas u observaciones contables'
  });

  const content = h('div', { style: 'padding:10px 4px;' },
    h('h3', { style: 'margin:0 0 6px;' }, 'Desembolsar Saldo a Farmacia'),
    h('p', { class: 'muted small', style: 'margin:0 0 16px;' }, 'Transfiere el valor neto de las ventas (95%) a la cuenta bancaria de la droguería aliada.'),

    // Ficha de cuenta destino
    h('div', { style: 'background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px; margin-bottom:16px;' },
      h('div', { style: 'display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;' },
        h('div', null,
          h('strong', { style: 'font-size:14px; color:#0f172a;' }, ph.pharmacyName),
          h('span', { class: 'muted small block-line' }, (ph.city || 'Nacional') + ' · ' + (ph.phone || ''))
        ),
        h('span', { class: 'tag tone-teal', style: 'font-weight:700;' }, ph.pendingOrdersCount + ' pedidos listos')
      ),
      h('div', { style: 'display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:12.5px; border-top:1px dashed #cbd5e1; padding-top:8px;' },
        h('div', null, h('span', { class: 'muted' }, 'Banco: '), h('strong', null, ph.bankName || 'Bancolombia')),
        h('div', null, h('span', { class: 'muted' }, 'Tipo de Cuenta: '), h('strong', null, ph.accountType || 'Ahorros')),
        h('div', null, h('span', { class: 'muted' }, 'N° Cuenta: '), h('strong', { style: 'font-family:monospace; color:#0284c7;' }, ph.accountNumber || '-')),
        h('div', null, h('span', { class: 'muted' }, 'Titular: '), h('strong', null, ph.accountHolder || ph.pharmacyName))
      )
    ),

    // Resumen financiero
    h('div', { style: 'background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:12px; margin-bottom:18px;' },
      h('div', { style: 'display:flex; justify-content:space-between; font-size:13px; margin-bottom:4px;' },
        h('span', null, 'Ventas Brutas de Medicamentos:'),
        h('strong', null, money(ph.grossTotal))
      ),
      h('div', { style: 'display:flex; justify-content:space-between; font-size:13px; margin-bottom:6px; color:#991b1b;' },
        h('span', null, 'Retención Comisión FarmaYA (5.0%):'),
        h('strong', null, '- ' + money(ph.platformEarnings))
      ),
      h('div', { style: 'display:flex; justify-content:space-between; font-size:15px; font-weight:800; color:#166534; border-top:1px solid #bbf7d0; padding-top:6px;' },
        h('span', null, 'VALOR NETO A TRANSFERIR (95%):'),
        h('span', null, money(ph.netPayable) + ' COP')
      )
    ),

    // Formulario de datos de transferencia
    h('div', { class: 'form-stack' },
      field('Medio o Canal de Desembolso', methodSelect),
      field('N° de Comprobante / Referencia Bancaria (Aprobación)', refInput, 'Identificador emitido por Bancolombia, Wompi o tu portal bancario.'),
      field('Concepto / Notas', notesInput)
    ),

    // Botones
    h('div', { class: 'actions', style: 'margin-top:20px; display:flex; justify-content:flex-end; gap:10px;' },
      h('button', {
        class: 'btn secondary',
        type: 'button',
        onclick: () => modal.close()
      }, 'Cancelar'),
      h('button', {
        class: 'btn primary',
        type: 'button',
        onclick: async () => {
          if (!refInput.value.trim()) {
            toast('Ingresa la referencia o comprobante bancario', 'error');
            return;
          }
          try {
            const payload = {
              pharmacyId: ph.pharmacyId,
              orderIds: ph.orderIds,
              reference: refInput.value.trim(),
              method: methodSelect.value,
              notes: notesInput.value.trim()
            };
            const result = await API.post('/admin/disbursements', payload);
            toast('Desembolso registrado con éxito.', 'success');
            modal.close();
            if (onSuccess) onSuccess();
            renderDisbursementReceiptModal(result);
          } catch (err) {
            toast(err.message || 'Error al ejecutar desembolso', 'error');
          }
        }
      }, 'Confirmar y Enviar Transferencia')
    )
  );

  const modal = openDialog(content, { wide: true });
}

function adminDisbursementsView() {
  const container = h('div', { class: 'stack admin-disbursements-root' });

  let activeTab = 'PENDING'; // 'PENDING' | 'HISTORY'
  let pendingSearch = '';
  let pendingPage = 1;
  let historySearch = '';
  let historyPage = 1;
  const PAGE_SIZE = 30;

  const draw = async () => {
    container.innerHTML = '<div class="p-6 text-center muted"><span class="spinner"></span> Cargando módulo de desembolsos...</div>';
    try {
      const [pendingList, historyList] = await Promise.all([
        API.get('/admin/disbursements/pending'),
        API.get('/admin/disbursements')
      ]);

      const totalPendingNet = pendingList.reduce((acc, p) => acc + (p.netPayable || 0), 0);
      const totalHistoricNet = historyList.reduce((acc, d) => acc + (d.netAmount || 0), 0);

      // Recuadro Superior Destacado (Hero Card)
      const header = h('div', { class: 'disbursement-hero-banner' },
        h('div', { class: 'disbursement-hero-left' },
          h('div', { class: 'disbursement-hero-icon-box' },
            icon('wallet')
          ),
          h('div', { class: 'disbursement-hero-details' },
            h('h1', { class: 'disbursement-hero-title' }, 'Desembolsos & Liquidaciones a Farmacias Aliadas'),
            h('p', { class: 'disbursement-hero-subtitle' }, 'Gestión central de dispersión de fondos Wompi a cuentas bancarias de las droguerías aliadas.'),
            h('div', { class: 'disbursement-hero-chips' },
              h('span', { class: 'disbursement-pill pill-amber' }, '95.0% Aliados en Ventas'),
              h('span', { class: 'disbursement-pill pill-blue' }, '5.0% Tarifa FarmaYA'),
              h('span', { class: 'disbursement-pill pill-green' }, 'Dispersión ACH / Wompi')
            )
          )
        ),
        h('div', { class: 'disbursement-hero-right' },
          h('div', { class: 'disbursement-status-badge' },
            h('span', { class: 'disbursement-status-dot' }),
            h('span', null, 'Cortes de Pago en Línea')
          )
        )
      );

      // Recuadros de Métricas Financieras (KPI Cards con Borde, Fondo y Acentos)
      const kpis = h('div', { class: 'disbursement-kpis-grid' },
        // Recuadro 1: Saldo Pendiente 95%
        h('div', { class: 'disbursement-kpi-card accent-amber' },
          h('div', { class: 'disbursement-kpi-head' },
            h('div', { class: 'disbursement-kpi-label-group' },
              icon('wallet', 'muted'),
              h('span', { class: 'disbursement-kpi-label' }, 'Saldo Total Pendiente por Desembolsar')
            ),
            h('span', { class: 'disbursement-kpi-badge badge-amber' }, '95.0% Aliados')
          ),
          h('div', { class: 'disbursement-kpi-amount-row' },
            h('span', { class: 'disbursement-kpi-amount text-amber' }, money(totalPendingNet)),
            h('span', { class: 'disbursement-kpi-currency' }, 'COP')
          ),
          h('div', { class: 'disbursement-kpi-footer' },
            icon('building', 'muted'),
            h('span', null, pendingList.length + ' droguerías aliadas en espera de transferencia bancaria')
          )
        ),

        // Recuadro 2: Total Desembolsado Histórico
        h('div', { class: 'disbursement-kpi-card accent-green' },
          h('div', { class: 'disbursement-kpi-head' },
            h('div', { class: 'disbursement-kpi-label-group' },
              icon('check', 'muted'),
              h('span', { class: 'disbursement-kpi-label' }, 'Total Desembolsado Histórico')
            ),
            h('span', { class: 'disbursement-kpi-badge badge-green' }, 'Transferido')
          ),
          h('div', { class: 'disbursement-kpi-amount-row' },
            h('span', { class: 'disbursement-kpi-amount text-green' }, money(totalHistoricNet)),
            h('span', { class: 'disbursement-kpi-currency' }, 'COP')
          ),
          h('div', { class: 'disbursement-kpi-footer' },
            icon('shield', 'muted'),
            h('span', null, historyList.length + ' transferencias bancarias conciliadas con comprobante')
          )
        ),

        // Recuadro 3: Comisión FarmaYA Retenida (5%)
        h('div', { class: 'disbursement-kpi-card accent-blue' },
          h('div', { class: 'disbursement-kpi-head' },
            h('div', { class: 'disbursement-kpi-label-group' },
              icon('package', 'muted'),
              h('span', { class: 'disbursement-kpi-label' }, 'Tarifa FarmaYA Retenida (5%)')
            ),
            h('span', { class: 'disbursement-kpi-badge badge-blue' }, '5.0% Plataforma')
          ),
          h('div', { class: 'disbursement-kpi-amount-row' },
            h('span', { class: 'disbursement-kpi-amount text-blue' }, money(Math.round(totalPendingNet * (5.0 / 95.0)))),
            h('span', { class: 'disbursement-kpi-currency' }, 'COP')
          ),
          h('div', { class: 'disbursement-kpi-footer' },
            icon('capsule', 'muted'),
            h('span', null, 'Retención legal automática por intermediación y catálogo FarmaYA')
          )
        )
      );

      // Botones selectores de pestaña
      const tabs = h('div', { class: 'tabs-row', style: 'display:flex; gap:10px; margin-bottom:16px;' },
        h('button', {
          class: 'btn ' + (activeTab === 'PENDING' ? 'primary' : 'secondary'),
          type: 'button',
          onclick: () => { activeTab = 'PENDING'; renderTabContent(); }
        }, 'Saldos Pendientes por Desembolsar (' + pendingList.length + ')'),
        h('button', {
          class: 'btn ' + (activeTab === 'HISTORY' ? 'primary' : 'secondary'),
          type: 'button',
          onclick: () => { activeTab = 'HISTORY'; renderTabContent(); }
        }, 'Historial de Desembolsos Realizados (' + historyList.length + ')')
      );

      const tabContainer = h('div', { class: 'disbursements-tab-body' });

      // --- PESTAÑA 1: SALDOS PENDIENTES ---
      const pendingBadge = h('span', { class: 'disbursement-table-badge' });
      const pendingInput = h('input', {
        type: 'search',
        class: 'disbursement-search-input',
        placeholder: 'Buscar farmacia por nombre, ciudad, banco, cuenta o NIT...',
        value: pendingSearch
      });
      const pendingResultsHolder = h('div', { class: 'disbursement-results-holder' });
      const pendingPaginationHolder = h('div', { class: 'disbursement-pagination-holder' });

      function updatePendingView() {
        const q = pendingSearch.toLowerCase().trim();
        const filteredPending = pendingList.filter(ph => {
          if (!q) return true;
          return (ph.pharmacyName || '').toLowerCase().includes(q) ||
                 (ph.city || '').toLowerCase().includes(q) ||
                 (ph.bankName || '').toLowerCase().includes(q) ||
                 (ph.accountNumber || '').toLowerCase().includes(q) ||
                 (ph.accountHolder || '').toLowerCase().includes(q) ||
                 (ph.accountDocNumber || '').toLowerCase().includes(q) ||
                 (ph.phone || '').toLowerCase().includes(q);
        });

        pendingBadge.textContent = filteredPending.length + ' aliadas';

        const totalPages = Math.max(1, Math.ceil(filteredPending.length / PAGE_SIZE));
        if (pendingPage > totalPages) pendingPage = totalPages;
        const startIdx = (pendingPage - 1) * PAGE_SIZE;
        const pagedPending = filteredPending.slice(startIdx, startIdx + PAGE_SIZE);

        if (!pagedPending.length) {
          pendingResultsHolder.replaceChildren(empty('No se encontraron farmacias con ese criterio de búsqueda', 'Intenta con otro término o limpia el buscador.'));
          pendingPaginationHolder.replaceChildren();
          return;
        }

        // Tabla de Escritorio
        const desktopTable = h('div', { class: 'table-wrap desktop-only' },
          h('table', { class: 'data-table grid-bordered' },
            h('thead', null,
              h('tr', null,
                h('th', null, 'Farmacia / Ciudad'),
                h('th', null, 'Cuenta Bancaria Registrada'),
                h('th', { class: 'text-center' }, 'Pedidos'),
                h('th', { class: 'text-right' }, 'Ventas Brutas'),
                h('th', { class: 'text-right' }, 'Comisión 5%'),
                h('th', { class: 'text-right' }, 'Neto a Transferir (95%)'),
                h('th', { class: 'text-center' }, 'Acción')
              )
            ),
            h('tbody', null, pagedPending.map(ph =>
              h('tr', null,
                h('td', null,
                  h('strong', null, ph.pharmacyName),
                  h('span', { class: 'muted small block-line' }, (ph.city || 'Nacional') + (ph.phone ? ' • ' + ph.phone : ''))
                ),
                h('td', null,
                  h('span', { style: 'font-weight:700; color:var(--text);' }, (ph.bankName || 'Bancolombia') + ' (' + (ph.accountType || 'Ahorros') + ')'),
                  h('span', { class: 'muted small block-line', style: 'font-family:monospace; font-weight:700; color:var(--primary);' }, 'N°: ' + (ph.accountNumber || 'Sin cuenta')),
                  h('small', { class: 'muted block-line', style: 'font-size:11px;' }, 'Titular: ' + (ph.accountHolder || ph.pharmacyName) + (ph.accountDocNumber ? ' • CC/NIT ' + ph.accountDocNumber : ''))
                ),
                h('td', { class: 'text-center' },
                  h('span', { class: 'tag tone-teal', style: 'font-weight:700;' }, ph.pendingOrdersCount)
                ),
                h('td', { class: 'text-right' }, money(ph.grossTotal)),
                h('td', { class: 'text-right text-red', style: 'color:#991b1b; font-weight:600;' }, '- ' + money(ph.platformEarnings)),
                h('td', { class: 'text-right font-bold', style: 'color:#166534; font-size:14.5px;' }, money(ph.netPayable) + ' COP'),
                h('td', { class: 'text-center' },
                  h('button', {
                    class: 'btn primary small',
                    type: 'button',
                    onclick: () => openDisbursementActionModal(ph, draw)
                  }, 'Transferir')
                )
              )
            ))
          )
        );

        // Tarjetas Flutter para Vista Móvil
        const mobileCards = h('div', { class: 'disbursement-mobile-cards-wrap mobile-only' },
          pagedPending.map(ph =>
            h('div', { class: 'disbursement-flutter-card' },
              h('div', { class: 'disbursement-flutter-head' },
                h('div', null,
                  h('strong', { class: 'disbursement-flutter-title' }, ph.pharmacyName),
                  h('span', { class: 'muted small block-line' }, (ph.city || 'Nacional') + (ph.phone ? ' • ' + ph.phone : ''))
                ),
                h('span', { class: 'tag tone-teal', style: 'font-weight:700;' }, ph.pendingOrdersCount + ' pedidos')
              ),
              h('div', { class: 'disbursement-flutter-bank-box' },
                h('span', { class: 'small font-bold', style: 'color:var(--text);' }, (ph.bankName || 'Bancolombia') + ' (' + (ph.accountType || 'Ahorros') + ')'),
                h('span', { class: 'small font-mono font-bold', style: 'color:var(--primary);' }, 'N° ' + (ph.accountNumber || 'Sin cuenta')),
                h('small', { class: 'muted', style: 'font-size:11px;' }, 'Titular: ' + (ph.accountHolder || ph.pharmacyName) + (ph.accountDocNumber ? ' • ' + ph.accountDocNumber : ''))
              ),
              h('div', { class: 'disbursement-flutter-fin-grid' },
                h('div', { class: 'disbursement-flutter-fin-item' },
                  h('small', { class: 'muted' }, 'Venta bruta'),
                  h('span', { class: 'bold small' }, money(ph.grossTotal))
                ),
                h('div', { class: 'disbursement-flutter-fin-item' },
                  h('small', { class: 'muted' }, 'Comisión 5%'),
                  h('span', { class: 'bold small text-red', style: 'color:#991b1b;' }, '- ' + money(ph.platformEarnings))
                ),
                h('div', { class: 'disbursement-flutter-fin-item highlight-green' },
                  h('small', { style: 'color:#166534; font-weight:700;' }, 'Neto 95% Aliado'),
                  h('span', { style: 'font-weight:800; color:#166534; font-size:13.5px;' }, money(ph.netPayable) + ' COP')
                )
              ),
              h('div', { class: 'disbursement-flutter-actions' },
                h('button', {
                  class: 'btn primary block small',
                  type: 'button',
                  onclick: () => openDisbursementActionModal(ph, draw)
                }, 'Transferir Fondos (95%)')
              )
            )
          )
        );

        pendingResultsHolder.replaceChildren(desktopTable, mobileCards);
        pendingPaginationHolder.replaceChildren(
          fyPagination(filteredPending.length, pendingPage, PAGE_SIZE, (p) => {
            pendingPage = p;
            updatePendingView();
          })
        );
      }

      pendingInput.addEventListener('input', (e) => {
        pendingSearch = e.target.value;
        pendingPage = 1;
        updatePendingView();
      });

      const pendingCard = h('div', { class: 'disbursement-table-card' },
        h('div', { class: 'disbursement-table-toolbar' },
          h('div', { class: 'disbursement-table-title-group' },
            h('h3', { class: 'disbursement-table-heading' }, 'Saldos Pendientes por Desembolsar a Droguerías'),
            pendingBadge
          ),
          h('div', { class: 'disbursement-search-wrap' },
            h('span', { class: 'disbursement-search-icon' }, icon('search')),
            pendingInput
          )
        ),
        pendingResultsHolder,
        pendingPaginationHolder
      );
      updatePendingView();

      // --- PESTAÑA 2: HISTORIAL DE DESEMBOLSOS ---
      const historyBadge = h('span', { class: 'disbursement-table-badge' });
      const historyInput = h('input', {
        type: 'search',
        class: 'disbursement-search-input',
        placeholder: 'Buscar por código LIQ, droguería, comprobante o banco...',
        value: historySearch
      });
      const historyResultsHolder = h('div', { class: 'disbursement-results-holder' });
      const historyPaginationHolder = h('div', { class: 'disbursement-pagination-holder' });

      function updateHistoryView() {
        const q = historySearch.toLowerCase().trim();
        const filteredHistory = historyList.filter(d => {
          if (!q) return true;
          return (d.code || '').toLowerCase().includes(q) ||
                 (d.pharmacyName || '').toLowerCase().includes(q) ||
                 (d.pharmacyCity || '').toLowerCase().includes(q) ||
                 (d.reference || '').toLowerCase().includes(q) ||
                 (d.bankName || '').toLowerCase().includes(q) ||
                 (d.accountNumber || '').toLowerCase().includes(q) ||
                 (d.method || '').toLowerCase().includes(q);
        });

        historyBadge.textContent = filteredHistory.length + ' desembolsos';

        const totalPages = Math.max(1, Math.ceil(filteredHistory.length / PAGE_SIZE));
        if (historyPage > totalPages) historyPage = totalPages;
        const startIdx = (historyPage - 1) * PAGE_SIZE;
        const pagedHistory = filteredHistory.slice(startIdx, startIdx + PAGE_SIZE);

        if (!pagedHistory.length) {
          historyResultsHolder.replaceChildren(empty('No se encontraron transferencias con ese criterio de búsqueda', 'Intenta con otro término o limpia el buscador.'));
          historyPaginationHolder.replaceChildren();
          return;
        }

        // Tabla de Escritorio
        const desktopTable = h('div', { class: 'table-wrap desktop-only' },
          h('table', { class: 'data-table grid-bordered' },
            h('thead', null,
              h('tr', null,
                h('th', null, 'Código / Fecha'),
                h('th', null, 'Droguería Beneficiaria'),
                h('th', null, 'Cuenta de Abono'),
                h('th', null, 'Comprobante / Ref'),
                h('th', { class: 'text-right' }, 'Ventas Brutas'),
                h('th', { class: 'text-right' }, 'Retención 5%'),
                h('th', { class: 'text-right' }, 'Neto Transferido (95%)'),
                h('th', { class: 'text-center' }, 'Comprobante')
              )
            ),
            h('tbody', null, pagedHistory.map(d =>
              h('tr', null,
                h('td', null,
                  h('strong', { style: 'font-family:monospace; color:var(--primary); font-size:13.5px;' }, d.code),
                  h('span', { class: 'muted small block-line' }, d.createdAt ? new Date(d.createdAt).toLocaleDateString('es-CO') : '-')
                ),
                h('td', null,
                  h('strong', null, d.pharmacyName),
                  h('span', { class: 'muted small block-line' }, d.pharmacyCity || 'Nacional')
                ),
                h('td', null,
                  h('span', { style: 'font-weight:700;' }, (d.bankName || 'Bancolombia') + ' • ' + (d.accountType || 'Ahorros')),
                  h('span', { class: 'muted small block-line', style: 'font-family:monospace; font-weight:700; color:var(--primary);' }, d.accountNumber)
                ),
                h('td', null,
                  h('span', { class: 'tag tone-blue', style: 'font-family:monospace; font-weight:700;' }, d.reference || '-'),
                  h('small', { class: 'muted block-line', style: 'font-size:11px;' }, d.method === 'TRANSFERENCIA_BANCARIA' ? 'Transferencia ACH' : d.method)
                ),
                h('td', { class: 'text-right' }, money(d.grossTotal)),
                h('td', { class: 'text-right text-red', style: 'color:#991b1b; font-weight:600;' }, '- ' + money(d.platformEarnings)),
                h('td', { class: 'text-right font-bold', style: 'color:#166534; font-size:14.5px;' }, money(d.netAmount) + ' COP'),
                h('td', { class: 'text-center' },
                  h('button', {
                    class: 'btn secondary small',
                    type: 'button',
                    onclick: () => {
                      if (typeof renderDisbursementReceiptModal === 'function') {
                        renderDisbursementReceiptModal(d);
                      } else {
                        alert('Liquidación ' + d.code + ' por ' + money(d.netAmount) + ' COP');
                      }
                    }
                  }, 'Ver Recibo')
                )
              )
            ))
          )
        );

        // Tarjetas Flutter para Vista Móvil
        const mobileCards = h('div', { class: 'disbursement-mobile-cards-wrap mobile-only' },
          pagedHistory.map(d =>
            h('div', { class: 'disbursement-flutter-card' },
              h('div', { class: 'disbursement-flutter-head' },
                h('div', null,
                  h('strong', { class: 'disbursement-flutter-code font-mono', style: 'color:var(--primary); font-size:14px;' }, d.code),
                  h('span', { class: 'muted small block-line' }, d.createdAt ? new Date(d.createdAt).toLocaleDateString('es-CO') : '-')
                ),
                h('span', { class: 'badge-pill success small' }, 'Comprobante OK')
              ),
              h('div', { class: 'disbursement-flutter-bank-box' },
                h('strong', { class: 'small block-line' }, d.pharmacyName),
                h('span', { class: 'muted small block-line' }, (d.bankName || 'Bancolombia') + ' • ' + (d.accountNumber || 'Cuenta Bancaria'))
              ),
              h('div', { class: 'disbursement-flutter-voucher-row' },
                h('span', { class: 'tag tone-blue small font-mono font-bold' }, 'Comp: ' + (d.reference || 'TRF-OK')),
                d.receiptPdfUrl ? h('span', { class: 'tag tone-teal small font-bold' }, 'PDF Oficial') : null
              ),
              h('div', { class: 'disbursement-flutter-fin-grid' },
                h('div', { class: 'disbursement-flutter-fin-item' },
                  h('small', { class: 'muted' }, 'Venta bruta'),
                  h('span', { class: 'bold small' }, money(d.grossTotal))
                ),
                h('div', { class: 'disbursement-flutter-fin-item' },
                  h('small', { class: 'muted' }, 'Tarifa 5%'),
                  h('span', { class: 'bold small text-red', style: 'color:#991b1b;' }, '- ' + money(d.platformEarnings))
                ),
                h('div', { class: 'disbursement-flutter-fin-item highlight-green' },
                  h('small', { style: 'color:#166534; font-weight:700;' }, 'Neto 95% Aliado'),
                  h('span', { style: 'font-weight:800; color:#166534; font-size:13.5px;' }, money(d.netAmount) + ' COP')
                )
              ),
              h('div', { class: 'disbursement-flutter-actions' },
                h('button', {
                  class: 'btn secondary block small',
                  type: 'button',
                  onclick: () => {
                    if (typeof renderDisbursementReceiptModal === 'function') {
                      renderDisbursementReceiptModal(d);
                    } else {
                      alert('Liquidación ' + d.code + ' por ' + money(d.netAmount) + ' COP');
                    }
                  }
                }, 'Ver Recibo Oficial')
              )
            )
          )
        );

        historyResultsHolder.replaceChildren(desktopTable, mobileCards);
        historyPaginationHolder.replaceChildren(
          fyPagination(filteredHistory.length, historyPage, PAGE_SIZE, (p) => {
            historyPage = p;
            updateHistoryView();
          })
        );
      }

      historyInput.addEventListener('input', (e) => {
        historySearch = e.target.value;
        historyPage = 1;
        updateHistoryView();
      });

      const historyCard = h('div', { class: 'disbursement-table-card' },
        h('div', { class: 'disbursement-table-toolbar' },
          h('div', { class: 'disbursement-table-title-group' },
            h('h3', { class: 'disbursement-table-heading' }, 'Historial de Transferencias y Comprobantes Oficiales'),
            historyBadge
          ),
          h('div', { class: 'disbursement-search-wrap' },
            h('span', { class: 'disbursement-search-icon' }, icon('search')),
            historyInput
          )
        ),
        historyResultsHolder,
        historyPaginationHolder
      );
      updateHistoryView();

      function switchTab(tab) {
        activeTab = tab;
        tabs.children[0].className = 'btn ' + (activeTab === 'PENDING' ? 'primary' : 'secondary');
        tabs.children[1].className = 'btn ' + (activeTab === 'HISTORY' ? 'primary' : 'secondary');
        tabContainer.replaceChildren(activeTab === 'PENDING' ? pendingCard : historyCard);
      }

      switchTab(activeTab);
      
      container.replaceChildren(header, kpis, tabs, tabContainer);
    } catch (err) {
      container.replaceChildren(notice('error', 'Error al cargar módulo de desembolsos', err.message));
    }
  };

  draw();
  return container;
}
