/**
 * The V2 flow: one state machine, not 614 screens.
 *
 * The V2 prototype (Figma section #254:858, "SCALED UP FINAL PROTOTYPE- V2")
 * draws 614 frames. They are not 614 designs - they are thirteen screens
 * enumerated across a state space: 3 issuers x 5 amounts x 16 balances x 8 PIN
 * steps. 360 of the frames are UPI PIN keystrokes and 76 are the balance screen
 * with a different number printed on it.
 *
 * So V1's rule is kept - the artwork IS the design, nothing is redrawn in DOM -
 * but the plate is chosen by STATE rather than by screen name. `plateFor()`
 * below is the whole of that idea.
 *
 * Every box and every timing here came out of the prototype's own
 * `interactions` metadata, distilled into `hits.json` beside this file; the
 * derivations, the invariance checks behind them and the designer's own
 * inconsistencies are written up in `.figma/v2/hits-notes.md`. Nothing was read
 * off the artwork. `docs/v2-build.md` is the contract.
 */

import hits from './hits.json';
import plates from './plates.json';
import { homeArtwork } from './screens/HomeScreen';

/* ------------------------------------------------------------------------- *
 * State
 * ------------------------------------------------------------------------- */

/** Which of the two apps on the device's home screen was opened. */
export type Leg = 'setup' | 'recharge';

/** The three issuers on #254:1550. The choice rides all the way to the receipt. */
export type Issuer = 'pinelabs' | 'iob' | 'rbl';

export type Template =
  | 'screensaver'
  | 'unlocked' | 'home' | 'homeCard' | 'intro' | 'introAccepted' | 'issuer'
  | 'amount' | 'methods' | 'pin' | 'success' | 'paid' | 'loading' | 'balance';

export type FlowState = {
  template: Template;
  leg: Leg;
  /** Meaningful from `issuer` onward; defaulted so the type never carries null. */
  issuer: Issuer;
  /** The chip the user has selected, or null for "nothing chosen yet". */
  amount: number | null;
  /** What the card holds now. 0 before the card exists. */
  balance: number;
  /**
   * How many times the balance screen has been arrived at this run.
   *
   * The kiosk has to hand itself back to the next customer. The prototype never
   * closes its own loop - it just stops drawing - so the run is given a length
   * instead: two rounds on the balance screen, and on the third the whole frame
   * becomes the way back to the start.
   */
  balanceVisits: number;
};

export const INITIAL: FlowState = {
  template: 'screensaver', leg: 'setup', issuer: 'pinelabs',
  amount: null, balance: 0, balanceVisits: 0,
};

/**
 * The attract screen, and the only screen in this app that is not Figma.
 *
 * A kiosk left alone shows something rather than the first screen of a flow
 * nobody is running - so the run starts here, and every way of ending a run
 * comes back here, because `INITIAL` is what the Home button resets to.
 *
 * It is deliberately NOT in `plates.json`. That manifest is written by the
 * export pass out of the prototype, and a hand-added row would be gone the next
 * time it runs; this is a poster the client supplied, so it is named here
 * instead and `plateFor` reads it straight. The space in the filename is the
 * client's and is left alone - it is encoded here rather than renamed, so the
 * file in `public/` stays the file they handed over.
 *
 * The source is 2251x4000, a hair wider than the 1080x1920 frame (0.5628
 * against 0.5625), so it lands within half a pixel of the stage and is left at
 * full resolution rather than resampled to fit.
 */
export const SCREENSAVER_PLATE = '/CoDT%20Home%20Screen.png';

/**
 * Tap anywhere to begin. ADDITION - ours, not the prototype's.
 *
 * `nav` and not `global`, which matters: `apply` turns a global heading for
 * `unlocked` into a whole reset to `INITIAL`, and `INITIAL` is now this screen
 * - so a global here would answer every tap by redrawing itself, and the kiosk
 * would never start.
 */
export const SCREENSAVER_TAP: Hit = {
  node: 'screensaver', label: 'Tap anywhere to begin',
  left: 0, top: 0, width: 1080, height: 1920,
  kind: 'nav', to: 'unlocked',
};

/** The five amount chips, in the order they are drawn, on both screens. */
export const CHIPS = [100, 200, 300, 400, 500] as const;

/** The one-time issuance fee printed on the Amount screen. */
export const ISSUANCE_FEE = 50;

/**
 * The card's stated ceiling.
 *
 * Every balance plate prints `2000 - balance` as its remaining headroom, and
 * every amount plate prints "Rs2,000 more" at a zero balance. The designer only
 * enumerated as far as Rs1000 - one top-up from the largest first payment - but
 * Rs1000 is enumeration depth, not the rule, and clamping there would put the
 * app in contradiction with the copy printed on its own artwork.
 */
export const PRINTED_CAP = 2000;

/** What is left to load, exactly as the artwork words it. */
export const headroom = (balance: number) => PRINTED_CAP - balance;

/* ------------------------------------------------------------------------- *
 * Derived facts
 * ------------------------------------------------------------------------- */

