/**
 * V2 transition test. The pixel diff proves each screen LOOKS right; it cannot
 * tell you a screen does anything, and in V2 it cannot tell you the screen is
 * showing the right STATE either - the plate is chosen by state, so `balance`
 * is fifty-one different pictures and only one of them is the correct answer to
 * "you had 50 and added 200".
 *
 * How the two halves are split, because it is the whole design of this file:
 *
 *   STRUCTURE is read out of the running app. `hitsFor`, `scrollFor`,
 *   `variantOf` and `backTarget` are imported from `/src/v2/flow.ts` through the
 *   dev server, so the boxes clicked are the prototype's own and a target added
 *   to the map cannot go untested.
 *
 *   BEHAVIOUR is recomputed here. The harness carries its own shadow state and
 *   its own plate-key rule, both written from `docs/v2-build.md`, and asserts
 *   the app is showing the artwork that state names. Reusing the app's own
 *   `apply`/`afterPaid` to check the app's own arithmetic would prove nothing.
 *
 * Needs the dev server and playwright. Playwright is not a dependency of this
 * app - it is only ever used by the verify tooling - so it is resolved
 * leniently: from here first, then from the figma-agent install, which is where
 * it already lives on the build machine.
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

import { readFileSync } from 'node:fs';
const { findDevPort, GUARD } = await import('./dev-port.mjs');
const PORT = await findDevPort();
const URL_BASE = `http://127.0.0.1:${PORT}/`;

/* The dev server is NOT started here - a test that boots its own server tests a
 * server nobody runs. Fail loudly and early instead of thirty seconds of
 * navigation timeouts that read like an app bug.
 *
 * The guard string is shared with V1, which is still in this build and still
 * served by the same port under `?v=1`, so it cannot tell the two apps apart.
 * The V2 flow module can, and the import further down is that check. */
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

/* ------------------------------------------------------------------------ *
 * The manifest: what a plate key is actually called on disk
 * ------------------------------------------------------------------------ */

/* Read from the file rather than through the app, because it is data. The one
 * thing it is needed for is ALIASES: eleven states share artwork with another
 * state - `amount-iob-300` is drawn by `amount-iob-100`, because IOB's chips
 * are identical at every value - so the file on screen is not always named
 * after the state that chose it. Without this the harness would fail four
 * perfectly correct screens, and with it those four assertions honestly weaken
 * to "the right artwork", which is the strongest claim the artwork supports. */
let PLATES;
try {
  PLATES = JSON.parse(readFileSync('src/v2/plates.json', 'utf8'));
} catch (e) {
  console.error('  could not read src/v2/plates.json: ' + e.message);
  process.exit(2);
}
const ALIASES = PLATES.aliases ?? {};
const SCREENS = PLATES.screens ?? {};
const aliasOf = (key) => ALIASES[key] ?? key;
const isAliased = (key) => aliasOf(key) !== key;
/** The basename the app will actually render for a plate key. */
const fileOf = (key) => {
  const entry = SCREENS[aliasOf(key)];
  const file = entry?.file ?? `/v2/screens/${aliasOf(key)}.png`;
  return file.split('/').pop().replace(/\.(png|jpe?g|svg)$/i, '');
};
const drawn = (key) => !!SCREENS[aliasOf(key)];

/* ------------------------------------------------------------------------ *
 * The flow, read out of the running dev server
 * ------------------------------------------------------------------------ */

const browser = await chromium.launch();
/* 1080x1920 exactly, so Stage's scale lands on 1 and the transform is omitted:
 * the frame-relative coordinates in the hit map are then page coordinates, with
 * no arithmetic between what the prototype declared and where the click goes.
 * ScrollPanel divides pointer deltas by the stage scale, so a drag would still
 * be right at any other size - this only keeps the ASSERTIONS legible. */
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });

const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  /* A plate that has not been exported yet 404s, and that is the export pass's
     business rather than a flow bug. Everything else is recorded. */
  const t = m.text();
  if (/Failed to load resource/.test(t) && /\/v2\/(screens|scroll|chrome|layers)\//.test(t)) return;
  errors.push('console: ' + t);
});

await page.goto(URL_BASE, { waitUntil: 'networkidle' });
let FLOW;
try {
  FLOW = await page.evaluate(() => import('/src/v2/flow.ts').then((m) => ({
    HITS: m.HITS, INITIAL: m.INITIAL, CHIPS: [...m.CHIPS],
    ISSUANCE_FEE: m.ISSUANCE_FEE, PRINTED_CAP: m.PRINTED_CAP,
  })));
} catch (e) {
  console.error('  could not import /src/v2/flow.ts through the dev server: ' + e.message);
  await browser.close();
  process.exit(2);
}

const { HITS, INITIAL, CHIPS, ISSUANCE_FEE, PRINTED_CAP } = FLOW;
const TEMPLATES = Object.keys(HITS.templates ?? {});
if (TEMPLATES.length === 0) {
  console.error('  the flow module exports no templates. Has hits.json landed?');
  await browser.close();
  process.exit(2);
}

/**
 * Resolve one state against the app's own map: which hits it offers, which
 * variant it is on, whether it scrolls, where back goes.
 *
 * This is the "read the flow, do not re-type it" half, and it has to go through
 * the module rather than the raw JSON because three templates carry variants
 * and `hitsFor` also drops what the map declares but the app owns - the PIN
 * pad's twelve keys and its Next, which `PinScreen` draws itself.
 */
const resolve = (s) => page.evaluate((st) => import('/src/v2/flow.ts').then((m) => ({
  hits: m.hitsFor(st),
  scroll: m.scrollFor(st) ?? null,
  variant: m.variantOf(st) ?? null,
  back: m.backTarget(st) ?? null,
  key: m.plateKey(st),
})), s);

/* ------------------------------------------------------------------------ *
 * The rules, restated - this is the independent half
 * ------------------------------------------------------------------------ */

/** A first payment buys the card; everything after it tops one up. */
const isPurchase = (s) => s.leg === 'setup' && s.balance === 0;

/**
 * Which of the balance screen's three artworks a state lands on.
 *
 * `landing` is the designer's unwired frame and there are two ways to reach it:
 * after a top-up, because the prototype draws exactly one and then stops; and
 * on a first payment with IOB or RBL, because only Pine Labs is wired onward
 * out of `loading`. Both print chips and a CTA that do nothing.
 */
