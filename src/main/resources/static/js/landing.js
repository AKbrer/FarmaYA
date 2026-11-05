/* FarmaYA · Pantalla de inicio pública y explicativa (Landing Page) */

function renderLandingPage() {
  const app = document.getElementById('app-container');
  if (!app) return;

  document.title = 'FarmaYa · Salud y Farmacia a Domicilio';

  // Limpiar cualquier barra flotante
  document.getElementById('fy_mobile_cart_bar')?.remove();

  const container = h('div', { class: 'landing-page page-view-transition' });

  // 1. HERO SECTION
  const heroSection = h('section', { class: 'landing-hero reveal-on-scroll' },
    h('div', { class: 'landing-hero-content' },
      h('div', { class: 'landing-hero-badge-row' },
        h('span', { class: 'landing-hero-badge' },
          h('span', { class: 'landing-pulse-dot' }),
          'Red de Salud Digital FarmaYA Colombia'
        )
      ),
      h('h1', { class: 'landing-hero-title' },
        'Medicamentos de confianza a tu puerta, ',
        h('span', { class: 'landing-hero-gradient-text' }, 'en minutos y con entrega segura')
      ),
      h('p', { class: 'landing-hero-description' },
        'Conectamos pacientes y familias con farmacias locales de turno y repartidores verificados. Cotizaciones transparentes, factura electronica inmediata y recepcion protegida mediante codigo PIN de seguridad.'
      ),
      h('div', { class: 'landing-hero-actions' },
        h('a', { class: 'btn btn-primary landing-btn-cta', href: '#register' },
          'Comenzar Ahora / Crear Cuenta'
        ),
        h('a', { class: 'btn btn-outline landing-btn-secondary', href: '#login' },
          'Iniciar Sesion'
        ),
        h('a', { class: 'btn btn-ghost landing-btn-ghost', href: '#como-funciona' },
          'Ver Como Funciona'
        )
      ),
      h('div', { class: 'landing-trust-strip' },
        h('div', { class: 'landing-trust-item' },
          icon('shield', 'landing-trust-ico'),
          h('span', null, 'Droguerias Verificadas')
        ),
        h('div', { class: 'landing-trust-item' },
          icon('check', 'landing-trust-ico'),
          h('span', null, 'Validacion con PIN')
        ),
        h('div', { class: 'landing-trust-item' },
          icon('lock', 'landing-trust-ico'),
          h('span', null, 'Pagos Seguros Wompi')
        ),
        h('div', { class: 'landing-trust-item' },
          icon('package', 'landing-trust-ico'),
          h('span', null, 'Factura al Correo')
        )
      )
    ),

    // Tarjeta visual interactiva simulando un pedido activo de FarmaYA
    h('div', { class: 'landing-hero-visual' },
      h('div', { class: 'landing-mock-card' },
        h('div', { class: 'landing-mock-header' },
          h('div', { class: 'landing-mock-brand' },
            h('img', { src: '/images/farmaya-cross.png?v=1', alt: 'Cruz FarmaYA', class: 'landing-mock-cross' }),
            h('div', null,
              h('strong', { class: 'landing-mock-title' }, 'Pedido #FY-8924'),
              h('small', { class: 'muted d-block' }, 'Farmacia Botica Central')
            )
          ),
          h('span', { class: 'tag tone-teal small' }, 'En camino')
        ),
        h('div', { class: 'landing-mock-stepper' },
          h('div', { class: 'landing-mock-step done' },
            h('span', { class: 'step-circle' }, '1'),
            h('span', { class: 'step-text' }, 'Solicitado')
          ),
          h('div', { class: 'landing-mock-line done' }),
          h('div', { class: 'landing-mock-step done' },
            h('span', { class: 'step-circle' }, '2'),
            h('span', { class: 'step-text' }, 'Cotizado')
          ),
          h('div', { class: 'landing-mock-line done' }),
          h('div', { class: 'landing-mock-step done' },
            h('span', { class: 'step-circle' }, '3'),
            h('span', { class: 'step-text' }, 'Pagado')
          ),
          h('div', { class: 'landing-mock-line active' }),
          h('div', { class: 'landing-mock-step active' },
            h('span', { class: 'step-circle' }, '4'),
            h('span', { class: 'step-text' }, 'En camino')
          )
        ),
        h('div', { class: 'landing-mock-pin-box' },
          h('div', { class: 'pin-box-left' },
            h('span', { class: 'pin-box-lbl' }, 'PIN DE ENTREGA'),
            h('strong', { class: 'pin-box-number' }, '1 0 4 4')
          ),
          h('span', { class: 'pin-box-note' }, 'Dictaselo a tu repartidor para confirmar la entrega en mano.')
        ),
        h('div', { class: 'landing-mock-items' },
          h('div', { class: 'mock-item-row' },
            h('span', null, '1x Suero Fisiologico 500 ml'),
            h('strong', null, '$ 14.500')
          ),
          h('div', { class: 'mock-item-row' },
            h('span', null, '1x Acetaminofen 500 mg x 20'),
            h('strong', null, '$ 8.200')
          ),
          h('div', { class: 'mock-item-row total-row' },
            h('span', null, 'Total Pagado (Facturado)'),
            h('strong', { class: 'text-green' }, '$ 22.700 COP')
          )
        )
      )
    )
  );

  // 2. SECCION: COMO FUNCIONA
  const howItWorksSection = h('section', { id: 'como-funciona', class: 'landing-section' },
    h('div', { class: 'landing-section-head reveal-on-scroll' },
      h('span', { class: 'landing-section-eyebrow' }, 'PROCESO SENCILLO Y PROTEGIDO'),
      h('h2', { class: 'landing-section-title' }, 'Como Funciona FarmaYA en 4 Pasos'),
      h('p', { class: 'landing-section-subtitle' },
        'Disenamos una experiencia transparente para que no pierdas tiempo en filas ni te preocupes por el cambio.'
      )
    ),
    h('div', { class: 'landing-steps-grid' },
      // Paso 1
      h('div', { class: 'landing-step-card reveal-on-scroll delay-1' },
        h('div', { class: 'landing-step-num' }, '01'),
        h('h3', { class: 'landing-step-card-title' }, 'Explora y selecciona tus productos'),
        h('p', { class: 'landing-step-card-desc' },
          'Encuentra medicamentos de venta libre, productos para el alivio de sintomas, primeros auxilios y cuidado de la salud en nuestro catalogo interactivo.'
        ),
        h('div', { class: 'landing-step-pill' }, 'Catalogo Digital')
      ),
      // Paso 2
      h('div', { class: 'landing-step-card reveal-on-scroll delay-2' },
        h('div', { class: 'landing-step-num' }, '02'),
        h('h3', { class: 'landing-step-card-title' }, 'La farmacia cercana cotiza y alista'),
        h('p', { class: 'landing-step-card-desc' },
          'Las droguerias aliadas con disponibilidad en tu sector reciben tu solicitud, confirman el stock real y envian el valor exacto sin cobros ocultos.'
        ),
        h('div', { class: 'landing-step-pill' }, 'Stock Real Garantizado')
      ),
      // Paso 3
      h('div', { class: 'landing-step-card reveal-on-scroll delay-3' },
        h('div', { class: 'landing-step-num' }, '03'),
        h('h3', { class: 'landing-step-card-title' }, 'Pago seguro y factura a tu correo'),
        h('p', { class: 'landing-step-card-desc' },
          'Acepta el precio y paga a traves de pasarela Wompi (Bancolombia, PSE, Nequi, tarjeta) o en efectivo contraentrega. Recibes tu factura electronica por correo.'
        ),
        h('div', { class: 'landing-step-pill' }, 'Wompi & Factura Digital')
      ),
      // Paso 4
      h('div', { class: 'landing-step-card reveal-on-scroll delay-4' },
        h('div', { class: 'landing-step-num' }, '04'),
        h('h3', { class: 'landing-step-card-title' }, 'Entrega certificada con PIN'),
        h('p', { class: 'landing-step-card-desc' },
          'Un repartidor certificado recoge el paquete sellado y lo lleva a tu direccion. La entrega solo se completa cuando le dictas tu codigo PIN personal de 4 digitos.'
        ),
        h('div', { class: 'landing-step-pill' }, 'Seguridad Total PIN')
      )
    )
  );

  // 3. SECCION: ECOSISTEMA FARMAYA (Para Clientes, Farmacias y Repartidores)
  const ecosystemSection = h('section', { class: 'landing-section' },
    h('div', { class: 'landing-section-head reveal-on-scroll' },
      h('span', { class: 'landing-section-eyebrow' }, 'ECOSISTEMA INTEGRAL'),
      h('h2', { class: 'landing-section-title' }, 'Creado para Beneficiar a Toda la Red'),
      h('p', { class: 'landing-section-subtitle' },
        'Conectamos las tres piezas clave para una entrega farmaceutica eficiente y justa.'
      )
    ),
    h('div', { class: 'landing-eco-grid' },
      // Card 1: Clientes
      h('div', { class: 'landing-eco-card reveal-on-scroll delay-1' },
        h('div', { class: 'landing-eco-icon eco-green' }, icon('user')),
        h('h3', { class: 'landing-eco-title' }, 'Para Clientes y Familias'),
        h('ul', { class: 'landing-eco-list' },
          h('li', null, icon('check', 'check-ico'), 'Acceso a farmacias de turno 24/7 sin salir de casa.'),
          h('li', null, icon('check', 'check-ico'), 'Cotizaciones competitivas y sin sobrecostos sorpresa.'),
          h('li', null, icon('check', 'check-ico'), 'Factura digital y comprobante enviado a tu correo.'),
          h('li', null, icon('check', 'check-ico'), 'Seguridad de entrega asegurada con tu PIN personal.')
        ),
        h('a', { class: 'btn btn-subtle eco-btn', href: '#register' }, 'Registrarme como Cliente')
      ),

      // Card 2: Farmacias
      h('div', { class: 'landing-eco-card reveal-on-scroll delay-2' },
        h('div', { class: 'landing-eco-icon eco-blue' }, icon('store')),
        h('h3', { class: 'landing-eco-title' }, 'Para Farmacias y Droguerias'),
        h('ul', { class: 'landing-eco-list' },
          h('li', null, icon('check', 'check-ico'), 'Incremento de ventas sin cobros fijos mensuales ni membresias.'),
          h('li', null, icon('check', 'check-ico'), 'Comision transparente: 90% para la farmacia, 10% FarmaYA.'),
          h('li', null, icon('check', 'check-ico'), 'Modulo de Prediccion de Demanda mensual con Inteligencia Artificial.'),
          h('li', null, icon('check', 'check-ico'), 'Panel administrativo para gestionar cotizaciones y stock.')
        ),
        h('a', { class: 'btn btn-subtle eco-btn', href: '#register' }, 'Afiliar mi Farmacia')
      ),

      // Card 3: Repartidores
      h('div', { class: 'landing-eco-card reveal-on-scroll delay-3' },
        h('div', { class: 'landing-eco-icon eco-purple' }, icon('bike')),
        h('h3', { class: 'landing-eco-title' }, 'Para Repartidores y Domiciliarios'),
        h('ul', { class: 'landing-eco-list' },
          h('li', null, icon('check', 'check-ico'), 'Tarifas claras de envio y liquidaciones confiables.'),
          h('li', null, icon('check', 'check-ico'), 'Cero disputas: el PIN de entrega garantiza que recibio el cliente correcto.'),
          h('li', null, icon('check', 'check-ico'), 'Rutas optimizadas con ubicacion GPS en tiempo real.'),
          h('li', null, icon('check', 'check-ico'), 'Flexibilidad de horarios para prestar servicio en tu zona.')
        ),
        h('a', { class: 'btn btn-subtle eco-btn', href: '#register' }, 'Unirme como Repartidor')
      )
    )
  );

  // 4. SECCION: SEGURIDAD Y ESTANDARES
  const securitySection = h('section', { class: 'landing-section' },
    h('div', { class: 'landing-security-box reveal-on-scroll' },
      h('div', { class: 'landing-security-header' },
        h('span', { class: 'landing-section-eyebrow' }, 'SEGURIDAD Y COMPROMISO'),
        h('h2', { class: 'landing-section-title' }, 'Salud Responsable y Estandares Farmaceuticos'),
        h('p', { class: 'landing-section-subtitle' },
          'Cumplimos con protocolos rigurosos de control para salvaguardar la salud y privacidad de nuestros usuarios.'
        )
      ),
      h('div', { class: 'landing-security-grid' },
        h('div', { class: 'landing-sec-item' },
          h('div', { class: 'landing-sec-ico' }, icon('shield')),
          h('h4', null, 'Verificacion Rigurosa'),
          h('p', null, 'Solo farmacias debidamente registradas y con licencias vigentes pueden operar en la red FarmaYA.')
        ),
        h('div', { class: 'landing-sec-item' },
          h('div', { class: 'landing-sec-ico' }, icon('lock')),
          h('h4', null, 'Seguridad y Farmacovigilancia'),
          h('p', null, 'Operamos bajo estrictos estandares de salud publica y proteccion integral de datos personales.')
        ),
        h('div', { class: 'landing-sec-item' },
          h('div', { class: 'landing-sec-ico' }, icon('package')),
          h('h4', null, 'Empaque Sellado'),
          h('p', null, 'Los medicamentos se entregan en empaque cerrado con sello de seguridad intacto hasta tu domicilio.')
        ),
        h('div', { class: 'landing-sec-item' },
          h('div', { class: 'landing-sec-ico' }, icon('check')),
          h('h4', null, 'Transacciones Auditadas'),
          h('p', null, 'Pagos procesados por Wompi Bancolombia bajo certificacion bancaria PCI-DSS Nivel 1.')
        )
      )
    )
  );

  // 5. SECCION: PREGUNTAS FRECUENTES (FAQ con acordeones fluidos)
  const faqData = [
    {
      q: '¿Como garantiza FarmaYA que el pedido sea entregado a la persona correcta?',
      a: 'Cada pedido cuenta con un codigo PIN exclusivo de 4 digitos que se muestra unicamente en la pantalla del cliente y se envia a su correo. El repartidor debe ingresar ese PIN en su aplicacion para completar la entrega, evitando errores o entregas a terceros.'
    },
    {
      q: '¿Que metodos de pago puedo utilizar en FarmaYA?',
      a: 'Aceptamos pagos electronicos inmediatos a traves de la pasarela Wompi Bancolombia (tarjetas de credito y debito Visa, Mastercard, cuentas de ahorros via PSE y Nequi), asi como la opcion de pago en efectivo contraentrega al recibir tus productos.'
    },
    {
      q: '¿Puedo solicitar medicamentos que requieran formula o receta medica?',
      a: 'No. Por estrictas razones de seguridad del paciente, farmacovigilancia y cumplimiento de la normatividad sanitaria vigente en Colombia (INVIMA y Ministerio de Salud), FarmaYA no distribuye medicamentos que requieran formula medica retenida o de control especial a domicilio. Nuestra plataforma esta especializada exclusivamente en medicamentos de venta libre (OTC), productos de primeros auxilios, bienestar y cuidado personal, garantizando una dispensacion etica, responsable y 100% segura.'
    },
    {
      q: '¿Cual es el tiempo promedio de entrega?',
      a: 'El tiempo habitual oscila entre 25 y 45 minutos, dependiendo de la distancia a la farmacia asignada y el trafico de la zona. Puedes seguir el avance del pedido paso a paso en tu pantalla de pedidos.'
    },
    {
      q: '¿Cual es el modelo de comision para farmacias aliadas?',
      a: 'FarmaYA no cobra tarifas de suscripcion mensual ni cargos fijos. Por cada pedido completado y pagado, la farmacia recibe el 90% neto del valor de los medicamentos y la plataforma retiene un 10% fijo por servicios de tecnologia, conexion y pasarela.'
    }
  ];

  const faqList = h('div', { class: 'landing-faq-list' });
  faqData.forEach((item, index) => {
    const faqBody = h('div', { class: 'landing-faq-body' }, h('p', null, item.a));
    const faqItem = h('div', { class: 'landing-faq-item reveal-on-scroll' },
      h('button', {
        class: 'landing-faq-trigger',
        type: 'button',
        'aria-expanded': 'false',
        onclick: () => {
          const isOpen = faqItem.classList.contains('is-open');
          // Cerrar otros
          faqList.querySelectorAll('.landing-faq-item.is-open').forEach(el => {
            if (el !== faqItem) {
              el.classList.remove('is-open');
              el.querySelector('.landing-faq-trigger').setAttribute('aria-expanded', 'false');
            }
          });
          if (isOpen) {
            faqItem.classList.remove('is-open');
            faqItem.querySelector('.landing-faq-trigger').setAttribute('aria-expanded', 'false');
          } else {
            faqItem.classList.add('is-open');
            faqItem.querySelector('.landing-faq-trigger').setAttribute('aria-expanded', 'true');
          }
        }
      },
        h('span', { class: 'landing-faq-question' }, item.q),
        h('span', { class: 'landing-faq-icon' }, '+')
      ),
      faqBody
    );
    faqList.append(faqItem);
  });

  const faqSection = h('section', { class: 'landing-section' },
    h('div', { class: 'landing-section-head reveal-on-scroll' },
      h('span', { class: 'landing-section-eyebrow' }, 'RESOLVEMOS TUS DUDAS'),
      h('h2', { class: 'landing-section-title' }, 'Preguntas Frecuentes'),
      h('p', { class: 'landing-section-subtitle' },
        'Todo lo que necesitas saber antes de pedir o unirte a la red de FarmaYA.'
      )
    ),
    faqList
  );

  // 6. SECCION: CTA BANNER FINAL
  const ctaBanner = h('section', { class: 'landing-cta-section reveal-on-scroll' },
    h('div', { class: 'landing-cta-card' },
      h('div', { class: 'landing-cta-content' },
        h('h2', { class: 'landing-cta-title' }, 'Comienza a Cuidar tu Salud con FarmaYA'),
        h('p', { class: 'landing-cta-desc' },
          'Crea tu cuenta gratuita en menos de dos minutos o inicia sesion para acceder a tu historial de medicamentos y farmacias cercanas.'
        ),
        h('div', { class: 'landing-cta-buttons' },
          h('a', { class: 'btn btn-primary landing-btn-cta', href: '#register' }, 'Crear Cuenta Gratis'),
          h('a', { class: 'btn btn-outline landing-btn-secondary', href: '#login' }, 'Ya tengo una cuenta')
        )
      )
    )
  );

  container.append(
    heroSection,
    howItWorksSection,
    ecosystemSection,
    securitySection,
    faqSection,
    ctaBanner
  );

  app.replaceChildren(container);

  // Iniciar animaciones de aparicion por scroll
  initScrollReveal();
}

/**
 * Inicializador de transiciones de scroll reveal fluidas sin bibliotecas externas.
 * Utiliza IntersectionObserver y aceleracion por hardware GPU.
 */
function initScrollReveal() {
  const elements = document.querySelectorAll('.reveal-on-scroll');
  if (!elements.length) return;

  if (!('IntersectionObserver' in window)) {
    elements.forEach(el => el.classList.add('is-revealed'));
    return;
  }

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-revealed');
        obs.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.12,
    rootMargin: '0px 0px -40px 0px'
  });

  elements.forEach(el => observer.observe(el));
}

window.renderLandingPage = renderLandingPage;
window.initScrollReveal = initScrollReveal;
