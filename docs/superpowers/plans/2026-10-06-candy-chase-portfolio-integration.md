# CANDY CHASE Portfolio Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full-screen CANDY CHASE feature slide before the existing project section and a standalone case page whose hero contains the playable game.

**Architecture:** Keep the static portfolio and React/Vite game isolated. Copy only the game thread's verified `dist` output into `games/candy-chase/`, rewrite copied root-relative URLs for the subdirectory, and load it in a same-origin iframe on `candy-chase.html`. Add the homepage feature as a focused CSS/JavaScript enhancement without restructuring the Framer mirror.

**Tech Stack:** Static HTML/CSS/JavaScript, Node.js built-ins, existing React/Vite game build, same-origin iframe, Playwright from the bundled Codex runtime, Netlify static hosting.

**Spec:** `docs/superpowers/specs/2026-10-06-candy-chase-portfolio-integration-design.md`

## Global Constraints

- Operate only in `D:\05 ai作品集\00 zuopinji - shejishi`; the game worktree is read-only input.
- Do not delete files, recursively delete folders, or bulk-delete content.
- Do not modify the game source, gameplay, score rules, chart, character rules, audio, or settlement logic.
- Do not copy a game build until its source thread reports a successful build and complete browser-flow verification.
- Preserve the homepage, About Me, ordinary project cards, footer, and ordinary project modal behavior.
- Reuse the existing project-detail typography, spacing, rounded corners, colors, and information hierarchy.
- Do not add a package manager or install project dependencies; use Node built-ins and the bundled Playwright runtime.
- Do not deploy to Netlify until local build and browser acceptance pass and the user authorizes production deployment.
- Use one-off Git identity `Codex <codex@local>` for agent-authored commits; do not change local or global Git identity configuration.

## File Structure

- Create `scripts/sync-candy-chase.cjs`: copy and rebase a verified game `dist` without changing the source.
- Create `tests/sync-candy-chase.test.cjs`: exercise copying, URL rebasing, preview-asset selection, and source preservation.
- Create `candy-chase-feature.css`: homepage feature-slide styles and responsive/reduced-motion behavior.
- Create `candy-chase-feature.js`: mount the feature immediately before `#project` and control hover media.
- Modify `index.html`: load the two feature assets only; do not edit the existing project data or modal implementation.
- Create `candy-chase.html`: standalone case page and same-origin game iframe.
- Create `candy-chase-case.css`: case-page layout using the current project-detail visual language.
- Create `candy-chase-case.js`: iframe retry, scroll-to-introduction, return-location, and unload cleanup.
- Create `assets/candy-chase/cover.png` and `assets/candy-chase/hover-loop.mp4`: stable homepage preview assets copied by the sync script.
- Create `games/candy-chase/**`: copied verified game distribution.
- Create `scripts/candy-chase-browser-qa.cjs`: real-browser desktop/mobile behavior checks.
- Create `tests/candy-chase-publish.test.cjs`: verify the Netlify allowlist contains the complete case and game.
- Modify `prepare-netlify.cjs`: publish the new root files, preview media, and game directory.
- Create `docs/qa/candy-chase-portfolio-integration.md`: record source revision, commands, viewport results, and known limits.

---

### Task 1: Verified game distribution sync

**Files:**
- Create: `scripts/sync-candy-chase.cjs`
- Create: `tests/sync-candy-chase.test.cjs`
- Create by script: `games/candy-chase/**`
- Create by script: `assets/candy-chase/cover.png`
- Create by script: `assets/candy-chase/hover-loop.mp4`

**Interfaces:**
- Consumes: a verified game distribution directory passed as `--source <absolute-dist-path>`.
- Produces: `syncCandyChase({ source, portfolioRoot })` returning `{ copiedFiles, rewrittenFiles, coverSource, hoverSource }`.
- URL contract: copied text files replace `/assets/` with `/games/candy-chase/assets/` and `/rhythm-game/` with `/games/candy-chase/rhythm-game/`.

- [ ] **Step 1: Confirm the source is ready without modifying it**

Read thread `01a10cf9-1f76-78f2-8470-07f5998cd7c2`. Proceed only after its final report includes successful `npm run build`, game tests, and full browser-flow verification. Confirm this exact directory exists:

```powershell
Test-Path 'C:\Users\25283\.codex\worktrees\game-flow-integration\游戏操作文件\dist\index.html'
```

If the worktree has been archived or the thread is still active, stop Task 1 and report the actual state; do not substitute an older build.

- [ ] **Step 2: Write the failing sync tests**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, writeFileSync, readFileSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const { syncCandyChase } = require('../scripts/sync-candy-chase.cjs');