const balanceVariant = (s) =>
  (s.toppedUp || (s.leg === 'setup' && s.issuer !== 'pinelabs')) ? 'landing'
    : s.amount === null ? 'unselected' : 'selected';

/**
 * The plate key a state names, restated from `docs/v2-build.md` rather than
 * imported. The receipt is the awkward one: a first payment is identified by
 * bank and TOTAL paid, a top-up by the chip and the leg, because the two legs
 * drew separate artwork for the same figure.
 */
const keyOf = (s) => {
  switch (s.template) {
    case 'amount':
      return `amount-${s.issuer}-${s.amount ?? 'none'}`;
    case 'balance': {
      const v = balanceVariant(s);
      return `balance-${s.leg}-${s.issuer}-${s.balance}-${v === 'landing' ? 'landing' : s.amount ?? 'none'}`;
    }
    case 'paid':
      return isPurchase(s)
        ? `paid-${s.issuer}-${ISSUANCE_FEE + (s.amount ?? 0)}`
        : `paid-${s.issuer}-${s.amount}-${s.leg}`;
    default:
      return s.template;
  }
};

/**
 * Paying credits the card. Buying loads the SELECTED amount and not the total -
 * the fee is a fee, so paying 350 lands on a balance of 300. Topping up adds
 * the chip to what is there, and the prototype then has no further artwork,
 * which `toppedUp` records.
 */
const afterPaid = (s) => ({
  ...s,
  balance: Math.min(PRINTED_CAP, isPurchase(s) ? (s.amount ?? 0) : s.balance + (s.amount ?? 0)),
  amount: null,
  toppedUp: !isPurchase(s),
  template: isPurchase(s) ? 'loading' : 'balance',
});

/**
 * What a declared hit does to the state, from the hit's own data.
 *
 * Only the arithmetic is ours; `set` and `to` are the extraction's. The one
 * piece of data that is prose rather than data is the top-up receipt's
 * `set: { balance: "balance + amount" }`, which is a note to a reader - leaving
 * the receipt is `afterPaid`, whichever leg it is.
 */
const applyHit = (s, h) => {
  if (h.kind === 'global' && h.to === 'unlocked') return { ...INITIAL };
  if (s.template === 'paid' && h.kind === 'nav') return afterPaid(s);

  const next = { ...s };
  for (const [k, v] of Object.entries(h.set ?? {})) {
    if (k === 'issuer' && v === null) continue;      // "not chosen yet"
    if (typeof v === 'string' && /[a-z]\s*\+/i.test(v)) continue;  // the prose above
    next[k] = v;
  }
  /* Tapping the selected chip again deselects it - the prototype's own wiring,
     and the only way back to the unselected artwork. */
  if (h.kind === 'state' && typeof h.set?.amount === 'number') {
    next.amount = s.amount === h.set.amount ? null : h.set.amount;
  }
  if (h.to) next.template = h.to;
  return next;
};

/* ------------------------------------------------------------------------ *
 * Assertions
 * ------------------------------------------------------------------------ */

const results = [];
const record = (ok, name, got, want) => {
  results.push({ ok, name, got, want });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) console.log(`        got  ${got}\n        want ${want}`);
};

/* Not a pass and not a failure: a check whose PREMISE is missing. Counted and
 * listed separately at the end, and the exit code says so. */
const skipped = [];
const skip = (name, why) => {
  skipped.push({ name, why });
  console.log(`SKIP  ${name}\n        ${why}`);
};

/**
 * What is on screen. Three independent readings joined into one object: the
 * `?screen=` the app writes on every navigation, the artwork the user is
 * actually looking at, and the scroll panel's own geometry.
 *
 * A scrolling screen no longer has a full-frame plate at all - it is the frame
 * fill, the scrolling content, and the fixed chrome over the top - so the
 * artwork that identifies it is the scroll content. Reading only `img.plate`
 * would report "none" for five of the thirteen templates.
 */
const READ = () => {
  const q = new URLSearchParams(location.search);
  const base = (el) => {
    const s = el && el.getAttribute('src');
    return s ? s.split('/').pop().replace(/\.(png|jpe?g|svg)$/i, '') : null;
  };
  const rect = (el) => {
    const r = el.getBoundingClientRect();
    return { left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) };
  };
  const panel = document.querySelector('[data-scroll-panel]');
  const plate = base(document.querySelector('img.plate'));
  const content = panel ? base(panel.querySelector('img')) : null;
  return {
    screen: q.get('screen') || '-',
    plate,
    content,
    /* `home` and `homeCard` composite from their separate Figma layers so the
       animated background can sit at its true depth, so they have no single
       plate to name and are identified by the stack instead. */
    layers: !!document.querySelector('.layer-clip'),
    art: plate ?? content ?? (document.querySelector('.layer-clip') ? 'layers' : null),
    chrome: [...document.querySelectorAll('.v2-chrome')].map((c) => base(c)),
    scroll: panel ? {
      top: Math.round(panel.scrollTop),
      max: Math.round(panel.scrollHeight - panel.clientHeight),
      box: rect(panel),
    } : null,
    hits: [...document.querySelectorAll('button.hit')].map((b) => ({ label: b.getAttribute('aria-label'), ...rect(b) })),
  };
};

const read = () => page.evaluate(READ);

const describe = (st) => {
  if (!st) return 'nothing';
  return `${st.screen} | ${st.art ?? 'none'}${st.scroll ? ` | scroll ${st.scroll.top}/${st.scroll.max}` : ''}`;
};

/** True when the app is showing exactly the state the harness believes it is. */
const showing = (st, s) => st && st.screen === s.template && st.art === fileOf(keyOf(s));
const wanted = (s) => `${s.template} | ${fileOf(keyOf(s))}`;

/**
 * Assert the flow ARRIVES somewhere, waiting for it.
 *
 * React 18 batches state updates that originate outside its own event handlers
 * - the `success` timeout, a replaceState landing beside a setState - so the
 * re-render lands a microtask or two after the call that triggered it returns.
 * Reading the DOM immediately is a race that a real mouse click is usually slow
 * enough to hide and an evaluate() is not, and it surfaces as a test that fails
 * roughly one run in three. Wait for the arrival rather than assume it. Never
 * assert on the spot.
 */