/** True while the card is being bought rather than topped up. */
export const isPurchase = (s: FlowState) => s.leg === 'setup' && s.balance === 0;

/** What the receipt says was paid: the fee rides on the purchase only. */
export const paidAmount = (s: FlowState) =>
  isPurchase(s) ? ISSUANCE_FEE + (s.amount ?? 0) : (s.amount ?? 0);

/**
 * Which of the balance screen's three artworks a state lands on.
 *
 * Decided by what the designer actually drew, not by a rule about how many
 * top-ups have happened. That distinction matters: the prototype only WIRES one
 * top-up, but it DRAWS the unselected frame and all five selected frames for
 * every Pine Labs setup balance from Rs100 to Rs500. Gating on a counter made
 * the app refuse a screen it had the artwork for - a Rs200 card showing five
 * chips that would not answer.
 *
 * So the card keeps topping up for as long as the design can show it, and
 * `landing` is what is left when it cannot: Rs600 and above, IOB and RBL, and
 * the recharge leg past its first top-up. On those the chips and the CTA are
 * printed dead, and `hitsFor` turns the frame into the way back to the start.
 */
export function balanceVariant(s: FlowState): 'unselected' | 'selected' {
  return s.amount === null ? 'unselected' : 'selected';
}

/** A balance plate's name, given the tail that picks the variant. */
const balanceKey = (s: FlowState, tail: string) =>
  `balance-${s.leg}-${s.issuer}-${s.balance}-${tail}`;

/** The variant of the current template, for the templates that have variants. */
export function variantOf(s: FlowState): string | undefined {
  switch (s.template) {
    case 'balance': return balanceVariant(s);
    case 'methods': return isPurchase(s) ? 'fromAmount' : 'fromBalance';
    case 'paid': return isPurchase(s) ? 'firstPayment' : 'topUp';
    default: return undefined;
  }
}

/* ------------------------------------------------------------------------- *
 * Plate resolution
 * ------------------------------------------------------------------------- */

/**
 * Which plate a state names in the export manifest.
 *
 * Three families are parameterised and the rest are constant. The keys are the
 * export pass's own, and it derived them from `.figma/v2/states.json` - so a
 * state that names no plate is a state the designer never drew, and that is a
 * bug in the flow, not in the export.
 *
 * The receipt is the awkward one. A first payment is identified by bank and the
 * total paid, because that is all that distinguishes the fifteen of them; a
 * top-up receipt is identified by the chip and the LEG, because the setup leg
 * and the recharge leg drew separate artwork for the same figure.
 */
export function plateKey(s: FlowState): string {
  switch (s.template) {
    case 'amount':
      return `amount-${s.issuer}-${s.amount ?? 'none'}`;
    case 'balance': {
      return balanceKey(s, String(s.amount ?? 'none'));
    }
    case 'paid':
      return isPurchase(s)
        ? `paid-${s.issuer}-${paidAmount(s)}`
        : `paid-${s.issuer}-${s.amount}-${s.leg}`;
    default:
      return s.template;
  }
}

type ChromeLayer = {
  role: string; file?: string; hidden?: boolean; fill?: string;
  left?: number; top?: number; width?: number; height?: number; zIndex?: number;
};

type PlateScroll = {
  content: string; contentW: number; contentH: number;
  contentX?: number; contentY?: number;
  viewport?: { x: number; y: number; w: number; h: number };
  preScrolled?: boolean; scrollTop?: number;
};

type PlateEntry = {
  file: string; node: string; w: number; h: number;
  chrome?: string | null; scroll?: PlateScroll;
  /** Set on artwork the designer flattened at a scroll offset, with the offset
      it was flattened AT - the export measured both off the frame. */
  preScrolled?: boolean; scrollTop?: number; variant?: string;
  /** On flattened artwork: the window it was flattened through, and where its
      content's own pixels ended up inside the frame. */
  clippedPanel?: { box?: Box; unionBox?: Box };
};

/** A rectangle in frame coordinates, as the export writes them. */
type Box = { x: number; y: number; w: number; h: number };

type PlateManifest = {
  screens: Record<string, PlateEntry>;
  chrome: Record<string, ChromeLayer[]>;
  aliases?: Record<string, string>;
};

const PLATES = plates as unknown as PlateManifest;

/** One plate by name, following an alias if the export deduped it. */
function lookup(key: string): PlateEntry | undefined {
  const alias = PLATES.aliases?.[key];
  return PLATES.screens[key] ?? (alias ? PLATES.screens[alias] : undefined);
}

