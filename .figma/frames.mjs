const { chromium } = await import('file:///C:/Users/iamne/Desktop/figma-agent/node_modules/playwright/index.mjs');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
await p.goto('http://127.0.0.1:5173/?screen=home', { waitUntil: 'networkidle' });
await p.waitForTimeout(2600);
await p.screenshot({ path: '.figma/diff/home-midanimation.png' });
console.log('captured mid-animation frame');
await b.close();