const waitUntil = async (pred, timeout = 4000) => {
  const t0 = Date.now();
  for (;;) {
    const st = await read();
    if (pred(st)) return { ok: true, st, ms: Date.now() - t0 };
    if (Date.now() - t0 > timeout) return { ok: false, st, ms: Date.now() - t0 };
    await page.waitForTimeout(40);
  }
};

const expect = async (name, pred, want, timeout = 4000) => {
  const r = await waitUntil(pred, timeout);
  record(r.ok, name, describe(r.st), want);
  return r;
};

/** The workhorse: assert the app landed on the state the harness expects. */
const arrive = async (name, s, timeout = 4000) => {
  const note = drawn(keyOf(s)) ? '' : '  [no artwork exported for this state]';
  const r = await expect(name, (st) => showing(st, s), wanted(s) + note, timeout);
  return r;
};

/** Assert the flow STAYS put. There is nothing to wait for, so give the
 *  transition that must not happen a fair chance before declaring it did not. */
const expectStays = async (name, s) => {
  await page.waitForTimeout(450);
  const st = await read();
  record(showing(st, s), name, describe(st), `still ${wanted(s)}`);
  return st;
};

/**
 * One phase, isolated. A thrown TypeError halfway down - a hit the map no
 * longer declares, a screen component mid-rewrite - must cost that phase and
 * not the report: the whole value of this harness during the build is telling
 * four agents which of their pieces is missing.
 */
const phase = async (title, fn) => {
  console.log(`\n  -- ${title} --`);
  try {
    await fn();
  } catch (e) {
    record(false, `${title}: ran to completion`, e && e.message ? e.message : String(e), 'no exception');
  }
};

/* ------------------------------------------------------------------------ *
 * Driving
 * ------------------------------------------------------------------------ */

/** The state a deep link lands in: INITIAL, wearing that template. */
const deepState = (t) => ({ ...INITIAL, template: t });

const goTo = async (t) => {
  await page.goto(`${URL_BASE}?screen=${t}`, { waitUntil: 'networkidle' });
  const s = deepState(t);
  await waitUntil((st) => showing(st, s), 4000);
  return s;
};

/** Click a point in frame pixels. The page is 1080x1920, so they are the same. */
const clickAt = (x, y) => page.mouse.click(Math.min(1079, x), Math.min(1919, y));

const near = (a, b, slack = 1) => Math.abs(a - b) <= slack;

/**
 * Put a hit inside the visible part of its scroll panel and answer where it
 * ended up, in frame pixels.
 *
 * The rule is "as high in the window as it will go": scroll by the hit's own
 * frame offset from the window top, clamped to the travel. That is the position
 * furthest from the fixed footer chrome, and on Card balance that footer is
 * drawn straight across the chip row - at rest the chips are behind it, and
 * only scrolling lifts them clear.
 *
 * The scroll is set directly rather than dragged. Dragging is exercised on its
 * own further down; using a 1227px drag to reach every control would turn every
 * later failure into a scroll failure.
 */
const scrollHitIntoView = async (h, scroll) => {
  if (!scroll || !h.scrolled) return { top: 0, x: h.left, y: h.top };
  const want = Math.max(0, h.top - scroll.viewport.y);
  await page.evaluate((top) => {
    const p = document.querySelector('[data-scroll-panel]');
    if (p) p.scrollTop = top;                 // the browser clamps to the travel
  }, want);
  await page.waitForTimeout(60);
  const st = await read();
  const top = st.scroll ? st.scroll.top : 0;
  /* The frame y of a scrolled box is its declared y minus however far the panel
     has travelled - the conversion ScrollPanel documents, run backwards. Note
     it does not involve contentX/contentY at all: the content origin cancels
     between `toContent` and the panel's own margin. */
  return { top, x: h.left, y: h.top - top };
};

const hitKey = (t, h) => `${t} -[${h.label}]-> ${h.to ?? (h.kind ?? 'state')}`;
const driven = new Set();

/**
 * Tap a declared hit where the PROTOTYPE says it is, scrolling to it first, and
 * advance the shadow state by the harness's own rules. Returns the new state.
 */
const tap = async (s, h, scroll) => {
  const at = await scrollHitIntoView(h, scroll);
  await clickAt(at.x + h.width / 2, at.y + h.height / 2);
  driven.add(hitKey(s.template, h));
  return applyHit(s, h);
};

/** Find a declared hit, or throw so the phase wrapper says which one is gone. */
const pick = (hits, match, what) => {
  const h = hits.find(match);
  if (!h) throw new Error(`no hit matching ${what}; have: ${hits.map((x) => x.label).join(' | ')}`);
  return h;
};
const chipHit = (hits, amount) =>
  pick(hits, (h) => h.kind === 'state' && h.set?.amount === amount, `chip ${amount}`);

/**
 * Six digits, the dwell, then Next.
 *
 * The 400ms dwell only ARMS Next - it does not press it. Entering a PIN and
 * authorising a payment are two decisions, and the prototype's own timer is on
 * the keypress, not on the submit. So this types, checks the screen has NOT
 * moved, and then presses.
 */
const PIN_DWELL_MS = HITS.timers?.pin?.ms ?? 400;
const typePin = async (s, tag) => {
  for (const d of '123456') await page.keyboard.press(d);
  await page.waitForTimeout(PIN_DWELL_MS + 250);
  const st = await read();
  record(showing(st, s), `${tag}: six digits and the ${PIN_DWELL_MS}ms dwell ARM Next, they do not press it`,
    describe(st), `still ${wanted(s)}`);
  await page.keyboard.press('Enter');
  return { ...s, template: 'success' };
};

/* ------------------------------------------------------------------------ */

const timed = Object.entries(HITS.timers ?? {}).filter(([t, v]) => v.to && TEMPLATES.includes(t));

console.log(`\n  ${URL_BASE}`);
console.log(`  ${TEMPLATES.length} templates, ${Object.keys(SCREENS).length} plates,`
  + ` ${Object.keys(ALIASES).length} aliases, ${timed.length} timed transitions`);
