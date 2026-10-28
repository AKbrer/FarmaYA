/* FarmaYA · catálogo rápido, ilustraciones e íconos de la vista de inicio del cliente.
   Los productos y precios son de ejemplo: el precio final lo confirma siempre la farmacia. */

Object.assign(ICONS, {
  capsule: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.5 20.5a4.95 4.95 0 0 1-7-7l10-10a4.95 4.95 0 0 1 7 7z"/><path d="m8.5 8.5 7 7"/></svg>',
  cream: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="9" rx="3"/><path d="M5 11V9a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v2"/><path d="M12 13.5v4M10 15.5h4"/></svg>',
  bottle: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2.5h5v3h-5z"/><path d="M8.5 5.5h7l1 3v10.5a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2V8.5z"/><path d="M8.5 12h3M8.5 15h3"/></svg>',
  percent: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-7 7"/><circle cx="9" cy="9" r="1.2"/><circle cx="15" cy="15" r="1.2"/></svg>',
  search: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  heart: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 20.5s-8-4.6-8-10.4A4.6 4.6 0 0 1 12 7.6a4.6 4.6 0 0 1 8 2.5c0 5.8-8 10.4-8 10.4z"/></svg>',
  heartfill: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 20.5s-8-4.6-8-10.4A4.6 4.6 0 0 1 12 7.6a4.6 4.6 0 0 1 8 2.5c0 5.8-8 10.4-8 10.4z"/></svg>',
  chevL: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 5-7 7 7 7"/></svg>',
  chevR: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 5 7 7-7 7"/></svg>'
});

const CATEGORIES = [
  { id: 'meds', label: 'Medicamentos y Salud', icon: 'capsule' },
  { id: 'care', label: 'Cuidado Personal y Piel', icon: 'cream' },
  { id: 'baby', label: 'Bebé, Mamá e Infantil', icon: 'bottle' },
  { id: 'gastro', label: 'Gastroenterología', icon: 'capsule' },
  { id: 'derm', label: 'Dermatología', icon: 'cream' },
  { id: 'vital', label: 'Vitaminas y Nutrición', icon: 'bottle' }
];

