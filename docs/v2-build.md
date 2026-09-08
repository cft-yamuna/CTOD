# V2 build contract

Figma file `jk3u8GQ1wxKd3Ge5hEPLaJ`, section **`#254:858` "SCALED UP FINAL
PROTOTYPE- V2"**. 614 frames, 610 reachable, 2064 declared edges. This document
is the contract every agent working on V2 builds against. V1 stays untouched in
`src/` — V2 lives in `src/v2/` and `public/v2/`.

## Why V2 is not V1

V1 was 22 frames, one linear path, one plate per screen. V2 is the same thirteen
screens **enumerated across a state space**: 3 issuers x 5 amounts x 16 balances
x 8 PIN steps. 614 frames is that product, not 614 designs.

So V2 keeps plate mode - the artwork is still the design, nothing is redrawn in
DOM - but a plate is chosen by **state**, not by screen name. The state is:

```ts
type Flow = { leg: 'setup' | 'recharge'; issuer: Issuer; amount: number | null;
              balance: number; }
```

Unique plates, measured from the prototype (`.figma/v2/states.json`):

| family | frames in Figma | unique plates |
|---|---|---|
| Amount details | 18 (+4 orphans) | **18** = 3 issuers x (none + 5 chips) |
| Payment successful | 45 | **25** = bank x amount |
| Card balance | 76 | **51**, over THREE dimensions - issuer, balance, selection |
| All Payment methods | 45 | **1** (all identical) |
| UPI PIN | 360 | **1** (live pad on top, as V1) |
| Success enabled | 45 | **1** |
| Loading | 15 | **1** |
| statics (unlocked, home x2, intro x2, issuer) | 6 | **6** |

~104 plates, not 614.

## The flow

```
Device Unlocked #254:51878
  |- Card Issuance   -> home      #254:1023  (setup leg)
  '- Balance Recharge-> homeCard  #254:58071 (recharge leg, card already holds Rs50)

setup:    home -> intro #254:941 -> introAccepted #254:860 -> issuer #254:1550
          -> amount(issuer) -> [chip] -> amount(issuer, amt) -> methods
          -> pin -> success -> paid(bank, 50+amt) -> loading -> balance(amt)
recharge: homeCard -> balance(50) -> [chip] -> balance(50, amt) -> methods
          -> pin -> success -> paid(Pine Labs, amt) -> balance(50+amt)
top-up:   balance(b) -> [chip] -> balance(b, amt) -> methods -> pin -> success
          -> paid -> balance(b+amt)          one top-up, then the artwork stops
```

Every screen carries two global controls, both from the prototype:

- **Home button** `123x123 @(479,1793)` -> Device Unlocked. On every frame.
- **Back arrow** `55x55 @(44,182)` -> previous screen. On most frames.

## Timings (the designer's own, all declared)

| screen | trigger | ms |
|---|---|---|
| PIN, after the 6th digit | AFTER_TIMEOUT -> arms Next | **400** |
| Success enabled | AFTER_TIMEOUT -> Payment successful | **1850** |
| Loading | AFTER_TIMEOUT -> Card balance | **2000** |
| home background | CHANGE_TO, 4 variants | 200, animating over 1500 |
| success tick `254:4180` | CHANGE_TO | 50, animating over 1400 |
| loading ring `254:19356` | CHANGE_TO | 50, animating over 1000 |

V1's 2600ms on `loading` was ours and is **replaced** by the declared 2000ms.

## Scrolling - the real change

Five families are genuine scroll regions with FIXED chrome. The plate is
**taller than the frame** and scrolls inside a viewport, with header and footer
composited over it:

| screen | viewport (x,y,w,h) | content |
|---|---|---|
| Amount details | 0,299,1080,1490 | frame-y **299..3015**, i.e. **2716** tall |
| Card balance | 44,299,991,1350 | measure |
| All Payment methods | 34,333,991,1587 | measure |
| Introduction (both) | 0,304,1080,1249 | measure |
| Home | horizontal carousel `1036x177 @(44,482)` | measure |

**Trap - the scroll container's own box under-reports its content.** On Amount
details the scroll child `Frame 1984080072` reports 1080x**1800**, which would
put its bottom at frame-y 2099 - but its own descendant `Frame 1984080086` is
1666 tall at y=1349 and the "Pay" CTA `Frame 1686562600` sits at **y=2718**,
well past that. The auto-layout box is not the content extent. **Measure the
content as the union of descendant bounding boxes**, never off the container's
own height, or every CTA in the flow ends up unreachable.

The export side is unaffected and confirms it: Figma exports a node unclipped
by its parent, so exporting the scroll container yields the true full-height
content. Export first, then take the content height from the exported PNG.

Each family exports as **chrome once** (background + fixed header + fixed
footer, transparent where the scroll shows through) and **content per state**.
Never re-export chrome per state.