console.log(`  cap ${PRINTED_CAP}, issuance fee ${ISSUANCE_FEE}, chips ${CHIPS.join('/')}`);

/* --- Phase 0: every template deep-links by name -------------------------- */
/* The visual diff photographs each screen through `?screen=`. If this is wrong
 * every percentage it reports afterwards is measuring the wrong frame. Note the
 * state a deep link lands in is INITIAL, and INITIAL names artwork that does
 * not exist for `paid` and `balance` - a card that has paid nothing and holds
 * nothing was never drawn. The URL and the chosen plate are still checked; the
 * plate simply 404s, and `arrive` says so. */
await phase('deep links', async () => {
  for (const t of TEMPLATES) {
    await page.goto(`${URL_BASE}?screen=${t}`, { waitUntil: 'networkidle' });
    await arrive(`?screen=${t} lands on ${t}`, deepState(t));
  }
});

/* --- Phase 1: the scroll regions ----------------------------------------- */
/* The whole reason V2 is not V1. Everything here is measured against the
 * export's own numbers rather than against numbers typed into this file.
 *
 * Which states scroll is asked of `scrollFor`, not of the interaction map: the
 * map marks `home` VERTICAL_SCROLLING (4878px of it) and the balance screen's
 * `selected` artwork is flattened at scrollTop 482, and neither is a live
 * scroll region in the build. */
const SCROLL_STATES = [
  ['intro', deepState('intro')],
  ['introAccepted', deepState('introAccepted')],
  ['amount', { ...INITIAL, template: 'amount' }],
  ['methods', { ...INITIAL, template: 'methods' }],
  ['balance/unselected', { ...INITIAL, template: 'balance', leg: 'recharge', balance: 50 }],
];

await phase('scroll regions: geometry and hit registration', async () => {
  for (const [label, s] of SCROLL_STATES) {
    const { scroll, hits } = await resolve(s);
    if (!scroll) { skip(`${label}: scroll geometry`, 'scrollFor() returns no region for this state'); continue; }

    /* Deep links only carry a template, so the states that need a leg or a
       balance are reached by walking. `balance/unselected` is the only one. */
    if (s.leg === 'recharge') {
      const u = await goTo('unlocked');
      const r = await resolve(u);
      let cur = await tap(u, pick(r.hits, (h) => h.to === 'homeCard', 'Balance Recharge'), null);
      await arrive(`${label}: reached via Balance Recharge`, cur);
      const rh = await resolve(cur);
      cur = await tap(cur, pick(rh.hits, (h) => h.to === 'balance', 'the card chip'), null);
      await arrive(`${label}: reached`, cur);
    } else {
      await goTo(s.template);
    }

    const st = await read();
    if (!st.scroll) {
      record(false, `${label}: renders a scroll panel`, describe(st), 'a [data-scroll-panel] in the DOM');
      continue;
    }
    record(true, `${label}: renders a scroll panel`, describe(st), 'a panel');

    const vp = scroll.viewport;
    record(
      near(st.scroll.box.left, vp.x) && near(st.scroll.box.top, vp.y)
      && near(st.scroll.box.width, vp.w) && near(st.scroll.box.height, vp.h),
      `${label}: the panel sits at the exported viewport box`,
      JSON.stringify(st.scroll.box),
      JSON.stringify({ left: vp.x, top: vp.y, width: vp.w, height: vp.h }),
    );

    /* The travel is the content's height plus wherever its own origin sits
       relative to the window - which on the balance screens is 17px ABOVE it,
       so the panel travels 17px less than the plate is tall. Getting this from
       the plate height alone is the mistake the contentY field exists to stop. */
    const offset = (scroll.contentY ?? vp.y) - vp.y;
    const wantMax = Math.round(offset + scroll.contentH - vp.h);
    record(near(st.scroll.max, wantMax),
      `${label}: ${scroll.contentH}px of content at offset ${Math.round(offset)} in a ${Math.round(vp.h)}px window travels ${wantMax}px`,
      `${st.scroll.max}px`, `${wantMax}px`);
    record(st.scroll.top === 0, `${label}: arriving lands at the top of the scroll`, `${st.scroll.top}`, '0');

    /* Every hit the map marks `scrolled` must render where the prototype put
       it, once the panel's travel is accounted for - and the content origin
       must cancel out entirely. Without this a coordinate mix-up is silent,
       because a box 44px out is still inside a 147px chip. */
    for (const h of hits.filter((x) => x.scrolled)) {
      const at = await scrollHitIntoView(h, scroll);
      const el = (await read()).hits.find((b) => b.label === h.label);
      if (!el) { record(false, `${label}: "${h.label}" is rendered`, 'no button with that label', h.label); continue; }
      record(near(el.left, h.left) && near(el.top, Math.round(at.y)),
        `${label}: "${h.label}" renders at its declared frame box (scrolled ${at.top}px)`,
        `${el.left},${el.top}`, `${h.left},${Math.round(at.y)}`);
    }
  }
});

/* The Amount CTA is the case the whole component exists for: frame-y 2718, in a
 * window that ends at 1789. */
const amountState = { ...INITIAL, template: 'amount' };
const amountScroll = (await resolve(amountState)).scroll;

await phase('the Amount CTA at frame-y 2718', async () => {
  if (!amountScroll) { skip('amount CTA is unreachable without scrolling', 'amount has no scroll region'); return; }
  const { hits } = await resolve(amountState);
  const pay = pick(hits, (h) => h.to === 'methods', 'the Pay CTA');
  const vp = amountScroll.viewport;
  const bottom = Math.round(vp.y + vp.h);

  await goTo('amount');
  record(pay.top >= bottom, `amount: the CTA is declared below the ${bottom}px window bottom`,
    `frame-y ${pay.top}`, `>= ${bottom}`);

  const el0 = (await read()).hits.find((b) => b.label === pay.label);
  record(!!el0 && el0.top >= bottom, 'amount: at rest the CTA is outside the window',
    el0 ? `frame-y ${el0.top}` : 'not rendered', `>= ${bottom}`);

  /* Not merely off-screen: not hittable. A click at the lowest pixel the window
     shows must not find it. */
  const under = await page.evaluate(([x, y]) => {
    const el = document.elementFromPoint(x, y);
    return el ? (el.getAttribute('aria-label') || el.className || el.tagName) : 'nothing';
  }, [pay.left + pay.width / 2, bottom - 2]);
  record(under !== pay.label, 'amount: the CTA cannot be clicked through the window bottom', under, `not "${pay.label}"`);

  await clickAt(pay.left + pay.width / 2, bottom - 2);
  await expectStays('amount: clicking where the window ends does not reach the CTA', amountState);

  /* And now the same button, after scrolling to it. */
  const at = await scrollHitIntoView(pay, amountScroll);
  const el1 = (await read()).hits.find((b) => b.label === pay.label);
  record(!!el1 && el1.top >= Math.round(vp.y) && el1.top + el1.height <= bottom + 1,
    `amount: after ${at.top}px of scroll the CTA is inside the window`,
    el1 ? `frame-y ${el1.top}..${el1.top + el1.height}` : 'not rendered',
    `within ${Math.round(vp.y)}..${bottom}`);
  await clickAt(at.x + pay.width / 2, at.y + pay.height / 2);
  await arrive('amount: the scrolled CTA reaches methods', applyHit(amountState, pay));
  driven.add(hitKey('amount', pay));
});

