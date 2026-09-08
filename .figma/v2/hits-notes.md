# V2 interaction map - derivation notes

Companion to `.figma/v2/hits.json`. Everything below comes from
`.figma/v2/edges.json`, `.figma/v2/states.json` and the raw node dump of
section `#254:858`. 2064 declared edges collapse to **13 templates, 68 distinct
hit boxes and 42 inert boxes**.

## Frame -> template

| template | Figma frame name | frames | edges |
|---|---|---:|---:|
| unlocked | Device Unlocked | 1 | 2 |
| home / homeCard | Home ON-THE-GO entry (`254:1023` / `254:58071`) | 2 | 6 |
| intro / introAccepted | Introduction to ON-THE-GO (+ accept terms) | 2 | 8 |
| issuer | Choose card issuer | 1 | 6 |
| amount | Amount details | 22 | 220 |
| methods | All Payment methods | 45 | 135 |
| pin | UPI PIN verification | 360 | 1080 |
| success | Success enabled | 45 | 135 |
| paid | Payment successful | 45 | 135 |
| loading | Loading | 15 | 45 |
| balance | Card balance and add money | 76 | 292 |

614 frames, 2064 edges, both accounted for. Note the Card balance frame name has
a **trailing space** (`"Card balance and add money "`) - match on a trimmed name.

## Invariance checks that were run, and what they returned

Method: for every template, group its frames by the sorted set of
`name|left,top,width,height|trigger` over all its declared edges, then compare
groups. Then separately group by the *printed* geometry of the controls
(chips, CTA, keypad, dots) taken from the node dump, to catch controls that are
painted but unwired.

- **pin, 360 frames -> 1 geometry.** Keys at `x ∈ {102,401,700}`,
  `y ∈ {1169,1307,1445,1584}`, `277x116`; dots `44x44` at `y=854`,
  `x ∈ {294,383,471,560,649,737}`. Identical on all 360. Only the *wired* key
  moves, one per storyboard step.
- **success, 45 -> 1.** `Dark` 50ms CHANGE_TO + whole-frame 1850ms + home button.
- **loading, 15 -> 1.** `Loader` 50ms CHANGE_TO + whole-frame 2000ms + home button.
- **methods, 45 -> 2.** Identical except a 10px x offset: the wired
  `UPI 1` row is `34,411,991,191` on the 15 frames entered from `amount`
  (`254:16395`) and `44,411,991,191` on the 30 entered from `balance`
  (`254:46980`). Same for the whole list beneath it.
- **paid, 45 -> 2.** `Home` CTA is `557,1623,479,155` on all 45. `More details`
  is `366,1060,349,98` on the 15 first-payment frames and `366,1171,349,98` on
  the 30 top-up frames.
- **amount, 22 -> 1 geometry.** Chips at `y=1982`,
  `x ∈ {78,265,458,653,848}`, widths `147,153,155,155,154`, height 102, on all
  22. The CTA is `44,2718,991,155` on all 22 but is *wired* on only 17. The six
  edge signatures differ only by which chip has had its edge dropped (a chip
  loses its edge when it is the current selection).
  One outlier: on `254:4043` (RBL, Rs500) the scroll viewport is `1494` tall,
  not `1490`. 4px, cosmetic.
- **balance, 76 -> 4 geometries** - the chip-row question, below.

## 1. PIN

Wired: **twelve** key cells, `277x116`, columns `102 / 401 / 700` (pitch 299),
rows `1169 / 1307 / 1445 / 1584` (pitch 138, last row 139). Labels from the
node dump: `1 2 3 / 4 5 6 / 7 8 9 / <blank> 0 Next`. The bottom-left cell is a
`Key / Function` (`254:14197`) and carries **no interaction on any of the 360
frames** - it is the only inert key. Submit is `Group 12934` at
`700,1584,277,116` (`254:14207`), labelled "Next", and it is the only key that
navigates (to `success`).

The keypad block is `102,1169,875x532` (`254:14192`) inside a sheet at
`-1,1125,1080x665` (`254:14191`). Dots: six `44x44` ellipses at `y=854`,
`x = 294, 383, 471, 560, 649, 737` (pitch 88.6), `#D9D9D9` empty ->
`#26387E` filled, prompt "Enter your UPI PIN" at `341,734,393x54`.

