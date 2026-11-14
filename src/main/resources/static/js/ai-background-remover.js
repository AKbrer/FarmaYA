/* FarmaYA - Motor de IA para Remocion de Fondo y Conversion a PNG Transparente
   Procesa fotografias de medicamentos y productos, eliminando fondos solidos,
   sombras duras o fondos de estudio para convertirlos a formato PNG transparente. */

(function(window) {
  'use strict';

  let imglyModule = null;
  let imglyLoading = false;

  async function loadImglyNeuralModel() {
    if (imglyModule) return imglyModule;
    if (imglyLoading) {
      return new Promise(resolve => {
        const check = setInterval(() => {
          if (imglyModule || !imglyLoading) {
            clearInterval(check);
            resolve(imglyModule);
          }
        }, 100);
      });
    }
    imglyLoading = true;
    try {
      imglyModule = await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.0/+esm');
      imglyLoading = false;
      return imglyModule;
    } catch (err) {
      console.warn('Modulo neuronal CDN no disponible o bloqueado, se usara vision por segmentacion canvas:', err);
      imglyLoading = false;
      return null;
    }
  }

  function loadImageElement(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => {
        // Segundo intento sin crossOrigin para URLs locales o data URLs
        const retry = new Image();
        retry.onload = () => resolve(retry);
        retry.onerror = reject;
        retry.src = src;
      };
      img.src = src;
    });
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /* Segmentacion visual de fondo por distribucion perimetral, flood-fill y suavizado de bordes */
  function removeBackgroundWithVisionAI(img, options) {
    const opts = options || {};
    const maxDimension = opts.maxDimension || 800;

    let w = img.naturalWidth || img.width;
    let h = img.naturalHeight || img.height;

    if (w > maxDimension || h > maxDimension) {
      const scale = Math.min(maxDimension / w, maxDimension / h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    // 1. Muestreo de color de fondo en bordes (margen de 4% en el perimetro)
    const marginX = Math.max(2, Math.floor(w * 0.04));
    const marginY = Math.max(2, Math.floor(h * 0.04));

    let bgR = 0, bgG = 0, bgB = 0, sampleCount = 0;
    const borderSamples = [];

    function addSample(x, y) {
      const idx = (y * w + x) * 4;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      borderSamples.push([r, g, b]);
      bgR += r;
      bgG += g;
      bgB += b;
      sampleCount++;
    }

    for (let x = 0; x < w; x += 3) {
      for (let y = 0; y < marginY; y += 2) addSample(x, y);
      for (let y = h - marginY; y < h; y += 2) addSample(x, y);
    }
    for (let y = marginY; y < h - marginY; y += 3) {
      for (let x = 0; x < marginX; x += 2) addSample(x, y);
      for (let x = w - marginX; x < w; x += 2) addSample(x, y);
    }

    if (sampleCount === 0) sampleCount = 1;
    const meanR = bgR / sampleCount;
    const meanG = bgG / sampleCount;
    const meanB = bgB / sampleCount;

    // Desviacion estandar para determinar tolerancia adaptativa
    let varSum = 0;
    for (let i = 0; i < borderSamples.length; i++) {
      const s = borderSamples[i];
      const dr = s[0] - meanR;
      const dg = s[1] - meanG;
      const db = s[2] - meanB;
      varSum += Math.sqrt(dr * dr + dg * dg + db * db);
    }
    const stdDist = varSum / (borderSamples.length || 1);
    const tolerance = Math.max(28, Math.min(65, stdDist * 2.2 + 24));
    const featherRadius = 18;

    // 2. Mapa de energia de pertenencia al fondo
    const isBackground = new Uint8Array(w * h); // 1 = fondo, 0 = primer plano
    const queue = new Int32Array(w * h);
    let head = 0, tail = 0;

    function colorDist(r, g, b, targetR, targetG, targetB) {
      // Ponderacion perceptiva CIELAB simplificada
      const dr = r - targetR;
      const dg = g - targetG;
      const db = b - targetB;
      return Math.sqrt(2 * dr * dr + 4 * dg * dg + 3 * db * db);
    }

    // Inicializar semillas en todos los bordes exteriores
    for (let x = 0; x < w; x++) {
      const topIdx = x;
      const botIdx = (h - 1) * w + x;
      const topP = topIdx * 4;
      const botP = botIdx * 4;

      if (colorDist(data[topP], data[topP + 1], data[topP + 2], meanR, meanG, meanB) <= tolerance * 1.35) {
        isBackground[topIdx] = 1;
        queue[tail++] = topIdx;
      }
      if (colorDist(data[botP], data[botP + 1], data[botP + 2], meanR, meanG, meanB) <= tolerance * 1.35) {
        isBackground[botIdx] = 1;
        queue[tail++] = botIdx;
      }
    }
    for (let y = 0; y < h; y++) {
      const leftIdx = y * w;
      const rightIdx = y * w + (w - 1);
      const leftP = leftIdx * 4;
      const rightP = rightIdx * 4;

      if (isBackground[leftIdx] === 0 && colorDist(data[leftP], data[leftP + 1], data[leftP + 2], meanR, meanG, meanB) <= tolerance * 1.35) {
        isBackground[leftIdx] = 1;
        queue[tail++] = leftIdx;
      }
      if (isBackground[rightIdx] === 0 && colorDist(data[rightP], data[rightP + 1], data[rightP + 2], meanR, meanG, meanB) <= tolerance * 1.35) {
        isBackground[rightIdx] = 1;
        queue[tail++] = rightIdx;
      }
    }

    // Flood fill conectado hacia el interior
    while (head < tail) {
      const curr = queue[head++];
      const cx = curr % w;
      const cy = Math.floor(curr / w);

      const neighbors = [
        cx > 0 ? curr - 1 : -1,
        cx < w - 1 ? curr + 1 : -1,
        cy > 0 ? curr - w : -1,
        cy < h - 1 ? curr + w : -1
      ];

      for (let n = 0; n < 4; n++) {
        const next = neighbors[n];
        if (next < 0 || isBackground[next] === 1) continue;

        const nextPx = next * 4;
        const r = data[nextPx];
        const g = data[nextPx + 1];
        const b = data[nextPx + 2];

        const dist = colorDist(r, g, b, meanR, meanG, meanB);
        if (dist <= tolerance) {
          isBackground[next] = 1;
          queue[tail++] = next;
        }
      }
    }

    // 3. Aplicar transparencia y suavizado perimetral (anti-aliasing)
    let minX = w, maxX = 0, minY = h, maxY = 0;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const pIdx = idx * 4;

        if (isBackground[idx] === 1) {
          data[pIdx + 3] = 0; // Transparente 100%
        } else {
          // Medir distancia al fondo mas cercano para bordes suaves
          const r = data[pIdx], g = data[pIdx + 1], b = data[pIdx + 2];
          const dist = colorDist(r, g, b, meanR, meanG, meanB);

          if (dist < tolerance + featherRadius) {
            // Suavizado suave en el contorno
            const factor = Math.max(0, Math.min(1, (dist - tolerance) / featherRadius));
            data[pIdx + 3] = Math.round(255 * factor);
          } else {
            data[pIdx + 3] = 255;
          }

          if (data[pIdx + 3] > 20) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);

    // 4. Auto-recorte y centrado con padding equilibrado
    if (minX <= maxX && minY <= maxY) {
      const boxW = maxX - minX + 1;
      const boxH = maxY - minY + 1;
      const padding = Math.max(12, Math.round(Math.max(boxW, boxH) * 0.05));

      const croppedCanvas = document.createElement('canvas');
      croppedCanvas.width = boxW + padding * 2;
      croppedCanvas.height = boxH + padding * 2;
      const croppedCtx = croppedCanvas.getContext('2d');

      croppedCtx.drawImage(
        canvas,
        minX, minY, boxW, boxH,
        padding, padding, boxW, boxH
      );

      return croppedCanvas.toDataURL('image/png');
    }

    return canvas.toDataURL('image/png');
  }

  /**
   * Remueve el fondo de una imagen con IA y devuelve una URL PNG con transparencia.
   * Si hay conexion a internet y compatibilidad, intenta el modelo neuronal (@imgly).
   * Si falla o esta offline, utiliza el motor de vision por segmentacion canvas.
   */
  async function removeImageBackgroundWithAI(source, options) {
    if (!source) return null;

    let imgElement = null;

    if (typeof source === 'string') {
      imgElement = await loadImageElement(source);
    } else if (source instanceof File || source instanceof Blob) {
      const dataUrl = await fileToDataUrl(source);
      imgElement = await loadImageElement(dataUrl);
    } else if (source instanceof HTMLImageElement) {
      imgElement = source;
    }

    if (!imgElement) return null;

    // Intento 1: Modelo Neuronal IMG.LY si esta disponible
    try {
      const imgly = await loadImglyNeuralModel();
      if (imgly && typeof imgly.removeBackground === 'function') {
        const inputSource = source instanceof Blob ? source : imgElement.src;
        const resultBlob = await imgly.removeBackground(inputSource, {
          progress: (key, current, total) => {
            if (options && typeof options.onProgress === 'function') {
              options.onProgress(Math.round((current / (total || 1)) * 100));
            }
          }
        });
        if (resultBlob) {
          const pngUrl = await blobToDataUrl(resultBlob);
          return pngUrl;
        }
      }
    } catch (e) {
      console.warn('Fallo el modelo neuronal @imgly, usando motor de vision AI canvas:', e);
    }

    // Intento 2: Motor de vision canvas inteligente de alto rendimiento
    return removeBackgroundWithVisionAI(imgElement, options);
  }

  /**
   * Procesa las imagenes ya integradas en FarmaYA (guardadas en local o en catalogo),
   * convirtiendolas a PNG con fondo transparente con IA.
   */
  async function processIntegratedProductImagesWithAI(onProgress) {
    const rawImages = typeof getCustomProductImages === 'function' ? getCustomProductImages() : {};
    const keys = Object.keys(rawImages);
    let processed = 0;

    for (let i = 0; i < keys.length; i++) {
      const name = keys[i];
      const currentUrl = rawImages[name];
      if (!currentUrl) continue;

      try {
        const transparentPng = await removeImageBackgroundWithAI(currentUrl);
        if (transparentPng) {
          rawImages[name] = transparentPng;
          if (typeof saveProductImage === 'function') {
            saveProductImage(name, transparentPng);
          }
          processed++;
        }
      } catch (err) {
        console.warn('No fue posible procesar imagen de ' + name + ' con IA:', err);
      }

      if (typeof onProgress === 'function') {
        onProgress(i + 1, keys.length, name);
      }
    }

    try {
      localStorage.setItem('farmaya_product_images', JSON.stringify(rawImages));
    } catch (_) {}

    window.dispatchEvent(new CustomEvent('farmaya:product-images-updated'));
    window.dispatchEvent(new CustomEvent('farmaya:catalog-refresh'));
    return processed;
  }

  window.removeImageBackgroundWithAI = removeImageBackgroundWithAI;
  window.convertProductImageToPng = removeImageBackgroundWithAI;
  window.processIntegratedProductImagesWithAI = processIntegratedProductImagesWithAI;

})(window);