/* Mapa gratuito Leaflet + OpenStreetMap con precisión GPS */
let farmayaLeafletPromise;
function loadLeaflet() {
  if (window.L?.map) return Promise.resolve(window.L);
  if (farmayaLeafletPromise) return farmayaLeafletPromise;
  farmayaLeafletPromise = new Promise((resolve, reject) => {
    if (!document.querySelector('link[data-farmaya-leaflet]')) {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      css.dataset.farmayaLeaflet = '1';
      document.head.appendChild(css);
    }
    const finish = () => {
      if (window.L?.map) resolve(window.L);
      else {
        farmayaLeafletPromise = null;
        reject(new Error('No se pudo cargar Leaflet. Comprueba la conexión a Internet.'));
      }
    };
    if (window.L?.map) return finish();
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = finish;
    script.onerror = () => {
      farmayaLeafletPromise = null;
      reject(new Error('No se pudo descargar Leaflet.'));
    };
    document.head.appendChild(script);
  });
  return farmayaLeafletPromise;
}

/**
 * Obtiene las coordenadas GPS exactas del dispositivo con máxima precisión y sin caché antigua.
 */
function farmayaGetPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      return reject(new Error('Este navegador o dispositivo no soporta geolocalización GPS.'));
    }

    let bestPos = null;
    let finished = false;

    // Timeout de salvaguarda a los 10 segundos
    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      if (bestPos) {
        resolve(bestPos);
      } else {
        reject(new Error('Tiempo de espera agotado buscando señal GPS. Asegúrate de dar permiso de ubicación al navegador.'));
      }
    }, 10000);

    navigator.geolocation.getCurrentPosition(
      p => {
        if (finished) return;
        const pos = {
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: p.coords.accuracy || 20
        };

        // Si la precisión es excelente (<= 50m), usamos inmediatamente
        if (pos.accuracy <= 50) {
          finished = true;
          clearTimeout(timer);
          resolve(pos);
        } else {
          bestPos = pos;
          // Intentar afinar con watchPosition por un par de segundos
          let watchId;
          try {
            watchId = navigator.geolocation.watchPosition(
              wp => {
                if (finished) {
                  try { navigator.geolocation.clearWatch(watchId); } catch (_) {}
                  return;
                }
                const acc = wp.coords.accuracy || 999;
                if (!bestPos || acc < bestPos.accuracy) {
                  bestPos = {
                    lat: wp.coords.latitude,
                    lng: wp.coords.longitude,
                    accuracy: acc
                  };
                }
                if (acc <= 40) {
                  finished = true;
                  clearTimeout(timer);
                  try { navigator.geolocation.clearWatch(watchId); } catch (_) {}
                  resolve(bestPos);
                }
              },
              () => {},
              { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 }
            );
          } catch (_) {}

          setTimeout(() => {
            if (!finished && bestPos) {
              finished = true;
              clearTimeout(timer);
              if (watchId) {
                try { navigator.geolocation.clearWatch(watchId); } catch (_) {}
              }
              resolve(bestPos);
            }
          }, 3000);
        }
      },
      e => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        let msg = 'No se pudo obtener la ubicación GPS.';
        if (e.code === 1) {
          msg = 'Permiso de ubicación denegado. Haz clic en el candado junto a la URL del navegador y activa el permiso de Ubicación.';
        } else if (e.code === 2) {
          msg = 'Señal de ubicación no disponible. Activa el GPS de tu dispositivo.';
        } else if (e.code === 3) {
          msg = 'Tiempo agotado esperando señal GPS de alta precisión.';
        }
        reject(new Error(msg));
      },
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 0 }
    );
  });
}

/**
 * Traduce coordenadas geográficas a una dirección legible.
 */
async function reverseGeocode(position) {
  try {
    const lat = Number(position.lat);
    const lng = Number(position.lng);
    const url = 'https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=' +
      encodeURIComponent(lat) + '&lon=' + encodeURIComponent(lng) +
      '&zoom=18&addressdetails=1';

    const resp = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'es-CO,es;q=0.9'
      }
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const a = data.address || {};

    const road = a.road || a.pedestrian || a.footway || a.street || '';
    const num = a.house_number ? (' #' + a.house_number) : '';
    const neighborhood = a.neighbourhood || a.suburb || a.residential || a.quarter || '';
    const city = a.city || a.town || a.municipality || a.village || a.county || '';

    let cleanAddress = '';
    if (road) {
      cleanAddress = road + num;
      if (neighborhood) cleanAddress += ', ' + neighborhood;
      if (city) cleanAddress += ', ' + city;
    } else if (neighborhood) {
      cleanAddress = neighborhood + (city ? (', ' + city) : '');
    } else if (data.display_name) {
      const parts = data.display_name.split(',').map(s => s.trim()).filter(Boolean);
      cleanAddress = parts.slice(0, 3).join(', ');
    } else {
      cleanAddress = city || '';
    }

    return {
      address: cleanAddress,
      city: city,
      neighborhood: neighborhood,
      accuracy: position.accuracy
    };
  } catch (_) {
    return null;
  }
}
