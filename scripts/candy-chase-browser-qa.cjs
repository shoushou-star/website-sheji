const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const baseUrlIndex = process.argv.indexOf('--base-url');
const baseUrl = baseUrlIndex >= 0 ? process.argv[baseUrlIndex + 1] : 'http://127.0.0.1:4174';
const artifactIndex = process.argv.indexOf('--artifact-dir');
const artifactDir = artifactIndex >= 0 ? process.argv[artifactIndex + 1] : null;

async function checkFeature(page) {
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.locator('#project').waitFor();
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
  assert.equal(await feature.count(), 1, 'Observer remounts one feature after hydration replaces it');
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

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' });
  try {
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
    console.log('PASS existing portfolio in all contexts: hero, About Me, four ordinary projects, keyboard modal open/Escape close/focus restore');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