/** The manifest entry for a state, following an alias if the export deduped it. */
export function screenFor(s: FlowState): PlateEntry | undefined {
  const hit = lookup(plateKey(s));
  if (hit) return hit;

  /* The top-up receipt was drawn for Pine Labs only. All fifteen first-payment
     receipts exist for all three issuers, but `paid-iob-300-setup` and its
     nineteen siblings do not - so a top-up on IOB or RBL named a plate that was
     never exported, and since Vite answers a missing public file with the SPA's
     own index.html the <img> got HTML where it wanted a PNG and the screen came
     up blank. Borrow the Pine Labs receipt for the same figure and the same
     leg: it gets every number right, and the one line it gets wrong -
     "Paid to Pine Labs" - is put back by `bankNameFor`. */
  if (s.template === 'paid') return lookup(`paid-pinelabs-${s.amount}-${s.leg}`);

  if (s.template !== 'balance') return undefined;

  /* The designer drew a live balance screen for Pine Labs only, and only up to
     Rs500. Everything else has to borrow, and WHICH plate it borrows matters:
     the balance is printed in the artwork, so a plate for the wrong balance
     puts a wrong number on the screen.
     So the search goes by balance first and by liveness second - the same
     figure on a dead frame beats a live frame showing someone else's money -
     and only gives up on the figure when the file has no frame for it at all. */
  const tail = String(s.amount ?? 'none');
  const nearest = [s.balance, 500, 50];
  for (const bal of nearest) {
    const found = lookup(`balance-${s.leg}-${s.issuer}-${bal}-${tail}`)
      ?? lookup(`balance-${s.leg}-pinelabs-${bal}-${tail}`)
      ?? lookup(`balance-${s.leg}-${s.issuer}-${bal}-landing`)
      ?? lookup(`balance-${s.leg}-pinelabs-${bal}-landing`);
    if (found) return found;
  }
  return undefined;
}

/**
 * The issuer's own card art, when the balance screen underneath is Pine Labs'.
 *
 * Only needed because the fallback above borrows another issuer's screen: the
 * card is the one part of it that would be visibly wrong, and it is a single
 * rectangle at a known box, so it is replaced rather than left lying.
 */
export function cardArtFor(s: FlowState): Layer | undefined {
  if (s.template !== 'balance' || s.issuer === 'pinelabs') return undefined;
  const art = CARD_ART[s.issuer];
  if (!art) return undefined;
  /* The selected variant is pre-scrolled and flattened, so the card moves with
     it. The shift is 482.846, not the round 482 the chip rows suggest: those
     frames put the card at y=-183.846, x=44.5. Rounded to the pixel the layer
     actually lands on - measured at 95.9% against the plate, against 94.0% for
     the round number. */
  if (balanceVariant(s) !== 'selected') return art;
  return { ...art, left: art.left + 1, top: art.top - 483 };
}

export type Layer = { src: string; left: number; top: number; width: number; height: number };

/* Boxes measured off the IOB and RBL landing frames, where this artwork is the
   only thing the designer drew differently. Filled in by the card-art pass. */
const CARD_ART: Partial<Record<Issuer, Layer>> = {
  iob: { src: '/v2/layers/254-19986.png', left: 44, top: 299, width: 991, height: 622 },
  rbl: { src: '/v2/layers/254-20090.png', left: 44, top: 299, width: 991, height: 622 },
};

/**
 * The issuer's name, drawn over a borrowed receipt.
 *
 * Same shape as the card art above: the receipt underneath is Pine Labs' (see
 * `screenFor`), the numbers on it are right, and the only visibly wrong part is
 * the line under the tick. It is a fixed box, so it is replaced rather than
 * left lying.
 *
 * The strip is opaque and full width, not a transparent word. It is the same 45
 * rows lifted out of the issuer's OWN first-payment receipt, so it carries that
 * receipt's green gradient with it - a transparent text layer would sit ON TOP
 * of "Paid to Pine Labs" instead of replacing it, and "Paid to Indian Overseas
 * Bank" is the wider of the two. Nothing else lives in those rows: pasted over
 * `paid-pinelabs-300-setup` the strip reproduces `paid-iob-350`'s own band with
 * zero differing pixels, which is what fixed the box at 360..405.
 */
const BANK_NAME: Partial<Record<Issuer, Layer>> = {
  iob: { src: '/v2/layers/paid-bank-iob.png', left: 0, top: 360, width: 1080, height: 45 },
  rbl: { src: '/v2/layers/paid-bank-rbl.png', left: 0, top: 360, width: 1080, height: 45 },
};

/** The issuer's name, only where the receipt under it was borrowed. */
export function bankNameFor(s: FlowState): Layer | undefined {
  if (s.template !== 'paid' || lookup(plateKey(s))) return undefined;
  return BANK_NAME[s.issuer];
}

/**
 * Everything drawn over a plate that belongs to another state.
 *
 * Two cases, and they are the same case twice: the export has no artwork for
 * this state, the nearest plate gets all of it right but one region, and that
 * region is a fixed box. A patch bigger than a box would be redrawing the
 * design in DOM, which is the one thing this app does not do.
 */
export function patchesFor(s: FlowState): Layer[] {
  return [cardArtFor(s), bankNameFor(s)].filter((l): l is Layer => !!l);
}

/** The plate for a state. Falls back to the key so a miss is visible, not blank. */
export function plateFor(s: FlowState): string {
  if (s.template === 'screensaver') return SCREENSAVER_PLATE;
  return screenFor(s)?.file ?? `/v2/screens/${plateKey(s)}.png`;
}

