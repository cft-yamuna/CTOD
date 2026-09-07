# ctod-setup adapter (CRAFTECH 360 / TOTD)

The `figma-to-code` skill looks for this at `adapters/<project>.md` inside the
skill's own directory. The canonical copy lives **here**, in the repo, because
the skill directory has already been reset once and taken the adapter with it.
Copy it back with:

```bash
cp docs/figma-adapter.md ~/.claude/skills/figma-to-code/adapters/ctod-setup.md
```

Plate-mode build. Figma file `jk3u8GQ1wxKd3Ge5hEPLaJ`, **two sections**:
`#211:5455` "Setup" (fourteen frames) and `#223:1403` "Add Money" (eight).
Twenty-two frames, all 1080x1920, all built. Frame names are descriptive here
and can be trusted ("All supported cities", "UPI PIN verification"), but the
flow order is the prototype's `interactions` graph, not canvas x-order -
`upipin2` sits to the right of `upipin` on the canvas and comes before it in
the flow.

The two sections are two legs of one flow. Setup issues the card and ends on
the balance screen; Add Money tops it up and ends on the balance screen again,
now reading ₹350. Add Money is the designer's own answer to the dead end Setup
used to have - it redraws the balance screen, wires the amount chip Setup left
inert, and carries the same UPI payment sequence through to a receipt. The two
sections do not agree on the starting balance: Setup draws ₹100, Add Money
draws ₹50 (and ₹50 + ₹300 = the ₹350 it finishes on). That is the designer's
inconsistency, is visible when the flow crosses the seam, and is left alone.

**Stage:** fixed 1080x1920. `src/components/Stage.tsx`, centred flexbox +
center-anchored `scale(min(vw/1080, vh/1920))`, transform omitted at exactly 1
so the target panel composites the plates at native pixels with no resample.

**Plates:** yes, whole-frame, `public/screens/<slug>.png` at 1080x1920, one per
screen, native pixels. Everything not listed under Controls below is baked into
the image and must never be redrawn.

**Entry:** `src/App.tsx`, a single renderer - plate plus the transparent hit
areas the prototype declares over it - driven entirely by `SCREENS` in
`src/flow.ts`. One renderer covers all twenty-two screens, so `flow.ts` is the
only file anyone has to edit. Reads `?screen=` (name or index) so the diff
harness can deep-link each screen without walking the flow to reach it.

**The flow.** Every row below came out of the prototype's own `interactions`
metadata (`.figma/controls.json`, extracted by `.figma/controls.mjs`), not out
of reading the artwork:

| # | Screen | Figma node | Advances on |
|---|---|---|---|
| 0 | home | `#211:5561` "Home ON-THE-GO entry" | "ON-THE-GO Transit Card" chip, 383x133 @(83,1565) |
| 1 | intro | `#211:5505` "Introduction to ON-THE-GO" | accept-terms checkbox, 89x89 @(99,1560) &nbsp;·&nbsp; back -> home |
| 2 | terms | `#211:5456` "…accept terms" | "Continue", 991x155 @(44,1682) &nbsp;·&nbsp; checkbox -> **intro** &nbsp;·&nbsp; back -> home |
| 3 | cities | `#211:6054` "All supported cities" | the city-list region, 1080x1571 @(0,354) &nbsp;·&nbsp; back -> terms |
| 4 | issuer | `#211:6137` "Choose card issuer" | "ABC Bank" card, 991x310 @(44,504) &nbsp;·&nbsp; back -> cities |
| 5 | cardstyle | `#211:6253` "Select card style" | "Continue", 991x155 @(44,1682) &nbsp;·&nbsp; back -> issuer |
| 6 | amount | `#211:6178` "Amount details" | "Pay ₹150", 991x155 @(44,1682) &nbsp;·&nbsp; back -> cardstyle |
| 7 | methods | `#211:6530` "All Payment methods" | "UPI 1" row, 991x191 @(34,411) &nbsp;·&nbsp; back -> amount |
| 8 | upipin2 | `#211:6419` "UPI PIN verification" | the PIN dots, 487x165 @(294,853) &nbsp;·&nbsp; close -> methods |
| 9 | upipin | `#211:6339` "UPI PIN verification" | the keypad's Next key, 277x116 @(699,1715) &nbsp;·&nbsp; close -> methods |
| 10 | success | `#211:6304` "Success enabled" | **nothing. 3s AFTER_TIMEOUT -> paid** |
| 11 | paid | `#211:6499` "Payment successful" | "Home", 479x155 @(557,1690) |
| 12 | loading | `#211:6689` "Loading" | **nothing. 2.6s timeout -> balance** (**addition**, replaces the declared full-frame tap) |
| 13 | balance | `#211:6706` "Card balance and add money" | ₹300 chip, 155x102 @(448,1596) -> **addmoney2** (**addition**, the seam, see below) |

