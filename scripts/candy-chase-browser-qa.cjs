const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const baseUrlIndex = process.argv.indexOf('--base-url');
const baseUrl = baseUrlIndex >= 0 ? process.argv[baseUrlIndex + 1] : 'http://127.0.0.1:4174';
const artifactIndex = process.argv.indexOf('--artifact-dir');
const artifactDir = artifactIndex >= 0 ? process.argv[artifactIndex + 1] : null;
const diagnostics = { consoleErrors: [], pageErrors: [], failedLocalRequests: [], httpErrors: [], expectedExternalErrors: [], expectedLocalCancellations: [], abortedMediaRequests: [] };
const controlledRequests = new WeakSet();
const flowEvidence = { baseUrl, startedAt: new Date().toISOString(), viewport: { width: 1440, height: 900 }, mode: 'natural media completion; real UI clicks and keyboard input; no seek or synthetic completion', phases: [] };

async function qaContext(browser, options) {
  const context = await browser.newContext(options);
  // Analytics is unrelated to local portfolio/game behavior and the host may
  // reject its remote connection. Fulfill this exact script as an empty stub.
  await context.route('https://events.framer.com/script?v=2', route => route.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  context.on('page', page => {
    page.on('console', message => {
      if (message.type() !== 'error') return;
      const entry = { text: message.text(), url: message.location().url };
      // Homepage tests deliberately abort Framer's remote bundle to exercise the
      // hydration boundary; keep that evidence separate from actual errors.
      if (entry.url.startsWith('https://framerusercontent.com/sites/')) diagnostics.expectedExternalErrors.push(entry);
      else diagnostics.consoleErrors.push(entry);
    });
    page.on('pageerror', error => diagnostics.pageErrors.push(error.message));
    page.on('requestfailed', request => {
      if (!request.url().startsWith(new URL(baseUrl).origin)) return;
      const entry = { url: request.url(), error: request.failure()?.errorText, type: request.resourceType() };
      if (controlledRequests.has(request)) diagnostics.expectedLocalCancellations.push(entry);
      else if (entry.error === 'net::ERR_ABORTED' && entry.type === 'media') diagnostics.abortedMediaRequests.push(entry);
      else diagnostics.failedLocalRequests.push(entry);
    });
    page.on('response', response => {
      if (response.url().startsWith(new URL(baseUrl).origin) && response.status() >= 400) diagnostics.httpErrors.push({ url: response.url(), status: response.status() });
    });
  });
  return context;
}

async function mediaState(frame, selector) {
  return frame.locator(selector).evaluate(media => ({ time: media.currentTime, duration: media.duration, paused: media.paused, muted: media.muted, volume: media.volume, ended: media.ended, src: media.currentSrc }));
}

async function checkRealGameplay(browser) {
  const context = await qaContext(browser, { viewport: flowEvidence.viewport });
  await context.addInitScript(() => {
    window.__qaMediaEvents = [];
    window.__qaCompletions = [];
    window.__qaAudioContexts = [];
    const NativeAudioContext = window.AudioContext;
    if (NativeAudioContext) window.AudioContext = class extends NativeAudioContext {
      constructor(...args) { super(...args); window.__qaAudioContexts.push(this); }
    };
    document.addEventListener('playing', event => {
      if (event.target instanceof HTMLMediaElement) window.__qaMediaEvents.push({ type: 'playing', src: event.target.currentSrc, time: event.target.currentTime, muted: event.target.muted, activated: navigator.userActivation.hasBeenActive });
    }, true);
    document.addEventListener('ended', event => {
      if (event.target instanceof HTMLMediaElement) window.__qaMediaEvents.push({ type: 'ended', src: event.target.currentSrc, time: event.target.currentTime });
    }, true);
    window.addEventListener('message', event => {
      if (event.data?.type === 'rhythmgame:complete') window.__qaCompletions.push({ data: event.data, sameOrigin: event.origin === location.origin, currentFrame: event.source === document.querySelector('iframe')?.contentWindow });
    });
  });
  const page = await context.newPage();
  await loadAfterHydrationSignal(page);
  await page.locator('#candy-chase-feature').getByRole('link', { name: /开始试玩/ }).click();
  await page.waitForURL(`${baseUrl}/candy-chase.html?from=portfolio#play`, { waitUntil: 'load' });
  flowEvidence.entryNavigation = 'actual homepage feature click → case ?from=portfolio#play';
  const outerIframe = page.locator('iframe[title="CANDY CHASE 可试玩游戏"]');
  const host = await (await outerIframe.elementHandle()).contentFrame();
  const screen = async name => {
    await host.locator(`[data-testid="app-screen"][data-screen="${name}"]`).waitFor({ state: 'attached', timeout: 25000 });
    await host.locator('[data-testid="screen-transition"][data-phase="idle"]').waitFor();
    flowEvidence.phases.push(name);
  };
  await screen('loading');
  const beforeGesture = await host.evaluate(() => [...document.querySelectorAll('audio,video')].map(m => ({ paused: m.paused, muted: m.muted, time: m.currentTime })));
  assert.ok(beforeGesture.every(m => m.paused || m.muted), 'No audible media playback before user interaction');
  flowEvidence.beforeGesture = beforeGesture;
  await screenshot(page, 'flow-loading');
  await host.getByRole('button', { name: '开始加载', exact: true }).click();
  await host.getByRole('button', { name: 'CLICK TO START', exact: true }).click({ timeout: 20000 });
  await screen('lobby');
  await host.waitForFunction(() => document.querySelector('main')?.getAttribute('aria-busy') !== 'true');
  await screenshot(page, 'flow-lobby');
  await host.getByRole('button', { name: '开始游戏', exact: true }).click();
  await screen('hero-select');
  await host.getByRole('button', { name: '确认选择 PIKO', exact: true }).click();
  await host.getByRole('dialog').waitFor();
  await screenshot(page, 'flow-piko');
  await host.getByRole('dialog').getByRole('button', { name: '开始游戏', exact: true }).click();
  await screen('pregame-video');
  await host.waitForFunction(() => document.querySelector('video[aria-label="游戏开场视频"]').currentTime > 0.5);
  flowEvidence.intro = await mediaState(host, 'video[aria-label="游戏开场视频"]');
  assert.equal(flowEvidence.intro.muted, false);
  assert.equal(flowEvidence.intro.paused, false);
  await screenshot(page, 'flow-intro');
  const game = await (await host.locator('iframe[title="节奏游戏"]').elementHandle()).contentFrame();
  assert.equal((await mediaState(game, '#gameBgm')).time, 0, 'Preloading does not start BGM during intro');
  await page.keyboard.press('Space');
  await page.keyboard.press('Escape');
  assert.equal(await host.locator('[data-screen="pregame-video"]').count(), 1, 'Case keys cannot skip intro');
  await screen('gameplay');
  if (await game.locator('#audioRecoveryButton').isVisible()) await game.locator('#audioRecoveryButton').click();
  await game.waitForFunction(() => document.querySelector('#gameBgm').currentTime > 0.5, null, { timeout: 15000 });
  flowEvidence.focus = { outer: await outerIframe.evaluate(m => m === document.activeElement), inner: await host.locator('iframe').evaluate(m => m === document.activeElement) };
  assert.ok(flowEvidence.focus.outer && flowEvidence.focus.inner, 'Actual game receives keyboard focus through both iframes');
  flowEvidence.bgmEarly = await mediaState(game, '#gameBgm');
  const scrollBefore = await page.evaluate(() => scrollY);
  await page.keyboard.press('Space');
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => scrollY), scrollBefore, 'Gameplay Space does not scroll the case page');
  await screenshot(page, 'flow-gameplay');
  await page.waitForTimeout(1000);
  flowEvidence.bgmLater = await mediaState(game, '#gameBgm');
  assert.ok(flowEvidence.bgmLater.time > flowEvidence.bgmEarly.time);
  assert.equal(flowEvidence.bgmLater.muted, false);
  assert.equal(flowEvidence.bgmLater.paused, false);
  // Preserve event evidence before the game frame is removed by real completion.
  await game.evaluate(() => {
    const bgm = document.querySelector('#gameBgm');
    bgm.addEventListener('ended', () => { parent.__qaBgmEnded = { time: bgm.currentTime, duration: bgm.duration }; }, { once: true });
  });
  console.log('RUN real flow: intro progressing naturally; BGM progressing unmuted; waiting for natural chart end');
  await host.locator('[data-screen="settlement"]').waitFor({ state: 'attached', timeout: 100000 });
  await screen('settlement');
  flowEvidence.bgmEnded = await host.evaluate(() => window.__qaBgmEnded);
  assert.ok(flowEvidence.bgmEnded && flowEvidence.bgmEnded.time >= flowEvidence.bgmEnded.duration - 0.1, 'Real BGM ended without seeking');
  flowEvidence.completions = await host.evaluate(() => window.__qaCompletions);
  assert.equal(flowEvidence.completions.length, 1);
  assert.ok(flowEvidence.completions[0].sameOrigin && flowEvidence.completions[0].currentFrame);
  const result = flowEvidence.completions[0].data.result;
  assert.equal(result.totalNotes, 80);
  assert.equal(result.judgedNotes, 80);
  const gesture = host.getByRole('button', { name: '播放结算动画', exact: true });
  if (await gesture.isVisible()) await gesture.click();
  await host.waitForFunction(() => document.querySelector('.settlement-media__intro').currentTime > 0.3, null, { timeout: 12000 });
  flowEvidence.settlementIntro = await mediaState(host, '.settlement-media__intro');
  assert.equal(flowEvidence.settlementIntro.muted, false);
  await host.getByRole('button', { name: '继续', exact: true }).waitFor();
  await host.waitForFunction(() => !document.querySelector('.settlement-action--next')?.disabled, null, { timeout: 15000 });
  assert.equal(await host.getByRole('region', { name: `得分 ${result.finalScore.toLocaleString('en-US')}`, exact: true }).count(), 1);
  for (const [label, field] of [['PERFECT', 'perfect'], ['GOOD', 'good'], ['MISS', 'miss']]) assert.equal(await host.getByRole('article', { name: `${label} ${result[field]}`, exact: true }).count(), 1);
  flowEvidence.settlementLoop = await mediaState(host, '.settlement-media__loop');
  assert.equal(flowEvidence.settlementLoop.muted, true);
  await screenshot(page, 'flow-settlement');
  flowEvidence.mediaEvents = await host.evaluate(() => window.__qaMediaEvents);
  assert.ok(flowEvidence.mediaEvents.some(event => event.type === 'ended' && event.src.includes('pregame-intro')));
  assert.ok(flowEvidence.mediaEvents.filter(event => event.type === 'playing' && !event.muted).every(event => event.activated), 'Audible game media begins after a real click');
  await page.locator('[data-scroll-intro]').first().click();
  await page.waitForFunction(() => Math.abs(document.querySelector('#intro').getBoundingClientRect().top) < 60);
  assert.equal(await page.locator('#intro').isVisible(), true, 'Introduction remains reachable after settlement');
  // Retry is a real user action. Return while this second BGM is active so the
  // real navigation exercises audio disposal, not just a silent result screen.
  await host.getByRole('button', { name: '重新挑战', exact: true }).click();
  await screen('gameplay');
  const retryGame = await (await host.locator('iframe[title="节奏游戏"]').elementHandle()).contentFrame();
  if (await retryGame.locator('#audioRecoveryButton').isVisible()) await retryGame.locator('#audioRecoveryButton').click();
  await retryGame.waitForFunction(() => document.querySelector('#gameBgm').currentTime > 0.5, null, { timeout: 15000 });
  flowEvidence.retryBgm = await mediaState(retryGame, '#gameBgm');
  assert.equal(flowEvidence.retryBgm.paused, false);
  assert.equal(flowEvidence.retryBgm.muted, false);
  // A callback in a nested frame cannot reliably report after navigation
  // destroys its execution realm. Retain real objects in the case realm and
  // dispatch the production lifecycle handler to inspect its stop effect.
  // Actual link navigation is verified separately immediately afterwards.
  await page.evaluate(() => {
    const hostWindow = document.querySelector('iframe').contentWindow;
    const gameWindow = hostWindow.document.querySelector('iframe').contentWindow;
    window.__qaReturnMedia = [...hostWindow.document.querySelectorAll('audio,video'), ...gameWindow.document.querySelectorAll('audio,video')];
    window.__qaReturnAudioContexts = [...hostWindow.__qaAudioContexts, ...gameWindow.__qaAudioContexts];
    window.dispatchEvent(new PageTransitionEvent('pagehide'));
  });
  assert.equal(await outerIframe.getAttribute('src'), 'about:blank');
  await page.waitForFunction(() => window.__qaReturnMedia.every(m => m.paused)
    && window.__qaReturnAudioContexts.every(context => context.state !== 'running'));
  flowEvidence.lifecycleStop = await page.evaluate(() => ({
    trigger: 'dispatched pagehide invokes actual case handler while real Retry BGM is active',
    media: window.__qaReturnMedia.map(m => ({ paused: m.paused, time: m.currentTime })),
    audioContextStates: window.__qaReturnAudioContexts.map(context => context.state),
  }));
  await page.locator('[data-return-portfolio]').first().click();
  await page.waitForURL(`${baseUrl}/#candy-chase-feature`, { waitUntil: 'domcontentloaded' });
  assert.equal(await page.locator('iframe').count(), 0, 'Returned homepage has no game document');
  assert.equal(page.frames().length, 1, 'Actual return removes both game frame realms');
  flowEvidence.returnNavigation = { url: page.url(), remainingFrames: page.frames().length };
  console.log('PASS real flow: homepage click → loading → lobby → PIKO → natural intro → actual 80-note chart/BGM end → authentic settlement; Retry BGM + lifecycle stop; actual return removes game frames');
  await context.close();
}