const CATALOG = [
  { 
    name: 'Ibuprofeno 800 mg', 
    cat: 'meds', 
    price: 14200, 
    art: 'box', 
    color: '#004e46', 
    featured: true, 
    lab: 'MK (Tecnoquímicas)', 
    presentation: 'Caja x 30 tabletas recubiertas', 
    invima: 'INVIMA 2018M-0008432-R2', 
    active: 'Ibuprofeno 800 mg', 
    indication: 'Antiinflamatorio no esteroideo (AINE), analgésico y antipirético para el alivio de dolor e inflamación.', 
    storage: 'Temperatura ambiente controlada (15°C - 25°C)'
  },
  { 
    name: 'Paracetamol 500 mg', 
    cat: 'meds', 
    price: 6500, 
    art: 'box', 
    color: '#e8742a', 
    featured: true, 
    lab: 'Genfar', 
    presentation: 'Caja x 20 tabletas', 
    invima: 'INVIMA 2017M-0004521-R1', 
    active: 'Acetaminofén 500 mg', 
    indication: 'Analgésico y antipirético para el alivio del dolor de cabeza y fiebre.', 
    storage: 'Temperatura menor a 30°C'
  },
  { 
    name: 'Vitamina C 1000 mg', 
    cat: 'vital', 
    price: 28900, 
    art: 'bottle', 
    color: '#f2a516', 
    featured: true, 
    lab: 'Bayer de Colombia', 
    presentation: 'Tubo x 10 tabletas efervescentes', 
    invima: 'INVIMA 2019M-0012903', 
    active: 'Ácido Ascórbico 1000 mg + Zinc', 
    indication: 'Refuerzo del sistema inmune y antioxidante celular.', 
    storage: 'Lugar fresco y seco'
  },
  { 
    name: 'Ibuprofeno 400 mg', 
    cat: 'meds', 
    price: 8900, 
    art: 'box', 
    color: '#c93a52', 
    featured: true, 
    lab: 'MK (Tecnoquímicas)', 
    presentation: 'Caja x 20 cápsulas blandas', 
    invima: 'INVIMA 2016M-0006782-R1', 
    active: 'Ibuprofeno 400 mg', 
    indication: 'Alivio rápido de dolores musculares, menstruales y de cabeza.', 
    storage: 'Temperatura ambiente (15°C - 25°C)'
  },
  { 
    name: 'Loratadina 10 mg', 
    cat: 'meds', 
    price: 7200, 
    art: 'box', 
    color: '#2b9a68', 
    lab: 'Genfar', 
    presentation: 'Caja x 10 tabletas', 
    invima: 'INVIMA 2015M-0003214-R2', 
    active: 'Loratadina 10 mg', 
    indication: 'Antihistamínico no sedante para rinitis alérgica y urticaria.', 
    storage: 'Temperatura menor a 30°C'
  },
  { 
    name: 'Omeprazol 20 mg', 
    cat: 'gastro', 
    price: 9800, 
    art: 'box', 
    color: '#0a5ca8', 
    lab: 'Sanofi', 
    presentation: 'Caja x 14 cápsulas con gránulos gastrorresistentes', 
    invima: 'INVIMA 2018M-0009841', 
    active: 'Omeprazol 20 mg', 
    indication: 'Inhibidor de la bomba de protones para reflujo gástrico y gastritis.', 
    storage: 'Protéjase de la humedad'
  },
  { 
    name: 'Naproxeno 250 mg', 
    cat: 'meds', 
    price: 11500, 
    art: 'box', 
    color: '#0a5ca8', 
    lab: 'MK (Tecnoquímicas)', 
    presentation: 'Caja x 20 tabletas', 
    invima: 'INVIMA 2019M-0010452', 
    active: 'Naproxeno sódico 250 mg', 
    indication: 'Antiinflamatorio y analgésico de acción prolongada.', 
    storage: 'Temperatura ambiente'
  },
  { 
    name: 'Amoxicilina 500 mg', 
    cat: 'meds', 
    price: 14500, 
    art: 'box', 
    color: '#d79a14', 
    rx: true, 
    lab: 'Lafrancol', 
    presentation: 'Caja x 15 cápsulas', 
    invima: 'INVIMA 2016M-0001928-R3', 
    active: 'Amoxicilina Trihidrato 500 mg', 
    indication: 'Antibiótico bactericida de amplio espectro. Venta obligatoria bajo fórmula médica.', 
    storage: 'Lugar seco a menos de 30°C'
  },
  { 
    name: 'Suero oral Electrolit Fresa', 
    cat: 'vital', 
    price: 8500, 
    art: 'bottle', 
    color: '#3b8fdb', 
    lab: 'Laboratorios Pisa', 
    presentation: 'Frasco x 625 ml', 
    invima: 'INVIMA 2020M-0015610', 
    active: 'Electrolitos orales y glucosa', 
    indication: 'Rehidratación oral para deshidratación por ejercicio, calor o diarrea.', 
    storage: 'Consérvese a temperatura ambiente'
  },
  { 
    name: 'Crema hidratante Ceramide', 
    cat: 'derm', 
    price: 49900, 
    art: 'jar', 
    color: '#4a7fc1', 
    featured: true, 
    lab: 'CeraVe / L\'Oréal', 
    presentation: 'Pote x 340 g', 
    invima: 'NSOC82910-18CO', 
    active: '3 ceramidas esenciales y ácido hialurónico', 
    indication: 'Hidratación profunda y restauración de la barrera cutánea.', 
    storage: 'Temperatura ambiente'
  },
  { 
    name: 'Protector solar FPS 50+ Facial', 
    cat: 'care', 
    price: 58500, 
    art: 'tube', 
    color: '#f2a516', 
    featured: true, 
    lab: 'ISDIN Colombia', 
    presentation: 'Frasco x 50 ml Fusion Water', 
    invima: 'NSOC71923-16CO', 
    active: 'Filtros solares UVA/UVB de amplio espectro', 
    indication: 'Fotoprotección facial diaria de fase acuosa y textura ultraligera.', 
    storage: 'No exponer a temperaturas mayores a 40°C'
  },
  { 
    name: 'Alcohol antiséptico 70% 350 ml', 
    cat: 'care', 
    price: 5900, 
    art: 'bottle', 
    color: '#5aa9a0', 
    lab: 'JGB', 
    presentation: 'Frasco x 350 ml', 
    invima: 'INVIMA 2014M-0001092-R1', 
    active: 'Alcohol Etílico al 70%', 
    indication: 'Antiséptico y desinfectante de uso tópico y de superficies.', 
    storage: 'Inflamable. Manténgase alejado del fuego'
  },
  { 
    name: 'Gel antibacterial con Aloe', 
    cat: 'care', 
    price: 7400, 
    art: 'bottle', 
    color: '#3b8fdb', 
    lab: 'MK (Tecnoquímicas)', 
    presentation: 'Frasco x 300 ml con dosificador', 
    invima: 'NSOC92301-19CO', 
    active: 'Alcohol al 68% + Glicerina y Aloe Vera', 
    indication: 'Higiene rápida de manos sin enjuague con agente humectante.', 
    storage: 'Lugar fresco'
  },
  { 
    name: 'Crema dental Total 12', 
    cat: 'care', 
    price: 8800, 
    art: 'tube', 
    color: '#0a5ca8', 
    lab: 'Colgate-Palmolive', 
    presentation: 'Tubo x 150 ml (180 g)', 
    invima: 'NSOC02941-98CO', 
    active: 'Flúor y Zinc antibacteriano', 
    indication: 'Protección antibacterial por 12 horas y prevención de caries.', 
    storage: 'Temperatura ambiente'
  },
  { 
    name: 'Jabón líquido antibacterial', 
    cat: 'care', 
    price: 9200, 
    art: 'bottle', 
    color: '#16865d', 
    lab: 'Protex', 
    presentation: 'Botella dispensadora x 500 ml', 
    invima: 'NSOC48291-12CO', 
    active: 'Óleo de linaza y agentes limpiadores suaves', 
    indication: 'Elimina el 99.9% de las bacterias manteniendo la piel suave.', 
    storage: 'Temperatura ambiente'
  },
  { 
    name: 'Pañales Winny Sensitive Etapa 3', 
    cat: 'baby', 
    price: 54900, 
    art: 'pack', 
    color: '#3b8fdb', 
    featured: true, 
    lab: 'Tecnoquímicas Bebé', 
    presentation: 'Paquete x 50 unidades', 
    invima: 'NSOC61029-14CO', 
    active: 'Cubierta suave con aloe vera y manzanilla', 
    indication: 'Absorción prolongada hasta por 12 horas para bebés de 7 a 10 kg.', 
    storage: 'Almacenar en lugar seco'
  },
  { 
    name: 'Toallitas húmedas Winny con Aloe', 
    cat: 'baby', 
    price: 10900, 
    art: 'pack', 
    color: '#5aa9a0', 
    lab: 'Tecnoquímicas Bebé', 
    presentation: 'Paquete con tapa x 80 unidades', 
    invima: 'NSOC38201-10CO', 
    active: 'Fórmula hipoalergénica con 99% agua pura', 
    indication: 'Limpieza suave y delicada de la piel del bebé desde el primer día.', 
    storage: 'Cerrar la tapa después de cada uso'
  },
  { 
    name: 'Biberón Anticólicos 260 ml', 
    cat: 'baby', 
    price: 26500, 
    art: 'baby', 
    color: '#f2a516', 
    lab: 'Philips Avent', 
    presentation: 'Unidad de 260 ml / 9 oz', 
    invima: 'Dispositivo médico no invasivo', 
    active: 'Polipropileno libre de BPA', 
    indication: 'Sistema de válvula anticólicos clínicamente comprobado.', 
    storage: 'Esterilizar antes de cada uso'
  },
  { 
    name: 'Crema antipañalitis Desitin Rapid', 
    cat: 'baby', 
    price: 18800, 
    art: 'tube', 
    color: '#e8742a', 
    lab: 'Johnson & Johnson', 
    presentation: 'Tubo x 57 g', 
    invima: 'NSOC29102-08CO', 
    active: 'Óxido de Zinc al 13%', 
    indication: 'Alivio y prevención inmediata de la dermatitis del pañal.', 
    storage: 'Temperatura menor a 30°C'
  },
  { 
    name: 'Termómetro Digital Infrarrojo', 
    cat: 'meds', 
    price: 45900, 
    art: 'box', 
    color: '#0d3f7a', 
    lab: 'GMD Biomédica', 
    presentation: 'Unidad digital con display LCD', 
    invima: 'INVIMA 2018DM-0018392', 
    active: 'Sensor infrarrojo de precisión clínica', 
    indication: 'Medición instantánea sin contacto en 1 segundo con alarma de fiebre.', 
    storage: 'Proteger de caídas y humedad'
  }
];

