/**
 * The ON-THE-GO card flow, transcribed from the Figma prototype.
 *
 * Every screen, every hit target and every destination below came out of the
 * prototype's own `interactions` metadata (section #211:5455 "Setup",
 * file jk3u8GQ1wxKd3Ge5hEPLaJ) - not from reading the artwork. The boxes are
 * frame-relative pixels at the 1080x1920 design size, so they composite over
 * the plates with no arithmetic at runtime.
 *
 * The flow is in two legs, and they are two Figma sections. Setup (#211:5455)
 * runs `home` -> `balance` and issues the card. Add Money (#223:1403) runs
 * `addmoney2` -> `addbalance` and tops it up. The second section is the
 * designer's own answer to the dead end the first one used to have: it redraws
 * the balance screen, wires the chip the first section left inert, and carries
 * the same UPI payment sequence through to a receipt and an updated balance.
 *
 * Four targets here are NOT from the Figma, and are marked `addition: true`
 * where they appear: the `attract` screen that holds the panel before the
 * flow starts, the `balance` chip that joins the two legs, `addpaid` reaching
 * `addbalance`, and `addbalance` restarting the flow. A fifth addition is not
 * a target and so cannot carry the flag: `loading` finishes on a timer rather
 * than on a tap. Each is noted again at the row it appears on.
 *
 * Two declared targets are missing rather than added, both the same case. The
 * prototype enters a UPI PIN by tapping the dots to cross from an empty frame
 * to a filled one; the kiosk types it. See `upipin2` and `addpin2` below.
 */

export type ScreenName =
  | 'attract'
  | 'home' | 'intro' | 'terms' | 'cities' | 'issuer' | 'cardstyle' | 'amount'
  | 'methods' | 'upipin2' | 'upipin' | 'success' | 'paid' | 'loading' | 'balance'
  | 'addmoney2' | 'addmoney' | 'addmethods' | 'addpin2' | 'addpin'
  | 'addsuccess' | 'addpaid' | 'addbalance';

export type Hit = {
  /** Figma node id, kept so a mis-placed target can be traced back to source. */
  node: string;
  label: string;
  left: number; top: number; width: number; height: number;
  to: ScreenName;
  /** true when the target is ours, not the designer's. */
  addition?: boolean;
};

export type Screen = {
  name: ScreenName;
  node: string;
  /** public/screens/<name>.png, whole-frame, 1080x1920, native pixels. */
  plate: string;
  hits: Hit[];
  /** Timed transitions, in ms. Declared in the prototype on the two success
      screens; ours on `loading`, which the prototype left waiting for a tap. */
  autoAdvanceMs?: number;
  autoTo?: ScreenName;
};

