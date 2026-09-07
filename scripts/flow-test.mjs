/**
 * Transition test. The pixel diff proves each screen LOOKS right; it cannot
 * tell you a screen does anything. This drives every transition declared in
 * `src/flow.ts` in a real browser, including the ones that must NOT fire.
 *
 * Needs the dev server and playwright available. The port defaults to 5176
 * because 5173 belongs to the sibling TOTD kiosk on this machine - the guard
 * check below is what turns that collision into a clear failure rather than a
 * pass against the wrong app. Playwright is not a
 * dependency of this app - it is only ever used by the verify tooling - so it
 * is resolved leniently: from here first, then from the figma-agent install,
 * which is where it already lives on the build machine.
 */
const PLAYWRIGHT_CANDIDATES = [
  'playwright',
  'file:///C:/Users/iamne/Desktop/figma-agent/node_modules/playwright/index.mjs',
];

let chromium;
for (const candidate of PLAYWRIGHT_CANDIDATES) {
  try {
    ({ chromium } = await import(candidate));
    break;
  } catch { /* try the next one */ }
}
if (!chromium) {
  console.error('  playwright not found. npm i -D playwright, or edit PLAYWRIGHT_CANDIDATES.');
  process.exit(2);
}

const { findDevPort, GUARD } = await import('./dev-port.mjs');
const PORT = await findDevPort();
const URL_BASE = `http://127.0.0.1:${PORT}/`;

/* The dev server is NOT started here - a test that boots its own server tests
 * a server nobody runs. Fail loudly and early instead of thirty seconds of
 * navigation timeouts that read like an app bug. */
try {
  const probe = await fetch(URL_BASE, { signal: AbortSignal.timeout(4000) });
  const html = await probe.text();
  if (!html.includes(GUARD)) {
    console.error(`  something is serving ${URL_BASE} but it is not this app`);
    console.error(`  (no "${GUARD}" in the document). Another project on ${PORT}?`);
    process.exit(2);
  }
} catch {
  console.error(`  no dev server on ${URL_BASE}. Start one first:  npm run dev`);
  process.exit(2);
}

const browser = await chromium.launch();
/* 1080x1920 exactly, so Stage's scale lands on 1 and the transform is omitted:
 * the frame-relative coordinates in flow.ts are then page coordinates, with no
 * arithmetic between what the prototype declared and where the click goes. */
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });

const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

/**
 * Which screen is showing. Two independent readings joined into one string:
 * the `?screen=` the app writes on every navigation (the cheap assertion) and
 * the plate the user is actually looking at (the honest one). Requiring both
 * to agree catches a URL that moved without the artwork, and artwork that
 * moved without the URL - either one would break the diff harness's deep link.
 */
const READ_SCREEN = () => {
  const param = new URLSearchParams(location.search).get('screen') || '-';
  /* `home` has no plate - it is composited from its Figma layers so that its
     background animation can run underneath the artwork - so identify it by
     the layer stack instead. Reading only `img.plate` would report the first
     layer's filename and fail a screen that is perfectly correct. */
  if (document.querySelector('.layer-clip')) return param + ' | home';
  const img = document.querySelector('img.plate') || document.querySelector('.stage img');
  /* Every plate but one is a PNG exported from Figma; the attract screen is a
     JPEG, because it is a photograph rather than a frame export. Strip either. */
  const plate = img ? img.getAttribute('src').split('/').pop().replace(/\.(png|jpe?g)$/, '') : 'none';
  return param + ' | ' + plate;
};
const where = () => page.evaluate(READ_SCREEN);
/** What READ_SCREEN reads when screen `n` is up and agreeing with itself. */
const at = (n) => `${n} | ${n}`;

const results = [];
const record = (ok, name, got, want) => {
  results.push({ ok, name, got, want });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) console.log(`        got  ${got}\n        want ${want}`);
};

/**
 * Assert the flow ARRIVES somewhere, waiting for it.
 *
 * React 18 batches state updates that originate outside its own event handlers
 * - the `success` screen's setTimeout, a replaceState landing beside a
 * setState - so the re-render lands a microtask or two after the call that
 * triggered it returns. Reading the DOM immediately is a race that a real
 * mouse click is usually slow enough to hide and an evaluate() is not, and it
 * surfaces as a test that fails roughly one run in three. Wait for the arrival
 * rather than assume it. Never assert on the spot.
 */
