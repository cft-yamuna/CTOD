const { chromium } = await import('file:///C:/Users/iamne/Desktop/figma-agent/node_modules/playwright/index.mjs');
const { PNG } = await import('file:///C:/Users/iamne/Desktop/figma-agent/node_modules/pngjs/lib/png.js');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });

/* Reference: white-rosette width in the 926px-wide recording, scaled to our
   1080px stage. Measured frame by frame in .figma/ref-video/. */
const REF = { 167: 119, 233: 128, 300: 131, 400: 134, 500: 143, 600: 147, 733: 148 };
const K = 1080 / 926;

console.log('t(ms)   ours   reference   delta');
for (const t of [167, 233, 300, 400, 500, 600, 733]) {
  await p.goto('http://127.0.0.1:5173/?screen=success', { waitUntil: 'load' });
  await p.waitForFunction(() => Array.from(document.images).every((i) => i.complete && i.naturalWidth > 0));
  /* Drive the animation clock rather than waiting on it - screenshot latency
     otherwise accumulates and every later sample reads too far ahead. */
  await p.evaluate((ms) => {
    document.getAnimations().forEach((a) => { a.pause(); a.currentTime = ms; });
  }, t);
  const buf = await p.screenshot({ clip: { x: 335, y: 753, width: 416, height: 352 } });
  const img = PNG.sync.read(buf);
  let a = 1e9, c = -1;
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
    const k = (img.width * y + x) << 2;
    if (img.data[k] > 235 && img.data[k+1] > 235 && img.data[k+2] > 235) { if (x<a)a=x; if(x>c)c=x; }
  }
  const ours = c < 0 ? 0 : c - a + 1;
  const ref = Math.round(REF[t] * K);
  console.log(String(t).padStart(5), String(ours).padStart(6), String(ref).padStart(11), String(ours - ref).padStart(7));
}
await b.close();