export const SCREENS: Screen[] = [
  {
    /* ADDITION, and the one screen in this file with no Figma frame behind it
       at all: an attract plate that holds the panel until somebody touches it.

       It sits BEFORE `home` rather than in place of it. `home` is still the
       prototype's first frame, unchanged, still diffed against #211:5561 and
       still where the flow test's loop starts and ends - this screen is only
       ahead of it. Nothing on it is interactive but the touch: one full-frame
       target, so a tap anywhere wakes the kiosk, and no `autoAdvanceMs`, so it
       holds as long as it has to rather than starting the flow by itself.

       The plate is a 4501x8000 JPEG at the same 9:16 the stage is, scaled to
       the design's 1080x1920 the way every other plate is. */
    name: 'attract', node: '-', plate: '/screens/attract.jpg',
    hits: [
      { node: '-', label: 'Wake', left: 0, top: 0, width: 1080, height: 1920, to: 'home', addition: true },
    ],
  },
  {
    name: 'home', node: '211:5561', plate: '/screens/home.png',
    hits: [
      // The only declared target on this screen - the prototype does NOT make
      // the whole frame tappable, so neither do we.
      { node: '211:5572', label: 'ON-THE-GO Transit Card chip', left: 83, top: 1565, width: 383, height: 133, to: 'intro' },
    ],
  },
  {
    name: 'intro', node: '211:5505', plate: '/screens/intro.png',
    hits: [
      { node: 'I211:5537;2688:1936', label: 'Accept terms checkbox', left: 99, top: 1560, width: 89, height: 89, to: 'terms' },
      { node: '211:5553', label: 'Back', left: 44, top: 183, width: 55, height: 55, to: 'home' },
    ],
  },
  {
    name: 'terms', node: '211:5456', plate: '/screens/terms.png',
    hits: [
      /* Was `to: 'cities'`. The city list is HIDDEN from the flow on request -
         see the note on the `cities` entry below. */
      { node: 'I211:5489;2260:88143', label: 'Continue', left: 44, top: 1682, width: 991, height: 155, to: 'issuer' },
      // The stepper arrow on this screen points BACK to intro in the prototype.
      { node: 'I211:5488;2712:826', label: 'Un-accept terms checkbox', left: 99, top: 1560, width: 89, height: 89, to: 'intro' },
      { node: '211:5497', label: 'Back', left: 44, top: 183, width: 55, height: 55, to: 'home' },
    ],
  },
  {
    /* HIDDEN. Nothing in the flow routes here any more: `terms` goes straight
       to `issuer`, and `issuer` goes back to `terms`. The screen is kept in
       SCREENS so `?screen=cities` still deep-links it and it still diffs
       against its exported frame - hidden, not deleted, so putting it back is
       two edges rather than a re-export. */
    name: 'cities', node: '211:6054', plate: '/screens/cities.png',
    hits: [
      // One region covers the whole city list: any city advances. The eight
      // per-row targets underneath it carry no destination and are inert.
      { node: '211:6072', label: 'City list', left: 0, top: 354, width: 1080, height: 1571, to: 'issuer' },
      { node: '211:6063', label: 'Back', left: 44, top: 210, width: 55, height: 55, to: 'terms' },
    ],
  },
  {
    name: 'issuer', node: '211:6137', plate: '/screens/issuer.png',
    hits: [
      { node: '211:6141', label: 'ABC Bank card', left: 44, top: 504, width: 991, height: 310, to: 'cardstyle' },
      { node: '211:6146', label: 'Back', left: 44, top: 183, width: 55, height: 55, to: 'terms' },
    ],
  },
  {
    name: 'cardstyle', node: '211:6253', plate: '/screens/cardstyle.png',
    hits: [
      { node: '211:6257', label: 'Continue', left: 44, top: 1682, width: 991, height: 155, to: 'amount' },
      { node: '211:6262', label: 'Back', left: 44, top: 183, width: 55, height: 55, to: 'issuer' },
    ],
  },
  {
    name: 'amount', node: '211:6178', plate: '/screens/amount.png',
    hits: [
      // The three amount rows above the button have no destination - inert.
      { node: '211:6182', label: 'Continue', left: 44, top: 1682, width: 991, height: 155, to: 'methods' },
      { node: '211:6187', label: 'Back', left: 44, top: 183, width: 55, height: 55, to: 'cardstyle' },
    ],
  },
  {
    name: 'methods', node: '211:6530', plate: '/screens/methods.png',
    hits: [
      { node: '211:6534', label: 'UPI 1 row', left: 34, top: 411, width: 991, height: 191, to: 'upipin2' },
      { node: '211:6539', label: 'Back', left: 44, top: 183, width: 55, height: 55, to: 'amount' },
    ],
  },
  {
    // The live one. The prototype's PIN entry is a tap on the dots that jumps
    // to a second frame with all six already filled - a storyboard of entry,
    // not entry, and nothing a cardholder could use. So that target is dropped
    // and the pad is real: `screens/UpiPinScreen.tsx` owns the twelve keys,
    // the six dots and the digits. None of that is listed here because none of
    // it is a prototype interaction, and this file is a transcript of those.
    // Close is, so Close stays - and it is also what clears a part-typed PIN,
    // by unmounting the screen that holds it.
    name: 'upipin2', node: '211:6419', plate: '/screens/upipin2.png',
    hits: [
      { node: '211:6428', label: 'Close', left: 948, top: 66, width: 66, height: 66, to: 'methods' },
    ],
  },
  {
    // Reference only - nothing navigates here any more. The live screen above
    // reproduces this frame at six digits, and this is the export that claim
    // is measured against, so it stays in SCREENS to keep `?screen=upipin`
    // deep-linking for the diff harness. Its targets are still the ones the
    // prototype declares; they are simply no longer on anyone's way through.
    name: 'upipin', node: '211:6339', plate: '/screens/upipin.png',
    hits: [
      { node: '211:6343', label: 'Next key', left: 699, top: 1715, width: 277, height: 116, to: 'success' },
      { node: '211:6348', label: 'Close', left: 948, top: 66, width: 66, height: 66, to: 'methods' },
    ],
  },
  {
    name: 'success', node: '211:6304', plate: '/screens/success.png',
    // Declared AFTER_TIMEOUT of 3s in the prototype. There is no tap target on
    // this screen at all - waiting is the only way forward, by design.
    hits: [],
    autoAdvanceMs: 3000, autoTo: 'paid',
  },
  {
    name: 'paid', node: '211:6499', plate: '/screens/paid.png',
    hits: [
      { node: '211:6503', label: 'Home button', left: 557, top: 1690, width: 479, height: 155, to: 'loading' },
    ],
  },
  {
    /* The prototype makes the whole frame tappable here, which is the wrong
       gesture for the screen it is on: this one says it is doing something,
       and a loader that waits to be dismissed is not loading, it is a picture
       of loading. So the full-frame target is dropped and the screen finishes
       by itself, the way `success` and `addsuccess` already do.

       ADDITION - 2600ms is ours, not the designer's. The prototype declares no
       timeout on this frame at all. It is long enough for the ring to make two
       full turns at its 1.1s period, so the screen reads as having done
       something rather than having flickered. */
    name: 'loading', node: '211:6689', plate: '/screens/loading.png',
    hits: [],
    autoAdvanceMs: 2600, autoTo: 'balance',
  },
  {
    name: 'balance', node: '211:6706', plate: '/screens/balance.png',
    hits: [
      // ADDITION, and the seam between the two sections. This screen used to
      // dead-end - all five chips inert, "Add Money" drawn disabled - and a
      // full-frame tap restarted the flow so the kiosk would not strand.
      //
      // The Add Money section redraws this exact screen as `addmoney`
      // (#223:1404) and wires its  ₹300 chip, node #223:1445, to the selected
      // state. That chip is the SAME component in both frames - Figma calls it
      // "Frame 1984079994" here too, node #211:6748, 155x102 - so the gesture
      // below is the designer's own, read off their redraw and applied to the
      // frame we already had. It is still an addition: nothing on #211:6706
      // itself declares it. The redraw is kept as `addmoney` for reference,
      // out of the tap path, because showing it here would be showing this
      // same screen twice in a row.
      { node: '211:6748', label: 'Add ₹300 chip', left: 448, top: 1596, width: 155, height: 102, to: 'addmoney2', addition: true },
    ],
  },

  /* ---------------------------------------------------------------------- *
   * Add Money - Figma section #223:1403. Eight frames, seven declared tap
   * transitions and one timed one, joined to the setup leg by the chip above.
   * ---------------------------------------------------------------------- */

  {
    // The chip is selected, the panel has scrolled to bring the CTA into view
    // and "Add Money" is drawn live rather than disabled. Tapping ₹300 again
    // deselects it, which is the prototype's own wiring back to `addmoney`.
    name: 'addmoney2', node: '223:1574', plate: '/screens/addmoney2.png',
    hits: [
      { node: 'I223:1649;2260:88143', label: 'Add Money', left: 44, top: 1682, width: 991, height: 155, to: 'addmethods' },
      { node: '223:1614', label: 'Deselect ₹300 chip', left: 458, top: 1142, width: 155, height: 102, to: 'addmoney' },
    ],
  },
  {
    // Reference only - nothing in the walk arrives here, because `balance` is
    // already this screen. Kept in SCREENS so `?screen=addmoney` deep-links for
    // the diff harness, exactly as `upipin` is, and its one declared target is
    // still the designer's. Note the balance reads ₹50 on this leg and ₹100 on
    // the setup leg: the two sections were drawn with different numbers, and
    // that is the designer's, not a transcription slip.
    name: 'addmoney', node: '223:1404', plate: '/screens/addmoney.png',
    hits: [
      { node: '223:1445', label: 'Select ₹300 chip', left: 457, top: 1626, width: 155, height: 102, to: 'addmoney2' },
    ],
  },
  {
    // A second, fuller payment-methods frame - UPI 1/2/3, cards, net banking
    // and wallets. Not the same artwork as `methods` on the setup leg (5.75%
    // of pixels differ), so it gets its own plate.
    name: 'addmethods', node: '223:1881', plate: '/screens/addmethods.png',
    hits: [
      { node: '223:1908', label: 'UPI 1 row', left: 44, top: 411, width: 991, height: 191, to: 'addpin2' },
      { node: 'I223:2039;3883:9418', label: 'Back', left: 44, top: 183, width: 55, height: 55, to: 'addmoney2' },
    ],
  },
  {
    // Live, for the same reason `upipin2` is: the prototype crosses from empty
    // dots to full ones on a tap, which is a storyboard of PIN entry and not
    // PIN entry. That target (#223:1654 -> #223:1769) is dropped and the pad
    // is real. The dots and the twelve keys sit at the same coordinates as the
    // setup leg's PIN screen - measured, not assumed - so `UpiPinScreen`
    // serves both and only the plate underneath changes.
    name: 'addpin2', node: '223:1652', plate: '/screens/addpin2.png',
    hits: [
      { node: '223:1717', label: 'Close', left: 948, top: 66, width: 66, height: 66, to: 'addmethods' },
    ],
  },
  {
    // Reference only, the six-digit state, matching `upipin`'s role on the
    // setup leg. Typing six digits on `addpin2` reaches this artwork on its
    // own. Its Next key is the prototype's declared target and is kept.
    name: 'addpin', node: '223:1769', plate: '/screens/addpin.png',
    hits: [
      { node: '223:1799', label: 'Next key', left: 699, top: 1714, width: 277, height: 116, to: 'addsuccess' },
    ],
  },
  {
    name: 'addsuccess', node: '223:1733', plate: '/screens/addsuccess.png',
    // The second declared AFTER_TIMEOUT in the file, 3s again, and like
    // `success` this frame carries no tap target at all.
    hits: [],
    autoAdvanceMs: 3000, autoTo: 'addpaid',
  },
  {
    name: 'addpaid', node: '223:1850', plate: '/screens/addpaid.png',
    hits: [
      // ADDITION. #223:1850 declares nothing - the designer left it dead - but
      // they also drew `addbalance` (#223:1489) and wired nothing to it, and
      // that frame reads ₹350, which is this receipt's ₹300 on top of the ₹50
      // this leg started from. Home is the button that means "done"; this is
      // where it goes. Same box as the setup leg's Home, 479x155 @(557,1690).
      { node: 'I223:1879;2260:88133', label: 'Home button', left: 557, top: 1690, width: 479, height: 155, to: 'addbalance', addition: true },
    ],
  },
  {
    name: 'addbalance', node: '223:1489', plate: '/screens/addbalance.png',
    hits: [
      // ADDITION, and the loop-closer that used to live on `balance`. The card
      // now reads ₹350 and there is nowhere further to go, so a full-frame tap
      // returns to the start and the kiosk runs unattended.
      { node: '-', label: 'Restart', left: 0, top: 0, width: 1080, height: 1920, to: 'home', addition: true },
    ],
  },
];

/* The attract screen, not `home`: the panel comes up asleep and the flow only
   starts on a touch. `R` in mouse mode resets to it for the same reason. */
export const FIRST: ScreenName = 'attract';

export const byName = (n: string): Screen | undefined =>
  SCREENS.find((s) => s.name === n);

/** `?screen=` accepts a name or an index, so the diff harness can deep-link. */
export function resolveScreen(param: string | null): Screen {
  if (!param) return byName(FIRST)!;
  const byIdx = SCREENS[Number(param)];
  if (/^\d+$/.test(param) && byIdx) return byIdx;
  return byName(param) ?? byName(FIRST)!;
}