The 360 frames are **8 steps x 45 payment contexts**. The wired key per step
is `1 -> 2 -> 3 -> 4 -> 5 -> 6`, i.e. the designer types `123456`:

| step | frame | wired key | box | node |
|---|---|---|---|---|
| 0 | `254:4833` | 1 | 102,1169 | `254:4849` |
| 1 | `254:6168` | 2 | 401,1169 | `254:6189` |
| 2 | `254:7503` | 3 | 700,1169 | `254:7529` |
| 3 | `254:8838` | 4 | 102,1307 | `254:8855` |
| 4 | `254:10173` | 5 | 401,1307 | `254:10195` |
| 5 | `254:11508` | 6 | 700,1307 | `254:11535` |
| 6 | `254:12843` | - | AFTER_TIMEOUT 400ms | -> `254:14178` |
| 7 | `254:14178` | Next | 700,1584 | `254:14207` -> `254:4158` |

**The 400ms is not what the contract says it is.** All six dots are already
`#26387E` on `254:12843`, the 6th-digit frame. Diffing `254:12843` against
`254:14178` node-for-node (132 vs 132 nodes, identical tree and identical
geometry) the only changes are: the "6" key reverts from the pressed fill
`#26387E` to white with dark text, and `Group 12934` swaps to its enabled
state. So the dwell **releases the pressed key and arms Next**; it does not
fill anything.

`pin` has no `55x55` back arrow. Its back is the sheet's close X at
`948,66,66,66` (`254:4897`), declared on all 360 frames, always to `methods`.

## 2. Timed transitions - every AFTER_TIMEOUT in the file

167 AFTER_TIMEOUT edges, seven distinct declarations:

| where | node | ms | nav | destination | count |
|---|---|---:|---|---|---:|
| success, whole frame | `254:4158` | **1850** | NAVIGATE | `paid` | 45 |
| loading, whole frame | `254:19323` | **2000** | NAVIGATE | `balance` | 15 |
| pin, whole frame | `254:12843` | **400** | NAVIGATE | `pin` (step 7) | 45 |
| home background | `254:1024` | 200 | CHANGE_TO, SMART_ANIMATE 1.5s | variant | 1 |
| homeCard background | `254:58072` | 200 | CHANGE_TO, SMART_ANIMATE 1.5s | variant | 1 |
| success tick (`Dark`) | `254:4180` | **50** | CHANGE_TO, SMART_ANIMATE 1.4s | variant | 45 |
| loading ring (`Loader`) | `254:19356` | **50** | CHANGE_TO, SMART_ANIMATE 1.0s | variant | 15 |

The last two are not in the contract's timing table. They are the animation
kick-offs, not screen changes - the tick draw-on and the arc rotation - and
they are what `LoadingScreen`/the success tick should be retimed against
(1000ms and 1400ms respectively, after a 50ms delay). The `loading -> balance`
NAVIGATE also declares a SMART_ANIMATE transition of 1022ms.

## 3. Balance arithmetic, the cap, and the dead ends

Rule, read off `states.paid` -> `states.balance` through every wired edge:

```
first payment (setup):  pay 50 + a   ->  balance = a         a in 100..500
top-up:                 pay a        ->  balance = balance + a
recharge leg:           card holds 50; pay a -> balance = 50 + a
```

The Rs50 is the issuance fee and is **not loaded onto the card** - paying Rs150
(`254:15513`) lands on balance Rs100 (`254:21023`), not Rs150.

Reachable balances: `50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550,
600, 700, 800, 900, 1000` - **16 distinct values**, not the 11 the contract's
state-space sentence implies. Highest is Rs1000 (`254:24000`), from Rs500
first payment + Rs500 top-up.

**The Rs1000 "cap" is an enumeration depth, not a rule.** Every Card balance
plate prints its own headroom, and it is always `2000 - balance`:

| frame | balance | printed |
|---|---:|---|
| `254:19983` | 100 | "You can only add Rs1,900 more to your card" |
| `254:51900` | 50 | "…Rs1,950 more" |
| `254:52413` | 550 | "…Rs1,450 more" |
| `254:24000` | 1000 | "…Rs1,000 more" |

All 22 Amount details plates print "Rs2,000 more" (balance 0). So the card's
own stated ceiling is **Rs2000**; Rs1000 is simply as far as the designer
enumerated - exactly one top-up from the largest first payment.