const expect = async (name, want, timeout = 4000) => {
  try {
    await page.waitForFunction(
      ([read, w]) => new Function('return ' + read)()() === w,
      [READ_SCREEN.toString(), want],
      { timeout },
    );
    record(true, name, want, want);
  } catch {
    record(false, name, await where(), want);
  }
};

/**
 * Assert the flow STAYS put. There is nothing to wait for, so give the
 * transition that must not happen a fair chance before declaring it did not.
 */
const expectStays = async (name, want) => {
  await page.waitForTimeout(400);
  const got = await where();
  record(got === want, name, got, want);
};

/** Deep-link, and wait for the landing without scoring it. Phase 0 already
 *  scored deep-linking for all fourteen screens; this is only setup. */
const goTo = async (name) => {
  await page.goto(`${URL_BASE}?screen=${name}`, { waitUntil: 'networkidle' });
  try {
    await page.waitForFunction(
      ([read, w]) => new Function('return ' + read)()() === w,
      [READ_SCREEN.toString(), at(name)],
      { timeout: 4000 },
    );
  } catch { /* the assertion that follows will report it */ }
};

/** Click the middle of a declared hit box, in frame-relative pixels. */
const tap = (h) => page.mouse.click(h.left + h.width / 2, h.top + h.height / 2);

/* ------------------------------------------------------------------------ */

/**
 * The flow is not re-typed here. Vite serves `/src/flow.ts` transformed, so
 * the page can import the declaration itself and hand it back: the test then
 * drives what the app is actually built from, and a target added to flow.ts
 * gets covered on the next run without anybody remembering to add it here.
 */
await page.goto(URL_BASE, { waitUntil: 'networkidle' });
let SCREENS;
try {
  SCREENS = await page.evaluate(() => import('/src/flow.ts').then(m => m.SCREENS));
} catch (e) {
  console.error('  could not import /src/flow.ts through the dev server: ' + e.message);
  await browser.close();
  process.exit(2);
}

const edgeKey = (from, h) => `${from} -[${h.label}]-> ${h.to}`;
const declared = new Map();
for (const s of SCREENS) for (const h of s.hits) declared.set(edgeKey(s.name, h), { from: s.name, h });
const timedScreens = SCREENS.filter(s => s.autoAdvanceMs && s.autoTo);
const driven = new Set();

console.log(`\n  ${SCREENS.length} screens, ${declared.size} declared tap transitions, ${timedScreens.length} timed\n`);

/* --- Phase 0: every screen deep-links by name ---------------------------- */
/* The visual diff photographs each screen through `?screen=`. If this is wrong
 * every percentage it reports afterwards is measuring the wrong frame. */
console.log('  -- deep links --');
for (const s of SCREENS) {
  await page.goto(`${URL_BASE}?screen=${s.name}`, { waitUntil: 'networkidle' });
  await expect(`?screen=${s.name} lands on ${s.name}`, at(s.name));
}

/* --- Phase 1: the unattended loop ---------------------------------------- */
/* One continuous session from home all the way back to home, no reloads. This
 * is the run the kiosk does all day, and the only test that proves the flow
 * closes rather than merely that each hop works when started fresh. */
/** Marks the one step that is typed rather than tapped. */
const TYPE_PIN = Symbol('type-pin');