Then the Add Money leg, section `#223:1403`:

| # | Screen | Figma node | Advances on |
|---|---|---|---|
| 14 | addmoney2 | `#223:1574` "Card balance and add money" | "Add Money", 991x155 @(44,1682) &nbsp;·&nbsp; ₹300 chip deselects -> **addmoney** |
| 15 | addmoney | `#223:1404` "Card balance and add money" | ₹300 chip, 155x102 @(457,1626) &nbsp;·&nbsp; **reference only, see below** |
| 16 | addmethods | `#223:1881` "All Payment methods" | "UPI 1" row, 991x191 @(44,411) &nbsp;·&nbsp; back -> addmoney2 |
| 17 | addpin2 | `#223:1652` "UPI PIN verification" | the PIN dots, 487x165 @(294,853) &nbsp;·&nbsp; close -> addmethods |
| 18 | addpin | `#223:1769` "UPI PIN verification" | the keypad's Next key, 277x116 @(699,1714) |
| 19 | addsuccess | `#223:1733` "Success enabled" | **nothing. 3s AFTER_TIMEOUT -> addpaid** |
| 20 | addpaid | `#223:1850` "Payment successful" | "Home", 479x155 @(557,1690) -> addbalance (**addition**) |
| 21 | addbalance | `#223:1489` "Card balance and add money" | full-frame 1080x1920 -> home (**addition**) |

Twenty-seven declared tap transitions, four additions and three timed ones - 34
edges in all, and the 31 tap targets among them are the number `flow-test.mjs`
reports as tap coverage. The
stepper checkbox on `terms` pointing back to `intro` is the prototype's own
wiring, not a transcription slip - that is genuinely what the designer
prototyped, and it is kept.

**Controls (all transparent hit targets - the plate draws every one of them):**
`src/components/HitTarget.tsx`, absolute boxes in frame-relative pixels straight
out of `flow.ts`, plus `FullScreenHit` for the two tap-anywhere screens
(`attract`, `addbalance`). Nothing is styled: a printed control and a live one a
pixel out of register are both on screen at once, and that is worse than either
alone. `aria-label` is the only accessible name any of these screens has,
because every other word on them is pixels.

No opaque slots. Nothing in this flow is user-specific data, so nothing has to
cover a designer's placeholder.

**The three timed transitions.** `success` (`#211:6304`) and `addsuccess`
(`#223:1733`) each declare AFTER_TIMEOUT 3000ms - to `paid` and `addpaid` - and
each carries **no tap target at all**. Waiting is the only way forward, by
design; both screens are payment confirmation spinners, one per leg.

`loading` (`#211:6689`) is the third, and it is **ours**. The prototype makes
that whole frame tappable and declares no timeout, which is the wrong gesture
for the screen: it says it is fetching the card, and a loader that waits to be
dismissed is not loading, it is a picture of loading. The full-frame target is
dropped and it finishes on a 2.6s timer instead - two full turns of its ring at
the 1.1s period, so it reads as having done something rather than flickered.

The timer lives in an effect in `App.tsx` keyed on the current screen, driven
straight off `autoAdvanceMs`/`autoTo` in `flow.ts`, so it is armed on arrival
and cleared on leave; if it does not fire the kiosk is stranded
mid-payment, which is why `scripts/flow-test.mjs` tests each twice, once inside
the loop and once on its own. Phase 3 of that test iterates `autoAdvanceMs` out
of `flow.ts`, so a third timed screen is covered without editing the test.

**Trap - the three ADDITIONS, none of them the Figma.** Everything else in
`flow.ts` came out of the prototype's `interactions`. These did not, and all
three are marked `addition: true`. Do not quietly promote any of them to "from
the prototype" in a later pass:

- **`balance` -> `addmoney2` on the ₹300 chip - the seam between the two
  sections.** `#211:6706` declares nothing: its "Add Money" button is drawn
  **disabled** because no amount chip has been chosen, and none of the five
  chips is wired. The Add Money section redraws that exact screen as
  `#223:1404` and wires its ₹300 chip, `#223:1445`, to the selected state. It
  is the **same component in both frames** - Figma names it "Frame 1984079994"
  on `#211:6706` too, node `#211:6748`, 155x102 @(448,1596) - so the gesture is
  the designer's own, read off their redraw and applied to the frame already
  built. It is still an addition, because nothing on `#211:6706` declares it.
- **`addpaid` -> `addbalance` on Home.** `#223:1850` declares nothing at all.
  But the designer drew `#223:1489` and wired nothing to it, and that frame
  reads **₹350**, which is this receipt's ₹300 on top of the ₹50 the leg began
  from. Home is the button that means "done"; that is where it goes.
- **`addbalance` -> `home`, full-frame.** The loop-closer, moved here from
  `balance`. A kiosk cannot dead-end, and after the top-up there is nowhere
  further to go.

**Trap - `balance` is no longer tap-anywhere.** It used to carry a full-frame
restart; it now carries a 155x102 chip. Everything else on that screen - the
other four amount chips, the disabled "Add Money" CTA - is inert again, and
`flow-test.mjs` asserts exactly that. A full-frame target reinstated there
would swallow the seam and the flow would loop the setup leg forever without
anything failing.

**Trap - `addmoney` (`#223:1404`) is deliberately out of the tap path.** It is
the Add Money section's own entry frame, and it is a redraw of `balance` - the
same screen, restyled, with "Updated 3h ago" added and the balance changed from
₹100 to ₹50 (26% of pixels differ, measured). Putting it in the walk would show
that same screen twice in a row, with the balance silently changing between
them. So `balance` skips straight to `addmoney2`, and `#223:1404` is kept in
`SCREENS` as reference only - deep-linkable and diffed like everything else,
with its one declared target intact so `flow-test.mjs` still drives it. This is
the same treatment `upipin` already gets, and for the same reason.

**Three screens are NOT plates, and all three exceptions are deliberate.**

`home` (`#211:5561`) is composited from its separate Figma layers by
`src/screens/HomeScreen.tsx`. Its background, instance `#211:5562`, is a
four-variant component set (`#211:940` "Component 52") that smart-animates
forever, and it is the frame's BOTTOM layer - child index 0, under every other
pixel. A flattened plate cannot move an interior layer, so the layers were
separated again to put the animation back underneath the artwork. Only the top
974.77px is decomposed, because that is exactly how tall the animated instance
is; everything below is one crop of the original plate, which is exact by
construction and removes the two worst-behaved layers from the problem.

`upipin2` (`#211:6419`) and `addpin2` (`#223:1652`) hold a PIN the user is
typing - state, which cannot be photographed - so `src/screens/UpiPinScreen.tsx`
draws the six dots live over an opaque patch in the plate's own sampled
background. With zero digits entered each is its own plate; with six it is the
`upipin` / `addpin` plate. Those two stay in `SCREENS` so `?screen=upipin` and
`?screen=addpin` still deep-link their plates, but neither is in the tap path -
typing six digits reaches that state on its own.

**One component serves both PIN screens**, and that was measured rather than
assumed. A row-profile diff of `#211:6419` against `#223:1652` puts **zero**
differing pixels across the dot band (y 973..1017) and peaks of one to two
pixels through the header - the two frames place the dots and the twelve keys
identically. Only the plate underneath differs. `PIN_SCREENS` in `App.tsx` is
the one place the pairing of PIN screen to its success screen is written down;
`UpiPinScreen` itself knows nothing about the flow, and is keyed on the screen
name so a half-typed PIN cannot ride across from one to the other.

**The animations, and what is actually in them.** Every screen-to-screen
transition in this prototype is instant - no dissolve, no push, no smart
animate. Two in-screen animations are built, and both are cases where the
artwork is plainly a still of something moving:

- `home` background, set `#211:940`, four keyframes each holding 0.2s:
  `#211:941` -> `944` -> `947` -> `950` -> back. Three legs are SMART_ANIMATE
  (1.5s, 1.5s, 3s, all ease-out) and the closing leg is DISSOLVE (2.2s), which
  is why `styles.css` stacks two ellipse pairs - a dissolve cross-fades, it does
  not move, so that leg cannot be a geometry tween like the other three. Cycle
  is 9s. Use the INSTANCE's colours (`#b29bff`, `#ffacf7` at 0.3 on white), not
  the component's: the component sits on `#0b0b0b` with green/orange blobs, and
  building from those renders a black home screen.