const norm = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/* ---------- Gestión de imágenes de medicamentos (Admin & Catálogo) ---------- */
function getCustomProductImages() {
  try {
    const raw = localStorage.getItem('farmaya_product_images');
    return raw ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
}

function saveProductImage(productName, imageUrl) {
  try {
    const map = getCustomProductImages();
    if (imageUrl && imageUrl.trim()) {
      map[productName] = imageUrl.trim();
    } else {
      delete map[productName];
    }
    localStorage.setItem('farmaya_product_images', JSON.stringify(map));
    const prod = CATALOG.find(p => p.name === productName);
    if (prod) {
      prod.imageUrl = (imageUrl && imageUrl.trim()) ? imageUrl.trim() : null;
    }
    window.dispatchEvent(new CustomEvent('farmaya:product-images-updated', { detail: { productName, imageUrl } }));
    return true;
  } catch (err) {
    console.error('Error guardando imagen de medicamento:', err);
    return false;
  }
}

function syncCatalogImages() {
  try {
    const map = getCustomProductImages();
    CATALOG.forEach(p => {
      if (map[p.name]) {
        p.imageUrl = map[p.name];
      }
    });
  } catch (_) {}
}
syncCatalogImages();

async function syncCatalogWithBackend() {
  try {
    if (typeof API !== 'undefined' && API.get) {
      const list = await API.get('/products');
      if (Array.isArray(list) && list.length > 0) {
        list.forEach(rp => {
          const idx = CATALOG.findIndex(p => (rp.id && p.id === rp.id) || norm(p.name) === norm(rp.name));
          if (idx >= 0) {
            CATALOG[idx] = Object.assign(CATALOG[idx], rp);
          } else {
            CATALOG.push({
              id: rp.id,
              name: rp.name,
              cat: rp.cat || 'meds',
              price: rp.price || 0,
              art: rp.art || 'box',
              color: rp.color || '#16865d',
              featured: !!rp.featured,
              lab: rp.lab || '',
              presentation: rp.presentation || '',
              invima: rp.invima || '',
              active: rp.active || '',
              indication: rp.indication || '',
              storage: rp.storage || '',
              rx: !!rp.rx,
              imageUrl: rp.imageUrl || null
            });
          }
        });
        syncCatalogImages();
        window.dispatchEvent(new CustomEvent('farmaya:catalog-synced', { detail: { count: CATALOG.length } }));
      }
    }
  } catch (err) {
    console.debug('Catalog backend sync deferred:', err);
  }
}

if (typeof window !== 'undefined') {
  setTimeout(syncCatalogWithBackend, 50);
  window.addEventListener('farmaya:product-images-updated', syncCatalogWithBackend);
  window.addEventListener('farmaya:catalog-refresh', syncCatalogWithBackend);
}

/* ---------- Ilustraciones y fotos de producto ---------- */
function productArt(p) {
  const c = p.color || '#16865d';
  const shadow = '<ellipse cx="60" cy="83" rx="36" ry="4.5" fill="rgba(13,47,92,.13)"/>';
  const art = {
    box: '<rect x="22" y="20" width="76" height="58" rx="5" fill="#fff" stroke="#c8d6e6"/><path d="M22 25a5 5 0 0 1 5-5h66a5 5 0 0 1 5 5v13H22z" fill="' + c + '"/>' +
      '<rect x="32" y="48" width="34" height="5" rx="2.5" fill="#cfdaea"/><rect x="32" y="58" width="48" height="4" rx="2" fill="#e1e9f3"/>' +
      '<rect x="72" y="46" width="18" height="9" rx="4.5" fill="' + c + '" transform="rotate(-35 81 50)"/>',
    jar: '<rect x="27" y="31" width="66" height="45" rx="11" fill="#e9f1fb" stroke="#c8d6e6"/><rect x="23" y="20" width="74" height="17" rx="6" fill="' + c + '"/>' +
      '<rect x="38" y="46" width="44" height="16" rx="4" fill="#fff"/><rect x="44" y="52" width="32" height="4" rx="2" fill="' + c + '" opacity=".7"/>',
    bottle: '<rect x="47" y="7" width="26" height="14" rx="3" fill="#0d3f7a"/><rect x="39" y="19" width="42" height="62" rx="11" fill="' + c + '"/>' +
      '<rect x="44" y="38" width="32" height="28" rx="3" fill="#fff"/><circle cx="60" cy="52" r="7.5" fill="' + c + '"/>',
    tube: '<g transform="rotate(-16 60 46)"><rect x="26" y="34" width="68" height="25" rx="8" fill="#fff" stroke="#c8d6e6"/>' +
      '<rect x="26" y="34" width="22" height="25" rx="7" fill="' + c + '"/><rect x="88" y="39" width="12" height="15" rx="3" fill="#0d3f7a"/>' +
      '<rect x="55" y="42" width="26" height="4" rx="2" fill="' + c + '"/><rect x="55" y="50" width="17" height="3" rx="1.5" fill="#cfdaea"/></g>',
    pack: '<rect x="25" y="16" width="70" height="63" rx="13" fill="' + c + '"/><circle cx="60" cy="40" r="13" fill="#fff"/>' +
      '<circle cx="55.5" cy="38" r="1.7" fill="#0d2f5c"/><circle cx="64.5" cy="38" r="1.7" fill="#0d2f5c"/>' +
      '<path d="M55 44q5 4 10 0" stroke="#0d2f5c" fill="none" stroke-width="1.7" stroke-linecap="round"/><rect x="37" y="61" width="46" height="5" rx="2.5" fill="#fff" opacity=".85"/>',
    baby: '<rect x="52" y="5" width="16" height="13" rx="7" fill="#f6c3d0"/><rect x="45" y="16" width="30" height="9" rx="3" fill="' + c + '"/>' +
      '<rect x="41" y="24" width="38" height="57" rx="11" fill="#e9f1fb" stroke="#c8d6e6"/><path d="M41 42h9M41 54h9M41 66h9" stroke="#8aa3c0" stroke-width="2"/>' +
      '<rect x="53" y="46" width="14" height="22" rx="7" fill="' + c + '" opacity=".35"/>'
  }[p.art] || '';

  const span = document.createElement('span');
  span.className = 'p-art';
  span.setAttribute('aria-hidden', 'true');

  const customImg = p.imageUrl || getCustomProductImages()[p.name];
  if (customImg) {
    span.classList.add('p-art-has-photo');
    const img = document.createElement('img');
    img.src = customImg;
    img.alt = p.name;
    img.className = 'product-custom-photo';
    img.loading = 'lazy';
    img.onerror = () => {
      // Si la imagen falla al cargar, vuelve al SVG limpio
      span.innerHTML = '<svg viewBox="0 0 120 90" xmlns="http://www.w3.org/2000/svg">' + shadow + art + '</svg>';
    };
    span.appendChild(img);
    return span;
  }

  span.innerHTML = '<svg viewBox="0 0 120 90" xmlns="http://www.w3.org/2000/svg">' + shadow + art + '</svg>';
  return span;
}

/* ---------- Fachada de farmacia ---------- */
const AWNINGS = ['#2b9a68', '#0a5ca8', '#c93a52', '#16865d', '#d97a1f'];
function hashOf(s) { let n = 0; for (const ch of String(s)) n = (n * 31 + ch.charCodeAt(0)) >>> 0; return n; }

function storefrontArt(p) {
  const c = AWNINGS[hashOf(p.id) % AWNINGS.length];
  const stripes = Array.from({ length: 8 }, (_, i) => '<rect x="' + (20 + i * 22.5) + '" y="39" width="11.25" height="7" rx="0" fill="#fff" opacity=".28"/>').join('');
  const span = document.createElement('span');
  span.className = 'store-art';
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = '<svg viewBox="0 0 220 110" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
    '<rect width="220" height="110" fill="#dfe8f3"/><rect y="94" width="220" height="16" fill="#c4d0df"/>' +
    '<rect x="20" y="28" width="180" height="68" fill="#f6f8fb"/><rect x="20" y="16" width="180" height="26" rx="3" fill="' + c + '"/>' + stripes +
    '<g fill="#fff"><rect x="30" y="21" width="4.5" height="16" rx="1"/><rect x="24.3" y="26.8" width="16" height="4.5" rx="1"/></g>' +
    '<text x="48" y="34" font-size="13" font-weight="700" fill="#fff" font-family="Figtree, system-ui, sans-serif"></text>' +
    '<rect x="34" y="54" width="62" height="42" rx="2" fill="#bcd3ea"/><rect x="40" y="60" width="50" height="30" fill="#e4f0fb" opacity=".8"/>' +
    '<rect x="110" y="54" width="38" height="42" rx="2" fill="#8fb3d9"/><circle cx="141" cy="76" r="2" fill="#fff"/>' +
    '<rect x="160" y="60" width="28" height="22" rx="2" fill="#bcd3ea"/></svg>';
  const label = p.name.length > 15 ? p.name.slice(0, 14) + '…' : p.name;
  span.querySelector('text').textContent = label;
  return span;
}