test('copies a distribution and rebases root URLs without changing the source', () => {
  const root = mkdtempSync(join(tmpdir(), 'candy-sync-'));
  const source = join(root, 'source');
  const portfolioRoot = join(root, 'portfolio');
  mkdirSync(join(source, 'assets'), { recursive: true });
  writeFileSync(join(source, 'index.html'), '<script src="/assets/app.js"></script><a href="/rhythm-game/index.html">play</a>');
  writeFileSync(join(source, 'assets', 'app.js'), 'const url="/assets/a.png"');
  writeFileSync(join(source, 'assets', 'loading-background-A.png'), 'cover');
  writeFileSync(join(source, 'assets', 'loading-loop-A.mp4'), 'video');

  syncCandyChase({ source, portfolioRoot });

  assert.match(readFileSync(join(portfolioRoot, 'games/candy-chase/index.html'), 'utf8'), /\/games\/candy-chase\/assets\/app\.js/);
  assert.match(readFileSync(join(portfolioRoot, 'games/candy-chase/index.html'), 'utf8'), /\/games\/candy-chase\/rhythm-game\/index\.html/);
  assert.equal(readFileSync(join(source, 'index.html'), 'utf8').includes('/games/candy-chase/'), false);
  assert.equal(readFileSync(join(portfolioRoot, 'assets/candy-chase/cover.png'), 'utf8'), 'cover');
  assert.equal(readFileSync(join(portfolioRoot, 'assets/candy-chase/hover-loop.mp4'), 'utf8'), 'video');
});
```

- [ ] **Step 3: Run the test and verify the expected failure**

Run: `node --test tests/sync-candy-chase.test.cjs`  
Expected: FAIL because `scripts/sync-candy-chase.cjs` does not exist.

- [ ] **Step 4: Implement the minimal sync module**

Implement recursive copying with `fs.cpSync(source, destination, { recursive: true, force: true })`. Never remove the destination. Rewrite only copied `.html`, `.js`, and `.css` files. Select exactly one `loading-background-*.png` and one `loading-loop-*.mp4`; throw when either is absent or ambiguous. Export `syncCandyChase`, and add a CLI that requires `--source`.

- [ ] **Step 5: Run unit tests and sync the verified distribution**

```powershell
node --test tests/sync-candy-chase.test.cjs
node scripts/sync-candy-chase.cjs --source 'C:\Users\25283\.codex\worktrees\game-flow-integration\游戏操作文件\dist'
```

Expected: tests PASS; the command reports copied and rewritten counts; the source file hashes remain unchanged.

- [ ] **Step 6: Commit only Task 1 files**

```powershell
git -c user.name=Codex -c user.email=codex@local add scripts/sync-candy-chase.cjs tests/sync-candy-chase.test.cjs games/candy-chase assets/candy-chase
git -c user.name=Codex -c user.email=codex@local commit -m "build: sync verified CANDY CHASE runtime"
```

### Task 2: Homepage feature slide

**Files:**
- Create: `candy-chase-feature.css`
- Create: `candy-chase-feature.js`
- Modify: `index.html:598` and the closing-script area near `index.html:2207`
- Create: `scripts/candy-chase-browser-qa.cjs`

**Interfaces:**
- Produces: `mountCandyChaseFeature()`, idempotently inserting `#candy-chase-feature` immediately before `#project`.
- Navigation: the card and `开始试玩` link to `./candy-chase.html?from=portfolio#play`.
- Media: `./assets/candy-chase/cover.png` and `./assets/candy-chase/hover-loop.mp4`.

- [ ] **Step 1: Write the first real-browser acceptance checks**

Create a Playwright script that imports `chromium` from `playwright` and `assert` from `node:assert/strict`, opens the current local server, waits for `#project`, and asserts:

```js
await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
const feature = page.locator('#candy-chase-feature');
assert.equal(await feature.count(), 1);
assert.equal(await feature.getAttribute('data-mounted-before'), 'project');
assert.equal(await feature.getByRole('heading', { name: 'CANDY CHASE' }).isVisible(), true);
assert.match(await feature.getByRole('link', { name: /开始试玩/ }).getAttribute('href'), /candy-chase\.html/);
```

Load Playwright through:

```powershell
$env:NODE_PATH='C:\Users\25283\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
node scripts/candy-chase-browser-qa.cjs --base-url http://127.0.0.1:4173
```

- [ ] **Step 2: Run the browser check and verify it fails**

Expected: FAIL because `#candy-chase-feature` is absent.

- [ ] **Step 3: Implement the slide**

Load `candy-chase-feature.css` and `candy-chase-feature.js` from `index.html`. The script must wait for Framer hydration, insert before `#project`, set `data-mounted-before="project"`, and remain idempotent under the existing MutationObserver.

