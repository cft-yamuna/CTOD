const { chromium } = await import('file:///C:/Users/iamne/Desktop/figma-agent/node_modules/playwright/index.mjs');
const { PNG } = await import('file:///C:/Users/iamne/Desktop/figma-agent/node_modules/pngjs/lib/png.js');
const fs = await import('node:fs');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
await p.goto('http://127.0.0.1:5173/?screen=paid', { waitUntil: 'load' });
await p.waitForFunction(() => Array.from(document.images).every((i) => i.complete && i.naturalWidth > 0));
/* Park the badge animation at its END while the layers are still shown. If the
   patch is right, the region is then identical to the plate. */
await p.evaluate(() => {
  document.getAnimations().forEach((a) => { a.pause(); a.currentTime = 780; });
});
const CLIP = { x: 441, y: 149, width: 201, height: 201 };   // badge box + 20px margin
const shot = PNG.sync.read(await p.screenshot({ clip: CLIP }));
await b.close();

const plate = PNG.sync.read(fs.readFileSync('.figma/ref/211-6499.png'));
let bad = 0, worst = 0;
for (let y = 0; y < shot.height; y++) for (let x = 0; x < shot.width; x++) {
  const i = (shot.width * y + x) << 2;
  const j = (plate.width * (y + CLIP.y) + (x + CLIP.x)) << 2;
  let d = 0;
  for (let c = 0; c < 3; c++) d = Math.max(d, Math.abs(shot.data[i + c] - plate.data[j + c]));
  if (d > 8) bad++;
  worst = Math.max(worst, d);
}
const total = shot.width * shot.height;
console.log(`badge region reconstructed from patch + badge layer:`);
console.log(`  differing pixels: ${bad} / ${total}  (${(bad / total * 100).toFixed(3)}%)`);
console.log(`  worst channel delta: ${worst}`);
console.log(worst <= 8 ? '  -> the patch is correct; nothing else sits behind the badge' : '  -> something else is behind the badge');
