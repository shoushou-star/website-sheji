(() => {
  const shell = document.querySelector('[data-game-shell]');
  const iframe = shell.querySelector('iframe');
  const loading = shell.querySelector('[data-game-loading]');
  const error = shell.querySelector('[data-game-error]');
  const mobile = shell.querySelector('[data-game-mobile]');
  const mobileQuery = window.matchMedia('(max-width: 809px), (pointer: coarse)');
  const gameUrl = './games/candy-chase/index.html';
  let readinessTimer;
  let stopped = false;
  let retryCount = 0;

  function showState(state) {
    shell.dataset.gameState = state;
    loading.hidden = state !== 'loading';
    error.hidden = state !== 'error';
    mobile.hidden = state !== 'mobile';
  }

  function failLoad() {
    clearTimeout(readinessTimer);
    if (!stopped && !mobileQuery.matches) showState('error');
  }

  function loadGame(url) {
    clearTimeout(readinessTimer);
    stopped = false;
    showState('loading');
    readinessTimer = setTimeout(failLoad, 12000);
    iframe.setAttribute('src', url);
  }

  function applyDevice() {
    clearTimeout(readinessTimer);
    if (mobileQuery.matches) {
      stopped = true;
      iframe.removeAttribute('src');
      showState('mobile');
    } else {
      loadGame(gameUrl);
    }
  }

  iframe.addEventListener('load', () => {
    if (stopped || mobileQuery.matches || !iframe.hasAttribute('src')) return;
    clearTimeout(readinessTimer);
    showState('ready');
  });
  iframe.addEventListener('error', failLoad);
  shell.querySelector('[data-game-retry]').addEventListener('click', () => {
    if (!mobileQuery.matches) loadGame(`${gameUrl}?retry=${Date.now()}-${++retryCount}`);
  });
  mobileQuery.addEventListener('change', applyDevice);
  window.addEventListener('pagehide', () => {
    stopped = true;
    clearTimeout(readinessTimer);
    if (iframe.hasAttribute('src')) iframe.setAttribute('src', 'about:blank');
  });
  window.addEventListener('pageshow', event => {
    if (event.persisted) applyDevice();
  });
  applyDevice();
})();