Use semantic content:

```html
<section id="candy-chase-feature" aria-labelledby="candy-chase-feature-title">
  <a class="candy-feature-link" href="./candy-chase.html?from=portfolio#play">
    <img class="candy-feature-cover" src="./assets/candy-chase/cover.png" alt="CANDY CHASE 游戏加载画面">
    <video class="candy-feature-preview" muted loop playsinline preload="none" poster="./assets/candy-chase/cover.png"></video>
    <p>GAME DESIGN · INTERACTIVE</p>
    <h2 id="candy-chase-feature-title">CANDY CHASE</h2>
    <span>开始试玩 →</span>
  </a>
</section>
```

Set the video `src` only on fine-pointer hover/focus and never when `prefers-reduced-motion: reduce` matches.

- [ ] **Step 4: Verify desktop, reduced-motion, and mobile behavior**

Run the browser QA at 1440×900 and 390×844. Assert desktop hover assigns and plays the muted preview; reduced-motion and mobile do not assign the video URL; the feature precedes `#project); no horizontal overflow occurs.

- [ ] **Step 5: Commit Task 2**

```powershell
git -c user.name=Codex -c user.email=codex@local add index.html candy-chase-feature.css candy-chase-feature.js scripts/candy-chase-browser-qa.cjs
git -c user.name=Codex -c user.email=codex@local commit -m "feat: add CANDY CHASE portfolio feature"
```

### Task 3: Standalone playable case page

**Files:**
- Create: `candy-chase.html`
- Create: `candy-chase-case.css`
- Create: `candy-chase-case.js`
- Modify: `scripts/candy-chase-browser-qa.cjs`

**Interfaces:**
- iframe title: `CANDY CHASE 可试玩游戏`
- iframe source: `./games/candy-chase/index.html`
- Controls: `[data-game-retry]`, `[data-scroll-intro]`, and `[data-return-portfolio]`.

- [ ] **Step 1: Extend browser QA before implementation**

Assert the case page has the verified title and facts, a 16:9 desktop iframe, a working introduction scroll control, and a return link to `./#candy-chase-feature`. At 390×844 assert the iframe is not loaded and the text `建议使用电脑体验完整游戏` is visible.

- [ ] **Step 2: Run the extended QA and verify it fails**

Expected: FAIL because `candy-chase.html` returns 404.

- [ ] **Step 3: Build the case page**

Use the approved copy exactly:

- `GAME DESIGN · INTERACTIVE`
- `CANDY CHASE`
- `网页音乐节奏游戏`
- `2026`
- `游戏视觉设计 / UI设计 / 交互设计 / 前端实现`
- `Figma / React / TypeScript / AI辅助开发`

Description:

> CANDY CHASE 是一款以糖果幻想舞台为主题的网页音乐节奏游戏。玩家选择角色 PIKO，经过舞台开场动画进入节奏挑战，通过精准判定完成演出，并获得实时成绩与星级评价。

Flow copy:

> 游戏体验由加载页、游戏大厅、角色选择、开场演出、节奏玩法和成绩结算组成，形成一条完整且连续的游玩流程。

Reuse the existing `project-case-kicker`, `project-case-title`, `project-case-description`, `project-case-summary`, and `project-case-facts` class names, with matching values copied into `candy-chase-case.css`. Do not alter the existing modal styles in `index.html`.

- [ ] **Step 4: Implement resilient iframe behavior**

On iframe `load`, remove the loading state. On `error` or an 12-second readiness timeout, show retry and return controls. Retry must replace only the iframe URL with a cache-busting `retry` query. On `pagehide`, set iframe `src` to `about:blank` so audio and animation stop.

- [ ] **Step 5: Run case-page QA**

Verify desktop iframe HTTP 200, game root visible, no page error, introduction scrolling, return URL, mobile fallback, and no horizontal overflow at 1440×900, 1366×768, and 390×844.

- [ ] **Step 6: Commit Task 3**

```powershell
git -c user.name=Codex -c user.email=codex@local add candy-chase.html candy-chase-case.css candy-chase-case.js scripts/candy-chase-browser-qa.cjs
git -c user.name=Codex -c user.email=codex@local commit -m "feat: add playable CANDY CHASE case page"
```

### Task 4: Netlify publish closure

**Files:**
- Modify: `prepare-netlify.cjs`
- Create: `tests/candy-chase-publish.test.cjs`

**Interfaces:**
- Build command remains `node prepare-netlify.cjs`.
- Publish output remains `tmp/netlify-publish-0904`.
- The allowlist adds the five new root files, two preview assets, and all files under `games/candy-chase/`.

- [ ] **Step 1: Write the failing publish test**