/* Gesture scrolling. The panel has to answer a mouse drag, because the dev rig
 * has no touchscreen and may have no trackpad either. Touch is handled natively
 * by `touch-action: pan-y` and is deliberately not driven here - see the note
 * at the foot of this file. */
await phase('drag, wheel, and a tap that is not a drag', async () => {
  if (!amountScroll) { skip('mouse drag scrolls the panel', 'amount has no scroll region'); return; }
  const vp = amountScroll.viewport;
  const midX = 540;
  const startY = Math.round(vp.y + vp.h) - 200;
  const DRAG = 400;

  await goTo('amount');
  await page.mouse.move(midX, startY);
  await page.mouse.down();
  await page.mouse.move(midX, startY - DRAG, { steps: 12 });
  await page.mouse.up();
  const dragged = await waitUntil((st) => st.scroll && Math.abs(st.scroll.top - DRAG) <= 2, 1500);
  record(dragged.ok, `amount: a ${DRAG}px mouse drag scrolls ${DRAG}px`,
    dragged.st?.scroll ? `${dragged.st.scroll.top}px` : 'no panel', `${DRAG}px +/-2`);

  /* The wheel is the other half of the dev rig, and it is the browser's own
     scrolling rather than ours - worth one assertion, because `overflow-y:auto`
     is easy to lose to a stray `overflow:hidden`. */
  await goTo('amount');
  await page.mouse.move(midX, Math.round(vp.y) + 100);
  await page.mouse.wheel(0, 300);
  const wheeled = await waitUntil((st) => st.scroll && st.scroll.top > 0, 1500);
  record(wheeled.ok, 'amount: the wheel scrolls the panel',
    wheeled.st?.scroll ? `${wheeled.st.scroll.top}px` : 'no panel', '> 0');

  /* A drag is not a tap, and a tap is not a drag. Both directions on the same
     control, because getting one right and the other wrong is the normal
     failure mode of a movement threshold. */
  const { hits } = await resolve(amountState);
  const chip = chipHit(hits, CHIPS[0]);
  const selected = applyHit(amountState, chip);

  await goTo('amount');
  const at = await scrollHitIntoView(chip, amountScroll);
  const cx = at.x + chip.width / 2;
  const cy = at.y + chip.height / 2;
  const st = await read();
  const before = st.art;
  /* Drag towards whichever end of the travel there is room to reach: the chip
     row sits at the bottom of Amount's content, so scrolling it into view lands
     the panel at its limit, and dragging further would be a gesture that
     correctly does nothing and would prove nothing either. */
  const travel = ((st.scroll?.max ?? 0) - at.top) >= 150 ? -120 : 120;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx, cy + travel, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  const afterDrag = await read();
  record(afterDrag.art === before, 'amount: dragging from a chip scrolls and does NOT select it',
    `${afterDrag.art} at scroll ${afterDrag.scroll?.top}`, `${before}, scrolled`);
  record(Math.abs((afterDrag.scroll?.top ?? at.top) - at.top) >= 100,
    `amount: that same ${Math.abs(travel)}px drag did scroll the panel`,
    `${afterDrag.scroll?.top} (from ${at.top})`, `at least 100px from ${at.top}`);

  const now = afterDrag.hits.find((b) => b.label === chip.label);
  if (!now) skip('amount: a tap on that chip selects it', 'the chip left the window during the drag');
  else {
    await clickAt(now.left + now.width / 2, now.top + now.height / 2);
    const sel = await arrive('amount: a tap on the same chip DOES select it', selected);
    if (sel.ok) driven.add(hitKey('amount', chip));
  }

  /* And a press that wobbles a few pixels is still a tap - the threshold has to
     sit above the noise a finger and a mouse both produce. */
  await goTo('amount');
  const at2 = await scrollHitIntoView(chip, amountScroll);
  const wx = at2.x + chip.width / 2;
  const wy = at2.y + chip.height / 2;
  await page.mouse.move(wx, wy);
  await page.mouse.down();
  await page.mouse.move(wx + 3, wy - 4, { steps: 3 });
  await page.mouse.up();
  await arrive('amount: a 5px wobble is still a tap, not a drag', selected);
});

/* ------------------------------------------------------------------------ *
 * The walks
 * ------------------------------------------------------------------------ */

/** methods -> pin -> success -> paid, which both legs share verbatim. */
const payWith = async (start, tag) => {
  let s = start;
  let r = await resolve(s);
  s = await tap(s, pick(r.hits, (h) => h.to === 'pin', 'the UPI row'), r.scroll);
  await arrive(`${tag}: UPI 1 -> pin`, s);

  s = await typePin(s, tag);
  await arrive(`${tag}: Next -> success`, s);

  s = { ...s, template: HITS.timers.success.to };
  await arrive(`${tag}: success waits out ${HITS.timers.success.ms}ms -> paid`, s,
    HITS.timers.success.ms + 7000);
  return s;
};