## Live, not photographed

Four things carry state a plate cannot hold. Everything else is a plate.

1. **UPI PIN** - real typing on the real keypad, six digits, then the 400ms
   dwell, then Next -> Success. Port `src/screens/UpiPinScreen.tsx`. The
   prototype's 360 keystroke frames are a storyboard of typing and are not built.
2. **Loading ring** - the arc rotates over the static track. Port
   `src/screens/LoadingScreen.tsx`, retime to 2000ms.
3. **Home background** - the 4-variant component set that smart-animates.
   Port `src/screens/HomeScreen.tsx` against V2's home frames.
4. **Scroll position** - see above.

**Never render live text over a plate.** Every rupee figure, bank name and
balance is already in the artwork; the plate is selected by state instead.

## Layout

```
src/v2/flow.ts              state machine, screen table, hit boxes
src/v2/App.tsx              renderer, entry
src/v2/components/          Stage, Plate, ScrollPanel, HitTarget
src/v2/screens/             PinScreen, LoadingScreen, HomeScreen
public/v2/screens/          per-state plates
public/v2/chrome/           per-family fixed chrome
.figma/v2/states.json       the state inventory (generated, authoritative)
.figma/v2/plates.json       plate manifest, written by the export pass
```

Stage stays 1080x1920 with the V1 scaling rule. `?screen=` and `?mode=mouse`
keep working.

## The balance rule, and where the artwork stops

```
first payment (setup):  pay 50 + a  ->  balance = a       the Rs50 fee is NOT loaded
recharge leg:           card holds 50; pay a -> balance = 50 + a
top-up:                 pay a       ->  balance = balance + a
```

Paying Rs150 lands on a balance of Rs100, not Rs150 - the fee buys the card, it
does not go onto it.

**The ceiling is Rs2000, not Rs1000.** Every balance plate prints its own
headroom as `2000 - balance`, and every amount plate prints "Rs2,000 more" at a
zero balance. Rs1000 is simply as far as the designer enumerated - exactly one
top-up from the largest first payment. So the app offers chips up to the printed
headroom and never clamps at 1000, which would put it in contradiction with the
copy on its own artwork.

**The prototype draws one top-up and then stops.** 40 of the 76 balance frames
print chips, a CTA and a back arrow with no interactions behind any of them.
They are the `landing` variant, and there are two ways to reach one: after a
top-up, or on a first payment with IOB or RBL - **the top-up loop is wired for
Pine Labs only.** The app uses the landing artwork in exactly those cases, so it
never offers a control the design refuses. Nothing dead-ends: the global home
button is on all 614 frames and is the way out.

## Card balance has three variants, not two

| variant | frames | chips at | how it is rendered |
|---|---:|---:|---|
| `unselected` | 6 | y 1624 | scroll panel, scrollTop 0 |
| `selected` | 30 | y 1142 | **pre-scrolled flat artwork** - a plain plate, no panel |
| `landing` | 40 | y 1605/1598 | plain plate, every control inert |

y 1142 is a **scroll offset, not a moved component**: 37 matched nodes shift by a
uniform 482px and the selected frames carry no `overflowDirection` node at all.
The designer scrolled the panel and flattened it. So the renderer must never
move the chip row - it either scrolls the panel or shows the flattened artwork.

## Known designer slips - reproduce or fix, but do it knowingly

- **4 orphan Amount frames.** `#254:1743` and `#254:1858` are the unselected
  IOB/RBL duplicates and are the only two frames in the file with no incoming
  edge; `#254:2318` and `#254:2433` are their Rs100-selected states, wired from
  them. Not built.
- **The top-up loop has no issuer dimension at all.** All 25 receipts are the
  ones the designer drew; `loading` sends IOB and RBL into landing frames. The
  build carries the real issuer through, so a receipt always names the bank that
  was chosen - and for the 20 top-up receipts that were never drawn
  (`paid-iob-*-setup` and the IOB/RBL recharge siblings) that has to be made
  true rather than assumed. `screenFor` borrows the Pine Labs receipt for the
  same figure and the same leg, and `bankNameFor` pastes rows 360-405 out of the
  issuer's own first-payment receipt back over it - full width and opaque, so it
  replaces "Paid to Pine Labs" rather than sitting on top of it. Composited over
  `paid-pinelabs-300-setup` the IOB strip reproduces `paid-iob-350`'s own band
  with zero differing pixels. Before this the state named a plate that does not
  exist, Vite answered the missing PNG with index.html, and the receipt came up
  blank.
- **Scroll content does not start at the viewport origin.** On Card balance the
  content box is `contentX 32, contentY 282` against a viewport at `44,299`.
  Assuming they coincide puts every target in the region 12-17px out.