**What an implementation should do at the cap:** compute `balance + amount`,
offer only chips `<= 2000 - balance`, and disable `Add Money` when the headroom
reaches 0. Do not clamp at 1000 - the artwork would contradict the app the
moment the user reached it.

**The "no chip edges" frames are unwired, not designed dead ends.** 40 of the
76 balance frames declare nothing but the home button. They print the chips,
the `Add Money` CTA (`254:20076`, `254:21620`) and even the back arrow
(`254:20070`, `254:21614`) with no interactions at all. That they are an
oversight rather than a decision is provable: balance Rs200 is dead on
`254:20191` and `254:21528` and fully live on `254:21124`. The split:

- **10 first-payment landings** reached from `loading`. These are exactly the
  IOB and RBL branches: `loading` sends Pine Labs to the wired frames
  (`254:21023 / 21124 / 21225 / 21326 / 21427`) and IOB/RBL to dead ends
  (`254:19983…20815` IOB, `254:20087…20919` RBL). **The whole top-up loop is
  wired for Pine Labs only.**
- **30 post-top-up landings** reached from `paid`. Every one is a dead end, so
  the prototype allows exactly one top-up and then stops.

The app should map every `{leg, balance}` onto the `unselected` / `selected`
variants and never build the landing frames.

## The chip row: two positions, and which is which

`states.json` records `chipTop` 1624 (unselected, chips wired) and 1142
(selected). Both are confirmed and both are invariant:

| variant | frames | chip y | chip x | scroll |
|---|---:|---:|---|---|
| unselected (wired) | 6 | **1624** | 77, 264, 457, 653, 848 | `254:21024` `Frame 1984080057`, viewport `44,299,991x1350`, scrollTop 0 |
| selected (wired) | 30 | **1142** | 77, 265, 458, 653, 848 | none - pre-scrolled |
| landing from `loading` | 10 | 1605 | 77, 264, 458, 653, 848 | `254:19984`, viewport `44,299,991x1313` |
| landing from `paid` | 30 | 1598 | 77, 264, 458, 653, 848 | `254:21529`, viewport `44,299,991x1360` |

**1142 is a scroll offset, not a moved component.** Comparing the panel subtree
of `254:21023` (unselected) with `254:24103` (selected) by tree path: 41 nodes
each, 37 matched by path and name, and the dy histogram over those 37 is
`{-483: 30, -482: 7}` - a single uniform shift, with identical names, sizes and
child order. `1624 - 1142 = 482`. Confirming details: the card art
`Frame 1984079982` sits at `44,299` unselected and at `45,-184` selected, above
the frame edge; and the selected frames carry **no `overflowDirection` node at
all** - the designer scrolled the panel and flattened it.

So the renderer keeps one chip row and scrolls the panel by **482**. It must
not move the row. This is also why the unselected variant has no `Add Money`
edge: the CTA is printed at content y 1623 (`254:21088`), below the viewport
bottom at 1649, so it is simply off-screen until the panel scrolls.

The two landing chip rows (1605, 1598) differ because of the "Updated 3h ago"
line; they are inert and should be ignored.

## 4. Amount arithmetic

`total = 50 + selected`, confirmed on all 18 states in `states.amount` **and**
on the four orphans, by reading the "Total Amount" text out of each plate:

| selected | null | 100 | 200 | 300 | 400 | 500 |
|---|---|---|---|---|---|---|
| total | Rs50 | Rs150 | Rs250 | Rs350 | Rs450 | Rs550 |

The CTA is `Pay Amount` at `44,2718,991,155`. It is **enabled by
`amount !== null`** and by nothing else: it is declared on the 17 frames that
carry a selection and printed disabled (`254:1687`) on the 5 that do not. The
issuer choice does not gate it. Selecting a second chip replaces the first
(each chip navigates to the frame for that amount); the currently-selected chip
has its edge removed, so re-tapping it is a no-op.

## Global controls

- **Home** `123x123`, `to: unlocked`, on 612 of 614 frames. Declared at
  `479,1793` on 568, `479,1794` on 70 (the 40 landing + 30 selected balance
  frames), `479,1797` on `254:860`. Use 1793. The only frame without it is
  `254:51878` (`unlocked`) itself.