/**
 * A selection is not another screen. It is this screen, with a still over it.
 *
 * The balance screen's selected artwork is a flattened frame - the whole page
 * at scroll 482, chip filled, custom amount typed, CTA alive - and treating it
 * as a screen of its own is what made selecting an amount JUMP: the live panel
 * stood wherever the customer had scrolled it, the still stands at 482, and
 * swapping one for the other moved the page by the difference.
 *
 * So the still is not swapped in. Its scrolling window - the 1350 rows the
 * panel would be showing - is painted INTO the panel, at the content rows those
 * pixels belong to, and scrolls with everything else. The chip lights up and
 * nothing moves, which is what the amount screen does and what this screen was
 * always meant to do.
 *
 * The offset is the map's own and needs no measuring: the same chip is declared
 * at frame-y 1624 unselected and 1142 on the still, and 1624 - 1142 is the 482
 * the manifest records. Confirmed against the pixels - the chip row differs
 * between the two exports at exactly those rows and nowhere else.
 */
/**
 * The offset the selected balance frames were flattened at.
 *
 * 482.846, not the 482 the manifest rounds it to: those frames put the card at
 * y=-183.846 against the 299 the unselected frame draws it at, which is the
 * same fraction `cardArtFor` had to measure to put an issuer's card back on one
 * of them. The rounded value is right for the hit boxes below - the map itself
 * declares the same chip 482 apart on the two frames, and reproducing the
 * declared box exactly is what the harness checks - and wrong for the artwork,
 * where 0.85px of slip is a visible outline around every glyph.
 */
const FLATTENED_AT = 482.846;

export type Still = {
  src: string;
  /** The panel's window, in CONTENT coordinates - where these pixels live. */
  window: { left: number; top: number; width: number; height: number };
  /** The still inside that window, positioned so its own window lines up. */
  left: number; top: number; width: number; height: number;
};

export function selectionStill(s: FlowState): Still | undefined {
  const e = screenFor(s);
  if (!e?.preScrolled) return undefined;
  const live = scrollFor(s);
  const vp = live?.viewport;
  if (!live || !vp) return undefined;
  /**
   * Where the still stops being content and starts being chrome.
   *
   * The still is a whole frame with the fixed layers baked into it, so its rows
   * below the footer ARE the footer - and painted into the scrolling content
   * they draw the Add Money button a SECOND time, a blue sliver that slides out
   * from under the real one whenever the panel is not standing at the offset
   * the still was flattened at. The panel's own window runs to 1649 and the CTA
   * band starts at 1590, so 59 rows of it were being drawn twice.
   *
   * Taken from the chrome the app is about to composite over the top rather
   * than from a number: whatever is drawn as fixed chrome is, by definition,
   * not part of the scrolling content underneath it.
   */
  const chromeTop = chromeFor(s)
    .filter((c) => c.file && !c.hidden && c.role !== 'header')
    .reduce((top, c) => Math.min(top, c.top ?? Infinity), Infinity);
  const bottom = Math.min(vp.y + vp.h, chromeTop);

  return {
    src: e.file,
    /* Rounded, every one of them. The window's own origin is fractional -
       43.81, and the flatten is 482.846 - so an unrounded overlay lands on a
       half pixel and the browser resamples a 1080x1920 plate to draw it, which
       shows up as a soft outline around every glyph on the screen. Rounding
       leaves the still 0.15px from where the content plate has the same pixels,
       which is less than a pixel and therefore nothing at all. */
    window: {
      left: Math.round(vp.x - (live.contentX ?? vp.x)),
      top: Math.round(vp.y - (live.contentY ?? vp.y) + FLATTENED_AT),
      width: vp.w, height: bottom - vp.y,
    },
    /* The still is a whole frame; only its window belongs here, so it is
       pulled up and left by the window's own origin and clipped to it. */
    left: -Math.round(vp.x), top: -Math.round(vp.y), width: e.w, height: e.h,
  };
}

/** How far the still is scrolled, for the hits declared on it. */
export const flatOffset = (s: FlowState) => screenFor(s)?.scrollTop ?? 0;

/**
 * The fixed chrome a scrolling screen composites OVER its scrolling content:
 * the background, the header, and the footer or sticky CTA band.
 *
 * This is what makes a scroll region look like the frame it came from. Without
 * it the only way to draw the screen is the flat full-frame plate, and that
 * plate already contains a copy of the content - so the scrolling artwork lands
 * on top of a still of itself and the card art appears twice.
 */
export function chromeFor(s: FlowState): ChromeLayer[] {
  const family = screenFor(s)?.chrome;
  return family ? PLATES.chrome[family] ?? [] : [];
}

/**
 * The templates whose component draws the whole frame itself.
 *
 * `home` and `homeCard` are composited from separate Figma layers so the
 * animated background can sit at its correct depth under the artwork, and
 * `HomeScreen` renders all of it. The prototype does mark both frames
 * VERTICAL_SCROLLING - the home screen scrolls 4878px in Figma - but not one
 * wired box on either is inside that region: the card chip and the home button
 * are both fixed chrome. Mounting a scroll panel over them would draw the
 * flat full-height artwork on top of the composite and hide the animation the
 * composite exists for, so these two are left unscrolled.
 */
