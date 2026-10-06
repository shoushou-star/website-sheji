const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const baseUrlIndex = process.argv.indexOf('--base-url');
const baseUrl = baseUrlIndex >= 0 ? process.argv[baseUrlIndex + 1] : 'http://127.0.0.1:4174';
const artifactIndex = process.argv.indexOf('--artifact-dir');
const artifactDir = artifactIndex >= 0 ? process.argv[artifactIndex + 1] : null;

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
    const context = await browser.newContext({ viewport });
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

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
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

  const failureContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const failurePage = await failureContext.newPage();
  await failurePage.clock.install();
  await failurePage.clock.pauseAt(new Date());
  await failurePage.route('**/games/candy-chase/index.html', () => {});
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
  try {
    await checkCasePage(browser);
    const earlySignalContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const earlySignalPage = await earlySignalContext.newPage();
    await earlySignalPage.route('https://framerusercontent.com/sites/**', route => route.abort());
    await earlySignalPage.addInitScript(() => performance.mark('framer-hydration-layout-effects-end'));
    await earlySignalPage.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
    await earlySignalPage.locator('#candy-chase-feature').waitFor();
    assert.equal(await earlySignalPage.locator('#candy-chase-feature').count(), 1, 'A previously emitted hydration mark is handled once');
    await earlySignalContext.close();
    console.log('PASS hydration signal already present before feature script: one feature');
    const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
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
      const context = await browser.newContext(scenario.options);
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
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