- **Back** `55x55` at `44,182` on 104 frames, `44,183` on `intro` (`254:1014`)
  and `introAccepted` (`254:933`). Absent from `unlocked`, `home`, `homeCard`,
  `success`, `paid`, `loading`, and printed-but-dead on the 40 landing balance
  frames. `pin` uses the close X instead.

Back targets: `intro -> home`, `introAccepted -> home`, `issuer ->
introAccepted`, `amount -> issuer` (all 22), `methods -> amount` (15) or
`balance/selected` (30) depending on entry, `balance -> home` (30, setup) or
`homeCard` (6, recharge), `pin -> methods` via the X.

## Inert - declared boxes with a null destination

89 edges declare `ON_CLICK` with no destination. All four are decorative rows:

| template | node | box | label |
|---|---|---|---|
| amount x22 | `254:1644` | `78,1493,925,155` | Issuance Fee / Rs50 |
| amount x22 | `254:1680` | `78,2545,925,116` | Total Amount |
| paid x15 | `254:15538` | `366,1060,349,98` | More details |
| paid x30 | `254:45553` | `366,1171,349,98` | More details |

## Inert - printed controls with no interaction at all

Listed in full in `hits.json`; the flow test should tap these and assert
nothing moves.

- **unlocked**: the Card Issuance tile *body* `260,1191,271x298` (`254:51887`).
  Only its `164x164` logo is wired, while the sibling Balance Recharge tile is
  wired across its whole `271x298`. Asymmetric - the build should use the full
  tile for both.
- **intro**: `Buy your RuPay ON-THE-GO card` `44,1623,991x155` (`254:978`) -
  the CTA exists on the un-accepted frame but is unwired; `See all the
  supported cities` (`254:966`).
- **issuer**: `More issuers coming soon` `44,1383,991x62` (`254:1585`).
- **amount**: `Add custom amount` label (`254:1673`) and its field
  (`254:1675`), drawn with a caret already in it; the disabled `Pay Amount`
  (`254:1687`).
- **methods**: ten rows - `UPI 2`, `UPI 3`, `Add new Credit on UPI account`,
  `Credit Card 1`, `Debit Card 1`, `Add new RuPay card`, `Bank 1` (net
  banking), `Add new bank account`, `Bank 1` (wallet), `Add new bank account`.
  Only the `UPI 1` row is wired, on all 45.
- **pin**: the blank `Key / Function` at `102,1584` (`254:14197`).
- **paid**: `UPI Help` `44,1623,479x155` (`254:15559` / `254:45574`),
  `Share screenshot` (`254:15531` / `254:45546`).
- **balance**: `View Card Details`, `Refresh`, `Add custom amount` and its
  field on both wired variants; plus everything on the 40 landing frames.

## Contradictions with `docs/v2-build.md`

1. **The 400ms is not "-> filled state".** The dots are already filled on
   `254:12843`. The dwell releases the pressed "6" key and arms `Next`
   (`Group 12934`, `254:14207`). Node-for-node the two frames are otherwise
   identical.

2. **The orphan Amount frames are not all "Rs100 selected".** The contract
   calls `254:1743`, `254:1858`, `254:2318`, `254:2433` "duplicate Rs100
   selected screens for IOB and RBL, wired from nothing". In fact `254:1743`
   (IOB) and `254:1858` (RBL) are duplicate **unselected** screens - total
   Rs50, no chip selected, no wired CTA - and they are the only two frames in
   the whole section with **no incoming edge**. `254:2318` and `254:2433` are
   the Rs100-selected duplicates, and they *are* wired: from `254:1743` and
   `254:1858` respectively. The cluster is two 2-frame branches hanging off the
   graph, not four loose frames.

3. **"In-setup top-up receipts always read Paid to Pine Labs (35 of 40)" is the
   wrong count and the wrong reason.** `states.paid` splits 15 first-payment
   receipts that name the real issuer correctly (5 Pine Labs, 5 Indian Overseas
   Bank, 5 RBL Bank) + 25 in-setup top-up receipts, **all** Pine Labs + 5
   recharge receipts, Pine Labs, which is correct for that leg. So it is 25 of
   25, not 35 of 40. The cause is that the top-up loop has no issuer dimension
   at all - `loading` routes IOB and RBL into dead ends and only the Pine Labs
   branch reaches a wired balance frame.

