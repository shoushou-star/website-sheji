(function attachGameCore(root, factory) {
  'use strict';

  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.RhythmGameCore = api;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function createGameCore() {
  'use strict';

  const CONFIG = Object.freeze({
    bpm: 120,
    durationSeconds: 60,
    travelTimeSeconds: 2,
    perfectWindowMs: 100,
    goodWindowMs: 200,
    perfectScore: 100,
    goodScore: 50,
  });

  /**
   * Converts the signed timing error into a judgement.
   * Negative values are early and positive values are late.
   */
  function judgeOffsetMs(offsetMs) {
    if (!Number.isFinite(offsetMs)) {
      return 'none';
    }

    const absoluteOffset = Math.abs(offsetMs);

    if (absoluteOffset <= CONFIG.perfectWindowMs) {
      return 'perfect';
    }

    if (absoluteOffset <= CONFIG.goodWindowMs) {
      return 'good';
    }

    return 'none';
  }

  /**
   * Builds beats whose spawn and hit moments both occur inside the round.
   * Times are expressed in seconds from the start of active gameplay.
   */
  function buildBeatSchedule(
    bpm = CONFIG.bpm,
    durationSeconds = CONFIG.durationSeconds,
    travelTimeSeconds = CONFIG.travelTimeSeconds,
  ) {
    if (!Number.isFinite(bpm) || bpm <= 0) {
      throw new RangeError('bpm must be a positive finite number');
    }

    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      throw new RangeError('durationSeconds must be a positive finite number');
    }

    if (!Number.isFinite(travelTimeSeconds) || travelTimeSeconds < 0) {
      throw new RangeError('travelTimeSeconds must be a non-negative finite number');
    }

    const beatInterval = 60 / bpm;
    const schedule = [];

    for (
      let hitTime = travelTimeSeconds;
      hitTime < durationSeconds;
      hitTime += beatInterval
    ) {
      const roundedHitTime = Number(hitTime.toFixed(10));
      schedule.push(Object.freeze({
        id: schedule.length,
        spawnTime: Number((roundedHitTime - travelTimeSeconds).toFixed(10)),
        hitTime: roundedHitTime,
      }));
    }

    return schedule;
  }

  function createScoreState() {
    return {
      score: 0,
      combo: 0,
      maxCombo: 0,
      perfect: 0,
      good: 0,
      miss: 0,
      resolvedMaxScore: 0,
    };
  }

  /**
   * Applies one judgement without mutating the previous score state.
   * A `none` judgement models an empty press and has no gameplay effect.
   */
  function applyJudgement(state, judgement) {
    if (judgement === 'none') {
      return { ...state };
    }

    return applyNoteResult(state, {
      judgement,
      points: judgement === 'perfect' ? CONFIG.perfectScore
        : judgement === 'good' ? CONFIG.goodScore : 0,
      maxPoints: CONFIG.perfectScore,
    });
  }

  /** Applies a completed note once, including both endpoints of a hold. */
  function applyNoteResult(state, { judgement, points, maxPoints }) {
    const next = {
      ...state,
      score: state.score + points,
      resolvedMaxScore: (state.resolvedMaxScore ?? 0) + maxPoints,
    };

    if (judgement === 'perfect' || judgement === 'good') {
      next.combo += 1;
      next.maxCombo = Math.max(next.maxCombo, next.combo);
      next[judgement] += 1;
      return next;
    }

    if (judgement === 'miss') {
      next.combo = 0;
      next.miss += 1;
      return next;
    }

    throw new TypeError(`Unknown judgement: ${judgement}`);
  }

  function combineHoldJudgements(startJudgement, endJudgement) {
    const pointsFor = (value) => value === 'perfect' ? 100 : value === 'good' ? 50 : 0;
    const missed = startJudgement === 'miss' || endJudgement === 'miss';
    return {
      judgement: missed
        ? 'miss'
        : startJudgement === 'perfect' && endJudgement === 'perfect' ? 'perfect' : 'good',
      points: pointsFor(startJudgement) + pointsFor(endJudgement),
      maxPoints: 200,
    };
  }

  function noteMaxScore(note) {
    return note.type === 'hold' ? 200 : 100;
  }

  function calculateChartMaxScore(notes) {
    return notes.reduce((sum, note) => sum + noteMaxScore(note), 0);
  }

  function validateChart(notes, meta) {
    if (!Array.isArray(notes) || notes.length === 0) {
      throw new TypeError('chart notes must be a non-empty array');
    }
    const ids = new Set();
    let previousHitTime = -Infinity;
    let activeHoldEnd = -Infinity;

    for (const note of notes) {
      if (ids.has(note.id)) throw new RangeError('duplicate chart note id');
      ids.add(note.id);
      if (!['normal', 'speed', 'hold'].includes(note.type)) {
        throw new TypeError('unknown chart note type');
      }
      if (![note.spawnTime, note.hitTime].every(Number.isFinite)) {
        throw new TypeError('chart note times must be finite');
      }
      if (note.spawnTime > note.hitTime || note.hitTime < previousHitTime) {
        throw new RangeError('chart notes must be ordered');
      }
      if (note.hitTime > meta.audioDuration) throw new RangeError('chart note exceeds audio');
      if (note.hitTime <= activeHoldEnd) throw new RangeError('hold judgement overlap');
      if (note.type === 'hold') {
        if (!Number.isFinite(note.holdEndTime) || note.holdEndTime <= note.hitTime) {
          throw new RangeError('hold end must follow hit time');
        }
        activeHoldEnd = note.holdEndTime;
      }
      if (note.type === 'speed'
        && (!Number.isFinite(note.accelerationAt)
          || note.accelerationAt <= note.spawnTime
          || note.accelerationAt >= note.hitTime)) {
        throw new RangeError('speed acceleration must occur during travel');
      }
      previousHitTime = note.hitTime;
    }
    return true;
  }

  function travelProgress(note, gameTime, travelTimeSeconds = CONFIG.travelTimeSeconds) {
    const elapsedRatio = clamp((gameTime - note.spawnTime) / travelTimeSeconds, 0, 1);
    if (note.type !== 'speed') return elapsedRatio;
    const progress = elapsedRatio <= 0.65
      ? (elapsedRatio / 0.65) * 0.35
      : 0.35 + ((elapsedRatio - 0.65) / 0.35) * 0.65;
    // Stabilize decimal checkpoints after subtracting audio-clock timestamps.
    return Number(progress.toFixed(12));
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function roundToTwo(value) {
    return Number(value.toFixed(2));
  }

  function calculateMusicProgress(
    elapsedSeconds,
    durationSeconds = CONFIG.durationSeconds,
  ) {
    if (!Number.isFinite(elapsedSeconds)) return 0;
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return 0;
    return clamp(elapsedSeconds / durationSeconds, 0, 1);
  }

  function starRatingForRepair(repairPercent) {
    if (repairPercent >= 90) return 5;
    if (repairPercent >= 75) return 4;
    if (repairPercent >= 60) return 3;
    if (repairPercent >= 40) return 2;
    if (repairPercent >= 20) return 1;
    return 0;
  }

  function calculateRoundMetrics(state, totalNotes, chartMaxScore = totalNotes * 100) {
    const maximumScore = Number.isFinite(chartMaxScore) ? Math.max(0, chartMaxScore) : 0;
    const score = Number.isFinite(state.score) ? Math.max(0, state.score) : 0;
    const repairPercent = maximumScore > 0
      ? roundToTwo(clamp((score / maximumScore) * 100, 0, 100))
      : 0;

    const perfect = Number.isFinite(state.perfect) ? Math.max(0, state.perfect) : 0;
    const good = Number.isFinite(state.good) ? Math.max(0, state.good) : 0;
    const miss = Number.isFinite(state.miss) ? Math.max(0, state.miss) : 0;
    const resolvedMaximum = state.resolvedMaxScore
      ?? ((perfect + good + miss) * CONFIG.perfectScore);
    const accuracy = resolvedMaximum > 0
      ? roundToTwo(clamp(
        (score / resolvedMaximum) * 100,
        0,
        100,
      ))
      : 0;

    return {
      accuracy,
      repairPercent,
      starRating: starRatingForRepair(repairPercent),
    };
  }

  function buildCompletionDetail(state, totalNotes, chartMaxScore) {
    const metrics = calculateRoundMetrics(state, totalNotes, chartMaxScore);
    const normalizedTotalNotes = Number.isFinite(totalNotes) ? Math.max(0, totalNotes) : 0;
    const judgedNotes = state.perfect + state.good + state.miss;
    return {
      finalScore: state.score,
      maxCombo: state.maxCombo,
      perfect: state.perfect,
      good: state.good,
      miss: state.miss,
      accuracy: metrics.accuracy,
      repairPercent: metrics.repairPercent,
      starRating: metrics.starRating,
      totalNotes: normalizedTotalNotes,
      judgedNotes,
    };
  }

  function formatHudScore(score) {
    const safeScore = Number.isFinite(score) ? Math.max(0, Math.round(score)) : 0;
    return String(safeScore).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  return Object.freeze({
    CONFIG,
    judgeOffsetMs,
    buildBeatSchedule,
    createScoreState,
    applyJudgement,
    validateChart,
    travelProgress,
    combineHoldJudgements,
    applyNoteResult,
    calculateChartMaxScore,
    calculateMusicProgress,
    calculateRoundMetrics,
    buildCompletionDetail,
    formatHudScore,
  });
}));