/** The Card Issuance leg, once per issuer. */
const setupLeg = async (issuerLabel, chip) => {
  const tag = `setup/${issuerLabel}`;
  let s = await goTo('unlocked');
  let r = await resolve(s);

  s = await tap(s, pick(r.hits, (h) => h.to === 'home', 'the Card Issuance tile'), null);
  await arrive(`${tag}: Card Issuance -> home`, s);

  r = await resolve(s);
  s = await tap(s, pick(r.hits, (h) => h.to === 'intro', 'the card chip'), null);
  await arrive(`${tag}: home chip -> intro`, s);

  r = await resolve(s);
  s = await tap(s, pick(r.hits, (h) => h.to === 'introAccepted', 'the accept checkbox'), r.scroll);
  await arrive(`${tag}: accept terms -> introAccepted`, s);

  r = await resolve(s);
  s = await tap(s, pick(r.hits, (h) => h.to === 'issuer', 'the Buy CTA'), r.scroll);
  await arrive(`${tag}: buy -> issuer`, s);

  r = await resolve(s);
  const row = pick(r.hits, (h) => h.set?.issuer === issuerLabel, `the ${issuerLabel} row`);
  s = await tap(s, row, r.scroll);
  await arrive(`${tag}: "${row.label}" -> amount, nothing selected`, s);

  r = await resolve(s);
  s = await tap(s, chipHit(r.hits, chip), r.scroll);
  const sel = await arrive(`${tag}: chip ${chip} selected, still on amount`, s);
  if (sel.ok && isAliased(keyOf(s))) {
    console.log(`        note: ${keyOf(s)} is drawn by ${aliasOf(keyOf(s))} - identical artwork, so`
      + ' this assertion proves the right picture and not the right number');
  }

  /* Selecting a chip must NOT throw the panel back to the top. The prototype
     does reset - each chip is a frame - but here it is a state change on the
     screen you are already looking at, and the build keeps the scroll. */
  const afterChip = await read();
  record((afterChip.scroll?.top ?? 0) > 0,
    `${tag}: selecting a chip keeps the scroll where the user left it`,
    `${afterChip.scroll?.top}`, '> 0');

  r = await resolve(s);
  s = await tap(s, pick(r.hits, (h) => h.to === 'methods', 'the Pay CTA'), r.scroll);
  await arrive(`${tag}: Pay -> methods`, s);

  s = await payWith(s, tag);
  record(keyOf(s) === `paid-${issuerLabel}-${ISSUANCE_FEE + chip}`,
    `${tag}: the receipt is ${issuerLabel} for the fee plus the chip`,
    keyOf(s), `paid-${issuerLabel}-${ISSUANCE_FEE + chip}`);

  r = await resolve(s);
  s = await tap(s, pick(r.hits, (h) => h.kind === 'nav', 'the receipt CTA'), null);
  await arrive(`${tag}: leaving the receipt -> loading`, s);

  s = { ...s, template: HITS.timers.loading.to };
  await arrive(`${tag}: loading waits out ${HITS.timers.loading.ms}ms -> balance`, s,
    HITS.timers.loading.ms + 7000);

  record(s.balance === chip, `${tag}: a new card holds exactly the chip, not the fee`,
    `${s.balance}`, `${chip}`);
  return s;
};

/** balance(unselected) -> chip -> Add Money -> pay -> balance(landing). */
const topUp = async (s, chip, tag) => {
  let r = await resolve(s);
  s = await tap(s, chipHit(r.hits, chip), r.scroll);
  await arrive(`${tag}: chip ${chip} selected, still on balance`, s);

  r = await resolve(s);
  record(r.variant === 'selected', `${tag}: the selected chip moves balance to its 'selected' artwork`,
    `${r.variant}`, 'selected');
  record(r.scroll === null,
    `${tag}: the selected artwork is pre-scrolled, so it is a plate and not a live scroll region`,
    r.scroll ? 'a scroll region' : 'a plain plate', 'a plain plate');

  const before = s.balance;
  s = await tap(s, pick(r.hits, (h) => h.to === 'methods', 'the Add Money CTA'), r.scroll);
  await arrive(`${tag}: Add Money -> methods`, s);

  s = await payWith(s, tag);
  record(keyOf(s) === `paid-${s.issuer}-${chip}-${s.leg}`,
    `${tag}: a top-up receipt is the chip alone and carries its leg, no issuance fee`,
    keyOf(s), `paid-${s.issuer}-${chip}-${s.leg}`);

  r = await resolve(s);
  const t0 = Date.now();
  s = await tap(s, pick(r.hits, (h) => h.kind === 'nav', 'the receipt CTA'), null);
  /* A top-up does not fetch a card, so it must land on the balance without
     passing through loading. The bound is deliberately shorter than loading's
     own 2000ms: if the flow went that way, this times out. */
  const back = await arrive(`${tag}: leaving the receipt lands straight on balance, no loading`, s, 1400);
  if (back.ok) console.log(`        landed in ${Date.now() - t0}ms, against loading's ${HITS.timers.loading.ms}ms`);

  record(s.balance === Math.min(PRINTED_CAP, before + chip),
    `${tag}: ${before} + ${chip} = ${Math.min(PRINTED_CAP, before + chip)}`,
    `${s.balance}`, `${Math.min(PRINTED_CAP, before + chip)}`);
  return s;
};

/** The landing balance: the designer drew it and wired nothing on it. */
const assertLanding = async (s, tag) => {
  const r = await resolve(s);
  record(r.variant === 'landing', `${tag}: lands on the 'landing' artwork`, `${r.variant}`, 'landing');
  const live = r.hits.filter((h) => h.kind !== 'global');
  record(live.length === 0, `${tag}: the landing frame declares no live control at all`,
    live.length ? live.map((h) => h.label).join(', ') : 'none but the home button', 'none but the home button');

  /* And the printed ones really are dead. The chip row and the CTA band are
     drawn on this frame exactly as they are on the wired one, so tap where the
     wired frame puts them and nothing may happen. */
  const wired = HITS.templates.balance?.variants?.unselected?.hits ?? [];
  const chip = wired.find((h) => h.kind === 'state');
  const cta = HITS.templates.balance?.variants?.selected?.hits?.find((h) => h.to === 'methods');
  if (chip && r.scroll) {
    const at = await scrollHitIntoView({ ...chip, scrolled: true }, r.scroll);
    await clickAt(at.x + chip.width / 2, at.y + chip.height / 2);
    await expectStays(`${tag}: the printed "${chip.label}" chip is dead`, s);
  }
  if (cta) {
    await clickAt(cta.left + cta.width / 2, cta.top + cta.height / 2);
    await expectStays(`${tag}: the printed Add Money CTA is dead`, s);
  }
};