const WALK = [
  /* --- Setup, Figma section #211:5455 --- */
  ['home',      'ON-THE-GO Transit Card chip'],
  ['intro',     'Accept terms checkbox'],
  ['terms',     'Continue'],
  /* `cities` is hidden from the flow - `terms` goes straight to `issuer` - so
     the walk no longer passes through it. Its own edges are still driven in
     the deep-linked phase below, and it still diffs, so hiding it did not stop
     it being tested. */
  ['issuer',    'ABC Bank card'],
  ['cardstyle', 'Continue'],
  ['amount',    'Continue'],
  ['methods',   'UPI 1 row'],
  /* upipin2 is a live PIN screen: no tap on it advances the flow any more,
     because reaching `success` means entering six digits and pressing Next.
     `TYPE_PIN` marks that, the third column is where it lands, and the walk
     types instead of tapping. */
  ['upipin2',   TYPE_PIN, 'success'],
  ['success',   null],   // no tap target at all - the 3s AFTER_TIMEOUT is the only exit
  ['paid',      'Home button'],
  ['loading',   null],   // no tap target either - it finishes its own 2.6s

  /* --- the seam. `balance` hands over to the Add Money section on the ₹300
     chip, which is where the setup leg used to restart instead. --- */
  ['balance',    'Add ₹300 chip'],

  /* --- Add Money, Figma section #223:1403 --- */
  ['addmoney2',  'Add Money'],
  ['addmethods', 'UPI 1 row'],
  ['addpin2',    TYPE_PIN, 'addsuccess'],
  ['addsuccess', null],  // the second AFTER_TIMEOUT, 3s again, also untappable
  ['addpaid',    'Home button'],
  ['addbalance', 'Restart'],
];

console.log('\n  -- the loop: one session, home back round to home --');
await goTo('home');
for (const [from, label, typedTo] of WALK) {
  const s = SCREENS.find(x => x.name === from);
  if (!s) { record(false, `walk: ${from}`, 'no such screen in flow.ts', from); continue; }
  if (label === TYPE_PIN) {
    /* Six digits then Enter, through the real keyboard path - the same one the
       keypad's own buttons feed. Typing is what this screen exists to do, so a
       walk that clicked past it would prove nothing about it. */
    for (const d of '123456') await page.keyboard.press(d);
    await page.keyboard.press('Enter');
    await expect(`walk: ${from} typed PIN + Next -> ${typedTo}`, at(typedTo));
    continue;
  }
  if (label === null) {
    /* Deliberately generous. 3000ms is declared, but the timer only starts once
     * React has committed the screen, and the plate has to decode first. A
     * tight bound here would be the flakiest line in the file and it would be
     * measuring the test, not the app. Phase 3 checks it is not instant. */
    await expect(`walk: ${from} waits out ${s.autoAdvanceMs}ms -> ${s.autoTo}`, at(s.autoTo), s.autoAdvanceMs + 7000);
    continue;
  }
  const h = s.hits.find(x => x.label === label);
  if (!h) { record(false, `walk: ${from} "${label}"`, 'no hit with that label in flow.ts', label); continue; }
  await tap(h);
  await expect(`walk: ${from} "${h.label}" -> ${h.to}`, at(h.to));
  driven.add(edgeKey(from, h));
}

/* --- Phase 2: every transition the loop did not use ---------------------- */
/* Mostly the back arrows and the two PIN-sheet closes. Each is deep-linked to
 * its own source screen so one failure cannot cascade into the next. */
console.log('\n  -- back arrows, closes, and anything else declared --');
for (const [key, { from, h }] of declared) {
  if (driven.has(key)) continue;
  await goTo(from);
  await tap(h);
  await expect(`${from}: "${h.label}" -> ${h.to}`, at(h.to));
  driven.add(key);
}

/* --- Phase 3: the timed transitions, on their own ------------------------ */
/* Three screens end on a timer and nothing else: `success` and `addsuccess`,
 * one per leg, on the prototype's own AFTER_TIMEOUT 3s, and `loading` on the
 * 2.6s we give it in place of the tap-anywhere target the prototype declared.
 * None of the three has a tap target left, so if one of these timers does not
 * fire the kiosk is stranded, and they get their own test rather than only
 * riding along inside the walk. Driven off `autoAdvanceMs` in flow.ts, so a
 * fourth timed screen added there is covered without editing this. */
console.log('\n  -- the timed transitions --');
for (const s of timedScreens) {
  await goTo(s.name);
  await page.mouse.click(540, 960);
  await expectStays(`${s.name} ignores a tap, and does not advance instantly`, at(s.name));
  const t0 = Date.now();
  await expect(
    `${s.name} -> ${s.autoTo} on its own after ${s.autoAdvanceMs}ms`,
    at(s.autoTo),
    s.autoAdvanceMs + 7000,
  );
  console.log(`        fired ${((Date.now() - t0) / 1000).toFixed(2)}s later, measured from 400ms in`
    + ` (set to ${(s.autoAdvanceMs / 1000).toFixed(1)}s)`);
}

