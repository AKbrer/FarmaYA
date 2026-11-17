/**
 * FarmaYA - Módulo de Blindaje y Seguridad Frontend
 * - Deshabilita menú contextual (clic derecho) para prevenir inspección casual
 * - Bloquea combinaciones de teclas de Developer Tools (F12, Ctrl+Shift+I/J/C, Ctrl+U, Ctrl+S)
 * - Silencia logs de depuración en entornos de producción
 * - Protege contra embebido en iframes no autorizados (Clickjacking)
 */
(function () {
  'use strict';

  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  // 1. Silenciar consola en producción para evitar fugas de información sensible
  if (!isLocal) {
    try {
      const emptyFn = function () {};
      console.log = emptyFn;
      console.info = emptyFn;
      console.debug = emptyFn;
    } catch (_) {}
  }

  // 2. Banner disuasorio de seguridad
  try {
    const bannerStyle = 'color: #007953; font-size: 18px; font-weight: 800; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;';
    const subStyle = 'color: #334155; font-size: 12px; line-height: 1.5;';
    (console.warn || console.log)(
      '%c[SEGURIDAD FARMAYA]%c\nEsta consola está destinada exclusivamente al equipo de soporte de FarmaYA.\nCualquier intento de alteración o inyección de scripts infringe los términos de uso del servicio.',
      bannerStyle,
      subStyle
    );
  } catch (_) {}

  // 3. Bloqueo de menú contextual (clic derecho), permitiendo inputs y áreas de texto
  document.addEventListener('contextmenu', function (e) {
    const target = e.target;
    if (target) {
      const tag = target.tagName ? target.tagName.toUpperCase() : '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) {
        return true;
      }
    }
    e.preventDefault();
    return false;
  }, { passive: false });

  // 4. Bloqueo de atajos de teclado para Developer Tools y visualización de fuentes
  document.addEventListener('keydown', function (e) {
    const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
    const mod = isMac ? e.metaKey : e.ctrlKey;
    const key = (e.key || '').toUpperCase();
    const code = e.keyCode || e.which;

    const isF12 = key === 'F12' || code === 123;
    const isInspect = mod && e.shiftKey && (key === 'I' || key === 'J' || key === 'C' || code === 73 || code === 74 || code === 67);
    const isViewSource = mod && (key === 'U' || code === 85);
    const isSave = mod && (key === 'S' || code === 83);

    if (isF12 || isInspect || isViewSource || isSave) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  }, true);

  // 5. Protección Anti-Clickjacking (romper marcos si se carga en un iframe malicioso)
  try {
    if (window.top !== window.self) {
      window.top.location = window.self.location;
    }
  } catch (_) {}
})();
