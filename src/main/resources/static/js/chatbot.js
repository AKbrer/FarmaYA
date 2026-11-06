/**
 * FarmaBot - Asistente Farmacéutico Virtual y Orientador Clínico de FarmaYA
 * Orientación en medicamentos de venta libre (OTC), advertencias éticas de receta (Rx) y soporte del flujo FarmaYA.
 */
(function() {
  'use strict';

  let isOpen = false;
  let chatHistory = [];
  let isSending = false;

  const QUICK_QUESTIONS = [
    'Tengo dolor de cabeza y fiebre',
    'Acidez y reflujo estomacal',
    'Gripe y congestión nasal',
    '¿Por qué exigen fórmula médica?',
    '¿Cómo funciona el pedido y pago?',
    'Suero oral y deshidratación'
  ];

  function initChatbot() {
    if (document.getElementById('farmabot-root')) return;

    const root = document.createElement('div');
    root.id = 'farmabot-root';
    root.className = 'farmabot-container';

    // Botón flotante para abrir el chat
    const launcher = document.createElement('button');
    launcher.id = 'farmabot-launcher';
    launcher.className = 'farmabot-launcher-btn';
    launcher.setAttribute('aria-label', 'Abrir asistente virtual FarmaBot');
    launcher.innerHTML = `
      <div class="launcher-icon-wrap">
        <svg class="launcher-cross" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 5v14M5 12h14"></path>
        </svg>
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
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 10.5V8.8C19 4.9 15.9 1.8 12 1.8S5 4.9 5 8.8v1.7C3.3 11 2 12.8 2 15c0 2.8 2.2 5 5 5h10c2.8 0 5-2.2 5-5 0-2.2-1.3-4-3-4.5zM7.5 10c-.8 0-1.5-.7-1.5-1.5S6.7 7 7.5 7s1.5.7 1.5 1.5S8.3 10 7.5 10zm9 0c-.8 0-1.5-.7-1.5-1.5S15.7 7 16.5 7s1.5.7 1.5 1.5-.7 1.5-1.5 1.5z"/>
            </svg>
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
        <!-- Mensajes renderizados aquí -->
      </div>

      <div class="farmabot-quick-chips" id="farmabot-chips">
        <!-- Chips rápidos -->
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
      }, 100);
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
    renderInitialWelcome();
    renderQuickChips();
  }

  function renderInitialWelcome() {
    appendBotMessage({
      reply: 'Hola, soy FarmaBot, tu asistente farmacéutico y operativo en FarmaYA.\n\n' +
             'Puedo orientarte sobre síntomas habituales, opciones seguras de venta libre (OTC) o el funcionamiento de tus pedidos a domicilio.\n\n' +
             '¿Qué molestia o síntoma tienes hoy, o en qué puedo colaborarte?',
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
      chip.onclick = () => {
        const input = document.getElementById('farmabot-input');
        if (input) {
          input.value = q;
          handleUserSubmit();
        }
      };
      chipsContainer.appendChild(chip);
    });
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
    const chips = document.getElementById('farmabot-chips');
    if (chips) chips.style.display = 'none';

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
      <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
        <path d="M19 10.5V8.8C19 4.9 15.9 1.8 12 1.8S5 4.9 5 8.8v1.7C3.3 11 2 12.8 2 15c0 2.8 2.2 5 5 5h10c2.8 0 5-2.2 5-5 0-2.2-1.3-4-3-4.5zM7.5 10c-.8 0-1.5-.7-1.5-1.5S6.7 7 7.5 7s1.5.7 1.5 1.5S8.3 10 7.5 10zm9 0c-.8 0-1.5-.7-1.5-1.5S15.7 7 16.5 7s1.5.7 1.5 1.5-.7 1.5-1.5 1.5z"/>
      </svg>
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
          <span class="card-price">$${formatMoney(prod.price)}</span>
        `;

        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'btn-add-to-cart-small';
        addBtn.textContent = 'Agregar a la canasta';
        addBtn.onclick = () => {
          if (typeof window.addClientProduct === 'function') {
            window.addClientProduct({
              name: prod.name,
              price: prod.price,
              rx: !!prod.rx
            });
            if (typeof window.toast === 'function') {
              window.toast(prod.name + ' agregado a tu pedido.');
            }
          } else {
            if (typeof window.toast === 'function') {
              window.toast('Inicia sesión o abre el catálogo para pedir ' + prod.name);
            }
          }
        };

        card.appendChild(info);
        card.appendChild(addBtn);
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
        <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
          <path d="M19 10.5V8.8C19 4.9 15.9 1.8 12 1.8S5 4.9 5 8.8v1.7C3.3 11 2 12.8 2 15c0 2.8 2.2 5 5 5h10c2.8 0 5-2.2 5-5 0-2.2-1.3-4-3-4.5zM7.5 10c-.8 0-1.5-.7-1.5-1.5S6.7 7 7.5 7s1.5.7 1.5 1.5S8.3 10 7.5 10zm9 0c-.8 0-1.5-.7-1.5-1.5S15.7 7 16.5 7s1.5.7 1.5 1.5-.7 1.5-1.5 1.5z"/>
        </svg>
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

    // Listas con guion
    out = out.replace(/(?:^|\n)- (.*?)(?=\n|$)/g, '<div class="bot-list-item"><span class="bot-bullet">•</span> <span>$1</span></div>');

    // Listas numeradas
    out = out.replace(/(?:^|\n)(\d+)\. (.*?)(?=\n|$)/g, '<div class="bot-list-item"><strong class="bot-num">$1.</strong> <span>$2</span></div>');

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

  // Inicializar al cargar el DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChatbot);
  } else {
    initChatbot();
  }
})();
