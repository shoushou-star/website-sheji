(function () {
  'use strict';

  const Core = globalThis.RhythmGameCore;
  const Chart = globalThis.RhythmGameChart;
  const Audio = globalThis.RhythmAudioClock;
  if (!Core || !Chart || !Audio) {
    throw new Error('RhythmGameCore, RhythmGameChart, and RhythmAudioClock must be loaded before app.js');
  }
  const { AudioClock } = Audio;
  const embedParams = new URLSearchParams(location.search);
  const embedded = embedParams.get('embed') === '1';
  const runId = Number(embedParams.get('runId'));
  const bgmClock = new AudioClock(document.querySelector('#gameBgm'));
  Core.validateChart(Chart.NOTES, Chart.META);
  const chartMaxScore = Core.calculateChartMaxScore(Chart.NOTES);

  const DESIGN = Object.freeze({ width: 2048, height: 1152 });
  const CANDY_SOURCES = Object.freeze({
    normal: 'assets/candies/candy-pink.png',
    speed: 'assets/candies/candy-yellow.png',
    hold: 'assets/candies/candy-blue.png',
  });
  const JUDGEMENT_SOURCES = Object.freeze({
    perfect: 'assets/ui/judgements/perfect.png',
    good: 'assets/ui/judgements/good.png',
    miss: 'assets/ui/judgements/miss.png',
  });
  const COUNTDOWN_SECONDS = 3;
  const SPAWN_GROW_SECONDS = 0.2;
  const SUCCESS_POSE_MS = 250;
  const MISS_POSE_MS = 450;
  const HOLD_REENTRY_MS = 1500;

  const elements = {
    stage: document.querySelector('#gameStage'),
    path: document.querySelector('#travelPath'),
    notes: document.querySelector('#notesLayer'),
    score: document.querySelector('#scoreValue'),
    combo: document.querySelector('#comboValue'),
    pauseButton: document.querySelector('#pauseButton'),
    pauseOverlay: document.querySelector('#pauseOverlay'),
    resumeButton: document.querySelector('#resumeButton'),
    progressHud: document.querySelector('#rhythmProgressHud'),
    ratingStars: Array.from(document.querySelectorAll('[data-rating-star]')),
    ratingStarsLabel: document.querySelector('#ratingStars'),
    musicProgress: document.querySelector('#musicProgress'),
    musicProgressFill: document.querySelector('#musicProgressFill'),
    judgement: document.querySelector('#judgementText'),
    judgementImage: document.querySelector('#judgementImage'),
    countdown: document.querySelector('#countdown'),
    startOverlay: document.querySelector('#startOverlay'),
    startButton: document.querySelector('#startButton'),
    audioLoadError: document.querySelector('#audioLoadError'),
    resultOverlay: document.querySelector('#resultOverlay'),
    resultScore: document.querySelector('#resultScore'),
    resultCombo: document.querySelector('#resultCombo'),
    restartButton: document.querySelector('#restartButton'),
    audioRecoveryOverlay: document.querySelector('#audioRecoveryOverlay'),
    audioRecoveryMessage: document.querySelector('#audioRecoveryMessage'),
    audioRecoveryButton: document.querySelector('#audioRecoveryButton'),
    characterIdle: document.querySelector('#characterIdle'),
    characterHit: document.querySelector('#characterHit'),
    characterMiss: document.querySelector('#characterMiss'),
  };

  const missingElement = Object.entries(elements).find(([, value]) => !value);
  if (missingElement) {
    throw new Error(`Missing required element: ${missingElement[0]}`);
  }
  if (elements.ratingStars.length !== 5) {
    throw new Error(`Expected 5 rating stars, found ${elements.ratingStars.length}`);
  }

  let sfxContext = null;
  let animationFrame = 0;
  let countdownEndTime = 0;
  let status = 'idle';
  let notes = [];
  let scoreState = Core.createScoreState();
  let pathLength = 0;
  let endTangent = { x: -1, y: 0 };
  let characterVersion = 0;
  let judgementVersion = 0;
  let pausedFromStatus = null;
  let isInputHeld = false;
  let heldSource = null;
  let activeHold = null;
  let pausedMediaTime = 0;
  let pausedCountdownRemaining = 0;
  let reentryTimeout = 0;
  let reentryDeadline = 0;
  let lifecycleVersion = 0;
  let completionDispatched = false;
  let pauseAfterArming = false;
  let disposed = false;
  let embedStartAccepted = false;
  const activeSfx = new Set();
  const listenerCleanups = [];

  function listen(target, type, callback, options) {
    if (disposed) return;
    target.addEventListener(type, callback, options);
    listenerCleanups.push(() => target.removeEventListener(type, callback, options));
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function smoothstep(value) {
    const t = clamp(value, 0, 1);
    return t * t * (3 - 2 * t);
  }

  function configurePath() {
    pathLength = elements.path.getTotalLength();
    const end = elements.path.getPointAtLength(pathLength);
    const beforeEnd = elements.path.getPointAtLength(Math.max(0, pathLength - 8));
    const dx = end.x - beforeEnd.x;
    const dy = end.y - beforeEnd.y;
    const magnitude = Math.hypot(dx, dy) || 1;
    endTangent = { x: dx / magnitude, y: dy / magnitude };
  }

  function resetScore() {
    scoreState = Core.createScoreState();
    renderHud();
  }

  function renderHud() {
    elements.score.textContent = Core.formatHudScore(scoreState.score);
    elements.combo.textContent = String(scoreState.combo);
    renderRatingStars();
  }

  function renderRatingStars() {
    const metrics = Core.calculateRoundMetrics(scoreState, notes.length, chartMaxScore);
    elements.ratingStars.forEach((star, index) => {
      star.classList.toggle('is-earned', index < metrics.starRating);
    });
    elements.ratingStarsLabel.setAttribute(
      'aria-label',
      `Current grade: ${metrics.starRating} of 5 stars`,
    );
  }

  function renderMusicProgress(progress) {
    const value = clamp(progress, 0, 1);
    elements.progressHud.style.setProperty('--music-progress', String(value));
    elements.musicProgress.setAttribute('aria-valuenow', String(Math.round(value * 100)));
  }

  function resetProgressHud() {
    renderMusicProgress(0);
    renderRatingStars();
  }

  function setPauseUi(isPaused) {
    elements.pauseButton.setAttribute('aria-pressed', String(isPaused));
    elements.pauseButton.setAttribute('aria-label', isPaused ? 'Resume game' : 'Pause game');
    elements.pauseOverlay.hidden = !isPaused;
  }

  async function pauseGame() {
    if (status === 'arming') {
      pauseAfterArming = true;
      return;
    }
    if (!['countdown', 'starting-audio', 'playing', 'reengaging', 'resuming-audio'].includes(status)) return;
    if (status === 'countdown') {
      pausedCountdownRemaining = Math.max(0, countdownEndTime - sfxContext.currentTime);
    }
    pausedFromStatus = status === 'resuming-audio' ? pausedFromStatus
      : status === 'countdown' ? 'countdown' : 'playing';
    lifecycleVersion += 1;
    clearReentry();
    pausedMediaTime = bgmClock.currentTime;
    status = 'paused';
    clearInputLatch();
    bgmClock.pause();
    setCharacter('idle');
    setPauseUi(true);
    window.dispatchEvent(new CustomEvent('rhythmgame:pause'));
    try {
      await suspendSfx();
    } catch (error) {
      if (status === 'paused') showAudioLoadError(error);
    }
  }

  function clearReentry() {
    window.clearTimeout(reentryTimeout);
    reentryTimeout = 0;
    reentryDeadline = 0;
    if (elements.countdown.textContent === 'HOLD') elements.countdown.hidden = true;
  }

  function settleCancelledPlayback(version) {
    // A newer playback lifecycle owns both media and SFX while it is starting.
    // Stale continuations may only restore a lifecycle that still wants silence.
    if (version !== lifecycleVersion
      && !['paused', 'reengaging', 'idle', 'result', 'disposed'].includes(status)) return;
    if (status !== 'playing') bgmClock.pause();
    if (['paused', 'reengaging', 'idle', 'result', 'disposed'].includes(status)) void suspendSfx();
  }

  async function resumePlayback(reenteredHold = false) {
    const nextStatus = pausedFromStatus;
    const version = ++lifecycleVersion;
    status = 'resuming-audio';
    clearReentry();
    setPauseUi(false);
    try {
      await Promise.all([
        sfxContext?.resume(),
        nextStatus === 'playing' ? bgmClock.resume() : Promise.resolve(),
      ]);
    } catch (error) {
      if (version === lifecycleVersion) showAudioLoadError(error);
      else settleCancelledPlayback(version);
      return;
    }
    if (version !== lifecycleVersion || status !== 'resuming-audio') {
      settleCancelledPlayback(version);
      return;
    }
    if (nextStatus === 'countdown') {
      countdownEndTime = sfxContext.currentTime + pausedCountdownRemaining;
    }
    status = nextStatus;
    pausedFromStatus = null;
    if (reenteredHold && activeHold) {
      if (!isInputHeld) finishHold('miss');
      else {
        setCharacter('hit');
        fireAttack(activeHold.startJudgement, 'hold-start');
      }
    }
  }

  function resumeGame() {
    if (status !== 'paused' || !pausedFromStatus) return;
    bgmClock.media.currentTime = pausedMediaTime;
    if (pausedFromStatus === 'playing' && activeHold) {
      status = 'reengaging';
      setPauseUi(false);
      elements.countdown.classList.remove('asset-countdown-number', 'asset-countdown-pop');
      elements.countdown.removeAttribute('data-countdown-asset');
      elements.countdown.setAttribute('aria-label', 'HOLD');
      elements.countdown.textContent = 'HOLD';
      elements.countdown.hidden = false;
      reentryDeadline = performance.now() + HOLD_REENTRY_MS;
      reentryTimeout = window.setTimeout(expireReentry, HOLD_REENTRY_MS);
      return;
    }
    void resumePlayback();
  }

  function expireReentry() {
    if (status !== 'reengaging') return;
    clearReentry();
    clearInputLatch();
    finishHold('miss');
    void resumePlayback();
  }

  function setCharacter(kind, durationMs = 0) {
    characterVersion += 1;
    const version = characterVersion;
    elements.characterIdle.classList.toggle('is-active', kind === 'idle');
    elements.characterHit.classList.toggle('is-active', kind === 'hit');
    elements.characterMiss.classList.toggle('is-active', kind === 'miss');

    if (durationMs > 0) {
      window.setTimeout(() => {
        if (characterVersion === version && status !== 'result') {
          setCharacter('idle');
        }
      }, durationMs);
    }
  }

  function showJudgement(value) {
    judgementVersion += 1;
    const version = judgementVersion;
    const label = value === 'perfect' ? 'Perfect' : value === 'good' ? 'Good' : 'Miss';
    elements.judgementImage.src = JUDGEMENT_SOURCES[value];
    elements.judgementImage.alt = label;
    elements.judgement.setAttribute('aria-label', label);
    if (value === 'perfect') {
      elements.judgement.removeAttribute('data-grade');
    } else {
      elements.judgement.dataset.grade = value;
    }
    elements.judgement.classList.remove('is-visible');
    void elements.judgement.offsetWidth;
    elements.judgement.classList.add('is-visible');

    window.setTimeout(() => {
      if (judgementVersion === version) {
        elements.judgement.classList.remove('is-visible');
      }
    }, value === 'miss' ? 450 : 320);
  }

  function createSfxContext() {
    if (!sfxContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error('This browser does not support Web Audio.');
      }
      sfxContext = new AudioContextClass();
    }
    return sfxContext.resume();
  }

  function playTone(when, frequency, duration, volume, type = 'sine') {
    if (!sfxContext || sfxContext.state !== 'running') return;
    const oscillator = sfxContext.createOscillator();
    const gain = sfxContext.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, when);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(volume, when + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    oscillator.connect(gain).connect(sfxContext.destination);
    activeSfx.add(oscillator);
    oscillator.onended = () => activeSfx.delete(oscillator);
    oscillator.start(when);
    oscillator.stop(when + duration + 0.02);
  }

  function stopSfx() {
    for (const oscillator of activeSfx) oscillator.stop();
    activeSfx.clear();
  }

  function suspendSfx() {
    stopSfx();
    return sfxContext?.state === 'running' ? sfxContext.suspend() : Promise.resolve();
  }

  function fireAttack(strength, phase = 'burst') {
    if (status !== 'playing') return;
    window.dispatchEvent(new CustomEvent('rhythmgame:attack', {
      detail: { strength, phase },
    }));
  }

  function clearInputLatch() {
    isInputHeld = false;
    heldSource = null;
  }

  function resetInput() {
    clearInputLatch();
    activeHold = null;
    window.dispatchEvent(new CustomEvent('rhythmgame:reset'));
  }

  function createNoteElement(note) {
    if (note.type === 'hold') {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 2048 1152');
      svg.setAttribute('aria-hidden', 'true');
      svg.classList.add('hold-note-tail-layer');
      svg.dataset.noteId = String(note.id);
      const tail = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      tail.setAttribute('d', elements.path.getAttribute('d'));
      tail.classList.add('hold-note-tail');
      svg.appendChild(tail);
      elements.notes.appendChild(svg);
      note.tailElement = svg;
    }
    const image = document.createElement('img');
    image.className = `note note-${note.type}`;
    image.dataset.noteId = String(note.id);
    image.alt = '';
    image.draggable = false;
    image.src = CANDY_SOURCES[note.type];
    listen(image, 'error', () => {
      image.removeAttribute('src');
      image.classList.add('note-fallback', `note-fallback-${note.type}`);
    }, { once: true });
    image.style.left = '0px';
    image.style.top = '0px';
    elements.notes.appendChild(image);
    note.element = image;
    note.state = 'active';
  }

  function removeNote(note) {
    if (note.tailElement) {
      note.tailElement.remove();
      note.tailElement = null;
    }
    if (note.element) {
      note.element.remove();
      note.element = null;
    }
  }

  function clearNotes() {
    for (const note of notes) removeNote(note);
    elements.notes.replaceChildren();
  }

  function pointForNote(note, gameTime, progress) {
    const elapsed = gameTime - note.spawnTime;
    if (note.type === 'hold' || elapsed <= Chart.META.travelTimeSeconds) {
      return elements.path.getPointAtLength(pathLength * progress);
    }

    const end = elements.path.getPointAtLength(pathLength);
    const speed = pathLength / Chart.META.travelTimeSeconds;
    const overshoot = (elapsed - Chart.META.travelTimeSeconds) * speed;
    return {
      x: end.x + endTangent.x * overshoot,
      y: end.y + endTangent.y * overshoot,
    };
  }

  function renderNotes(gameTime) {
    for (const note of notes) {
      if (note.state === 'queued' && gameTime >= note.spawnTime) {
        createNoteElement(note);
      }
      if (!['active', 'holding'].includes(note.state) || !note.element) continue;

      const progress = note.state === 'holding' ? 1
        : Core.travelProgress(note, gameTime, Chart.META.travelTimeSeconds);
      const point = note.state === 'holding' ? elements.path.getPointAtLength(pathLength)
        : pointForNote(note, gameTime, progress);
      note.element.dataset.progress = progress.toFixed(4);
      if (note.type === 'speed' && gameTime >= note.accelerationAt && !note.didAccelerate) {
        note.didAccelerate = true;
        const element = note.element;
        element.classList.add('is-accelerating');
        window.setTimeout(() => element.classList.remove('is-accelerating'), 220);
      }
      const grow = smoothstep((gameTime - note.spawnTime) / SPAWN_GROW_SECONDS);
      note.element.style.left = `${(point.x / DESIGN.width) * 100}%`;
      note.element.style.top = `${(point.y / DESIGN.height) * 100}%`;
      note.element.style.transform = `scale(${grow})`;
      if (note.tailElement) {
        const remaining = note.state === 'holding'
          ? clamp((note.holdEndTime - gameTime) / (note.holdEndTime - note.hitTime), 0, 1)
          : 1;
        const headLength = pathLength * progress;
        const tailLength = Math.min(headLength,
          pathLength * (note.holdEndTime - note.hitTime) / Chart.META.travelTimeSeconds * remaining);
        const tail = note.tailElement.firstElementChild;
        tail.setAttribute('stroke-dasharray', `${tailLength} ${pathLength}`);
        tail.setAttribute('stroke-dashoffset', String(-(headLength - tailLength)));
      }
    }
  }

  function finishNote(note, result) {
    if (note.state === 'hit' || note.state === 'missed') return;
    const { judgement } = result;
    note.state = judgement === 'miss' ? 'missed' : 'hit';
    removeNote(note);
    scoreState = Core.applyNoteResult(scoreState, result);
    if (activeHold === note) activeHold = null;
    renderHud();
    showJudgement(judgement);

    if (judgement === 'miss') {
      setCharacter('miss', MISS_POSE_MS);
    } else {
      setCharacter('hit', SUCCESS_POSE_MS);
      playTone(sfxContext.currentTime, judgement === 'perfect' ? 880 : 660, 0.09, 0.06, 'sine');
    }
  }

  function inputJudgement(gameTime, targetTime) {
    // Keep inclusive millisecond boundaries stable after subtracting media timestamps.
    const offsetMs = Math.round((gameTime - targetTime) * 1e9) / 1e6;
    return Core.judgeOffsetMs(offsetMs);
  }

  function judgementOrMiss(gameTime, targetTime) {
    const judgement = inputJudgement(gameTime, targetTime);
    return judgement === 'none' ? 'miss' : judgement;
  }

  function singleNoteResult(judgement) {
    return {
      judgement,
      points: judgement === 'perfect' ? Core.CONFIG.perfectScore
        : judgement === 'good' ? Core.CONFIG.goodScore : 0,
      maxPoints: 100,
    };
  }

  function handlePressInput(source) {
    if (status === 'reengaging' && activeHold && !isInputHeld) {
      if (performance.now() >= reentryDeadline) {
        expireReentry();
        return;
      }
      isInputHeld = true;
      heldSource = source;
      void resumePlayback(true);
      return;
    }
    if (status !== 'playing' || isInputHeld || activeHold) return;
    isInputHeld = true;
    heldSource = source;
    const gameTime = bgmClock.currentTime;
    let candidate = null;
    let smallestDifference = Infinity;

    for (const note of notes) {
      if (note.state !== 'active') continue;
      const difference = Math.abs(gameTime - note.hitTime);
      if (difference < smallestDifference) {
        smallestDifference = difference;
        candidate = note;
      }
    }

    if (!candidate) {
      fireAttack('weak');
      return;
    }
    const judgement = inputJudgement(gameTime, candidate.hitTime);
    if (judgement === 'none') {
      fireAttack('weak');
      return;
    }
    if (candidate.type === 'hold') {
      candidate.startJudgement = judgement;
      candidate.state = 'holding';
      candidate.element.classList.add('is-holding');
      activeHold = candidate;
      setCharacter('hit');
      fireAttack(judgement, 'hold-start');
      renderNotes(gameTime);
    } else {
      fireAttack(judgement);
      finishNote(candidate, singleNoteResult(judgement));
    }
  }

  function finishHold(endJudgement) {
    const note = activeHold;
    if (!note) return;
    fireAttack(endJudgement, 'hold-end');
    finishNote(note, Core.combineHoldJudgements(note.startJudgement, endJudgement));
  }

  function handleReleaseInput(source) {
    if (!isInputHeld || heldSource !== source) return;
    isInputHeld = false;
    heldSource = null;
    if (status !== 'playing' || !activeHold) return;
    const endJudgement = judgementOrMiss(bgmClock.currentTime, activeHold.holdEndTime);
    finishHold(endJudgement);
  }

  function expireMissedNotes(gameTime) {
    const lateWindow = Core.CONFIG.goodWindowMs / 1000;
    for (const note of notes) {
      if (note.state === 'active' && gameTime > note.hitTime + lateWindow) {
        finishNote(note, note.type === 'hold'
          ? Core.combineHoldJudgements('miss', 'miss') : singleNoteResult('miss'));
      } else if (note.state === 'holding' && gameTime > note.holdEndTime + lateWindow) {
        finishHold('miss');
      }
    }
  }

  function endGame() {
    if (completionDispatched
      || !['playing', 'paused', 'reengaging', 'resuming-audio', 'starting-audio'].includes(status)) return;
    completionDispatched = true;
    lifecycleVersion += 1;
    clearReentry();
    status = 'result';
    pausedFromStatus = null;
    for (const note of notes) {
      if (note.state === 'hit' || note.state === 'missed') continue;
      finishNote(note, note.type === 'hold'
        ? Core.combineHoldJudgements(note.startJudgement || 'miss', 'miss')
        : singleNoteResult('miss'));
    }
    resetInput();
    const completionDetail = Core.buildCompletionDetail(scoreState, notes.length, chartMaxScore);
    bgmClock.pause();
    void suspendSfx();
    clearNotes();
    setCharacter('idle');
    judgementVersion += 1;
    elements.judgement.classList.remove('is-visible');
    elements.countdown.hidden = true;
    elements.resultScore.textContent = String(scoreState.score);
    elements.resultCombo.textContent = String(scoreState.maxCombo);
    renderMusicProgress(1);
    renderRatingStars();
    elements.progressHud.hidden = true;
    elements.pauseButton.disabled = true;
    setPauseUi(false);
    elements.resultOverlay.hidden = embedded;
    window.dispatchEvent(new CustomEvent('rhythmgame:complete', {
      detail: completionDetail,
    }));
  }

  function frame() {
    if (disposed) return;
    if (status === 'countdown') {
      const remaining = countdownEndTime - sfxContext.currentTime;
      if (remaining > 0) {
        elements.countdown.textContent = String(Math.max(1, Math.ceil(remaining)));
      } else {
        elements.countdown.hidden = true;
        status = 'starting-audio';
        void beginBgmPlayback();
      }
    }

    if (status === 'playing') {
      const gameTime = bgmClock.currentTime;
      renderMusicProgress(Core.calculateMusicProgress(gameTime, bgmClock.duration));
      renderNotes(gameTime);
      expireMissedNotes(gameTime);
    }

    animationFrame = window.requestAnimationFrame(frame);
  }

  function prepareNotes() {
    notes = Chart.NOTES.map((definition) => ({
      ...definition,
      state: 'queued',
      element: null,
      tailElement: null,
      startJudgement: null,
      didAccelerate: false,
    }));
  }

  function showAudioLoadError(error) {
    if (disposed) return;
    lifecycleVersion += 1;
    clearReentry();
    status = 'idle';
    pausedFromStatus = null;
    resetInput();
    bgmClock.reset();
    void suspendSfx();
    clearNotes();
    setCharacter('idle');
    judgementVersion += 1;
    elements.judgement.classList.remove('is-visible');
    elements.countdown.hidden = true;
    elements.progressHud.hidden = true;
    elements.pauseButton.disabled = true;
    setPauseUi(false);
    elements.resultOverlay.hidden = true;
    elements.startOverlay.hidden = embedded;
    elements.audioLoadError.hidden = false;
    elements.startButton.textContent = 'RETRY';
    elements.startButton.disabled = false;
    if (embedded) {
      elements.audioRecoveryOverlay.hidden = false;
      elements.audioRecoveryMessage.textContent = '点击恢复音频';
      elements.audioRecoveryButton.hidden = !embedStartAccepted;
    }
    console.error(error);
  }

  async function beginBgmPlayback() {
    if (status !== 'starting-audio') return;
    const version = lifecycleVersion;
    try {
      await bgmClock.playFromStart();
      if (version === lifecycleVersion && status === 'starting-audio') status = 'playing';
      else settleCancelledPlayback(version);
    } catch (error) {
      if (version === lifecycleVersion) showAudioLoadError(error);
      else settleCancelledPlayback(version);
    }
  }

  async function startGame() {
    if (disposed || (embedded && !embedStartAccepted)) return;
    if (status !== 'idle' && status !== 'result') return;
    const version = ++lifecycleVersion;
    completionDispatched = false;
    clearReentry();
    pausedFromStatus = null;
    pausedMediaTime = 0;
    pausedCountdownRemaining = 0;
    pauseAfterArming = false;
    bgmClock.reset();
    resetInput();
    stopSfx();
    clearNotes();
    resetScore();
    prepareNotes();
    resetProgressHud();
    judgementVersion += 1;
    elements.judgement.classList.remove('is-visible');
    setCharacter('idle');
    try {
      // A failed load needs a fresh media load before readiness can be retried.
      if (bgmClock.media.error) bgmClock.media.load();
      // Start metadata loading before unlock: a later load() cancels pending play.
      const readyPromise = bgmClock.whenReady();
      const unlockPromise = bgmClock.unlock();
      status = 'arming';
      elements.startButton.disabled = true;
      const sfxPromise = createSfxContext();
      if (embedded && sfxContext.state !== 'running') {
        elements.audioRecoveryOverlay.hidden = false;
        elements.audioRecoveryButton.hidden = false;
        elements.audioRecoveryMessage.textContent = '点击继续播放';
      }
      await Promise.all([readyPromise, unlockPromise, sfxPromise]);
    } catch (error) {
      if (version === lifecycleVersion) showAudioLoadError(error);
      return;
    }
    if (version !== lifecycleVersion || status !== 'arming') {
      settleCancelledPlayback(version);
      return;
    }
    elements.audioLoadError.hidden = true;
    elements.resultOverlay.hidden = true;
    elements.startOverlay.hidden = true;
    elements.audioRecoveryOverlay.hidden = true;
    elements.progressHud.hidden = false;
    elements.pauseButton.disabled = false;
    setPauseUi(false);
    elements.countdown.hidden = false;
    elements.countdown.textContent = '3';
    countdownEndTime = sfxContext.currentTime + COUNTDOWN_SECONDS;
    status = 'countdown';
    if (pauseAfterArming || document.hidden) void pauseGame();
  }

  listen(elements.startButton, 'click', (event) => {
    event.stopPropagation();
    startGame();
  });

  listen(elements.restartButton, 'click', (event) => {
    event.stopPropagation();
    startGame();
  });

  listen(elements.audioRecoveryButton, 'click', (event) => {
    event.stopPropagation();
    if (disposed || !embedStartAccepted) return;
    window.focus();
    if (status === 'arming') {
      // Resume the pending unlock in the actual click gesture.
      void Promise.all([bgmClock.unlock(), createSfxContext()]).catch(showAudioLoadError);
    } else {
      void startGame();
    }
  });

  listen(elements.pauseButton, 'click', (event) => {
    event.stopPropagation();
    if (status === 'paused') {
      resumeGame();
    } else {
      pauseGame();
    }
  });

  listen(elements.resumeButton, 'click', (event) => {
    event.stopPropagation();
    resumeGame();
  });

  listen(window, 'keydown', (event) => {
    if (event.code !== 'Space') return;
    event.preventDefault();
    if (event.repeat) return;
    handlePressInput('keyboard');
  });

  listen(window, 'keyup', (event) => {
    if (event.code !== 'Space') return;
    event.preventDefault();
    handleReleaseInput('keyboard');
  });

  listen(elements.stage, 'pointerdown', (event) => {
    if (event.button !== 0 || event.target.closest('button')) return;
    handlePressInput(`pointer:${event.pointerId}`);
  });

  listen(window, 'pointerup', (event) => {
    handleReleaseInput(`pointer:${event.pointerId}`);
  });

  listen(window, 'pointercancel', () => {
    clearInputLatch();
    void pauseGame();
  });

  listen(document, 'visibilitychange', () => {
    if (document.hidden) void pauseGame();
  });

  listen(window, 'blur', () => { void pauseGame(); });

  function disposeGame() {
    if (disposed) return;
    disposed = true;
    for (const cleanup of listenerCleanups.splice(0)) cleanup();
    lifecycleVersion += 1;
    clearReentry();
    status = 'disposed';
    pausedFromStatus = null;
    resetInput();
    bgmClock.pause();
    void suspendSfx();
    if (sfxContext && sfxContext.state !== 'closed') void sfxContext.close();
    clearNotes();
    characterVersion += 1;
    judgementVersion += 1;
    window.cancelAnimationFrame(animationFrame);
  }

  if (!embedded) listen(window, 'pagehide', disposeGame);

  listen(bgmClock.media, 'ended', endGame);
  listen(bgmClock.media, 'error', () => {
    if (['countdown', 'starting-audio', 'playing', 'paused', 'reengaging', 'resuming-audio'].includes(status)) {
      showAudioLoadError(new Error('BGM playback failed'));
    }
  });

  configurePath();
  resetScore();
  resetProgressHud();
  elements.progressHud.hidden = true;
  elements.pauseButton.disabled = true;
  setPauseUi(false);
  setCharacter('idle');
  elements.startButton.disabled = true;
  if (embedded) {
    elements.startOverlay.hidden = true;
    elements.resultOverlay.hidden = true;
    const bridge = globalThis.RhythmEmbedBridge.createEmbedBridge({
      window, runId,
      prepare: async () => {
        const pageLoaded = document.readyState === 'complete' ? Promise.resolve()
          : new Promise((resolve) => listen(window, 'load', resolve, { once: true }));
        const extraSources = [...Object.values(CANDY_SOURCES), ...Object.values(JUDGEMENT_SOURCES),
          ...[1, 2, 3].map((number) => `assets/ui/countdown/${number}.png`)];
        const images = [...document.images].filter((image) => image.getAttribute('src'));
        for (const source of extraSources) {
          const image = new Image();
          image.src = source;
          images.push(image);
        }
        await Promise.all([pageLoaded, bgmClock.whenReady(), ...images.map((image) => image.decode())]);
      },
      start: () => {
        embedStartAccepted = true;
        resetInput();
        window.focus();
        void startGame();
      },
      dispose: disposeGame,
    });
    bridge.ready.catch(showAudioLoadError);
  } else {
    bgmClock.whenReady().then(() => {
      if (!disposed) elements.startButton.disabled = false;
    }).catch(showAudioLoadError);
  }
  animationFrame = window.requestAnimationFrame(frame);
})();
