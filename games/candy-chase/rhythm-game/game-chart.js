(function attachChart(root, factory) {
  'use strict';

  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.RhythmGameChart = api;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function createChart() {
  'use strict';

  const META = Object.freeze({
    bpm: 120,
    beatSeconds: 0.4992,
    audioDuration: 69.218005,
    firstHitTime: 4.981,
    lastHitTime: 66.8818,
    travelTimeSeconds: 2,
  });

  const REST_BEATS = new Set([1, 3, 5, 7, 9, 12, 15, 18, 22, 26, 30, 34, 38, 42, 46, 50, 54, 58, 62, 66, 70]);
  const HOLD_BEATS = new Set([76, 80, 84, 88, 92, 96, 100, 104, 108, 112, 116, 120]);
  const SPEED_BEATS = new Set([21, 25, 29, 33, 37, 41, 45, 49, 53, 57, 61, 65, 69, 73, 79, 87, 95, 103, 111, 119]);
  const BLOCKED_BEATS = new Set([...HOLD_BEATS].flatMap((beat) => [beat + 1, beat + 2]));

  const beatIndices = Array.from({ length: 125 }, (_, index) => index)
    .filter((beat) => !REST_BEATS.has(beat) && !BLOCKED_BEATS.has(beat));

  const NOTES = Object.freeze(beatIndices.map((beatIndex, id) => {
    const type = HOLD_BEATS.has(beatIndex)
      ? 'hold'
      : SPEED_BEATS.has(beatIndex) ? 'speed' : 'normal';
    const hitTime = Number((META.firstHitTime + beatIndex * META.beatSeconds).toFixed(4));
    const spawnTime = Number((hitTime - META.travelTimeSeconds).toFixed(4));

    return Object.freeze({
      id,
      beatIndex,
      type,
      spawnTime,
      hitTime,
      holdEndTime: type === 'hold'
        ? Number((hitTime + META.beatSeconds * 2).toFixed(4))
        : null,
      accelerationAt: type === 'speed'
        ? Number((spawnTime + META.travelTimeSeconds * 0.65).toFixed(4))
        : null,
    });
  }));

  return Object.freeze({ META, NOTES });
}));