```js
test('publishes the case page and complete game subtree', () => {
  execFileSync(process.execPath, ['prepare-netlify.cjs'], { cwd: root });
  for (const file of [
    'candy-chase.html',
    'candy-chase-case.css',
    'candy-chase-case.js',
    'candy-chase-feature.css',
    'candy-chase-feature.js',
    'assets/candy-chase/cover.png',
    'assets/candy-chase/hover-loop.mp4',
    'games/candy-chase/index.html',
  ]) assert.equal(existsSync(join(output, file)), true, file);
});
```

- [ ] **Step 2: Run and observe the expected failure**

Run: `node --test tests/candy-chase-publish.test.cjs`  
Expected: FAIL because the current allowlist omits the new files.

- [ ] **Step 3: Extend the allowlist without publishing workspace debris**

Add the new root files explicitly. Add preview assets explicitly. Walk `games/candy-chase` recursively and add regular files relative to the project root. Do not publish source docs, backups, Git data, tests, or the game source worktree.

- [ ] **Step 4: Verify the build and every copied game reference**

```powershell
node --test tests/sync-candy-chase.test.cjs tests/candy-chase-publish.test.cjs
node prepare-netlify.cjs
```

Start a static server rooted at `tmp/netlify-publish-0904` and assert HTTP 200 for `/`, `/candy-chase.html`, `/games/candy-chase/index.html`, plus every local `src` and `href` discovered from the copied game HTML.

- [ ] **Step 5: Commit Task 4**

```powershell
git -c user.name=Codex -c user.email=codex@local add prepare-netlify.cjs tests/candy-chase-publish.test.cjs
git -c user.name=Codex -c user.email=codex@local commit -m "build: publish CANDY CHASE case and runtime"
```

### Task 5: Full local acceptance and evidence

**Files:**
- Modify: `scripts/candy-chase-browser-qa.cjs`
- Create: `docs/qa/candy-chase-portfolio-integration.md`

**Interfaces:**
- QA accepts `--base-url`.
- QA exits non-zero on console errors, page errors, failed local requests, missing content, layout overflow, or broken navigation.

- [ ] **Step 1: Run the complete automated suite**

```powershell
node --test tests/sync-candy-chase.test.cjs tests/candy-chase-publish.test.cjs
node prepare-netlify.cjs
$env:NODE_PATH='C:\Users\25283\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
node scripts/candy-chase-browser-qa.cjs --base-url http://127.0.0.1:4173
```

- [ ] **Step 2: Perform the real gameplay flow**

At desktop size, complete:

`加载 → 大厅 → 选择 PIKO → 开场视频 → 节奏游戏 → 成绩结算`

Confirm audio starts only after user interaction, the case page does not steal game keys, the introduction remains reachable, and returning stops all audio.

- [ ] **Step 3: Record evidence**

Document source thread ID, source worktree revision, source `dist` hash summary, test commands, viewport results, audio behavior, mobile fallback, and any uncovered manual limitation in `docs/qa/candy-chase-portfolio-integration.md`.

- [ ] **Step 4: Final diff and regression checks**

```powershell
git diff --check
node --check candy-chase-feature.js
node --check candy-chase-case.js
node --check scripts/sync-candy-chase.cjs
node --check prepare-netlify.cjs
```

Confirm no files outside the current portfolio project were modified and no files were deleted.

- [ ] **Step 5: Commit QA evidence**

```powershell
git -c user.name=Codex -c user.email=codex@local add scripts/candy-chase-browser-qa.cjs docs/qa/candy-chase-portfolio-integration.md
git -c user.name=Codex -c user.email=codex@local commit -m "test: verify CANDY CHASE portfolio flow"
```

### Task 6: Production deployment after explicit approval

**Files:** No source changes expected.

**Interfaces:**
- Netlify project must be `suki-visual-design-portfolio`.
- Production URL must be `https://suki-visual-design-portfolio.netlify.app`.

- [ ] **Step 1: Confirm explicit deployment approval**

Report local build and QA evidence to the user. Do not continue until the user explicitly asks to publish the verified build.

- [ ] **Step 2: Verify the linked Netlify project**

```powershell
npx --yes netlify-cli status
```

Expected project ID: `c4f7b44b-48b5-4fa2-856f-36737cf4e18b`.

- [ ] **Step 3: Deploy the verified publish directory**

```powershell
npx --yes netlify-cli deploy --prod --dir "tmp/netlify-publish-0904" --message "Add playable CANDY CHASE case"
```

- [ ] **Step 4: Verify production**

Fetch the production homepage, case page, game index, cover, and hover video. Run browser QA against the production URL and confirm the old site `suki-aigc-portfolio.netlify.app` was not targeted.