/* --- Phase 4: printed controls that must stay inert ---------------------- */
/* Every one of these is drawn by the plate and looks completely tappable. The
 * prototype gives them no destination, so neither do we. A stray hit target
 * over one of them would otherwise only ever be noticed by somebody watching a
 * kiosk wander off mid-flow. */
console.log('\n  -- printed controls that must do nothing --');

await goTo('amount');
await page.mouse.click(540, 1570);            // "One-time fee for card Issuance" row, #211:6205
await expectStays('amount: printed amount row is inert', at('amount'));

await goTo('methods');
await page.mouse.click(540, 1450);            // "Credit Card 1" - drawn genuinely disabled
await expectStays('methods: disabled Credit Card 1 row is inert', at('methods'));
await page.mouse.click(540, 1660);            // "Debit Card 1" - likewise
await expectStays('methods: disabled Debit Card 1 row is inert', at('methods'));

await goTo('paid');
await page.mouse.click(366 + 174, 1120 + 49); // "More details" chip, #211:6524
await expectStays('paid: More details chip is inert', at('paid'));
await page.mouse.click(540, 1400);            // the share-screenshot circle
await expectStays('paid: share screenshot is inert', at('paid'));

await goTo('cities');
await page.mouse.click(540, 250);             // header, above the one live list region
await expectStays('cities: header above the list region is inert', at('cities'));

/* `balance` is testable now that it carries a 155x102 chip instead of a
   full-frame restart: only ₹300 crosses to the Add Money leg, and the other
   four chips and the disabled CTA stay exactly as dead as the Figma draws
   them. This is the check that the seam is a chip and not the whole screen. */
await goTo('balance');
await page.mouse.click(67 + 73, 1596 + 51);   // ₹100 chip, #211:6744
await expectStays('balance: ₹100 chip is inert', at('balance'));
await page.mouse.click(838 + 77, 1596 + 51);  // ₹500 chip, #211:6752
await expectStays('balance: ₹500 chip is inert', at('balance'));
await page.mouse.click(540, 1760);            // "Add Money", drawn disabled here
await expectStays('balance: disabled Add Money CTA is inert', at('balance'));

await goTo('addmoney2');
await page.mouse.click(77 + 73, 1142 + 51);   // ₹100 chip, #223:1610 - only ₹300 is wired
await expectStays('addmoney2: ₹100 chip is inert', at('addmoney2'));
await page.mouse.click(540, 1500);            // the "Add custom amount" field
await expectStays('addmoney2: custom amount field is inert', at('addmoney2'));

await goTo('addmethods');
await page.mouse.click(540, 720);             // "UPI 2" row - only UPI 1 is wired
await expectStays('addmethods: UPI 2 row is inert', at('addmethods'));

await goTo('addpaid');
await page.mouse.click(366 + 174, 1171 + 49); // "More details" chip, #223:1875
await expectStays('addpaid: More details chip is inert', at('addpaid'));
await page.mouse.click(44 + 239, 1690 + 77);  // "UPI Help" - only Home is wired
await expectStays('addpaid: UPI Help button is inert', at('addpaid'));

/* `addbalance` is not tested for inertness: the restart addition covers the
 * whole frame there, so on that screen every tap is supposed to do something.
 * Its five amount chips are printed and dead in the Figma. */

/* ------------------------------------------------------------------------ */

await browser.close();

const failed = results.filter(r => !r.ok);
console.log(`\n  ${results.length - failed.length}/${results.length} assertions correct`);

/* Coverage, not a formality: the whole point of reading flow.ts at runtime is
 * that a transition added there cannot quietly go untested. */
const missed = [...declared.keys()].filter(k => !driven.has(k));
console.log(`  ${driven.size}/${declared.size} declared tap transitions driven,`
  + ` ${timedScreens.length}/${timedScreens.length} timed`);
if (missed.length) console.log('  NOT DRIVEN:\n' + missed.map(m => '    ' + m).join('\n'));

if (errors.length) console.log('\n  PAGE ERRORS:\n' + errors.map(e => '    ' + e).join('\n'));
else console.log('  no page or console errors');

process.exit(failed.length || missed.length ? 1 : 0);