/* --- Phase 2: Card Issuance, all three issuers --------------------------- */
/* `unlocked -> home -> intro -> introAccepted -> issuer -> amount -> methods ->
 * pin -> success -> paid -> loading -> balance`, one uninterrupted session each
 * time, typing a real six-digit PIN. Three times, because the issuer has to
 * survive to the receipt - the designer's own frames get that wrong 35 times
 * out of 40, so it is not a theoretical failure. */
let pinelabsBalance = null;
for (const issuer of ['pinelabs', 'iob', 'rbl']) {
  await phase(`Card Issuance: ${issuer}, +300`, async () => {
    const s = await setupLeg(issuer, 300);
    if (issuer === 'pinelabs') {
      const r = await resolve(s);
      record(r.variant === 'unselected', 'setup/pinelabs: Pine Labs lands on a balance that can be topped up',
        `${r.variant}`, 'unselected');
      pinelabsBalance = s;
    } else {
      /* Only Pine Labs is wired onward out of `loading`; the other two land on
         the unwired frame, which is the designer's own dead end. */
      await assertLanding(s, `setup/${issuer}`);
    }
  });
}

/* --- Phase 3: the top-up, on the setup leg ------------------------------- */
await phase('Card Issuance: the one top-up Pine Labs is wired for', async () => {
  if (!pinelabsBalance) { skip('setup top-up', 'the Pine Labs issuance walk did not reach a balance'); return; }
  const s = await topUp(pinelabsBalance, 500, 'setup/pinelabs top-up');
  await assertLanding(s, 'setup/pinelabs after the top-up');
});

/* --- Phase 4: Balance Recharge ------------------------------------------- */
/* `unlocked -> homeCard -> balance -> methods -> pin -> success -> paid ->
 * balance`, on a card that already holds 50. */
await phase('Balance Recharge', async () => {
  let s = await goTo('unlocked');
  let r = await resolve(s);
  s = await tap(s, pick(r.hits, (h) => h.to === 'homeCard', 'the Balance Recharge tile'), null);
  await arrive('recharge: Balance Recharge -> homeCard', s);

  r = await resolve(s);
  s = await tap(s, pick(r.hits, (h) => h.to === 'balance', 'the card chip'), null);
  await arrive('recharge: home chip -> balance', s);
  record(s.balance > 0, 'recharge: the leg starts on a card that already holds money', `${s.balance}`, '> 0');

  s = await topUp(s, 200, 'recharge');
  record(keyOf(s) === 'balance-recharge-pinelabs-250-landing',
    'recharge: 50 + 200 lands on balance-recharge-pinelabs-250-landing',
    keyOf(s), 'balance-recharge-pinelabs-250-landing');
  await assertLanding(s, 'recharge after the top-up');
});

/* The Rs2000 cap is asserted arithmetically inside `topUp` and cannot be
 * reached by walking: the prototype draws one top-up and then stops, so the
 * highest balance any path can produce is 500 + 500. Saying so is more honest
 * than a test that pretends to exercise it. */
console.log(`\n  note: the ${PRINTED_CAP} cap is unreachable by walking - the artwork allows one`
  + ' top-up, so the highest reachable balance is 1000. Every balance is still checked'
  + ' against min(cap, previous + selected).');

/* --- Phase 5: arriving resets the scroll --------------------------------- */
/* Figma sets `resetScrollPosition: true` on the flow's navigations. Phase 1
 * showed a deep link landing at 0, but a deep link is a fresh mount and proves
 * nothing about a live session - this leaves a screen scrolled, walks away, and
 * comes back the way a user would. */
await phase('arriving at a screen resets its scroll', async () => {
  if (!amountScroll) { skip('arriving at amount resets the scroll', 'amount has no scroll region'); return; }
  let s = await goTo('issuer');
  let r = await resolve(s);
  const row = pick(r.hits, (h) => h.set?.issuer === 'pinelabs', 'the Pine Labs row');
  s = await tap(s, row, r.scroll);
  await arrive('reset: issuer -> amount', s);

  await page.evaluate(() => { const p = document.querySelector('[data-scroll-panel]'); if (p) p.scrollTop = 900; });
  await page.waitForTimeout(80);
  record(((await read()).scroll?.top ?? 0) > 0, 'reset: amount is left scrolled', `${(await read()).scroll?.top}`, '> 0');

  r = await resolve(s);
  const back = pick(r.hits, (h) => h.label === 'Back', 'the back arrow');
  s = await tap(s, back, r.scroll);
  s = { ...s, template: 'issuer' };
  await arrive('reset: back arrow -> issuer', s);

  r = await resolve(s);
  s = await tap(s, pick(r.hits, (h) => h.set?.issuer === 'pinelabs', 'the Pine Labs row'), r.scroll);
  const again = await arrive('reset: issuer -> amount, a second time', s);
  const top = (await read()).scroll?.top;
  record(again.ok && top === 0, 'reset: arriving back at amount starts at the top, not where it was left',
    `${top}`, '0');
});

/* --- Phase 6: the timed transitions, on their own ------------------------ */
/* `success` and `loading` have no tap target but the home button, so if one of
 * these timers does not fire the kiosk is stranded mid-payment. Driven off
 * `HITS.timers`, so a third timed template is covered without editing this.
 * The PIN's 400ms is in that table too and is deliberately not here: it arms
 * Next rather than navigating, and `typePin` is where that is asserted. */
await phase('the timed transitions', async () => {
  if (timed.length === 0) { skip('timed transitions', 'HITS.timers declares no navigating timer'); return; }
  for (const [t, timer] of timed) {
    const s = await goTo(t);
    await clickAt(540, 960);
    await expectStays(`${t} ignores a tap, and does not advance instantly`, s);
    const t0 = Date.now();
    const r = await arrive(`${t} -> ${timer.to} on its own after ${timer.ms}ms`,
      { ...s, template: timer.to }, timer.ms + 7000);
    if (r.ok) console.log(`        fired ${((Date.now() - t0) / 1000).toFixed(2)}s later, measured from 450ms in`
      + ` (declared ${(timer.ms / 1000).toFixed(2)}s)`);
  }
});

