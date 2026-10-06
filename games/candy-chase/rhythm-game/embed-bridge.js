(function (root) {
  'use strict';

  function createEmbedBridge({ window, runId, prepare, start, dispose }) {
    if (!Number.isInteger(runId) || runId < 0) throw new TypeError('Invalid embedded game runId');
    const parent = window.parent;
    const origin = window.location.origin;
    let prepared = false;
    let started = false;
    let completed = false;
    let disposed = false;

    function onMessage(event) {
      const data = event.data;
      if (disposed || !prepared || started || event.source !== parent || event.origin !== origin
        || !data || Array.isArray(data) || data.type !== 'rhythmgame:start' || data.runId !== runId) return;
      started = true;
      start();
    }

    function onComplete(event) {
      if (disposed || !started || completed) return;
      completed = true;
      parent.postMessage({ type: 'rhythmgame:complete', runId, result: event.detail }, origin);
    }

    function cleanup() {
      if (disposed) return;
      disposed = true;
      window.removeEventListener('message', onMessage);
      window.removeEventListener('rhythmgame:complete', onComplete);
      window.removeEventListener('pagehide', cleanup);
      dispose();
    }

    window.addEventListener('message', onMessage);
    window.addEventListener('rhythmgame:complete', onComplete);
    window.addEventListener('pagehide', cleanup);
    const ready = Promise.resolve().then(prepare).then(() => {
      if (disposed) return;
      prepared = true;
      parent.postMessage({ type: 'rhythmgame:ready', runId }, origin);
    });
    return Object.freeze({ ready, dispose: cleanup });
  }

  root.RhythmEmbedBridge = Object.freeze({ createEmbedBridge });
}(globalThis));