async function loadAfterHydrationSignal(page) {
  // Keep the third-party emitter controlled; test the real browser Performance API
  // and feature boundary against the hydration mark verified in Framer's bundle.
  await page.route('https://framerusercontent.com/sites/**', route => route.abort());
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.locator('#project').waitFor();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await page.locator('#candy-chase-feature').count(), 0, 'DOMContentLoaded and animation frames must not mount before Framer hydration');
  await page.evaluate(() => {
    document.querySelector('script[data-framer-bundle="main"]').dispatchEvent(new Event('load'));
    window.mountCandyChaseFeature();
    window.mountCandyChaseFeature();
  });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await page.locator('#candy-chase-feature').count(), 0, 'Bundle load and explicit mount calls must not bypass the hydration gate');
  await page.evaluate(() => performance.mark('framer-hydration-layout-effects-end'));
  await page.locator('#candy-chase-feature').waitFor();
  await page.evaluate(() => {
    performance.mark('framer-hydration-layout-effects-end');
    window.mountCandyChaseFeature();
    window.mountCandyChaseFeature();
  });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await page.locator('#candy-chase-feature').count(), 1, 'The verified Framer hydration signal mounts exactly one feature');
}

async function checkFeature(page) {
  await loadAfterHydrationSignal(page);
  const feature = page.locator('#candy-chase-feature');
  await feature.waitFor();
  assert.equal(await feature.count(), 1, 'Mount one CANDY CHASE feature before the project section');
  assert.equal(await feature.getAttribute('data-mounted-before'), 'project');
  assert.equal(await feature.getByRole('heading', { name: 'CANDY CHASE', exact: true }).isVisible(), true);
  assert.match(await feature.getByRole('link', { name: /开始试玩/ }).getAttribute('href'), /candy-chase\.html/);
  assert.equal(await feature.getByRole('link', { name: /开始试玩/ }).getAttribute('href'), './candy-chase.html?from=portfolio#play');
  assert.equal(await feature.evaluate(element => element.nextElementSibling?.id), 'project');
  await page.waitForFunction(() => {
    const image = document.querySelector('#candy-chase-feature img');
    return image?.complete && image.naturalWidth > 0;
  });
  assert.equal(await feature.locator('img').evaluate(image => image.complete && image.naturalWidth > 0), true);
  assert.equal(await feature.locator('video').getAttribute('src'), null, 'Preview is not requested before interaction');
  assert.equal(await feature.locator('video').evaluate(video => video.muted && video.loop && video.playsInline), true);
  await page.evaluate(() => {
    window.mountCandyChaseFeature();
    window.mountCandyChaseFeature();
    document.querySelector('#candy-chase-feature').remove();
  });
  await page.waitForFunction(() => document.querySelector('#candy-chase-feature')?.nextElementSibling?.id === 'project');
  assert.equal(await feature.count(), 1, 'Observer remounts one feature after its node is removed');
  await feature.scrollIntoViewIfNeeded();
  assert.equal(await feature.evaluate(element => element.scrollWidth <= element.clientWidth), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'No page horizontal overflow');
  return feature;
}

