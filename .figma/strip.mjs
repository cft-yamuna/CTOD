const { chromium } = await import('file:///C:/Users/iamne/Desktop/figma-agent/node_modules/playwright/index.mjs');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
const stops = [0,80,160,240,320,400,480,560,640,720,760,800,840,880,940,1000,1060,1140];
for (const [i, t] of stops.entries()) {
  await p.goto('http://127.0.0.1:5173/?screen=success', { waitUntil: 'load' });
  await p.waitForFunction(() => Array.from(document.images).every((x) => x.complete && x.naturalWidth > 0));
  await p.evaluate((ms) => { document.getAnimations().forEach((a) => { a.pause(); a.currentTime = ms; }); }, t);
  await p.screenshot({ path: `.figma/ours/${String(i).padStart(2,'0')}.png`, clip: { x: 320, y: 740, width: 440, height: 440 } });
}
console.log('captured', stops.length, 'frames');
await b.close();
