const { chromium } = await import('file:///C:/Users/iamne/Desktop/figma-agent/node_modules/playwright/index.mjs');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
const errs = [];
p.on('pageerror', e => errs.push(e.message));
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });

/* success, mid-animation - the state the user saw the artifact in on paid. */
await p.goto('http://127.0.0.1:5173/?screen=success', { waitUntil: 'load' });
await p.waitForFunction(() => Array.from(document.images).every(i => i.complete && i.naturalWidth > 0));
await p.evaluate(() => document.getAnimations().forEach(a => { a.pause(); a.currentTime = 300; }));
await p.screenshot({ path: '.figma/check-success-mid.png', clip: { x: 300, y: 720, width: 480, height: 420 } });

/* loading - one frame at rest, one part-way round. */
await p.goto('http://127.0.0.1:5173/?screen=loading', { waitUntil: 'load' });
await p.waitForFunction(() => Array.from(document.images).every(i => i.complete && i.naturalWidth > 0));
await p.evaluate(() => document.getAnimations().forEach(a => { a.pause(); a.currentTime = 0; }));
await p.screenshot({ path: '.figma/check-loading-0.png', clip: { x: 400, y: 745, width: 310, height: 310 } });
await p.evaluate(() => document.getAnimations().forEach(a => { a.currentTime = 412; }));   // ~135deg
await p.screenshot({ path: '.figma/check-loading-1.png', clip: { x: 400, y: 745, width: 310, height: 310 } });
console.log('errors:', errs.length ? errs.join(' | ') : 'none');
await b.close();
