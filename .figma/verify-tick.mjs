const { chromium } = await import('file:///C:/Users/iamne/Desktop/figma-agent/node_modules/playwright/index.mjs');
const { PNG } = await import('file:///C:/Users/iamne/Desktop/figma-agent/node_modules/pngjs/lib/png.js');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
/* The tick sits at (172,184) 72x50 inside layer #211:6338, which is placed at
   (335,753) - so this is the tick's own region on the stage. Mean red falls
   from white (255) toward the tick's 67 as it fades up. */
const CLIP = { x: 335 + 172, y: 753 + 184, width: 72, height: 50 };
console.log('t(ms)   mean red   tick opacity (0=absent, 1=full)');
for (const t of [700, 740, 800, 860, 920, 980, 1040, 1100]) {
  await p.goto('http://127.0.0.1:5173/?screen=success', { waitUntil: 'load' });
  await p.waitForFunction(() => Array.from(document.images).every((i) => i.complete && i.naturalWidth > 0));
  await p.evaluate((ms) => { document.getAnimations().forEach((a) => { a.pause(); a.currentTime = ms; }); }, t);
  const img = PNG.sync.read(await p.screenshot({ clip: CLIP }));
  let sum = 0, n = 0;
  for (let i = 0; i < img.data.length; i += 4) { sum += img.data[i]; n++; }
  const mean = sum / n;
  console.log(String(t).padStart(5), mean.toFixed(1).padStart(10), ((255 - mean) / (255 - 150)).toFixed(2).padStart(16));
}
await b.close();