async function screenshot(page, name) {
  if (!artifactDir) return;
  fs.mkdirSync(artifactDir, { recursive: true });
  await page.screenshot({ path: path.join(artifactDir, `${name}.png`) });
}

async function checkExistingPortfolio(page) {
  assert.equal(await page.locator('#hero .hero-portfolio-heading').count(), 1);
  assert.equal(await page.locator('#about .personal-about-extras').count(), 1);
  assert.deepEqual(await page.locator('#project .project-stack-title').allTextContents(), [
    '让你啤·Let it beer', 'Khaki Girl', '万事皆让我焦虑', '星耳小狐・Lumi',
  ]);
  const firstProject = page.locator('#project .project-stack-card').first();
  await firstProject.focus();
  await firstProject.press('Enter');
  await page.getByRole('dialog').waitFor();
  assert.equal(await page.getByRole('dialog').getByRole('heading', { name: '让你啤·Let it beer', exact: true }).isVisible(), true);
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.equal(await firstProject.evaluate(button => button === document.activeElement), true);
  assert.equal(await page.locator('#candy-chase-feature').count(), 1);
}

async function checkCasePage(browser) {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }]) {
    const context = await qaContext(browser, { viewport });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    const gameResponse = page.waitForResponse(response => response.url() === `${baseUrl}/games/candy-chase/index.html`).catch(error => error);
    const response = await page.goto(`${baseUrl}/candy-chase.html`, { waitUntil: 'domcontentloaded' });
    assert.equal(response.status(), 200, 'The standalone CANDY CHASE case page must exist');
    assert.equal(await page.title(), 'CANDY CHASE · 网页音乐节奏游戏');
    assert.equal(await page.getByRole('heading', { name: 'CANDY CHASE', exact: true }).isVisible(), true);
    for (const copy of [
      'GAME DESIGN · INTERACTIVE', '网页音乐节奏游戏', '2026',
      '游戏视觉设计 / UI设计 / 交互设计 / 前端实现', 'Figma / React / TypeScript / AI辅助开发',
      'CANDY CHASE 是一款以糖果幻想舞台为主题的网页音乐节奏游戏。玩家选择角色 PIKO，经过舞台开场动画进入节奏挑战，通过精准判定完成演出，并获得实时成绩与星级评价。',
      '游戏体验由加载页、游戏大厅、角色选择、开场演出、节奏玩法和成绩结算组成，形成一条完整且连续的游玩流程。',
    ]) assert.equal(await page.getByText(copy, { exact: true }).isVisible(), true, `Visible approved copy: ${copy}`);
    const iframe = page.locator('iframe[title="CANDY CHASE 可试玩游戏"]');
    assert.equal(await iframe.getAttribute('src'), './games/candy-chase/index.html');
    assert.equal((await gameResponse).status(), 200, 'The actual embedded game document returns HTTP 200');
    await page.frameLocator('iframe').locator('#root > *').first().waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForFunction(() => document.querySelector('[data-game-shell]').dataset.gameState === 'ready');
    assert.equal(await page.locator('[data-game-loading]').isVisible(), false, 'Iframe load removes the shell loading state');
    const bounds = await iframe.boundingBox();
    assert.ok(Math.abs(bounds.width / bounds.height - 16 / 9) < 0.01, 'Desktop iframe uses a 16:9 ratio');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, 'Desktop case has no horizontal overflow');
    await screenshot(page, `case-${viewport.width}x${viewport.height}`);
    await page.locator('[data-scroll-intro]').first().click();
    await page.waitForFunction(() => Math.abs(document.querySelector('#intro').getBoundingClientRect().top) < 60);
    assert.equal(await page.locator('#intro').isVisible(), true);
    assert.equal(await page.locator('[data-return-portfolio]').first().getAttribute('href'), './#candy-chase-feature');
    assert.deepEqual(pageErrors, [], 'No shell or actual game page errors');
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
    assert.equal(await iframe.getAttribute('src'), 'about:blank', 'Pagehide stops the iframe document');
    await page.route('https://framerusercontent.com/sites/**', route => route.abort());
    await page.locator('[data-return-portfolio]').first().click();
    await page.waitForURL(`${baseUrl}/#candy-chase-feature`, { waitUntil: 'domcontentloaded' });
    console.log(`PASS case ${viewport.width}x${viewport.height}: approved copy, 16:9 iframe, actual game HTTP 200 and visible root, load readiness, introduction scroll, return navigation, pagehide blanking, no page errors/overflow`);
    await context.close();
  }

  const mobileContext = await qaContext(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const mobilePage = await mobileContext.newPage();
  const mobileGameRequests = [];
  mobilePage.on('request', request => {
    if (request.url().includes('/games/candy-chase/')) mobileGameRequests.push(request.url());
  });
  await mobilePage.goto(`${baseUrl}/candy-chase.html?from=portfolio#play`, { waitUntil: 'load' });
  assert.equal(await mobilePage.getByText('建议使用电脑体验完整游戏', { exact: true }).isVisible(), true);
  assert.equal(await mobilePage.locator('iframe').getAttribute('src'), null, 'Mobile does not assign an iframe source');
  assert.deepEqual(mobileGameRequests, [], 'Mobile does not request the game or game assets');
  assert.equal(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, 'Mobile case has no horizontal overflow');
  await screenshot(mobilePage, 'case-mobile-390x844');
  console.log('PASS case 390x844: exact desktop recommendation, no iframe source or game requests, no overflow');
  await mobileContext.close();

  const failureContext = await qaContext(browser, { viewport: { width: 1440, height: 900 } });
  const failurePage = await failureContext.newPage();
  await failurePage.clock.install();
  await failurePage.clock.pauseAt(new Date());
  await failurePage.route('**/games/candy-chase/index.html', route => { controlledRequests.add(route.request()); });
  await failurePage.goto(`${baseUrl}/candy-chase.html`, { waitUntil: 'domcontentloaded' });
  await failurePage.clock.runFor(11999);
  assert.equal(await failurePage.locator('[data-game-shell]').getAttribute('data-game-state'), 'loading', 'Readiness fallback must not fire before 12 seconds');
  await failurePage.clock.runFor(1);
  assert.equal(await failurePage.locator('[data-game-shell]').getAttribute('data-game-state'), 'error', 'No load signal for 12 seconds shows retry fallback');
  assert.equal(await failurePage.locator('[data-game-retry]').isVisible(), true);
  assert.equal(await failurePage.locator('[data-game-error] [data-return-portfolio]').isVisible(), true);
  await failurePage.evaluate(() => { window.qaIntro = document.querySelector('#intro'); window.qaShell = document.querySelector('[data-game-shell]'); });
  // Keep the original document stalled. The retry query falls outside this
  // exact URL route, so only the user-triggered retry reaches the real server.
  await failurePage.clock.resume();
  const retriedResponse = failurePage.waitForResponse(response => response.url().includes('/games/candy-chase/index.html?retry=')).catch(error => error);
  await failurePage.locator('[data-game-retry]').click();
  assert.equal((await retriedResponse).status(), 200);
  const retrySource = new URL(await failurePage.locator('iframe').getAttribute('src'), baseUrl);
  assert.equal(retrySource.pathname, '/games/candy-chase/index.html');
  assert.deepEqual([...retrySource.searchParams.keys()], ['retry'], 'Retry replaces only the game URL with the cache-busting query');
  assert.equal(await failurePage.evaluate(() => window.qaIntro === document.querySelector('#intro') && window.qaShell === document.querySelector('[data-game-shell]')), true, 'Retry preserves the surrounding case document');
  await failurePage.waitForFunction(() => document.querySelector('[data-game-shell]').dataset.gameState === 'ready');
  await failurePage.clock.runFor(12000);
  assert.equal(await failurePage.locator('[data-game-shell]').getAttribute('data-game-state'), 'ready', 'A loaded iframe must not be invalidated by the fallback timer');
  await failurePage.locator('iframe').dispatchEvent('error');
  assert.equal(await failurePage.locator('[data-game-retry]').isVisible(), true, 'Iframe error shows retry');
  assert.equal(await failurePage.locator('[data-game-error] [data-return-portfolio]').isVisible(), true, 'Iframe error shows return control');
  console.log('PASS case lifecycle: 11999ms loading/12000ms fallback, retry game HTTP 200 with only retry query and unchanged shell, loaded state survives timer, iframe error exposes retry/return');
  await failureContext.close();
}

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' });
  flowEvidence.browserVersion = browser.version();
  try {
    await checkCasePage(browser);
    await checkRealGameplay(browser);
    const earlySignalContext = await qaContext(browser, { viewport: { width: 1440, height: 900 } });
    const earlySignalPage = await earlySignalContext.newPage();
    await earlySignalPage.route('https://framerusercontent.com/sites/**', route => route.abort());
    await earlySignalPage.addInitScript(() => performance.mark('framer-hydration-layout-effects-end'));
    await earlySignalPage.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
    await earlySignalPage.locator('#candy-chase-feature').waitFor();
    assert.equal(await earlySignalPage.locator('#candy-chase-feature').count(), 1, 'A previously emitted hydration mark is handled once');
    await earlySignalContext.close();
    console.log('PASS hydration signal already present before feature script: one feature');
    const desktop = await qaContext(browser, { viewport: { width: 1440, height: 900 } });
    const page = await desktop.newPage();
    const feature = await checkFeature(page);
    await feature.locator('a').hover();
    await page.waitForFunction(() => {
      const video = document.querySelector('#candy-chase-feature video');
      return video?.getAttribute('src') === './assets/candy-chase/hover-loop.mp4' && !video.paused && video.currentTime > 0;
    });
    await screenshot(page, 'desktop-hover');
    await page.mouse.move(0, 0);
    await page.waitForFunction(() => document.querySelector('#candy-chase-feature video').paused);
    await feature.locator('a').focus();
    await page.waitForFunction(() => !document.querySelector('#candy-chase-feature video').paused);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => !document.querySelector('#candy-chase-feature video').hasAttribute('src'));
    await checkExistingPortfolio(page);
    console.log('PASS desktop 1440x900: placement, cover, idempotent remount, hover playback, keyboard playback, leave pause, preference-change unload, no overflow');
    await desktop.close();

    for (const scenario of [
      { name: 'reduced-motion', options: { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' } },
      { name: 'mobile', options: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    ]) {
      const context = await qaContext(browser, scenario.options);
      const currentPage = await context.newPage();
      const currentFeature = await checkFeature(currentPage);
      await currentFeature.locator('a').hover();
      await currentFeature.locator('a').focus();
      assert.equal(await currentFeature.locator('video').getAttribute('src'), null, `${scenario.name} must not request preview`);
      assert.equal(await currentFeature.locator('video').evaluate(video => video.paused), true);
      await screenshot(currentPage, scenario.name);
      await checkExistingPortfolio(currentPage);
      console.log(`PASS ${scenario.name}: placement, cover, idempotent remount, no preview on hover/focus, no overflow`);
      await context.close();
    }
    console.log('PASS delayed hydration gate in all contexts: zero before verified mark, no bypass on bundle load or explicit calls, one after repeated marks');
    console.log('PASS existing portfolio in all contexts: hero, About Me, four ordinary projects, keyboard modal open/Escape close/focus restore');
    assert.deepEqual(diagnostics.consoleErrors, [], 'No unexpected browser console errors');
    assert.deepEqual(diagnostics.pageErrors, [], 'No page errors');
    assert.deepEqual(diagnostics.failedLocalRequests, [], 'No failed local non-media requests');
    assert.deepEqual(diagnostics.httpErrors, [], 'No local HTTP errors');
    flowEvidence.status = 'passed';
  } catch (error) {
    flowEvidence.status = 'failed';
    flowEvidence.error = error.stack;
    throw error;
  } finally {
    flowEvidence.finishedAt = new Date().toISOString();
    if (artifactDir) {
      fs.mkdirSync(artifactDir, { recursive: true });
      fs.writeFileSync(path.join(artifactDir, 'report.json'), JSON.stringify({ ...flowEvidence, diagnostics }, null, 2) + '\n');
    }
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
