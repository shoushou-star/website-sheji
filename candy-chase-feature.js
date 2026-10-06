(() => {
  if (window.mountCandyChaseFeature) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const desktopPointer = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 810px)');

  function mountCandyChaseFeature() {
    if (document.readyState === 'loading') return;
    const project = document.querySelector('#project');
    if (!project?.parentElement) return;

    const existing = document.querySelector('#candy-chase-feature');
    if (existing) {
      if (existing.nextElementSibling !== project) project.before(existing);
      return existing;
    }

    const feature = document.createElement('section');
    feature.id = 'candy-chase-feature';
    feature.setAttribute('aria-labelledby', 'candy-chase-feature-title');
    feature.dataset.mountedBefore = 'project';
    feature.innerHTML = `
      <a class="candy-feature-link" href="./candy-chase.html?from=portfolio#play">
        <img class="candy-feature-cover" src="./assets/candy-chase/cover.png" alt="CANDY CHASE 游戏加载画面">
        <video class="candy-feature-preview" muted loop playsinline preload="none" poster="./assets/candy-chase/cover.png" aria-hidden="true"></video>
        <p>GAME DESIGN · INTERACTIVE</p>
        <h2 id="candy-chase-feature-title">CANDY CHASE</h2>
        <span>开始试玩 →</span>
      </a>`;

    const link = feature.querySelector('a');
    const video = feature.querySelector('video');
    let hovered = false;
    let focused = false;

    const syncPreview = () => {
      const allowed = desktopPointer.matches && !reducedMotion.matches;
      if (!allowed || (!hovered && !focused)) {
        video.pause();
        link.classList.remove('is-preview-playing');
        if (!allowed && video.hasAttribute('src')) {
          video.removeAttribute('src');
          video.load();
        }
        return;
      }
      if (!video.hasAttribute('src')) video.src = './assets/candy-chase/hover-loop.mp4';
      video.play().catch(() => link.classList.remove('is-preview-playing'));
    };

    link.addEventListener('pointerenter', () => { hovered = true; syncPreview(); });
    link.addEventListener('pointerleave', () => { hovered = false; syncPreview(); });
    link.addEventListener('focus', () => { focused = true; syncPreview(); });
    link.addEventListener('blur', () => { focused = false; syncPreview(); });
    video.addEventListener('playing', () => {
      if (desktopPointer.matches && !reducedMotion.matches && (hovered || focused)) {
        link.classList.add('is-preview-playing');
      }
    });
    // Removed Framer subtrees can be collected without retaining media listeners.
    reducedMotion.addEventListener('change', syncPreview, { signal: getMediaSignal(feature) });
    desktopPointer.addEventListener('change', syncPreview, { signal: getMediaSignal(feature) });
    project.before(feature);
    return feature;
  }

  const mediaControllers = new Map();
  function getMediaSignal(feature) {
    if (!mediaControllers.has(feature)) mediaControllers.set(feature, new AbortController());
    return mediaControllers.get(feature).signal;
  }

  let scheduled = false;
  const scheduleMount = () => {
    if (scheduled) return;
    scheduled = true;
    // Yield to Framer hydration; recheck the live project node after it settles.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      scheduled = false;
      for (const [feature, controller] of mediaControllers) {
        if (!feature.isConnected) {
          feature.querySelector('video')?.pause();
          controller.abort();
          mediaControllers.delete(feature);
        }
      }
      mountCandyChaseFeature();
    }));
  };

  window.mountCandyChaseFeature = mountCandyChaseFeature;
  const start = () => {
    new MutationObserver(scheduleMount).observe(document.querySelector('#main') || document.body, { childList: true, subtree: true });
    document.querySelector('script[data-framer-bundle="main"]')?.addEventListener('load', scheduleMount, { once: true });
    scheduleMount();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