export const OWNS_FRAME = new Set<Template>(['home', 'homeCard']);

/**
 * The scroll region for a state, as the export actually measured it.
 *
 * Preferred over the interaction map's copy because these numbers come off the
 * exported PNG rather than off Figma's own boxes, which under-report. Artwork
 * the designer flattened at an offset carries `preScrolled` and is not a scroll
 * region at all - scrolling it again would move pixels that have already moved.
 */
/**
 * Home's scroll region. The frame is the viewport and the content is its own
 * children, so content coordinates and frame coordinates coincide - a target
 * declared at frame-y 1565 is at content-y 1565, and no conversion applies.
 */
export const HOME_SCROLL: PlateScroll = {
  content: '', contentW: 1080, contentH: 4878,
  contentX: 0, contentY: 0, viewport: { x: 0, y: 0, w: 1080, h: 1920 },
};

/**
 * Where the exported content plate's own pixels start, measured.
 *
 * The manifest records the union of the region's children, which is the right
 * answer only when the export was taken at those bounds. The balance families
 * were not: their content plates come back exactly as wide as the panel - 992
 * against a 991.38 window - because they were exported CLIPPED to it, so their
 * pixels start at the window's origin and not at the union's.
 *
 * Believing the union put the whole balance screen 12px left and 17px above
 * where its own frame draws it. Everything moved together, hit targets
 * included, so nothing looked broken until the flattened selected artwork -
 * which is not clipped, and does sit at the union - landed beside it and the
 * page jumped by exactly that (12, 17).
 *
 * Solved against each family's own full-frame plate, the way `solve-offsets`
 * does: the balance content matches at (44, 299), the window's origin, and
 * matches nowhere near (32, 282). Amount, intro and methods already agree with
 * their manifest and are left alone - the width test is what tells them apart.
 */
function measuredOrigin(spec: PlateScroll): PlateScroll {
  const vp = spec.viewport;
  if (!vp) return spec;
  /* Exported at its own bounds, not clipped to the panel: trust the manifest. */
  if (Math.abs(spec.contentW - vp.w) > 1.5) return spec;
  const x = spec.contentX ?? vp.x;
  const y = spec.contentY ?? vp.y;
  if (Math.abs(x - vp.x) < 1 && Math.abs(y - vp.y) < 1) return spec;
  return { ...spec, contentX: vp.x, contentY: vp.y };
}

export function scrollFor(s: FlowState): PlateScroll | undefined {
  /* Home scrolls, but `HomeScreen` owns the panel because the screen is a
     composite rather than a plate. The app still needs the geometry, to place
     the targets that ride inside it. */
  if (OWNS_FRAME.has(s.template)) return HOME_SCROLL;
  const entry = screenFor(s);
  if (!entry) return undefined;
  /* A still is a state OF this screen, not another screen: the panel stays,
     and the still is painted into it. See `selectionStill`. */
  if (entry.preScrolled) {
    const live = screenFor({ ...s, amount: null })?.scroll;
    return live && !live.preScrolled ? measuredOrigin(live) : undefined;
  }
  if (!entry.scroll || entry.scroll.preScrolled) return undefined;
  return measuredOrigin(entry.scroll);
}

/* ------------------------------------------------------------------------- *
 * Transitions
 * ------------------------------------------------------------------------- */

/**
 * Where a hit goes.
 *
 * `hits.json` carries the boxes, their destination and, for the ones that also
 * change state, the fields they set. The arithmetic is here rather than in the
 * extracted data, because arithmetic is not something you can read off a frame.
 */
export function apply(s: FlowState, hit: Hit): FlowState {
  /* The home button abandons rather than moves: it returns to the device's home
     screen, and the half-finished purchase behind it is forgotten. */
  if (hit.kind === 'global' && hit.to === 'unlocked') return { ...INITIAL };

  /* Leaving the receipt is what credits the card - that is the moment the
     prototype's own artwork starts printing the new figure. */
  if (s.template === 'paid' && hit.kind === 'nav') return afterPaid(s);

  const next: FlowState = { ...s };
  for (const [k, v] of Object.entries(hit.set ?? {})) {
    /* `issuer: null` in the data means "not chosen yet", which the state models
       as the default rather than as a null the whole app has to guard. */
    if (v === null && k === 'issuer') continue;
    (next as Record<string, unknown>)[k] = v;
  }

  /* Tapping the selected chip again deselects it - the prototype's own wiring,
     and the only way back to the unselected artwork. */
  if (hit.kind === 'state' && typeof hit.set?.amount === 'number') {
    next.amount = s.amount === hit.set.amount ? null : hit.set.amount;
  }

  if (hit.to) next.template = hit.to;
  return next;
}

/**
 * Where a tap lands, back arrow included.
 *
 * `apply` answers every hit the map can answer on its own; the two that need
 * the state as well as the box are the back arrow and the sheet's close, and
 * they are resolved here so that the app and the prefetch below cannot disagree
 * about where a control goes. They did once: the prefetch walked `apply` and
 * the app walked its own copy, so every back arrow in the flow arrived on
 * artwork nobody had loaded.
 */
