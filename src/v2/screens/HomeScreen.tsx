import { type ReactNode } from 'react';
import { LayerImg, type Layer } from '../../components/LayerStack';
import { ScrollPanel } from '../components/ScrollPanel';
import './v2-screens.css';

/**
 * Home, rebuilt from its Figma layers instead of one flat plate.
 *
 * The reason is the background, and it is the same reason V1 had: the frame's
 * BOTTOM layer - child index 0, under every other pixel - is an instance of a
 * four-variant component set that smart-animates forever. A plate has already
 * flattened it into the artwork, so the only way to let it move is to separate
 * the layers again and put the animation back underneath them.
 *
 * V2 did not redraw this. #254:1024 and #254:58072 are both instances of
 * `211:941`, both 1080x974.77, both carrying the same two ellipses at the same
 * coordinates in the same overridden colours, and both declare the same
 * AFTER_TIMEOUT 0.2s CHANGE_TO #211:944 SMART_ANIMATE 1.5s that V1 measured.
 * The keyframes in `v2-screens.css` are therefore V1's, unchanged.
 *
 * What DID change is everything on top of it: V2's four upper layers are a
 * full redraw at byte level (light theme, different card art, an Android nav
 * bar) while landing on exactly the same layout boxes. The offsets below are
 * still measured rather than inherited - see the note on them.
 *
 * Only the top 974.77px is decomposed, because that is exactly how tall the
 * animated instance is. Everything below it is one crop of the plate.
 */

/* Offsets are measured, not assumed. Figma exports a node at its full render
   extent, unclipped by the parent frame, so a carousel that runs off the edge
   comes back wider than its layout box AND starts somewhere else: the two
   `Frame 1686562867` carousels export 3709x266 for a 1036x227 box and their
   pixels actually begin at (-2, 466), not (44, 482). Each of these was solved
   by sliding the layer's fully-opaque pixels over the plate and taking the
   offset where they match, exactly as `scripts/solve-offsets.mjs` does for V1;
   the header needs the whole layer sampled rather than a 4000px subset, since
   it carries a baked BACKGROUND_BLUR and its opaque pixels are sparse.

   Both legs solved to identical offsets, which is the check that the redraw
   really did keep V1's layout: (0,784), (-2,466), (44,366), (0,0). */
type HomeArt = { plate: string; alt: string; layers: Layer[]; fixed: Layer[] };

/* The scrolling children of #254:1023 span frame-y 0..4878. Width stays at the
   frame: the carousels run far past the right edge and are clipped there, in
   Figma and here - panning them is their own horizontal region, not this one. */
const HOME_CONTENT_W = 1080;
const HOME_CONTENT_H = 4878;

const ART: Record<'setup' | 'card', HomeArt> = {
  /* #254:1023 - the setup leg. No card has been issued, so the carousel is a
     single "get started" tile. */
  setup: {
    plate: '/v2/screens/home.png',
    alt: 'Home ON-THE-GO entry',
    layers: [
      { node: '254:1028', src: '/v2/layers/254-1028.png', left: 0, top: 784,  width: 1080, height: 1493 },
      { node: '254:1098', src: '/v2/layers/254-1098.png', left: 1, top: 1778, width: 2370, height: 3092 },
      { node: '254:1318', src: '/v2/layers/254-1318.png', left: 0, top: 465,  width: 3709, height: 266 },
      { node: '254:1413', src: '/v2/layers/254-1413.png', left: 44, top: 366, width: 992,  height: 60 },
    ],
    fixed: [
      { node: '254:1420', src: '/v2/layers/254-1420.png', left: -92, top: 1439, width: 2946, height: 560 },
      { node: '254:1499', src: '/v2/layers/254-1499.png', left: 0,   top: 0,    width: 1080, height: 332 },
    ],
  },
  /* #254:58071 - the recharge leg. Same frame, same geometry, same layer
     names; the card already exists and is drawn in the carousel, which is why
     three of the four layers differ from `setup` as pixels and none of them
     differ as boxes. `254-58461` is byte-identical to `254-1413` - the title
     row does not know which leg it is on - and is kept separate anyway so a
     misplaced layer can be traced to the node it came from. */
  card: {
    plate: '/v2/screens/homeCard.png',
    alt: 'Home ON-THE-GO entry, card issued',
    layers: [
      { node: '254:58076', src: '/v2/layers/254-58076.png', left: 0, top: 784,  width: 1080, height: 1493 },
      { node: '254:58146', src: '/v2/layers/254-58146.png', left: 1, top: 1778, width: 2370, height: 3092 },
      { node: '254:58366', src: '/v2/layers/254-58366.png', left: 0, top: 465,  width: 3709, height: 266 },
      { node: '254:58461', src: '/v2/layers/254-58461.png', left: 44, top: 366, width: 992,  height: 60 },
    ],
    fixed: [
      { node: '254:58468', src: '/v2/layers/254-58468.png', left: -92, top: 1439, width: 2946, height: 560 },
      { node: '254:58547', src: '/v2/layers/254-58547.png', left: 0,   top: 0,    width: 1080, height: 332 },
    ],
  },
};

export function HomeScreen({
  variant, children,
}: {
  variant: 'setup' | 'card';
  /* The hit targets that ride inside the panel. The card chip is one of them -
     it is a SCROLLS child of the frame, so it moves with the artwork and its
     target has to move with it. See `homeScrollFix` in `flow.ts`. */
  children?: ReactNode;
}) {
  const art = ART[variant];
  return (
    <div className="layer-clip">
      {/* The frame itself is the scroll region here - VERTICAL_SCROLLING on
          #254:1023 with 4878px of content in a 1920px window - so the panel is
          the whole frame rather than a window inside it. The header and the
          bottom nav bar are the frame's two `scrollBehavior: FIXED` children
          and sit outside it; everything else scrolls, the animated background
          included, because Figma marks it SCROLLS like the rest.

          No content plate: this screen is a composite, not a picture. It passes
          its layers as children and the panel supplies the touch pan, the mouse
          drag, the drag-vs-tap threshold and the reset. */}
      <ScrollPanel
        contentW={HOME_CONTENT_W}
        contentH={HOME_CONTENT_H}
        viewport={{ x: 0, y: 0, w: 1080, h: 1920 }}
        resetKey={variant}
      >
      {/* Two stacked pairs, not one: the closing leg of the loop is a DISSOLVE,
          which cross-fades rather than moves. Pair B holds keyframe 1 and fades
          in under pair A. */}
      <div className="v2-home-bg">
        <div className="v2-home-pair-a">
          <div className="v2-home-blob v2-home-blob-a" />
          <div className="v2-home-blob v2-home-blob-b" />
        </div>
        <div className="v2-home-pair-b">
          {/* Pair B is keyframe 1 and never moves, so it needs no override -
              the base box in `v2-screens.css` already is keyframe 1. */}
          <div className="v2-home-blob v2-home-blob-a" />
          <div className="v2-home-blob v2-home-blob-b" />
        </div>
      </div>

        {/* In the frame's own child order, so the carousel and the title row
            stay above the group they overlap. */}
        {art.layers.map((l) => <LayerImg key={l.node} layer={l} />)}
        {children}
      </ScrollPanel>

      {/* The two FIXED children, over the scrolling content. Both export well
          off-origin - the nav bar comes back 2946px wide with its true left at
          -92 - so both offsets were solved by matching opaque pixels against
          the plate, never read off the layout box. */}
      {art.fixed.map((l) => <LayerImg key={l.node} layer={l} />)}
    </div>
  );
}
