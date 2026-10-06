(function attachAudioClock(root, factory) {
  'use strict';

  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.RhythmAudioClock = api;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function createAudioClock() {
  'use strict';

  /** The media element owns playback time; no separate timer is maintained. */
  class AudioClock {
    constructor(media) {
      if (!media) throw new TypeError('AudioClock requires a media element');
      this.media = media;
    }

    get currentTime() { return Number(this.media.currentTime) || 0; }
    get duration() { return Number.isFinite(this.media.duration) ? this.media.duration : 0; }
    get ended() { return Boolean(this.media.ended); }
    get paused() { return Boolean(this.media.paused); }

    whenReady() {
      if (this.media.error) {
        return Promise.reject(new Error('BGM metadata failed to load'));
      }
      if (this.media.readyState >= 1 && this.duration > 0) {
        return Promise.resolve(this.duration);
      }

      return new Promise((resolve, reject) => {
        const cleanup = () => {
          this.media.removeEventListener('loadedmetadata', onMetadata);
          this.media.removeEventListener('error', onError);
        };
        const onMetadata = () => {
          cleanup();
          if (this.duration > 0) {
            resolve(this.duration);
          } else {
            reject(new Error('BGM metadata has no positive finite duration'));
          }
        };
        const onError = () => {
          cleanup();
          reject(new Error('BGM metadata failed to load'));
        };

        this.media.addEventListener('loadedmetadata', onMetadata, { once: true });
        this.media.addEventListener('error', onError, { once: true });
        try {
          this.media.load();
        } catch (error) {
          cleanup();
          reject(error);
        }
      });
    }

    async unlock() {
      const previousMuted = this.media.muted;
      this.media.muted = true;
      try {
        // Invoke play before yielding so a caller's user gesture remains usable.
        await this.media.play();
        this.media.pause();
        this.media.currentTime = 0;
      } finally {
        this.media.muted = previousMuted;
      }
    }

    async playFromStart() {
      this.media.currentTime = 0;
      await this.media.play();
    }

    pause() { this.media.pause(); }

    async resume() { await this.media.play(); }

    reset() {
      this.media.pause();
      this.media.currentTime = 0;
    }
  }

  return Object.freeze({ AudioClock });
}));