export function nextState(s: FlowState, h: Hit): FlowState {
  if (h.label === 'Back' || h.label.startsWith('Close')) {
    const back = h.to ?? backTarget(s);
    return back ? { ...s, template: back } : s;
  }
  return apply(s, h);
}

/**
 * Every image a state puts on screen.
 *
 * Composed exactly the way `App` composes the screen, and it has to stay that
 * way - this list is what gets decoded before a tap is allowed to land, so an
 * image the app draws and this function forgets is an image that flickers.
 * Hence the three cases below rather than "all of the plates for this state":
 * a scrolling screen never draws its own full-frame plate, and prefetching that
 * unused 400KB on every screen would push the artwork that IS needed out of the
 * way at exactly the wrong moment.
 */
export function artworkFor(s: FlowState): string[] {
  const out: string[] = [];
  /* `home` and `homeCard` composite their own layers rather than a plate, and
     only the screen itself knows what those are. */
  if (OWNS_FRAME.has(s.template)) {
    out.push(...homeArtwork(s.template === 'home' ? 'setup' : 'card'));
  } else {
    const scroll = scrollFor(s);
    if (scroll) {
      if (scroll.content) out.push(scroll.content);
      const still = selectionStill(s);
      if (still) out.push(still.src);
      for (const c of chromeFor(s)) if (c.file && !c.hidden) out.push(c.file);
    } else {
      out.push(plateFor(s));
    }
  }
  for (const p of patchesFor(s)) out.push(p.src);
  return out;
}

/**
 * Every image the NEXT tap could need, from here.
 *
 * The whole of the prefetch policy, and it is a walk of the interaction map
 * rather than a list of screens on purpose: what a chip does, where the back
 * arrow goes and what a timer runs out into are all already answered in
 * `hits.json`, and a hand-kept list of "screens worth preloading" would be a
 * second copy of that to get wrong. Every reachable state, one tap deep.
 *
 * On the amount screen that is the five chips plus Continue plus Back - about
 * 2MB of local PNGs fetched while the customer is reading the screen, which is
 * the entire reason the chips no longer flicker when they are pressed.
 */
export function nextArtwork(s: FlowState): string[] {
  const out = new Set<string>();
  for (const h of hitsFor(s)) for (const a of artworkFor(nextState(s, h))) out.add(a);
  const t = timerFor(s.template);
  if (t?.to) for (const a of artworkFor({ ...s, template: t.to })) out.add(a);
  /* The PIN pad submits without a hit of its own - `PinScreen` owns those keys
     - so the screen it submits to is not on the map and has to be named. */
  if (s.template === 'pin') for (const a of artworkFor({ ...s, template: 'success' })) out.add(a);
  return [...out];
}

/**
 * Paying credits the card, and where you land depends on why you paid.
 *
 * Buying loads the SELECTED amount, not the total - the Rs50 is a fee and the
 * prototype is explicit about it: paying Rs150 lands on a balance of Rs100.
 * Topping up adds the chip to what is already there, and then the prototype
 * has no further artwork, which `toppedUp` records.
 */
export function afterPaid(s: FlowState): FlowState {
  const purchase = isPurchase(s);
  const added = s.amount ?? 0;
  return {
    ...s,
    balance: Math.min(PRINTED_CAP, purchase ? added : s.balance + added),
    amount: null,
    template: purchase ? 'loading' : 'balance',
  };
}

/** The chips the artwork will honour: never more than the printed headroom. */
export const offerableChips = (s: FlowState) =>
  CHIPS.filter((c) => c <= headroom(s.balance));

/* ------------------------------------------------------------------------- *
 * The extracted interaction map
 * ------------------------------------------------------------------------- */

export type Hit = {
  /** Figma node id, kept so a mis-placed target can be traced back to source. */
  node: string;
  label: string;
  left: number; top: number; width: number; height: number;
  to?: Template;
  toVariant?: string;
  kind?: 'nav' | 'state' | 'global' | 'inert';
  set?: Record<string, unknown>;
  /** true when the box lives inside the screen's scroll region. */
  scrolled?: boolean;
};


/**
 * Every balance the file has a frame for, per leg.
 *
 * The printed balance is part of the artwork, so a balance with no frame is a
 * balance the app cannot show. The designer drew up to Rs1000 on the setup leg
 * and Rs550 on the recharge leg - one top-up past the largest first payment -
 * and stopped, which is well short of the Rs2000 ceiling the copy on those same
 * frames advertises.
 */
const DRAWABLE: Record<string, Set<number>> = (() => {
  const out: Record<string, Set<number>> = {};
  for (const key of Object.keys(PLATES.screens)) {
    const m = /^balance-(\w+)-\w+-(\d+)-/.exec(key);
    if (!m) continue;
    (out[m[1]] ??= new Set()).add(Number(m[2]));
  }
  return out;
})();

/** Whether the app can draw this balance at all. */
export const isDrawableBalance = (leg: Leg, balance: number) =>
  DRAWABLE[leg]?.has(balance) ?? false;

