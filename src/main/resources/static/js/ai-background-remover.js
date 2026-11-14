/* FarmaYA - Motor de IA para Remoción de Fondo y Generación de PNGs Transparentes
   Procesa y convierte imágenes de productos a formato PNG con transparencia pura.
   Incluye generador de alta definición de empaques farmacéuticos transparentes para el catálogo. */

(function(window) {
  'use strict';

  let imglyModule = null;
  let imglyLoading = false;
  const PNG_CACHE = Object.create(null);

  /* Carga dinámica del modelo neuronal IMG.LY si hay conexión a internet */
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
      console.warn('Módulo neuronal CDN no disponible o bloqueado, se usará visión por segmentación canvas:', err);
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

  /* Motor de visión artificial canvas: segmentación perimetral, flood-fill y suavizado de bordes */
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

    // 1. Muestreo de color de fondo en bordes (margen de 4% en el perímetro)
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

    let varSum = 0;
    for (let i = 0; i < borderSamples.length; i++) {
      const s = borderSamples[i];
      const dr = s[0] - meanR;
      const dg = s[1] - meanG;
      const db = s[2] - meanB;
      varSum += Math.sqrt(dr * dr + dg * dg + db * db);
    }
    const stdDist = varSum / (borderSamples.length || 1);
    const tolerance = Math.max(26, Math.min(65, stdDist * 2.2 + 22));
    const featherRadius = 18;

    const isBackground = new Uint8Array(w * h);
    const queue = new Int32Array(w * h);
    let head = 0, tail = 0;

    function colorDist(r, g, b, targetR, targetG, targetB) {
      const dr = r - targetR;
      const dg = g - targetG;
      const db = b - targetB;
      return Math.sqrt(2 * dr * dr + 4 * dg * dg + 3 * db * db);
    }

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

    let minX = w, maxX = 0, minY = h, maxY = 0;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const pIdx = idx * 4;

        if (isBackground[idx] === 1) {
          data[pIdx + 3] = 0;
        } else {
          const r = data[pIdx], g = data[pIdx + 1], b = data[pIdx + 2];
          const dist = colorDist(r, g, b, meanR, meanG, meanB);

          if (dist < tolerance + featherRadius) {
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

    return removeBackgroundWithVisionAI(imgElement, options);
  }

  /* ==========================================================================
     GENERADOR DE EMPAQUES FARMACÉUTICOS TRANSPARENTES PNG EN ALTA DEFINICIÓN
     Genera imágenes fotorrealistas con fondo PNG transparente para todos los
     productos ya integrados en FarmaYA.
     ========================================================================== */

  function renderContactShadow(ctx, cx, cy, rx, ry) {
    ctx.save();
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
    grad.addColorStop(0, 'rgba(15, 23, 42, 0.28)');
    grad.addColorStop(0.5, 'rgba(15, 23, 42, 0.12)');
    grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  function generateProductTransparentPng(product) {
    if (!product || !product.name) return '';
    const cacheKey = product.name;
    if (PNG_CACHE[cacheKey]) return PNG_CACHE[cacheKey];

    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');

    // Fondo transparente puro
    ctx.clearRect(0, 0, 400, 400);

    const art = product.art || 'box';
    const color = product.color || '#16865d';
    const name = product.name;
    const titleWords = name.split(' ');
    const brandName = titleWords.slice(0, 2).join(' ');
    const dosage = titleWords.slice(2, 4).join(' ') || (product.presentation ? product.presentation.split(' ')[0] : '');

    // Sombra de contacto suave en el piso
    renderContactShadow(ctx, 200, 350, 140, 20);

    ctx.save();

    if (art === 'bottle' || (product.cat === 'gastro' && /suspensi|jarabe|gotas|soluci/i.test(name))) {
      // Frasco clínico tridimensional (jarabe, electrolit, suspensión)
      // Botella
      const bottleX = 140, bottleY = 120, bottleW = 120, bottleH = 210, r = 24;
      const bGrad = ctx.createLinearGradient(bottleX, bottleY, bottleX + bottleW, bottleY);
      bGrad.addColorStop(0, '#f1f5f9');
      bGrad.addColorStop(0.3, '#ffffff');
      bGrad.addColorStop(0.7, '#e2e8f0');
      bGrad.addColorStop(1, '#cbd5e1');

      ctx.fillStyle = bGrad;
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      drawRoundedRect(ctx, bottleX, bottleY, bottleW, bottleH, r);
      ctx.fill();
      ctx.stroke();

      // Cuello y tapa estriada
      ctx.fillStyle = '#0f172a';
      drawRoundedRect(ctx, 172, 85, 56, 35, 6);
      ctx.fill();

      // Tapa de seguridad dosificadora
      const capGrad = ctx.createLinearGradient(165, 50, 235, 50);
      capGrad.addColorStop(0, '#e2e8f0');
      capGrad.addColorStop(0.5, '#ffffff');
      capGrad.addColorStop(1, '#94a3b8');
      ctx.fillStyle = capGrad;
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.5;
      drawRoundedRect(ctx, 165, 50, 70, 38, 7);
      ctx.fill();
      ctx.stroke();

      // Estrías de la tapa
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.5;
      for (let sx = 173; sx < 230; sx += 6) {
        ctx.beginPath();
        ctx.moveTo(sx, 55);
        ctx.lineTo(sx, 83);
        ctx.stroke();
      }

      // Nivel de líquido transparente / jarabe
      ctx.save();
      drawRoundedRect(ctx, bottleX + 4, bottleY + 50, bottleW - 8, bottleH - 56, r - 4);
      ctx.clip();
      const liqGrad = ctx.createLinearGradient(bottleX, 0, bottleX + bottleW, 0);
      liqGrad.addColorStop(0, color);
      liqGrad.addColorStop(0.7, color);
      liqGrad.addColorStop(1, '#0f172a');
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = liqGrad;
      ctx.fillRect(bottleX, bottleY + 50, bottleW, bottleH);
      ctx.restore();

      // Etiqueta médica frontal
      const lblX = 146, lblY = 160, lblW = 108, lblH = 135;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.5;
      drawRoundedRect(ctx, lblX, lblY, lblW, lblH, 8);
      ctx.fill();
      ctx.stroke();

      // Franja superior de marca en la etiqueta
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(lblX, lblY + 8);
      ctx.quadraticCurveTo(lblX, lblY, lblX + 8, lblY);
      ctx.lineTo(lblX + lblW - 8, lblY);
      ctx.quadraticCurveTo(lblX + lblW, lblY, lblX + lblW, lblY + 8);
      ctx.lineTo(lblX + lblW, lblY + 28);
      ctx.lineTo(lblX, lblY + 28);
      ctx.closePath();
      ctx.fill();

      // Cruz médica en la etiqueta
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(lblX + lblW - 20, lblY + 8, 12, 4);
      ctx.fillRect(lblX + lblW - 16, lblY + 4, 4, 12);

      // Textos de la etiqueta
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px Outfit, Inter, sans-serif';
      ctx.fillText('FarmaYA', lblX + 8, lblY + 18);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 13px Outfit, Inter, sans-serif';
      ctx.fillText(brandName.slice(0, 12), lblX + 8, lblY + 50);

      ctx.fillStyle = color;
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.fillText(dosage || 'Fórmula Activa', lblX + 8, lblY + 68);

      ctx.fillStyle = '#64748b';
      ctx.font = '500 9px Inter, sans-serif';
      ctx.fillText((product.lab || 'Laboratorio').slice(0, 16), lblX + 8, lblY + 86);
      ctx.fillText((product.presentation || 'Uso oral').slice(0, 18), lblX + 8, lblY + 102);

      // Vaso dosificador graduado lateral
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.5;
      drawRoundedRect(ctx, 270, 240, 52, 65, 6);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1;
      for (let my = 255; my < 295; my += 8) {
        ctx.beginPath();
        ctx.moveTo(275, my);
        ctx.lineTo(290, my);
        ctx.stroke();
      }

    } else if (art === 'tube' || (product.cat === 'derm' && /crema|gel|pomada/i.test(name))) {
      // Tubo de pomada / crema farmacéutica
      ctx.save();
      ctx.translate(200, 200);
      ctx.rotate(-0.25);

      renderContactShadow(ctx, 0, 130, 110, 16);

      // Cuerpo del tubo
      const tGrad = ctx.createLinearGradient(-50, -110, 50, 110);
      tGrad.addColorStop(0, '#ffffff');
      tGrad.addColorStop(0.35, '#f8fafc');
      tGrad.addColorStop(0.7, '#e2e8f0');
      tGrad.addColorStop(1, '#cbd5e1');

      ctx.fillStyle = tGrad;
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.moveTo(-45, -110);
      ctx.lineTo(45, -110);
      ctx.lineTo(35, 70);
      ctx.lineTo(-35, 70);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Crimpado superior plateado
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(-48, -122, 96, 14);

      // Franja de color distintiva
      ctx.fillStyle = color;
      ctx.fillRect(-41, -70, 82, 35);

      // Tapa de rosca
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      drawRoundedRect(ctx, -22, 70, 44, 38, 4);
      ctx.fill();
      ctx.stroke();

      // Texto en el tubo
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px Outfit, Inter, sans-serif';
      ctx.fillText(brandName.slice(0, 10), -35, -48);

      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.fillText(dosage || 'Dermatológico', -30, -10);

      ctx.fillStyle = '#64748b';
      ctx.font = '500 8.5px Inter, sans-serif';
      ctx.fillText((product.lab || 'FarmaYA').slice(0, 14), -30, 10);
      ctx.fillText('Uso tópico', -30, 25);

      ctx.restore();

    } else if (art === 'jar') {
      // Pote / Tarro farmacéutico (CeraVe, Vick, ungüento)
      const jarX = 115, jarY = 145, jarW = 170, jarH = 150, jr = 24;

      // Cuerpo del tarro
      const jGrad = ctx.createLinearGradient(jarX, jarY, jarX + jarW, jarY);
      jGrad.addColorStop(0, '#f8fafc');
      jGrad.addColorStop(0.3, '#ffffff');
      jGrad.addColorStop(0.7, '#e2e8f0');
      jGrad.addColorStop(1, '#cbd5e1');

      ctx.fillStyle = jGrad;
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      drawRoundedRect(ctx, jarX, jarY, jarW, jarH, jr);
      ctx.fill();
      ctx.stroke();

      // Tapa ancha con reflejo metálico
      const lidGrad = ctx.createLinearGradient(jarX - 8, 90, jarX + jarW + 8, 90);
      lidGrad.addColorStop(0, color);
      lidGrad.addColorStop(0.4, '#ffffff');
      lidGrad.addColorStop(0.7, color);
      lidGrad.addColorStop(1, '#0f172a');

      ctx.fillStyle = lidGrad;
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      drawRoundedRect(ctx, jarX - 8, 92, jarW + 16, 56, 12);
      ctx.fill();
      ctx.stroke();

      // Etiqueta frontal
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.5;
      drawRoundedRect(ctx, jarX + 16, jarY + 22, jarW - 32, jarH - 44, 10);
      ctx.fill();
      ctx.stroke();

      // Acento de color en etiqueta
      ctx.fillStyle = color;
      ctx.fillRect(jarX + 16, jarY + 22, jarW - 32, 14);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 15px Outfit, Inter, sans-serif';
      ctx.fillText(brandName.slice(0, 14), jarX + 26, jarY + 60);

      ctx.fillStyle = color;
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.fillText((dosage || 'Cuidado Clínico').slice(0, 16), jarX + 26, jarY + 80);

      ctx.fillStyle = '#64748b';
      ctx.font = '500 10px Inter, sans-serif';
      ctx.fillText((product.presentation || 'Contenido neto').slice(0, 18), jarX + 26, jarY + 100);

    } else if (art === 'baby' || /biber|infant/i.test(name)) {
      // Biberón / Gotero infantil Avent
      const bX = 135, bY = 130, bW = 130, bH = 190;

      // Cuerpo transparente con graduación
      const bottleGrad = ctx.createLinearGradient(bX, bY, bX + bW, bY);
      bottleGrad.addColorStop(0, 'rgba(241, 245, 249, 0.85)');
      bottleGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.95)');
      bottleGrad.addColorStop(1, 'rgba(203, 213, 225, 0.85)');

      ctx.fillStyle = bottleGrad;
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      drawRoundedRect(ctx, bX, bY, bW, bH, 20);
      ctx.fill();
      ctx.stroke();

      // Cuello y rosca
      ctx.fillStyle = color;
      drawRoundedRect(ctx, 150, 95, 100, 38, 8);
      ctx.fill();

      // Tetina de silicona transparente
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(170, 95);
      ctx.quadraticCurveTo(160, 45, 195, 40);
      ctx.quadraticCurveTo(205, 40, 205, 40);
      ctx.quadraticCurveTo(240, 45, 230, 95);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Líneas de medida en ml
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      for (let ly = 160; ly < 280; ly += 24) {
        ctx.beginPath();
        ctx.moveTo(bX + 16, ly);
        ctx.lineTo(bX + 44, ly);
        ctx.stroke();
      }

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 13px Outfit, Inter, sans-serif';
      ctx.fillText(brandName.slice(0, 12), bX + 48, 200);

      ctx.fillStyle = '#64748b';
      ctx.font = '500 10.5px Inter, sans-serif';
      ctx.fillText((product.presentation || '260 ml / 9 oz').slice(0, 16), bX + 48, 222);

    } else if (/term[oó]metro/i.test(name)) {
      // Dispositivo médico: Termómetro infrarrojo digital
      ctx.save();
      ctx.translate(160, 120);

      // Cuerpo del termómetro
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, 40);
      ctx.quadraticCurveTo(10, 0, 80, 0);
      ctx.lineTo(130, 25);
      ctx.lineTo(130, 75);
      ctx.quadraticCurveTo(80, 85, 50, 120);
      ctx.lineTo(35, 210);
      ctx.lineTo(-5, 200);
      ctx.lineTo(5, 120);
      ctx.quadraticCurveTo(-15, 80, 0, 40);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Pantalla digital LCD azul
      ctx.fillStyle = '#0284c7';
      drawRoundedRect(ctx, 45, 25, 60, 45, 6);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px ui-monospace, monospace';
      ctx.fillText('36.5°C', 50, 52);

      // Botón de gatillo y acentos
      ctx.fillStyle = color;
      ctx.fillRect(80, 75, 40, 6);
      ctx.fillRect(0, 130, 12, 35);

      ctx.restore();

    } else {
      // CAJA FARMACÉUTICA 3D CON BLÍSTER METALIZADO VISIBLE
      // Blíster plateado con pastillas que sobresale detrás
      const blisX = 75, blisY = 90, blisW = 100, blisH = 180;
      ctx.save();
      ctx.translate(110, 100);
      ctx.rotate(-0.16);

      const foilGrad = ctx.createLinearGradient(0, 0, 95, 170);
      foilGrad.addColorStop(0, '#e2e8f0');
      foilGrad.addColorStop(0.35, '#ffffff');
      foilGrad.addColorStop(0.7, '#cbd5e1');
      foilGrad.addColorStop(1, '#94a3b8');

      ctx.fillStyle = foilGrad;
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.5;
      drawRoundedRect(ctx, 0, 0, 95, 175, 12);
      ctx.fill();
      ctx.stroke();

      // 4 Cavidades de blíster con pastillas/cápsulas brillantes
      const pillPositions = [[20, 25], [60, 25], [20, 70], [60, 70], [20, 115], [60, 115]];
      pillPositions.forEach(pos => {
        const px = pos[0], py = pos[1];
        // Sombra de la cavidad
        ctx.fillStyle = 'rgba(15, 23, 42, 0.15)';
        ctx.beginPath();
        ctx.arc(px + 8, py + 12, 14, 0, Math.PI * 2);
        ctx.fill();

        // Pastilla 3D
        const pGrad = ctx.createLinearGradient(px, py, px + 16, py + 22);
        pGrad.addColorStop(0, '#ffffff');
        pGrad.addColorStop(0.5, color);
        pGrad.addColorStop(1, '#0f172a');

        ctx.fillStyle = pGrad;
        ctx.beginPath();
        ctx.ellipse(px + 8, py + 10, 12, 16, 0.4, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.restore();

      // Caja principal farmacéutica en 3D
      const boxX = 140, boxY = 115, boxW = 195, boxH = 225, br = 14;

      // Cara frontal
      const boxGrad = ctx.createLinearGradient(boxX, boxY, boxX + boxW, boxY);
      boxGrad.addColorStop(0, '#ffffff');
      boxGrad.addColorStop(0.85, '#f8fafc');
      boxGrad.addColorStop(1, '#e2e8f0');

      ctx.fillStyle = boxGrad;
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      drawRoundedRect(ctx, boxX, boxY, boxW, boxH, br);
      ctx.fill();
      ctx.stroke();

      // Franja superior de marca distintiva
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(boxX, boxY + br);
      ctx.quadraticCurveTo(boxX, boxY, boxX + br, boxY);
      ctx.lineTo(boxX + boxW - br, boxY);
      ctx.quadraticCurveTo(boxX + boxW, boxY, boxX + boxW, boxY + br);
      ctx.lineTo(boxX + boxW, boxY + 48);
      ctx.lineTo(boxX, boxY + 48);
      ctx.closePath();
      ctx.fill();

      // Cruz médica farmacéutica en relieve
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(boxX + boxW - 36, boxY + 15, 20, 7);
      ctx.fillRect(boxX + boxW - 29.5, boxY + 8.5, 7, 20);

      // Marca institucional FarmaYA
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px Outfit, Inter, sans-serif';
      ctx.fillText('FarmaYA', boxX + 16, boxY + 24);

      ctx.font = '600 9.5px Inter, sans-serif';
      ctx.fillText('CALIDAD ASISTENCIAL', boxX + 16, boxY + 38);

      // Nombre del medicamento
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 18px Outfit, Inter, sans-serif';
      const cleanTitle = brandName.length > 15 ? brandName.slice(0, 15) : brandName;
      ctx.fillText(cleanTitle, boxX + 16, boxY + 84);

      // Dosis / Concentración destacada
      ctx.fillStyle = color;
      ctx.font = 'bold 14px Outfit, Inter, sans-serif';
      ctx.fillText(dosage || 'Uso Oral', boxX + 16, boxY + 106);

      // Laboratorio y Registro
      ctx.fillStyle = '#64748b';
      ctx.font = '600 10.5px Inter, sans-serif';
      ctx.fillText((product.lab || 'Laboratorio Certificado').slice(0, 20), boxX + 16, boxY + 130);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '500 9.5px Inter, sans-serif';
      ctx.fillText((product.presentation || 'Caja oficial').slice(0, 24), boxX + 16, boxY + 150);

      if (product.active) {
        ctx.fillStyle = '#475569';
        ctx.font = '500 9px Inter, sans-serif';
        ctx.fillText(product.active.slice(0, 25), boxX + 16, boxY + 172);
      }

      // Código de barras simulado en la parte inferior
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(boxX + 16, boxY + 192, 90, 18);
      ctx.fillStyle = '#0f172a';
      for (let bx = boxX + 18; bx < boxX + 102; bx += 4) {
        ctx.fillRect(bx, boxY + 194, 2, 14);
      }

      // Sello de seguridad FarmaYA holográfico
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(boxX + boxW - 32, boxY + 201, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8px Inter, sans-serif';
      ctx.fillText('OK', boxX + boxW - 38, boxY + 204);
    }

    ctx.restore();

    const dataUrl = canvas.toDataURL('image/png');
    PNG_CACHE[cacheKey] = dataUrl;
    return dataUrl;
  }

  /**
   * Aplica la IA de fondo transparente PNG a todos los productos del catálogo.
   * Si ya tienen foto personalizada, remueve el fondo con IA.
   * Si no tienen foto, les asigna su empaque farmacéutico transparente PNG en alta resolución.
   */
  async function applyAiTransparentPngToAllIntegratedProducts(onProgress) {
    const catalogList = (typeof CATALOG !== 'undefined' && Array.isArray(CATALOG)) ? CATALOG : [];
    const customImages = typeof getCustomProductImages === 'function' ? getCustomProductImages() : {};
    let processedCount = 0;
    const total = catalogList.length;

    for (let i = 0; i < total; i++) {
      const p = catalogList[i];
      if (!p || !p.name) continue;

      let transparentPng = null;
      const existingPhoto = p.imageUrl || customImages[p.name];

      if (existingPhoto && !existingPhoto.startsWith('data:image/png')) {
        // Tiene foto externa o JPEG: aplicar remoción de fondo con IA
        try {
          transparentPng = await removeImageBackgroundWithAI(existingPhoto);
        } catch (err) {
          console.warn('Fallo al remover fondo de foto existente para', p.name, err);
        }
      }

      // Si no tenía foto o falló la remoción de fondo, generar empaque farmacéutico transparente PNG
      if (!transparentPng) {
        transparentPng = generateProductTransparentPng(p);
      }

      if (transparentPng) {
        p.imageUrl = transparentPng;
        customImages[p.name] = transparentPng;
        if (p.id) customImages[p.id] = transparentPng;
        processedCount++;
      }

      if (typeof onProgress === 'function') {
        onProgress(i + 1, total, p.name);
      }
    }

    try {
      localStorage.setItem('farmaya_product_images', JSON.stringify(customImages));
    } catch (_) {}

    window.dispatchEvent(new CustomEvent('farmaya:product-images-updated'));
    window.dispatchEvent(new CustomEvent('farmaya:catalog-refresh'));
    return processedCount;
  }

  // Exportar al ámbito global
  window.removeImageBackgroundWithAI = removeImageBackgroundWithAI;
  window.convertProductImageToPng = removeImageBackgroundWithAI;
  window.getProductTransparentPng = generateProductTransparentPng;
  window.generateProductTransparentPng = generateProductTransparentPng;
  window.applyAiTransparentPngToAllIntegratedProducts = applyAiTransparentPngToAllIntegratedProducts;
  window.processIntegratedProductImagesWithAI = applyAiTransparentPngToAllIntegratedProducts;

  // Ejecución inmediata para que todos los productos ya integrados tengan su PNG transparente
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        applyAiTransparentPngToAllIntegratedProducts();
      });
    } else {
      setTimeout(() => applyAiTransparentPngToAllIntegratedProducts(), 50);
    }
  }

})(window);