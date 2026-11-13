/**
 * FarmaBot - Asistente Farmacéutico Virtual y Orientador Clínico de FarmaYA
 * Orientación en medicamentos de venta libre (OTC), advertencias éticas de receta (Rx) y soporte del flujo FarmaYA.
 */
(function() {
  'use strict';

  let isOpen = false;
  let chatHistory = [];
  let isSending = false;

  const AVATAR_SRC = '/images/farmabot-avatar.jpg?v=20261106v2';

  const QUICK_QUESTIONS = [
    'Tengo dolor de cabeza y fiebre',
    'Acidez y reflujo estomacal',
    'Gripe y congestión nasal',
    '¿Por qué exigen fórmula médica?',
    '¿Cómo funciona el pedido y pago?',
    'Suero oral y deshidratación'
  ];

  function isClientView() {
    const hash = (window.location.hash || '').split('?')[0].toLowerCase();
    // Vistas operativas donde JAMAS debe salir el chatbot
    if (hash === '#pharmacy' || hash === '#courier' || hash === '#admin') {
      return false;
    }
    if (typeof state !== 'undefined' && state && state.user && state.user.role) {
      // Ocultar siempre si es rol interno de operacion (FARMACIA, REPARTIDOR, ADMIN)
      return state.user.role === 'CLIENTE';
    }
    // Para visitantes no autenticados: solo en catalogo/inicio/pedidos
    return !['#pharmacy', '#courier', '#admin'].includes(hash);
  }

  function initChatbot() {
    if (document.getElementById('farmabot-root')) return;

    const root = document.createElement('div');
    root.id = 'farmabot-root';
    root.className = 'farmabot-container';
    root.style.display = isClientView() ? '' : 'none';

    // Botón flotante para abrir el chat con la foto de perfil en lugar de la cruz
    const launcher = document.createElement('button');
    launcher.id = 'farmabot-launcher';
    launcher.className = 'farmabot-launcher-btn';
    launcher.setAttribute('aria-label', 'Abrir asistente virtual FarmaBot');
    launcher.innerHTML = `
      <div class="launcher-icon-wrap launcher-avatar-wrap">
        <img src="${AVATAR_SRC}" alt="FarmaBot" class="launcher-avatar-img">
      </div>
      <span class="launcher-label">FarmaBot IA</span>
      <span class="launcher-badge-pulse" aria-hidden="true"></span>
    `;

    // Ventana / Panel del Chat
    const panel = document.createElement('div');
    panel.id = 'farmabot-panel';
    panel.className = 'farmabot-panel';
    panel.setAttribute('aria-hidden', 'true');
    panel.style.display = 'none';

    panel.innerHTML = `
      <header class="farmabot-header">
        <div class="farmabot-header-left">
          <div class="farmabot-avatar">
            <img src="${AVATAR_SRC}" alt="FarmaBot" class="farmabot-avatar-img">
            <span class="avatar-online-dot"></span>
          </div>
          <div class="farmabot-header-info">
            <h3 class="farmabot-title">FarmaBot IA</h3>
            <p class="farmabot-subtitle">Orientador Farmacéutico FarmaYA</p>
          </div>
        </div>
        <div class="farmabot-header-actions">
          <button id="farmabot-reset-btn" class="header-action-btn" title="Reiniciar conversación" aria-label="Reiniciar chat">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
          </button>
          <button id="farmabot-close-btn" class="header-action-btn" title="Cerrar chat" aria-label="Cerrar ventana">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </header>

      <div id="farmabot-messages" class="farmabot-messages" role="log" aria-live="polite">
        <!-- Mensajes renderizados aqui -->
      </div>

      <div class="farmabot-chips-wrapper" id="farmabot-chips-wrapper">
        <div class="farmabot-chips-nav-row">
          <button type="button" class="farmabot-chips-arrow farmabot-chips-prev" id="farmabot-chips-prev" aria-label="Deslizar a la izquierda" title="Desplazar a la izquierda">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>
          <div class="farmabot-quick-chips" id="farmabot-chips" role="region" aria-label="Preguntas rapidas">
            <!-- Chips rapidos -->
          </div>
          <button type="button" class="farmabot-chips-arrow farmabot-chips-next" id="farmabot-chips-next" aria-label="Deslizar a la derecha" title="Desplazar a la derecha">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </button>
        </div>
        <div class="farmabot-scroll-track-wrap" id="farmabot-scroll-track-wrap">
          <div class="farmabot-scroll-track" id="farmabot-scroll-track" title="Desliza para ver mas preguntas">
            <div class="farmabot-scroll-thumb" id="farmabot-scroll-thumb"></div>
          </div>
        </div>
      </div>

      <form id="farmabot-form" class="farmabot-input-area" novalidate>
        <input type="text" id="farmabot-input" class="farmabot-input" placeholder="Pregunta sobre síntomas o medicamentos..." autocomplete="off">
        <button type="submit" id="farmabot-send-btn" class="farmabot-send-btn" aria-label="Enviar consulta">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </form>

      <footer class="farmabot-footer-disclaimer">
        <span>Orientación educativa. No reemplaza a tu médico de confianza.</span>
      </footer>
    `;

    root.appendChild(launcher);
    root.appendChild(panel);
    document.body.appendChild(root);

    // Eventos
    launcher.addEventListener('click', toggleChat);
    panel.querySelector('#farmabot-close-btn').addEventListener('click', toggleChat);
    panel.querySelector('#farmabot-reset-btn').addEventListener('click', resetChat);

    const form = panel.querySelector('#farmabot-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      handleUserSubmit();
    });

    renderInitialWelcome();
    renderQuickChips();
    setupChipsInteractions();
  }

  function toggleChat() {
    isOpen = !isOpen;
    const panel = document.getElementById('farmabot-panel');
    const launcher = document.getElementById('farmabot-launcher');
    if (!panel || !launcher) return;

    if (isOpen) {
      panel.style.display = 'flex';
      panel.setAttribute('aria-hidden', 'false');
      launcher.classList.add('is-open');
      setTimeout(() => {
        const inp = document.getElementById('farmabot-input');
        if (inp) inp.focus();
        scrollChatToBottom();
        updateSliderUI();
      }, 50);
      setTimeout(() => {
        updateSliderUI();
      }, 300);
    } else {
      panel.style.display = 'none';
      panel.setAttribute('aria-hidden', 'true');
      launcher.classList.remove('is-open');
    }
  }

  function resetChat() {
    chatHistory = [];
    const container = document.getElementById('farmabot-messages');
    if (container) container.innerHTML = '';
    const chipsWrapper = document.getElementById('farmabot-chips-wrapper') || document.getElementById('farmabot-chips');
    if (chipsWrapper) chipsWrapper.style.display = '';
    renderInitialWelcome();
    renderQuickChips();
  }

  function renderInitialWelcome() {
    appendBotMessage({
      reply: 'Hola, soy FarmaBot, tu asistente farmacéutico operativo en FarmaYA. ¿Qué malestares o síntomas tienes hoy con los que te pueda colaborar?',
      suggestedProducts: [],
      category: 'GENERAL',
      rxWarning: false
    });
  }

  function renderQuickChips() {
    const chipsContainer = document.getElementById('farmabot-chips');
    if (!chipsContainer) return;
    chipsContainer.innerHTML = '';

    QUICK_QUESTIONS.forEach(q => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'farmabot-chip';
      chip.textContent = q;
      chip.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (chipsContainer.dataset.wasDragging === 'true') {
          return;
        }
        const input = document.getElementById('farmabot-input');
        if (input) {
          input.value = q;
          handleUserSubmit();
        }
      });
      chipsContainer.appendChild(chip);
    });

    setTimeout(updateSliderUI, 50);
  }

  function setupChipsInteractions() {
    const container = document.getElementById('farmabot-chips');
    const prevBtn = document.getElementById('farmabot-chips-prev');
    const nextBtn = document.getElementById('farmabot-chips-next');
    const track = document.getElementById('farmabot-scroll-track');
    const thumb = document.getElementById('farmabot-scroll-thumb');
    if (!container) return;

    function scrollChipsBy(delta) {
      if (!container) return;
      if (typeof container.scrollBy === 'function') {
        try {
          container.scrollBy({ left: delta, behavior: 'smooth' });
        } catch (err) {
          container.scrollLeft += delta;
        }
      } else {
        container.scrollLeft += delta;
      }
      setTimeout(updateSliderUI, 200);
    }

    // 1. Botones de flecha izquierda y derecha
    if (prevBtn) {
      prevBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        scrollChipsBy(-180);
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        scrollChipsBy(180);
      });
    }

    // 2. Desplazamiento horizontal con la rueda del raton en computador
    container.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaY) > 0 || Math.abs(e.deltaX) > 0) {
        e.preventDefault();
        const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        container.scrollLeft += delta;
        updateSliderUI();
      }
    }, { passive: false });

    // 3. Arrastre directo con raton (drag-to-scroll) sobre las preguntas
    let isDown = false;
    let startX = 0;
    let scrollLeftStart = 0;
    let hasMoved = false;

    container.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      isDown = true;
      hasMoved = false;
      startX = e.pageX - container.offsetLeft;
      scrollLeftStart = container.scrollLeft;
      container.dataset.wasDragging = 'false';
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      const x = e.pageX - container.offsetLeft;
      const walk = (x - startX);
      if (Math.abs(walk) > 6) {
        if (!hasMoved) {
          hasMoved = true;
          container.classList.add('is-dragging');
          container.dataset.wasDragging = 'true';
        }
        container.scrollLeft = scrollLeftStart - walk;
        updateSliderUI();
      }
    });

    const finishDrag = () => {
      if (!isDown) return;
      isDown = false;
      container.classList.remove('is-dragging');
      if (hasMoved) {
        setTimeout(() => {
          if (container) container.dataset.wasDragging = 'false';
        }, 150);
      }
    };

    window.addEventListener('mouseup', finishDrag);

    // 4. Linea para desplazar en la vista computador: clic en pista y arrastre de la barra
    if (track && thumb) {
      let isThumbDragging = false;
      let thumbStartX = 0;
      let initialScroll = 0;

      // Clic directo en cualquier punto de la linea para saltar alli
      track.addEventListener('mousedown', (e) => {
        if (e.target === thumb) return;
        const rect = track.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const trackW = track.offsetWidth;
        const thumbW = thumb.offsetWidth;
        const maxTravel = trackW - thumbW;
        const targetRatio = maxTravel > 0 ? Math.max(0, Math.min(1, (clickX - thumbW / 2) / maxTravel)) : 0;
        const maxScroll = container.scrollWidth - container.clientWidth;
        container.scrollTo({ left: targetRatio * maxScroll, behavior: 'smooth' });
        setTimeout(updateSliderUI, 200);
      });

      // Arrastre manual del indicador deslizante (thumb)
      thumb.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        isThumbDragging = true;
        thumbStartX = e.clientX;
        initialScroll = container.scrollLeft;
        thumb.classList.add('is-dragging');
        e.stopPropagation();
        e.preventDefault();
      });

      window.addEventListener('mousemove', (e) => {
        if (!isThumbDragging) return;
        const deltaX = e.clientX - thumbStartX;
        const trackW = track.offsetWidth;
        const thumbW = thumb.offsetWidth;
        const maxTravel = trackW - thumbW;
        const maxScroll = container.scrollWidth - container.clientWidth;
        if (maxTravel > 0 && maxScroll > 0) {
          const scrollDelta = (deltaX / maxTravel) * maxScroll;
          container.scrollLeft = Math.max(0, Math.min(maxScroll, initialScroll + scrollDelta));
          updateSliderUI();
        }
      });

      window.addEventListener('mouseup', () => {
        if (isThumbDragging) {
          isThumbDragging = false;
          thumb.classList.remove('is-dragging');
        }
      });
    }

    container.addEventListener('scroll', () => {
      updateSliderUI();
    }, { passive: true });
  }

  function updateSliderUI() {
    const container = document.getElementById('farmabot-chips');
    const prevBtn = document.getElementById('farmabot-chips-prev');
    const nextBtn = document.getElementById('farmabot-chips-next');
    const trackWrap = document.getElementById('farmabot-scroll-track-wrap');
    const track = document.getElementById('farmabot-scroll-track');
    const thumb = document.getElementById('farmabot-scroll-thumb');
    if (!container) return;

    if (trackWrap) trackWrap.style.display = 'block';

    const scrollWidth = container.scrollWidth;
    const clientWidth = container.clientWidth;
    const maxScroll = Math.max(0, scrollWidth - clientWidth);
    const currentScroll = container.scrollLeft;

    // Actualizar estado de los botones de flecha
    if (prevBtn) {
      prevBtn.disabled = (currentScroll <= 4);
    }
    if (nextBtn) {
      nextBtn.disabled = (currentScroll >= maxScroll - 4);
    }

    // Actualizar linea deslizante
    if (track && thumb) {
      const trackWidth = track.clientWidth || track.offsetWidth;
      if (trackWidth > 0 && maxScroll > 0) {
        const ratio = clientWidth / scrollWidth;
        const thumbWidth = Math.max(45, Math.min(130, trackWidth * ratio));
        thumb.style.width = thumbWidth + 'px';

        const maxTravel = trackWidth - thumbWidth;
        const scrollRatio = currentScroll / maxScroll;
        const thumbLeft = Math.max(0, Math.min(maxTravel, scrollRatio * maxTravel));
        thumb.style.transform = `translateX(${thumbLeft}px)`;
      } else {
        thumb.style.width = '35%';
        thumb.style.transform = 'translateX(0px)';
      }
    }
  }

  async function handleUserSubmit() {
    if (isSending) return;
    const input = document.getElementById('farmabot-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    appendUserMessage(text);
    chatHistory.push({ role: 'user', text: text });

    // Ocultar chips tras primera interacción para dejar espacio al chat
    const chipsWrapper = document.getElementById('farmabot-chips-wrapper') || document.getElementById('farmabot-chips');
    if (chipsWrapper) chipsWrapper.style.display = 'none';

    // Mostrar indicador de escribiendo
    showTypingIndicator();
    isSending = true;

    try {
      const res = await fetch('/api/chat/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: chatHistory.slice(-6)
        })
      });

      removeTypingIndicator();

      if (!res.ok) {
        throw new Error('No se pudo conectar con el servidor de orientación clínica.');
      }

      const data = await res.json();
      chatHistory.push({ role: 'assistant', text: data.reply || '' });
      appendBotMessage(data);

    } catch (err) {
      removeTypingIndicator();
      appendBotMessage({
        reply: 'Ha ocurrido una interrupción temporal en la conexión: ' + (err.message || 'Inténtalo de nuevo.') +
               '\n\nRecuerda que ante cualquier urgencia o síntoma agudo debes consultar con tu médico o acudir a urgencias.',
        suggestedProducts: [],
        category: 'ERROR',
        rxWarning: false
      });
    } finally {
      isSending = false;
      scrollChatToBottom();
    }
  }

  function appendUserMessage(text) {
    const container = document.getElementById('farmabot-messages');
    if (!container) return;

    const msgRow = document.createElement('div');
    msgRow.className = 'chat-row user-row';

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble user-bubble';
    bubble.textContent = text;

    msgRow.appendChild(bubble);
    container.appendChild(msgRow);
    scrollChatToBottom();
  }

  function appendBotMessage(data) {
    const container = document.getElementById('farmabot-messages');
    if (!container) return;

    const msgRow = document.createElement('div');
    msgRow.className = 'chat-row bot-row';

    const avatarWrap = document.createElement('div');
    avatarWrap.className = 'bot-avatar-tiny';
    avatarWrap.innerHTML = `
      <img src="${AVATAR_SRC}" alt="FarmaBot" class="bot-avatar-img-tiny">
    `;

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble bot-bubble' + (data.rxWarning ? ' is-rx-warning' : '');

    if (data.rxWarning) {
      const rxHeader = document.createElement('div');
      rxHeader.className = 'rx-warning-header';
      rxHeader.innerHTML = `
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        <span>Control Sanitario / Requiere Fórmula Médica</span>
      `;
      bubble.appendChild(rxHeader);
    }

    const contentDiv = document.createElement('div');
    contentDiv.className = 'bot-text-content';
    contentDiv.innerHTML = formatMarkdownText(data.reply || '');
    bubble.appendChild(contentDiv);

    // Si hay productos sugeridos del catálogo oficial, renderizar tarjetas interactivas
    if (data.suggestedProducts && data.suggestedProducts.length > 0) {
      const productsWrap = document.createElement('div');
      productsWrap.className = 'bot-products-grid';

      const prodHeading = document.createElement('div');
      prodHeading.className = 'bot-products-heading';
      prodHeading.textContent = 'Opciones de venta libre en FarmaYA:';
      productsWrap.appendChild(prodHeading);

      data.suggestedProducts.forEach(prod => {
        const card = document.createElement('div');
        card.className = 'bot-product-card';

        const info = document.createElement('div');
        info.className = 'card-info';
        info.innerHTML = `
          <strong class="card-title">${escapeHtml(prod.name)}</strong>
          <span class="card-presentation">${escapeHtml(prod.presentation || prod.active || '')}</span>
        `;

        const actionRow = document.createElement('div');
        actionRow.className = 'card-action-row';

        const priceSpan = document.createElement('span');
        priceSpan.className = 'card-price';
        priceSpan.textContent = '$' + formatMoney(prod.price);

        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'btn-add-to-cart-small';
        addBtn.textContent = 'Agregar a la canasta';

        addBtn.onclick = () => {
          const user = window.state && window.state.user;

          // 1. Si no ha iniciado sesión:
          if (!user) {
            // Guardar producto en la canasta para que persista
            if (typeof window.addClientProduct === 'function') {
              window.addClientProduct({
                name: prod.name,
                price: prod.price,
                rx: !!prod.rx
              });
            }
            if (typeof window.toast === 'function') {
              window.toast('Inicia sesión o crea tu cuenta para ver tu canasta y completar tu pedido de ' + prod.name + '.', 'warn');
            }
            // Redirigir a login para que inicie sesión y vea su canasta cargada
            window.location.hash = '#login';
            return;
          }

          // 2. Si está autenticado pero con otro rol (FARMACIA o REPARTIDOR):
          if (user.role !== 'CLIENTE') {
            if (typeof window.toast === 'function') {
              window.toast('Tu cuenta es de tipo ' + (user.role || 'aliado') + '. Para hacer pedidos a farmacias, ingresa con una cuenta de Cliente.', 'warn');
            }
            return;
          }

          // 3. Usuario autenticado como CLIENTE: agregar al carrito y sincronizar UI en vivo
          if (typeof window.addClientProduct === 'function') {
            window.addClientProduct({
              name: prod.name,
              price: prod.price,
              rx: !!prod.rx
            });
          }

          if (typeof window.syncClientCartUI === 'function') {
            window.syncClientCartUI();
          }

          if (typeof window.toast === 'function') {
            window.toast(prod.name + ' añadido a tu canasta FarmaYA.');
          }
        };

        actionRow.appendChild(priceSpan);
        actionRow.appendChild(addBtn);
        card.appendChild(info);
        card.appendChild(actionRow);
        productsWrap.appendChild(card);
      });

      bubble.appendChild(productsWrap);
    }

    msgRow.appendChild(avatarWrap);
    msgRow.appendChild(bubble);
    container.appendChild(msgRow);
    scrollChatToBottom();
  }

  function showTypingIndicator() {
    removeTypingIndicator();
    const container = document.getElementById('farmabot-messages');
    if (!container) return;

    const row = document.createElement('div');
    row.id = 'farmabot-typing-row';
    row.className = 'chat-row bot-row typing-row';
    row.innerHTML = `
      <div class="bot-avatar-tiny">
        <img src="${AVATAR_SRC}" alt="FarmaBot" class="bot-avatar-img-tiny">
      </div>
      <div class="chat-bubble bot-bubble typing-bubble">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </div>
    `;
    container.appendChild(row);
    scrollChatToBottom();
  }

  function removeTypingIndicator() {
    const el = document.getElementById('farmabot-typing-row');
    if (el) el.remove();
  }

  function scrollChatToBottom() {
    const container = document.getElementById('farmabot-messages');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  function formatMarkdownText(raw) {
    if (!raw) return '';
    let out = escapeHtml(raw);

    // Negritas
    out = out.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Listas con viñeta (• o -)
    out = out.replace(/(?:^|\n)[•\-]\s*(.*?)(?=\n|$)/g, '<div class="bot-list-item"><span class="bot-bullet">•</span><span>$1</span></div>');

    // Listas numeradas (ej. 1. 2.)
    out = out.replace(/(?:^|\n)(\d+)\.\s*(.*?)(?=\n|$)/g, '<div class="bot-list-item"><strong class="bot-num">$1.</strong><span>$2</span></div>');

    // Saltos de línea
    out = out.replace(/\n\n/g, '<br><br>');
    out = out.replace(/\n/g, '<br>');

    return out;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatMoney(n) {
    return Math.round(Number(n) || 0).toLocaleString('es-CO');
  }

  function syncChatbotVisibility() {
    const root = document.getElementById('farmabot-root');
    if (!root) return;
    const show = isClientView();
    if (show) {
      root.style.removeProperty('display');
      root.style.display = '';
    } else {
      root.style.setProperty('display', 'none', 'important');
      if (isOpen) {
        isOpen = false;
        const panel = document.getElementById('farmabot-panel');
        if (panel) {
          panel.style.setProperty('display', 'none', 'important');
          panel.setAttribute('aria-hidden', 'true');
        }
      }
    }
  }
  window.syncChatbotVisibility = syncChatbotVisibility;
  window.addEventListener('hashchange', syncChatbotVisibility);
  window.addEventListener('popstate', syncChatbotVisibility);
  setInterval(syncChatbotVisibility, 600);

  // Inicializar al cargar el DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { initChatbot(); syncChatbotVisibility(); });
  } else {
    initChatbot();
    syncChatbotVisibility();
  }
})();
