const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, writeFileSync, readFileSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const { spawnSync } = require('node:child_process');
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

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'candy-sync-'));
  const source = join(root, 'source');
  const portfolioRoot = join(root, 'portfolio');
  mkdirSync(join(source, 'assets'), { recursive: true });
  writeFileSync(join(source, 'index.html'), '<script src="/assets/app.js"></script>');
  writeFileSync(join(source, 'assets', 'loading-background-A.png'), Buffer.from([0, 255, 1, 128]));
  writeFileSync(join(source, 'assets', 'loading-loop-A.mp4'), Buffer.from([255, 0, 128, 1]));
  return { source, portfolioRoot };
}

test('rebases nested copied HTML, JavaScript and CSS while preserving binary and other files', () => {
  const { source, portfolioRoot } = fixture();
  mkdirSync(join(source, 'rhythm-game'), { recursive: true });
  writeFileSync(join(source, 'assets', 'app.js'), 'const urls=["/assets/a.png","/assets/b.png","/rhythm-game/index.html"]');
  writeFileSync(join(source, 'rhythm-game', 'index.html'), '<link href="/assets/style.css">');
  writeFileSync(join(source, 'assets', 'style.css'), 'body{background:url(/assets/a.png)}');
  writeFileSync(join(source, 'assets', 'metadata.json'), '{"url":"/assets/a.png"}');
  const binary = readFileSync(join(source, 'assets', 'loading-background-A.png'));

  const result = syncCandyChase({ source, portfolioRoot });

  assert.equal(readFileSync(join(portfolioRoot, 'games/candy-chase/assets/app.js'), 'utf8'), 'const urls=["/games/candy-chase/assets/a.png","/games/candy-chase/assets/b.png","/games/candy-chase/rhythm-game/index.html"]');
  assert.equal(readFileSync(join(portfolioRoot, 'games/candy-chase/rhythm-game/index.html'), 'utf8'), '<link href="/games/candy-chase/assets/style.css">');
  assert.equal(readFileSync(join(portfolioRoot, 'games/candy-chase/assets/style.css'), 'utf8'), 'body{background:url(/games/candy-chase/assets/a.png)}');
  assert.equal(readFileSync(join(portfolioRoot, 'games/candy-chase/assets/metadata.json'), 'utf8'), '{"url":"/assets/a.png"}');
  assert.deepEqual(readFileSync(join(portfolioRoot, 'games/candy-chase/assets/loading-background-A.png')), binary);
  assert.equal(readFileSync(join(source, 'assets', 'app.js'), 'utf8'), 'const urls=["/assets/a.png","/assets/b.png","/rhythm-game/index.html"]');
  assert.deepEqual(result, {
    copiedFiles: 7,
    rewrittenFiles: 4,
    coverSource: join(source, 'assets', 'loading-background-A.png'),
    hoverSource: join(source, 'assets', 'loading-loop-A.mp4'),
  });
});

test('preserves existing destination files and produces the same URLs on a repeat sync', () => {
  const { source, portfolioRoot } = fixture();
  mkdirSync(join(portfolioRoot, 'games/candy-chase'), { recursive: true });
  writeFileSync(join(portfolioRoot, 'games/candy-chase/keep.html'), '/assets/keep.png');
  syncCandyChase({ source, portfolioRoot });
  const result = syncCandyChase({ source, portfolioRoot });
  assert.equal(readFileSync(join(portfolioRoot, 'games/candy-chase/keep.html'), 'utf8'), '/assets/keep.png');
  assert.equal(readFileSync(join(portfolioRoot, 'games/candy-chase/index.html'), 'utf8'), '<script src="/games/candy-chase/assets/app.js"></script>');
  assert.equal(result.copiedFiles, 3);
  assert.equal(result.rewrittenFiles, 1);
});

for (const [label, file, pattern] of [
  ['cover', 'loading-background-B.png', /loading-background/],
  ['hover video', 'loading-loop-B.mp4', /loading-loop/],
]) {
  test(`rejects an ambiguous ${label} asset`, () => {
    const { source, portfolioRoot } = fixture();
    writeFileSync(join(source, 'assets', file), 'duplicate');
    assert.throws(() => syncCandyChase({ source, portfolioRoot }), pattern);
  });
}

for (const [label, file, pattern] of [
  ['cover', 'loading-loop-A.mp4', /loading-background/],
  ['hover video', 'loading-background-A.png', /loading-loop/],
]) {
  test(`rejects a missing ${label} asset`, () => {
    const root = mkdtempSync(join(tmpdir(), 'candy-sync-'));
    const source = join(root, 'source');
    const portfolioRoot = join(root, 'portfolio');
    mkdirSync(join(source, 'assets'), { recursive: true });
    writeFileSync(join(source, 'assets', file), 'one asset');
    assert.throws(() => syncCandyChase({ source, portfolioRoot }), pattern);
  });
}

test('rejects a portfolio root inside the source to avoid modifying the source', () => {
  const { source } = fixture();
  assert.throws(() => syncCandyChase({ source, portfolioRoot: join(source, 'portfolio') }), /overlap|inside|source/i);
});

test('CLI requires an absolute --source path and exits unsuccessfully without it', () => {
  const script = join(__dirname, '../scripts/sync-candy-chase.cjs');
  for (const args of [[], ['--source'], ['--source', 'relative-dist']]) {
    const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /--source|absolute/i);
  }
});