- `loading`, the ring: Figma draws a static arc (`#211:6704`) on a grey track
  (`#211:6703`), and a spinner that does not turn is the one thing on that
  screen a flat plate obviously cannot be. The arc is its own node, so
  `LoadingScreen.tsx` separates it and rotates it about the track's centre,
  1.1s linear and infinite. It is the one screen whose diff is not 0.000%,
  because it has no resting state to measure against.

`success` and `addsuccess` are NOT animated, and that is a decision rather than
an omission - both are plates, exactly as exported.

- Set `#211:3316` on `success` is declared in the file and deliberately not
  built. It widens a clipping frame from 2.77px to 1080px over 1.4s while the
  panel inside goes 0.3 -> 0.4 alpha, which reads like a wipe. The panel has no
  fill. Counted from the exports: 287 non-transparent pixels at peak alpha
  58/255 at rest, 2706 at 102/255 fully open, on a surface that would be
  ~617,000 pixels if filled. Both are the antialiased edge of an empty
  rectangle. Building it would mean inventing a fill the designer never set.
- The badge pop that used to run here - the rosette scaling up and the tick
  fading in behind it, split out of the flat export by
  `scripts/split-badge.mjs` and timed off the reference recording - has been
  removed on request. The split layers and that script are still in the tree;
  nothing renders them.

**Trap - a Figma layer blur is not a CSS blur.** The home blobs carry
LAYER_BLUR 653.54; CSS `blur()` takes the Gaussian sigma, which is half that
(326.77px). It is close but not identical, and it is the whole of home's
remaining diff residue.

**Trap - Figma exports a node unclipped by its parent frame.** `#211:5840`
exports 3709x266 for a 1036x227 layout box and its pixels actually begin at
(-2,466), not (44,482). Layer offsets in `HomeScreen.tsx` were solved by
matching each layer's opaque pixels against the plate, never read off the
layout box. `scripts/solve-offsets.mjs` is that solver, kept for the next time.

**Tap feedback.** `App.tsx` holds a pressed state for 140ms before navigating,
and `.hit-pressed` washes the control that was hit. Without it a tap and a
mis-tap look identical, because the plates swap within a frame and nothing
tells the user the press registered. It is applied only between the click and
the move, so nothing about a screen at rest changes and the diffs are unaffected.

**Trap - never render live text over these plates.** Every glyph on all
twenty-two screens is already in the image, including the status-bar clock,
which reads `9:41` on every single frame because that is what the designer
drew - and including every rupee figure, so the ₹50, ₹300 and ₹350 that carry
the Add Money story are pixels and cannot be recomputed.
Making it live would require covering it with an opaque overlay first, or
exporting that screen through the full `SKILL.md` pipeline instead of as a
plate.

**Trap - eight frames are scroll regions in Figma and their plates are clipped
at 1920.** Figma marks these `VERTICAL_SCROLLING` and their content runs past
the frame's bottom edge, so the export slices it:

- `cities` (`#211:6072`, 1571px region): the city list runs past the bottom edge - eight rows are drawn, the last of them cut.
- `amount` (`#211:6179`, 1327px region): the payment panel is sliced by the sticky "Pay ₹150" button.
- `methods` (`#211:6552`, 2751px of content in a 1920px frame): the "Add new RuPay card" tile is sliced.
- `balance` (`#211:6707`, 1374px region): the amount-chip row is clipped by the fixed "Add Money" CTA.
- `home` (`#211:5561`, plus three `HORIZONTAL_SCROLLING` carousels inside it): the chip row sits under the nav.
- `addmoney` (`#223:1405`, 1350px region): same clip as `balance` - the chip row runs under the CTA.
- `addmethods` (`#223:1903`, 1587px region): the net-banking and wallet sections run well past the bottom edge.
- `addbalance` (`#223:1490`, 1360px region): the chip row again, clipped by the CTA.

All eight are rendered **static, at the frame's top**, which is exactly what the
plate contains. Do not add a scroller to any of them. Each advances on a hit
target that is already on screen, so a scroll region would only ever fight the
tap that moves the flow on - and on `addbalance`, where the whole frame is the
target, a drag would swallow it outright.

`addmoney2` (`#223:1574`) is the exception that proves this. It is not a scroll
region: it is the **already-scrolled state**, drawn as its own frame. The card
art is cut off at the top of the frame (its "XYZ" label sits at y=-141, above
the frame edge) because the designer scrolled the panel up to bring the enabled
"Add Money" CTA into view. Export it, do not try to derive it from `addmoney`
by translating anything.

