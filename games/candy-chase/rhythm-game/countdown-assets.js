(() => {
  'use strict';

  const DIRECT_SELECTORS = [
    '#countdownNumber',
    '#countdown-number',
    '.countdown-number',
    '.countdown-value',
    '[data-countdown-number]',
    '#countdown > span',
    '.countdown-overlay > span',
  ];

  let countdownElement = null;
  let lastValue = '';
  let scanQueued = false;

  function normalizedValue(element) {
    const value = (element && element.textContent ? element.textContent : '').trim();
    return /^[123]$/.test(value) ? value : '';
  }

  function isPlausibleCountdown(element) {
    if (!element || !normalizedValue(element)) return false;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const centerX = rect.left + rect.width * 0.5;
    const centerY = rect.top + rect.height * 0.5;
    const central = centerX > innerWidth * 0.24
      && centerX < innerWidth * 0.76
      && centerY > innerHeight * 0.18
      && centerY < innerHeight * 0.82;
    const fontSize = Number.parseFloat(getComputedStyle(element).fontSize) || 0;
    return central && fontSize >= 28;
  }

  function findCountdownElement() {
    for (const selector of DIRECT_SELECTORS) {
      const element = document.querySelector(selector);
      if (element) return element;
    }

    return [...document.querySelectorAll('div, span, p')].find(isPlausibleCountdown) || null;
  }

  function showAsset(element, value) {
    if (!element || !value) return;
    element.classList.add('asset-countdown-number');
    element.dataset.countdownAsset = value;
    element.setAttribute('aria-label', value);

    if (value !== lastValue) {
      element.classList.remove('asset-countdown-pop');
      void element.offsetWidth;
      element.classList.add('asset-countdown-pop');
      lastValue = value;
    }
  }

  function syncCountdown() {
    if (!countdownElement || !countdownElement.isConnected) {
      countdownElement = findCountdownElement();
      lastValue = '';
    }
    if (!countdownElement) return;

    const value = normalizedValue(countdownElement);
    if (value) showAsset(countdownElement, value);
  }

  function queueSync() {
    if (scanQueued) return;
    scanQueued = true;
    requestAnimationFrame(() => {
      scanQueued = false;
      syncCountdown();
    });
  }

  function init() {
    syncCountdown();
    const observer = new MutationObserver(queueSync);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
