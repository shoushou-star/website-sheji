const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { tmpdir } = require('node:os');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const required = [
  'candy-chase.html',
  'candy-chase-case.css',
  'candy-chase-case.js',
  'candy-chase-feature.css',
  'candy-chase-feature.js',
  'assets/candy-chase/cover.png',
  'assets/candy-chase/hover-loop.mp4',
];

function regularFiles(directory, prefix = '') {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) return regularFiles(path.join(directory, entry.name), relative);
    return entry.isFile() ? [relative] : [];
  });
}

test('publishes the case, previews and every regular game runtime file byte for byte', () => {
  execFileSync(process.execPath, ['prepare-netlify.cjs'], { cwd: root });
  const output = path.join(root, 'tmp/netlify-publish-0904');
  const gameFiles = regularFiles(path.join(root, 'games/candy-chase'));
  assert.ok(gameFiles.includes('index.html'));
  assert.ok(gameFiles.includes('rhythm-game/index.html'));
  for (const file of [...required, ...gameFiles.map(file => `games/candy-chase/${file}`)]) {
    assert.equal(fs.existsSync(path.join(output, file)), true, file);
    assert.deepEqual(fs.readFileSync(path.join(output, file)), fs.readFileSync(path.join(root, file)), file);
  }
});

test('keeps workspace debris and game metadata out of the explicit publish allowlist', () => {
  const fixture = fs.mkdtempSync(path.join(tmpdir(), 'candy-publish-'));
  const write = (file, data = 'fixture') => {
    fs.mkdirSync(path.dirname(path.join(fixture, file)), { recursive: true });
    fs.writeFileSync(path.join(fixture, file), data);
  };
  fs.copyFileSync(path.join(root, 'prepare-netlify.cjs'), path.join(fixture, 'prepare-netlify.cjs'));
  write('index.html', '<html></html>');
  write('about-collage.css');
  for (const [folder, count, start, pad] of [
    ['khaki-girl', 3, 1, false], ['lumi-case-study', 6, 1, false],
    ['let-it-beer', 13, 1, true], ['anxiety-event', 14, 2, true],
  ]) {
    for (let i = start; i <= count; i++) write(`assets/${folder}/page-${pad ? String(i).padStart(2, '0') : i}.jpg`);
  }
  for (const file of required) write(file);
  write('games/candy-chase/index.html', '<html></html>');
  write('games/candy-chase/nested/assets/runtime.bin', Buffer.from([0, 255, 128]));
  const forbidden = [
    'docs/private.md', 'tests/private.cjs', '.git/config', '.superpowers/plan.md',
    'source-game/dist/private.js', 'unrelated.txt', 'assets/candy-chase/extra.png',
    'games/candy-chase/.git/config', 'games/candy-chase/.superpowers/plan.md',
    'games/candy-chase/docs/source.md', 'games/candy-chase/tests/private.cjs',
    'games/candy-chase/backups/old.js', 'games/candy-chase/README.md',
    'games/candy-chase/app.js.bak',
  ];
  for (const file of forbidden) write(file);
  execFileSync(process.execPath, ['prepare-netlify.cjs'], { cwd: fixture });
  const output = path.join(fixture, 'tmp/netlify-publish-0904');
  assert.deepEqual(fs.readFileSync(path.join(output, 'games/candy-chase/nested/assets/runtime.bin')), Buffer.from([0, 255, 128]));
  for (const file of forbidden) assert.equal(fs.existsSync(path.join(output, file)), false, file);
  const staleFile = path.join(output, 'stale-private-note.txt');
  fs.writeFileSync(staleFile, 'must not ship');
  assert.throws(() => execFileSync(process.execPath, ['prepare-netlify.cjs'], { cwd: fixture, stdio: 'pipe' }),
    error => /Unexpected publish output entries: stale-private-note\.txt/.test(error.stderr.toString()));
  assert.equal(fs.readFileSync(staleFile, 'utf8'), 'must not ship', 'Refuse stale output without deleting it');
});
