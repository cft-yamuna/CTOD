const { chromium } = await import('file:///C:/Users/iamne/Desktop/figma-agent/node_modules/playwright/index.mjs');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
await p.goto('http://127.0.0.1:5173/?screen=terms', { waitUntil: 'networkidle' });

/* Sample from inside the page so nothing depends on driver round-trip timing. */
const seen = await p.evaluate(async () => {
  const log = [];
  const t0 = performance.now();
  const iv = setInterval(() => {
    const el = document.querySelector('.hit-pressed');
    if (el) log.push({
      at: Math.round(performance.now() - t0),
      label: el.getAttribute('aria-label'),
      bg: getComputedStyle(el).backgroundColor,
    });
  }, 8);
  document.querySelector('button[aria-label="Continue"]').click();
  await new Promise(r => setTimeout(r, 400));
  clearInterval(iv);
  return { samples: log.length, first: log[0] || null, last: log[log.length - 1] || null,
           screen: new URLSearchParams(location.search).get('screen') };
});
console.log(JSON.stringify(seen, null, 2));
console.log('lingering at rest:', await p.evaluate(() => document.querySelectorAll('.hit-pressed').length));
await b.close();