**Inert printed controls (intentional).** These look tappable because they are
painted, and the prototype gives them no destination:

- the eight city rows on `cities` (`#211:6074` … `#211:6130`) - one region over the whole list advances instead, so any city goes to `issuer`;
- the three amount rows on `amount` (`#211:6205`, `#211:6215`, `#211:6225`);
- the `Credit Card 1` and `Debit Card 1` rows on `methods` - drawn genuinely disabled, greyed and washed out, so they read as unavailable rather than as broken;
- `More details` (`#211:6524`), the share-screenshot circle and `UPI Help` on `paid`;
- **four** of the five amount chips on `balance` - `₹300` is the seam and is live; `₹100`, `₹200`, `₹400`, `₹500` and the disabled `Add Money` CTA are not;
- the same four chips on `addmoney` and `addmoney2`, plus the `Add custom amount` field on both - it is drawn with a caret already in it and looks focused, and there is nothing to type into;
- `UPI 2`, `UPI 3`, the card rows, the net-banking and wallet rows and all four `Add new …` tiles on `addmethods` - only the `UPI 1` row is wired;
- `More details`, the share-screenshot circle and `UPI Help` on `addpaid`;
- the five amount chips on `addbalance`.

There is only the one path through this flow, so there is nothing for a
selection to change. `flow-test.mjs` phase 4 taps fourteen of these and asserts
the screen does not move.

**Verify:**

```
node "C:\Users\iamne\Desktop\figma-agent\skill\scripts\visual-diff.mjs"
  --url "http://127.0.0.1:5173/?screen=<name>" --ref .figma/ref/<node>.png
  --width 1080 --height 1920 --guard "TOTD ON-THE-GO Card Flow" --report
```

The guard string lives in `<title>`, not in the body, so it adds no pixels to a
plate-mode screen. Reference exports are in `.figma/ref/`, named by node with
the colon replaced by a dash (`.figma/ref/211-5561.png` for `home`). Measured
`node scripts/diff-all.mjs` runs all twenty-two in one go and finds the dev
server by its guard string rather than assuming a port - vite walks up from
5173 whenever something else holds it, and pointing the diff at a sibling
project has already happened once on this machine.

**Measured, all twenty-two under 0.5%:**

| screen | mismatch | |
|---|---|---|
| nineteen plate screens | **0.000%** | `intro` `terms` `cities` `issuer` `cardstyle` `amount` `methods` `upipin` `success` `paid` `loading` `balance` `addmoney2` `addmoney` `addmethods` `addpin` `addsuccess` `addpaid` `addbalance` |
| `upipin2`, `addpin2` | **0.019%** each | live PIN dots at zero digits vs the printed ones; antialiasing on the ring. Identical figures from one shared component over two different plates, which is the check that the geometry really is shared |
| `home` | **0.131%** | CSS blur approximating Figma's LAYER_BLUR on the two background blobs |

`home` is worth a note: the empty-PIN and at-rest states are the reference
states, so `home` measures 0.130% *while the animation is running* only because
the screenshot lands at t=0, where the stack is identical to the plate by
construction. Mid-cycle roughly 15% of the frame differs, which is the
animation doing its job, not a regression.

Transitions are not covered by the pixel diff - a screen can diff at 0% and do
nothing at all. `scripts/flow-test.mjs` drives all 31 tap transitions plus all
three timed ones in a real browser, walks the whole loop from `home` through both
legs and back round to `home` in one uninterrupted session - entering a PIN by
typing it on each leg - and checks that fourteen of the printed controls above
stay inert. It reads `SCREENS` out of `/src/flow.ts` through the dev server
rather than re-typing the coordinates, so a target added to the flow cannot go
untested, and it reports coverage. **79/79 assertions, 31/31 tap transitions,
3/3 timed, no page or console errors.**

**Trap - do not read the DOM immediately after firing a click in a test.**
React 18 batches state updates raised outside its own event handlers - the
`success` timeout, a `replaceState` landing beside a `setState` - so the
re-render lands a microtask or two later. A real mouse click is usually slow
enough to hide this and an `evaluate()` is not, which surfaces as a test failing
roughly one run in three. `flow-test.mjs` waits for the arrival (`expect`)
rather than asserting on the spot, and gives the timed transition generous
slack. The app is not at fault here and does not need a fix for it.
