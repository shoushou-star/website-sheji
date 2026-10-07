const fs = require('node:fs');
const path = require('node:path');

// Publish an explicit allowlist; never upload the workspace, backups or notes.
const root = __dirname;
const output = path.join(root, 'tmp', 'netlify-publish-0904');
const sourceFiles = ['index.html', 'about-collage.css'];
const source = sourceFiles.map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
const files = new Set(sourceFiles);
for (const match of source.matchAll(/(?<![A-Za-z0-9_/.:-])(?:\.\/)?(assets\/[A-Za-z0-9_./-]+\.(?:png|jpe?g|webp|svg|gif|woff2?|mp4))/g)) files.add(match[1]);
for (const [folder, count] of [['khaki-girl', 3], ['lumi-case-study', 6]]) {
  for (let i = 1; i <= count; i++) files.add(`assets/${folder}/page-${i}.jpg`);
}
for (let i = 1; i <= 13; i++) files.add(`assets/let-it-beer/page-${String(i).padStart(2, '0')}.jpg`);
for (let i = 2; i <= 14; i++) files.add(`assets/anxiety-event/page-${String(i).padStart(2, '0')}.jpg`);
for (let i = 1; i <= 6; i++) files.add(`assets/placeholder-project/page-${i}.png`);
for (const match of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
  if (!/type=["'](?:module|application\/|text\/template)/i.test(match[1])) new Function(match[2]);
}
let size = 0;
for (const file of files) {
  const input = path.join(root, file);
  if (!fs.existsSync(input)) throw new Error(`Missing published asset: ${file}`);
  const destination = path.join(output, file);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(input, destination);
  size += fs.statSync(input).size;
}
console.log(JSON.stringify({ output, files: files.size, megabytes: +(size / 1024 / 1024).toFixed(2) }));
