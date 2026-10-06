(() => {
  'use strict';

  const DESIGN_WIDTH = 2048;
  const DESIGN_HEIGHT = 1152;
  const GUITAR = { x: 350 / DESIGN_WIDTH, y: 792 / DESIGN_HEIGHT };
  const TARGET = { x: 1034 / DESIGN_WIDTH, y: 548 / DESIGN_HEIGHT };
  const COLORS = ['#79f7ff', '#ff83ef', '#ffe77b', '#a99cff', '#ffffff'];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const shots = [];
  let canvas;
  let ctx;
  let host;
  let width = 1;
  let height = 1;
  let pixelRatio = 1;
  let running = false;
  let animationFrame = 0;
  let sustained = null;
  let finishFlash = null;
  let displayScaleX = 1;
  let displayScaleY = 1;

  function findHost() {
    return document.querySelector('.game-shell, .game-stage, #game, main') || document.body;
  }

  function resize() {
    const rect = host.getBoundingClientRect();
    displayScaleX = displayScaleY = 1;
    // An embedded design-sized iframe may be transformed by the host page.
    // Render in displayed CSS pixels so glows/line widths are not scaled twice.
    try {
      const frame = window.frameElement;
      if (frame && frame.clientWidth && frame.clientHeight) {
        const displayed = frame.getBoundingClientRect();
        if (displayed.width > 0 && displayed.height > 0) {
          displayScaleX = displayed.width / frame.clientWidth;
          displayScaleY = displayed.height / frame.clientHeight;
        }
      }
    } catch (_) { /* Cross-origin embeds keep the standalone coordinate system. */ }
    width = Math.max(1, rect.width * displayScaleX);
    height = Math.max(1, rect.height * displayScaleY);
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }

  function clearEffects() {
    shots.length = 0;
    sustained = null;
    finishFlash = null;
    canvas?.classList.remove('is-holding');
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    if (ctx) ctx.clearRect(0, 0, width, height);
    running = false;
  }

  function visibleRect(element) {
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    if (rect.width < 20 || rect.height < 20) return null;
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return null;
    return rect;
  }

  function decodedSource(image) {
    try {
      return decodeURIComponent(image.currentSrc || image.src || '').toLowerCase();
    } catch (_) {
      return (image.currentSrc || image.src || '').toLowerCase();
    }
  }

  function locateCharacterImage() {
    const direct = document.querySelector(
      '.character img, .penguin img, .performer img, #character img, #penguin img, img.character, img.penguin, .character-sprite',
    );
    if (visibleRect(direct)) return direct;

    const images = [...document.images].filter((image) => visibleRect(image));
    const named = images.find((image) => /企鹅|警觉待机|强力攻击|严重失误/.test(decodedSource(image)));
    if (named) return named;

    const hostRect = host.getBoundingClientRect();
    return images
      .filter((image) => {
        const rect = image.getBoundingClientRect();
        return rect.right < hostRect.left + hostRect.width * 0.58
          && rect.bottom > hostRect.top + hostRect.height * 0.45
          && rect.width < hostRect.width * 0.55
          && rect.height < hostRect.height * 0.9;
      })
      .sort((a, b) => {
        const ar = a.getBoundingClientRect();
        const br = b.getBoundingClientRect();
        return (br.width * br.height) - (ar.width * ar.height);
      })[0] || null;
  }

  function locateTargetImage() {
    const direct = document.querySelector(
      '.judge-point img, .judgement-point img, .hit-target img, #judgePoint img, #judgementPoint img, img.judge-point, img.judgement-point',
    );
    if (visibleRect(direct)) return direct;
    return [...document.images].find((image) => {
      return visibleRect(image) && /判定点|judge|judgement/.test(decodedSource(image));
    }) || null;
  }

  function locateEndpoints() {
    const hostRect = host.getBoundingClientRect();
    const characterRect = visibleRect(locateCharacterImage());
    const targetRect = visibleRect(locateTargetImage());

    // The guitar body sits slightly right and below the visual centre of the penguin sprite.
    const start = characterRect
      ? {
          x: (characterRect.left - hostRect.left + characterRect.width * 0.54) * displayScaleX,
          y: (characterRect.top - hostRect.top + characterRect.height * 0.56) * displayScaleY,
        }
      : { x: width * 0.255, y: height * 0.69 };

    const end = targetRect
      ? {
          x: (targetRect.left - hostRect.left + targetRect.width * 0.5) * displayScaleX,
          y: (targetRect.top - hostRect.top + targetRect.height * 0.5) * displayScaleY,
        }
      : { x: width * TARGET.x, y: height * TARGET.y };

    return { start, end };
  }

  function glowDot(x, y, radius, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = color;
    ctx.shadowBlur = radius * 4;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function sparkle(x, y, radius, color, alpha, rotation) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.globalAlpha = alpha;
    ctx.shadowColor = color;
    ctx.shadowBlur = radius * 3.5;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -radius * 2.2);
    ctx.quadraticCurveTo(radius * 0.28, -radius * 0.28, radius * 2.2, 0);
    ctx.quadraticCurveTo(radius * 0.28, radius * 0.28, 0, radius * 2.2);
    ctx.quadraticCurveTo(-radius * 0.28, radius * 0.28, -radius * 2.2, 0);
    ctx.quadraticCurveTo(-radius * 0.28, -radius * 0.28, 0, -radius * 2.2);
    ctx.fill();
    ctx.restore();
  }

  function pointOnAttackLine(t, start, end) {
    return {
      x: start.x + (end.x - start.x) * t,
      y: start.y + (end.y - start.y) * t,
    };
  }

  function tangentOnAttackLine(start, end) {
    return {
      x: end.x - start.x,
      y: end.y - start.y,
    };
  }

  function drawWave(shot, progress, alpha, isSustained = false) {
    const start = shot.start;
    const end = shot.end;
    const direction = tangentOnAttackLine(start, end);
    const directionLength = Math.hypot(direction.x, direction.y) || 1;
    const normal = { x: -direction.y / directionLength, y: direction.x / directionLength };
    const head = Math.min(1, progress * 1.06);
    const packetLength = reducedMotion ? 0.34 : 0.52;
    const tail = isSustained ? 0 : Math.max(0, head - packetLength);
    const strands = [
      { color: '#7df7ff', phase: 0, amplitude: 25, width: 1.65, glow: 16 },
      { color: '#ff7fe7', phase: Math.PI * 0.72, amplitude: 34, width: 1.55, glow: 19 },
      { color: '#ffe58a', phase: Math.PI * 1.38, amplitude: 20, width: 1.35, glow: 17 },
      { color: '#ffffff', phase: Math.PI * 0.18, amplitude: 8, width: 0.9, glow: 13 },
    ];

    for (const strand of strands) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = strand.color;
      ctx.lineWidth = strand.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = strand.color;
      ctx.shadowBlur = strand.glow;
      ctx.globalAlpha = alpha * 0.78;
      ctx.beginPath();
      const steps = 72;
      for (let index = 0; index <= steps; index += 1) {
        const packetPosition = index / steps;
        const t = tail + (head - tail) * packetPosition;
        const base = pointOnAttackLine(t, start, end);
        const taper = Math.pow(Math.sin(Math.PI * packetPosition), 0.72);
        const sceneScale = 0.58 + Math.sin(Math.PI * t) * 0.62;
        const oscillation = Math.sin(t * Math.PI * 8.5 + strand.phase + shot.seed * 0.16)
          * strand.amplitude * taper * sceneScale;
        const x = base.x + normal.x * oscillation;
        const y = base.y + normal.y * oscillation;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    }

    const core = pointOnAttackLine(head, start, end);
    glowDot(core.x, core.y, 3.7, '#ffffff', alpha * 0.96);

    const sourceLife = Math.max(0, 1 - progress / 0.28);
    if (sourceLife > 0) {
      glowDot(start.x, start.y, 7 + (1 - sourceLife) * 5, '#fff6bd', sourceLife * 0.88);
      const rayCount = reducedMotion ? 5 : 9;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(start.x, start.y);
      ctx.rotate(Math.atan2(direction.y, direction.x));
      for (let i = 0; i < rayCount; i += 1) {
        const rayAngle = ((i / (rayCount - 1)) - 0.5) * 1.7;
        const rayLength = (18 + (i % 3) * 9) * sourceLife;
        ctx.strokeStyle = COLORS[i % COLORS.length];
        ctx.lineWidth = 1.2;
        ctx.globalAlpha = sourceLife * 0.7;
        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(rayAngle) * rayLength, Math.sin(rayAngle) * rayLength);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawShot(shot, now) {
    const elapsed = now - shot.startedAt;
    const duration = reducedMotion ? 920 : 820;
    const progress = Math.min(1, elapsed / duration);
    const alpha = Math.sin(Math.PI * Math.min(1, progress * 1.08));
    drawWave(shot, progress, alpha);

    const headT = Math.min(1, progress * 1.1);
    for (let i = 0; i < shot.particles.length; i += 1) {
      const particle = shot.particles[i];
      const t = Math.max(0, Math.min(1, headT - particle.lag));
      if (t <= 0 || t >= 1) continue;
      const base = pointOnAttackLine(t, shot.start, shot.end);
      const tangent = tangentOnAttackLine(shot.start, shot.end);
      const length = Math.hypot(tangent.x, tangent.y) || 1;
      const nx = -tangent.y / length;
      const ny = tangent.x / length;
      const drift = Math.sin(t * particle.frequency + particle.phase) * particle.spread;
      const fade = Math.sin(Math.PI * t) * (1 - progress * 0.22);
      const x = base.x + nx * drift + particle.jitterX;
      const y = base.y + ny * drift + particle.jitterY;
      if (particle.star) sparkle(x, y, particle.size, particle.color, fade, particle.rotation + progress * 2.4);
      else glowDot(x, y, particle.size, particle.color, fade * 0.9);
    }

    if (progress > 0.78) {
      const burst = (progress - 0.78) / 0.22;
      const burstAlpha = Math.sin(Math.PI * burst);
      const count = reducedMotion ? 8 : 18;
      for (let i = 0; i < count; i += 1) {
        const angle = (i / count) * Math.PI * 2 + shot.seed;
        const radius = burst * (22 + (i % 5) * 8);
        const x = shot.end.x + Math.cos(angle) * radius;
        const y = shot.end.y + Math.sin(angle) * radius;
        const color = COLORS[i % COLORS.length];
        if (i % 3 === 0) sparkle(x, y, 2.2 + (i % 2), color, burstAlpha, angle);
        else glowDot(x, y, 1.7 + (i % 3) * 0.5, color, burstAlpha);
      }
    }
    return elapsed < duration + 100;
  }

  function drawFinishFlash(flash, now) {
    const progress = (now - flash.startedAt) / 260;
    if (progress >= 1) return false;
    const alpha = 1 - progress;
    const scale = Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT);
    glowDot(flash.end.x, flash.end.y, 6 * scale, '#ffffff', alpha);
    sparkle(flash.end.x, flash.end.y, 10 * scale, '#fff6bd', alpha, Math.PI / 4);
    const count = reducedMotion ? 6 : 12;
    for (let index = 0; index < count; index += 1) {
      const angle = index / count * Math.PI * 2;
      const radius = (12 + progress * 24) * scale;
      glowDot(flash.end.x + Math.cos(angle) * radius,
        flash.end.y + Math.sin(angle) * radius, 2.2 * scale, COLORS[index % COLORS.length], alpha);
    }
    return true;
  }

  function frame(now) {
    animationFrame = 0;
    ctx.clearRect(0, 0, width, height);
    for (let i = shots.length - 1; i >= 0; i -= 1) {
      if (!drawShot(shots[i], now)) shots.splice(i, 1);
    }
    if (sustained) {
      const elapsed = reducedMotion ? 0 : (now - sustained.startedAt) / 1000;
      const { start, end } = locateEndpoints();
      sustained.start = start;
      sustained.end = end;
      const alpha = reducedMotion ? 0.56 : 0.56 + Math.sin(elapsed * 4) * 0.1;
      drawWave({ ...sustained, seed: sustained.seed + elapsed * 6 }, 1, alpha, true);
      glowDot(start.x, start.y, 4.6, '#fff6bd', alpha);
      for (let index = 0; index < sustained.particles.length; index += 1) {
        const particle = sustained.particles[index];
        const t = (index / sustained.particles.length + elapsed * 0.35) % 1;
        const point = pointOnAttackLine(t, start, end);
        const fade = Math.sin(Math.PI * t) * alpha;
        if (particle.star) sparkle(point.x, point.y, particle.size, particle.color, fade, particle.rotation + elapsed);
        else glowDot(point.x, point.y, particle.size, particle.color, fade);
      }
    }
    if (finishFlash && !drawFinishFlash(finishFlash, now)) finishFlash = null;
    if (shots.length || sustained || finishFlash) animationFrame = requestAnimationFrame(frame);
    else running = false;
  }

  function fire(event) {
    const phase = event.detail?.phase || 'burst';
    if (phase === 'hold-end') {
      clearEffects();
      if (event.detail?.strength !== 'perfect' && event.detail?.strength !== 'good') return;
      finishFlash = { startedAt: performance.now(), end: locateEndpoints().end };
      drawFinishFlash(finishFlash, finishFlash.startedAt);
      running = true;
      animationFrame = requestAnimationFrame(frame);
      return;
    }
    if (phase !== 'burst' && phase !== 'hold-start') return;
    const { start, end } = locateEndpoints();
    const seed = Math.random() * Math.PI * 2;
    const particleCount = reducedMotion ? 14 : 34;
    const particles = Array.from({ length: particleCount }, (_, index) => ({
      lag: 0.02 + Math.random() * 0.34,
      spread: 7 + Math.random() * 24,
      frequency: 22 + Math.random() * 32,
      phase: Math.random() * Math.PI * 2,
      jitterX: (Math.random() - 0.5) * 7,
      jitterY: (Math.random() - 0.5) * 7,
      size: 1.25 + Math.random() * 2.8,
      color: COLORS[(index + Math.floor(seed)) % COLORS.length],
      star: index % 4 === 0,
      rotation: Math.random() * Math.PI,
    }));
    const shot = { startedAt: performance.now(), start, end, seed, particles };
    if (phase === 'hold-start') {
      sustained = shot;
      canvas.classList.add('is-holding');
    } else {
      shots.push(shot);
    }
    if (!running) {
      running = true;
      animationFrame = requestAnimationFrame(frame);
    }
  }

  function init() {
    host = findHost();
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    canvas = document.createElement('canvas');
    canvas.className = 'magic-attack-stage';
    canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(canvas);
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize, { passive: true });
    try {
      if (window.frameElement) {
        const parent = window.parent;
        let resizeFrame = 0;
        const parentResize = () => {
          // Coalesce changes and measure after the parent commits its layout.
          cancelAnimationFrame(resizeFrame);
          resizeFrame = requestAnimationFrame(() => { resizeFrame = 0; clearEffects(); resize(); });
        };
        const layoutObserver = new MutationObserver(parentResize);
        for (let node = window.frameElement.parentElement; node; node = node.parentElement) {
          layoutObserver.observe(node, { attributes: true, attributeFilter: ['style', 'class'] });
        }
        parent.addEventListener('resize', parentResize, { passive: true });
        window.addEventListener('pagehide', () => {
          layoutObserver.disconnect();
          parent.removeEventListener('resize', parentResize);
          cancelAnimationFrame(resizeFrame);
          clearEffects();
        }, { once: true });
      }
    } catch (_) { /* No parent layout access in cross-origin embeds. */ }
    window.addEventListener('rhythmgame:attack', fire);
    window.addEventListener('rhythmgame:pause', clearEffects);
    window.addEventListener('rhythmgame:complete', clearEffects);
    window.addEventListener('rhythmgame:reset', clearEffects);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
