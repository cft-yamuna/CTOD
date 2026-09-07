const { chromium } = await import('file:///C:/Users/iamne/Desktop/figma-agent/node_modules/playwright/index.mjs');
const { PNG } = await import('file:///C:/Users/iamne/Desktop/figma-agent/node_modules/pngjs/lib/png.js');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
await p.goto('http://127.0.0.1:5173/?screen=home', { waitUntil: 'networkidle' });
const shots = [];
for (const t of [0, 1200, 2600, 5200, 8200]) {
  if (t) await p.waitForTimeout(t - (shots.length ? [0,1200,2600,5200,8200][shots.length-1] : 0));
  shots.push({ t, buf: await p.screenshot() });
}
await b.close();
const base = PNG.sync.read(shots[0].buf);
for (const s of shots) {
  const img = PNG.sync.read(s.buf);
  let diff = 0;
  for (let i = 0; i < img.data.length; i += 4) {
    if (Math.abs(img.data[i] - base.data[i]) + Math.abs(img.data[i+1] - base.data[i+1]) + Math.abs(img.data[i+2] - base.data[i+2]) > 6) diff++;
  }
  console.log(`t=${String(s.t).padStart(5)}ms   pixels changed vs t=0: ${diff.toLocaleString()}  (${(diff / (img.width*img.height) * 100).toFixed(2)}%)`);
}
