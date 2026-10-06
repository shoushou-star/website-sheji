const fs = require('node:fs');
const path = require('node:path');

function listFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Distribution contains a symbolic link: ${file}`);
    return entry.isDirectory() ? listFiles(file) : [file];
  });
}

function isWithin(parent, child) {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function uniqueAsset(files, pattern, label) {
  const matches = files.filter((file) => pattern.test(path.basename(file)));
  if (matches.length !== 1) throw new Error(`Expected exactly one ${label} asset; found ${matches.length}`);
  return matches[0];
}

function syncCandyChase({ source, portfolioRoot }) {
  if (typeof source !== 'string' || !path.isAbsolute(source)) {
    throw new Error('--source must be an absolute distribution path');
  }
  if (typeof portfolioRoot !== 'string' || !path.isAbsolute(portfolioRoot)) {
    throw new Error('portfolioRoot must be an absolute path');
  }
  source = fs.realpathSync(source);
  portfolioRoot = path.resolve(portfolioRoot);
  if (fs.existsSync(portfolioRoot)) portfolioRoot = fs.realpathSync(portfolioRoot);
  const destination = path.join(portfolioRoot, 'games', 'candy-chase');
  if (isWithin(source, portfolioRoot) || isWithin(destination, source)) {
    throw new Error('Source and portfolio destination must not overlap');
  }
  const files = listFiles(source);
  const coverSource = uniqueAsset(files, /^loading-background-.*\.png$/, 'loading-background-*.png');
  const hoverSource = uniqueAsset(files, /^loading-loop-.*\.mp4$/, 'loading-loop-*.mp4');

  // Retain destination-only files: synchronizing never clears any directory.
  fs.cpSync(source, destination, { recursive: true, force: true });
  let rewrittenFiles = 0;
  for (const file of files) {
    if (!['.html', '.js', '.css'].includes(path.extname(file).toLowerCase())) continue;
    const copiedFile = path.join(destination, path.relative(source, file));
    const original = fs.readFileSync(copiedFile, 'utf8');
    const rewritten = original
      .replaceAll('/assets/', '/games/candy-chase/assets/')
      .replaceAll('/rhythm-game/', '/games/candy-chase/rhythm-game/');
    if (rewritten !== original) {
      fs.writeFileSync(copiedFile, rewritten);
      rewrittenFiles++;
    }
  }
  const cardAssets = path.join(portfolioRoot, 'assets', 'candy-chase');
  fs.mkdirSync(cardAssets, { recursive: true });
  fs.copyFileSync(coverSource, path.join(cardAssets, 'cover.png'));
  fs.copyFileSync(hoverSource, path.join(cardAssets, 'hover-loop.mp4'));
  return { copiedFiles: files.length, rewrittenFiles, coverSource, hoverSource };
}

module.exports = { syncCandyChase };

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 2 || args[0] !== '--source' || !args[1]) {
      throw new Error('Usage: node scripts/sync-candy-chase.cjs --source <absolute-dist-path>');
    }
    const result = syncCandyChase({ source: args[1], portfolioRoot: path.resolve(__dirname, '..') });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