/**
 * How many rounds the balance screen gets before the run is handed back.
 *
 * Counted in sightings of the screen (see `arrive`). Both legs get two, and
 * they are kept apart rather than collapsed to one constant because the two
 * legs do not spend them on the same thing - the number agreeing today is a
 * coincidence of the journeys, not a shared rule:
 *
 *   Card issuance pays first. Sighting one is the card landing, bought with the
 *   fee plus the chosen amount; the customer may top up once from it.
 *
 *   Recharge already has the card. Sighting one is the card chip on `homeCard`,
 *   with nothing paid yet; the customer may top up once from it.
 *
 * Either way the second sighting is the last. The chips and the CTA are printed
 * on it but dead, the whole frame answers instead, and the tap resets to
 * `INITIAL` - balance, issuer, leg and the count itself - so the next customer
 * starts from scratch with nothing of this run carried over.
 */
export const BALANCE_ROUNDS: Record<Leg, number> = { setup: 2, recharge: 2 };

/** How many rounds this run gets, given the leg it started on. */
export const roundsFor = (leg: Leg) => BALANCE_ROUNDS[leg];

/**
 * Count sightings of the balance screen.
 *
 * A sighting, not a payment, because that is what the run is budgeted in: the
 * customer is done when they have SEEN this screen enough times, and the two
 * legs do not reach it the same way. Card issuance is always shown it by a
 * payment - `loading` after the card is bought, `paid` after each top-up - but
 * recharge is shown it immediately, straight off the card chip on `homeCard`
 * with nothing paid yet. Counting payments alone dropped that first sighting
 * and gave the recharge leg one more round than it looked like it had.
 *
 * Two arrivals are not sightings and are excluded by name:
 *
 *   `methods` is the back arrow out of the payment sheet - the user changing
 *   their mind about a top-up they have not made. It must not burn a round, or
 *   backing out twice would end the run without paying for anything.
 *
 *   `balance` is the screen itself: selecting a chip commits a new state
 *   without moving template, and the customer is still looking at the sighting
 *   they were already counted for.
 */
const NOT_A_SIGHTING = new Set<Template>(['methods', 'balance']);

export function arrive(prev: FlowState, next: FlowState): FlowState {
  if (next.template !== 'balance') return next;
  if (NOT_A_SIGHTING.has(prev.template)) return next;
  return { ...next, balanceVisits: next.balanceVisits + 1 };
}

export type ScrollSpec = {
  viewport: { x: number; y: number; w: number; h: number };
  contentW: number; contentH: number;
  /** Where the exported content's own pixels begin, in frame coordinates. It is
      NOT the viewport origin - on balance the content starts 12px left and 17px
      above it, and assuming otherwise puts every target in the region out. */
  contentX?: number; contentY?: number;
  /** Set on artwork the designer flattened at a scroll offset. */
  preScrolled?: boolean; scrollTop?: number;
};

type Variant = { hits?: Hit[]; scroll?: ScrollSpec };
type TemplateEntry = Variant & { node?: string; variants?: Record<string, Variant> };

type BackTarget =
  | null
  | { to: Template }
  | { by: 'entry' | 'leg'; cases: Record<string, Template> };

type HitMap = {
  global: { home: Hit; back: Hit };
  backTargets: Record<string, BackTarget>;
  templates: Record<string, TemplateEntry>;
  timers: Record<string, { ms: number; to?: Template }>;
};

export const HITS = hits as unknown as HitMap;

/** The template's entry, resolved through its variant when it has one. */
export function specFor(s: FlowState): Variant | undefined {
  const entry = HITS.templates?.[s.template];
  if (!entry) return undefined;
  const v = variantOf(s);
  return v && entry.variants?.[v] ? entry.variants[v] : entry;
}

/**
 * A correction to the map, and the only one in this file.
 *
 * `hits.json` marks a box `scrolled` when it is a descendant of the template's
 * own `overflowDirection` container. On every other screen that container is a
 * child of the frame, so the test works. On home it IS the frame - #254:1023
 * carries VERTICAL_SCROLLING itself - and the rule quietly concluded that
 * nothing on home scrolls.
 *
 * It does. The card chip `#254:1034` sits under `Group 1547753965` (#254:1028),
 * which is a SCROLLS child, so the chip moves with the content; only the header
 * and the bottom nav bar are `scrollBehavior: FIXED`. Left uncorrected the chip
 * was drawn scrolling while its target stayed pinned at y=1565, behind the nav
 * bar - so the control you could see was never the control you could press.
 */
const homeScrollFix = (h: Hit): Hit =>
  h.node === '254:1034' || h.node === '254:58082' ? { ...h, scrolled: true } : h;

/**
 * The hits for a state, minus the ones the app owns rather than the map.
 *
 * The PIN pad's twelve keys are declared on all 360 PIN frames because the
 * prototype storyboards typing by crossing between them. The kiosk types for
 * real, so `PinScreen` owns those keys and they are dropped here - keeping both
 * would put a dead target over every live one.
 */