4. **"balance caps at Rs1000" contradicts the artwork.** Every plate prints
   `headroom = 2000 - balance`, including `254:24000` at balance Rs1000, which
   still says "you can only add Rs1,000 more". Rs1000 is the enumeration
   ceiling, not the cap. See section 3.

5. **The methods scroll viewport `34,333,991,1587` mixes the two variants.**
   `1587` belongs to `254:46975` on the 30 `fromBalance` frames, whose x is
   `44`, not `34`. The 15 `fromAmount` frames have an inner container that is
   as tall as its content (`34,333,991x2751`) and it is the **root frame** that
   scrolls there. Content extent is `2751` (bottom frame-y 3084) for both.
   Related: the contract says All Payment methods is "1 unique plate (all
   identical)" - the plate may be, but the wired hit box is not, it moves 10px.

6. **The state space "3 issuers x 5 amounts x 11 balances x 7 PIN lengths"
   under-counts on two axes.** `states.balance` carries 16 distinct balance
   values, not 11 (the recharge landings 150/250/350/450/550 are missing from
   any 11-value reading), and the PIN family is 8 steps, not 7 (six digit
   presses, the dwell frame, and the armed-Next frame - 8 x 45 = 360).

7. **The Card balance family has a third plate dimension the contract and
   `states.json` do not record: issuer card art.** `IOB-GPAY CODT`,
   `RBL-GPAY CODT` and `Pinelabs-GPAY CODT` all appear. IOB and RBL art is on
   the 10 first-payment landing frames only; all 36 wired frames are Pine Labs.
   If the build carries the real issuer through to the balance screen (as the
   contract's own "known slips" section asks it to), it needs the IOB and RBL
   card art, and those two only exist on frames that are otherwise dead.

8. **Two declared timings are missing from the timings table** - the 50ms
   CHANGE_TO on `Dark` (`254:4180`, SMART_ANIMATE 1.4s) and on `Loader`
   (`254:19356`, SMART_ANIMATE 1.0s). These are the designer's own animation
   durations for the tick and the ring, and the ported `LoadingScreen` should
   use 1000ms rather than a guess.

## Measured scroll geometry (union of descendant bounds)

| family | container | viewport (x,y,w,h) | content (x,y,w,h) | bottom |
|---|---|---|---|---|
| Amount details | `254:1629` | 0,299,1080,1490 | 0,299,1080,**2716** | 3015 |
| Card balance, unselected | `254:21024` | 44,299,991,1350 | 32,282,1016,**1881** | 2163 |
| Card balance, selected | none | 44,299,991,1350 | pre-scrolled 482 | - |
| Card balance, landing (loading) | `254:19984` | 44,299,991,1313 | 32,282,1016,1861 | 2143 |
| Card balance, landing (paid) | `254:21529` | 44,299,991,1360 | 32,282,1016,1854 | 2136 |
| All Payment methods, fromAmount | `254:16390` (root scrolls) | 34,333,991,2751 | 34,333,991,**2751** | 3084 |
| All Payment methods, fromBalance | `254:46975` | 44,333,991,1587 | 44,333,991,**2751** | 3084 |
| Introduction (both) | `254:942` / `254:861` | 0,304,1080,1249 | 0,304,1080,**1668** | 1972 |
| Home carousel | `254:1319` / `254:58367` | 44,482,1036,177 | 44,479,**3620**,253 | - |
| Home, vertical | `254:1023` / `254:58071` | 0,0,1080,1920 | -432,0,4095,**4878** | 4878 |

`Amount details` is the case the contract warns about and it checks out: the
container's own child `Frame 1984080072` reports `1080x1800` (bottom 2099), but
`Frame 1984080086` is 1666 tall at y=1349 and the Pay CTA sits at y=2718, so the
true extent is 299..3015. Every `scrolled: true` flag in `hits.json` was set by
walking ancestry, not by comparing `top` against 1920 - which is why the CTA at
2718 and the chips at 1982 are both marked scrolled while the home button at
1793 and the back arrow at 182 are not.

Home also has two further horizontal carousels below the fold (`254:1151`
`43,1902,994x408` content 2530 wide; `254:1102` `44,3622,991x493` content 1746
wide). Neither carries a wired box.