/* --- Phase 7: the global controls ---------------------------------------- */
/* The designer put the home button on 568 of the 614 frames, and on a kiosk it
 * is the only way out of a half-finished purchase. It has to work from
 * everywhere, including the screens that have nothing else on them. */
await phase('the global home button, from every template', async () => {
  for (const t of TEMPLATES) {
    const s = await goTo(t);
    const { hits } = await resolve(s);
    const home = hits.find((h) => h.kind === 'global' && h.to === 'unlocked');
    if (!home) {
      /* `unlocked` is the one frame the designer left it off, and being already
         there is the reason. */
      skip(`${t}: home button`, 'no global home hit declared on this template');
      continue;
    }
    await clickAt(home.left + home.width / 2, home.top + home.height / 2);
    driven.add(hitKey(t, home));
    await arrive(`${t}: home button -> unlocked`, { ...INITIAL });
  }
});

await phase('the global back arrow', async () => {
  for (const t of TEMPLATES) {
    const s = await goTo(t);
    const { hits, back } = await resolve(s);
    const arrow = hits.find((h) => h.kind === 'global' && h.label !== 'Home');
    if (!arrow) continue;
    if (!back && !arrow.to) { skip(`${t}: back arrow`, 'declared, but backTarget() resolves to nothing'); continue; }
    await clickAt(arrow.left + arrow.width / 2, arrow.top + arrow.height / 2);
    driven.add(hitKey(t, arrow));
    await arrive(`${t}: "${arrow.label}" -> ${arrow.to ?? back}`, { ...s, template: arrow.to ?? back });
  }
});

/* --- Phase 8: every declared target the walks did not use ---------------- */
/* Mostly the chips the walks had no reason to pick, and the un-accept
 * checkbox. Each is deep-linked to its own template so one failure cannot
 * cascade into the next. Note this walks the map's own variants: the state a
 * deep link lands in only reaches one of balance's three, so the other two are
 * covered by the walks above rather than here. */
await phase('every remaining declared target', async () => {
  for (const t of TEMPLATES) {
    const s0 = deepState(t);
    const { hits, scroll } = await resolve(s0);
    for (const h of hits) {
      if (driven.has(hitKey(t, h))) continue;
      await goTo(t);
      const next = applyHit(s0, h);
      if (h.to && h.to !== t) {
        await tap(s0, h, scroll);
        await arrive(`${t}: "${h.label}" -> ${h.to}`, next);
      } else if (h.kind === 'state' && typeof h.set?.amount === 'number') {
        /* A chip does not navigate; it repaints the same screen with the
           selection burnt into the artwork. */
        await tap(s0, h, scroll);
        await arrive(`${t}: "${h.label}" selects ${h.set.amount} without leaving`, next);
      } else {
        /* Declared, reachable, and with nowhere to go. */
        await tap(s0, h, scroll);
        await expectStays(`${t}: "${h.label}" is declared inert`, s0);
      }
    }
  }
});

/* A control the map declares on `pin` and the app deliberately does not offer:
 * Next is drawn by PinScreen, not by the map, because it must not fire until
 * six digits and the dwell have armed it. Tap it cold. */
await phase('Next does nothing until a PIN has been typed', async () => {
  const next = HITS.templates.pin?.hits?.find((h) => h.to === 'success');
  if (!next) { skip('pin: Next is inert with no PIN typed', 'the map declares no Next on pin'); return; }
  const s = await goTo('pin');
  await clickAt(next.left + next.width / 2, next.top + next.height / 2);
  await expectStays('pin: Next with no PIN typed does not submit', s);
});

/* ------------------------------------------------------------------------ */

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n  ${results.length - failed.length}/${results.length} assertions correct`);

/* Coverage, not a formality: the whole point of reading the flow at runtime is
 * that a target added to it cannot quietly go untested. Counted across every
 * variant, because a hit that only exists on `balance/selected` is still a hit
 * somebody has to drive. */
const declared = new Map();
for (const [t, entry] of Object.entries(HITS.templates ?? {})) {
  const sets = entry.variants ? Object.values(entry.variants) : [entry];
  for (const v of sets) {
    for (const h of v.hits ?? []) {
      /* `inert` boxes and the PIN pad's own keys are dropped by `hitsFor` and
         are never rendered, so they are not coverage. */
      if (h.kind === 'inert') continue;
      if (t === 'pin' && (h.kind === 'state' || h.to === 'success')) continue;
      declared.set(hitKey(t, h), true);
    }
  }
}
const missed = [...declared.keys()].filter((k) => !driven.has(k));
console.log(`  ${driven.size}/${declared.size} declared tap transitions driven,`
  + ` ${timed.length}/${timed.length} timed, ${SCROLL_STATES.length} scroll regions exercised`);
if (missed.length) console.log('  NOT DRIVEN:\n' + missed.map((m) => '    ' + m).join('\n'));

if (skipped.length) {
  console.log(`\n  ${skipped.length} SKIPPED - premise missing, which is not a pass:`);
  for (const s of skipped) console.log(`    ${s.name}\n      ${s.why}`);
}

/* Touch is not driven here, and that is deliberate rather than an omission:
 * ScrollPanel hands touch to the browser (`touch-action: pan-y`) precisely so
 * that the pan, its momentum and the "a swipe is not a click" rule are the
 * platform's own instead of ours. A synthetic touch would exercise our code
 * path rather than the browser's and would therefore prove the wrong thing.
 * The kiosk panel is the test for that one. */
if (errors.length) console.log('\n  PAGE ERRORS:\n' + errors.map((e) => '    ' + e).join('\n'));
else console.log('  no page or console errors');

/* 1 for a real failure, 3 for a run that could not ask every question.
 *
 * `exitCode` rather than `exit()`. On Windows, node 24 aborts with a libuv
 * assertion (`UV_HANDLE_CLOSING`, src\win\async.c) when `process.exit()` is
 * called with this much output still in flight to a pipe or a file - so a run
 * that had merely failed would look like a crashed harness. */
process.exitCode = failed.length || missed.length ? 1 : skipped.length ? 3 : 0;