export function hitsFor(s: FlowState): Hit[] {
  /* Not in `hits.json` - it is not a prototype frame - so it is answered before
     the map is consulted at all. */
  if (s.template === 'screensaver') return [SCREENSAVER_TAP];

  const declared = specFor(s)?.hits ?? [];

  /* A hit on a still is declared where the still draws it, and the still is
     this screen scrolled by 482 - so a chip the map puts at frame-y 1142 is the
     chip the unselected frame puts at 1624. Now that the still is painted into
     the live panel rather than replacing it, those boxes have to be brought
     back to the panel's own coordinates or every chip on a selected balance
     screen answers 482px above where it is drawn. Only the scrolled ones: the
     CTA and the two globals are on fixed chrome and never moved. */
  const flat = flatOffset(s);
  const own = flat
    ? declared.map((h) => (h.scrolled ? { ...h, top: h.top + flat } : h))
    : declared;

  /* The run ends on the balance screen, and there are two ways to get there:
     the last sighting for the leg, or a card with nothing left it can be topped
     up to. The second is not a corner case - Rs500 and another Rs500 reaches
     the top of what the designer drew in two rounds, and a screen with every
     chip dropped and no way on would strand the kiosk.

     Either way the ending is the same, and it is the frame's OWN two controls
     that carry it, not a sheet over the top. Only the payment controls die -
     the chips and the Add Money CTA, which is everything that could spend more
     money on a card the artwork can no longer draw. What is left is what the
     designer already put on the frame:

       Back  - the arrow at (44,182), to the app's home screen for this leg.
       Home  - the device's middle button at (479,1793), which ends the run and
               hands the kiosk to the next customer from `INITIAL`.

     Both are `global` on this screen, so that is the whole filter.

     This replaces a full-frame "tap anywhere to start over" target. Covering
     the frame ended the run on any touch at all, including the one meant for a
     dead chip, and it took the back arrow with it - a customer who wanted the
     screen they came from got the top of the flow instead. Two live controls
     that are already drawn beat one invisible one that is not.

     ADDITION - ours, not the prototype's, and only Back is: the designer's own
     `landing` frames declare Home alone and PRINT the arrow dead (254:20070,
     254:21614). The prototype simply stops here; a kiosk cannot. */
  if (s.template === 'balance') {
    const offerable = own.some(
      (h) => typeof h.set?.amount === 'number'
        && isDrawableBalance(s.leg, s.balance + h.set.amount),
    );
    if (s.balanceVisits >= roundsFor(s.leg) || !offerable) {
      return own.filter((h) => h.kind === 'global');
    }
  }
  return own.map(homeScrollFix).filter((h) => {
    /* A chip that would take the card past the last balance the designer drew
       is dropped rather than offered: the figure is printed in the artwork, so
       spending past it would leave the screen showing a number that is not the
       card's. Rs500 + Rs500 is the top of the setup leg, and that is where the
       file stops. */
    if (s.template === 'balance' && typeof h.set?.amount === 'number'
        && !isDrawableBalance(s.leg, s.balance + h.set.amount)) return false;
    if (h.kind === 'inert') return false;
    if (s.template === 'pin' && h.kind === 'state') return false;
    if (s.template === 'pin' && h.to === 'success') return false;
    return true;
  });
}

/**
 * Where back goes.
 *
 * Two templates cannot answer that from their own frame. `methods` returns to
 * whichever screen opened it, and `balance` returns to the home screen of its
 * own leg - so both are resolved against the state rather than the map alone.
 */
export function backTarget(s: FlowState): Template | undefined {
  const bt = HITS.backTargets?.[s.template];
  if (!bt) return undefined;
  if ('to' in bt) return bt.to;
  if (bt.by === 'leg') return bt.cases[s.leg];
  if (bt.by === 'entry') return bt.cases[isPurchase(s) ? 'amount' : 'balance'];
  return undefined;
}

/** The declared AFTER_TIMEOUT for a screen, if it has one. */
export const timerFor = (t: Template) => HITS.timers?.[t];

/** `?screen=` accepts a template name, so a screen can be deep-linked. */
export function resolveTemplate(param: string | null): Template {
  const t = (param ?? '') as Template;
  /* Named here because it is the one template with no row in `hits.json`, and
     the map is what every other name is checked against. */
  if (t === 'screensaver') return t;
  return HITS.templates?.[t] ? t : INITIAL.template;
}

/**
 * A state a deep-linked screen can actually be drawn in.
 *
 * Half the screens in V2 are a function of state, so a template name alone does
 * not name a picture: `?screen=paid` from the initial state asks for a receipt
 * for the Rs50 fee and nothing else, which the designer never drew, and the
 * screen comes up blank. The seed is the shortest walk that reaches each one -
 * a Rs300 purchase - so a deep link lands on the same artwork the flow would
 * have reached, and `?screen=` stays usable for the diff harness and for
 * pasting a screen into a bug report.
 */
export function seedFor(t: Template): FlowState {
  const base: FlowState = { ...INITIAL, template: t };
  switch (t) {
    case 'paid':
    case 'success':
    case 'pin':
    case 'methods':
      return { ...base, amount: 300 };
    case 'loading':
    case 'balance':
      return { ...base, balance: 300 };
    default:
      return base;
  }
}
