import { Plate } from '../components/Plate';

/**
 * The loading screen, with its ring actually turning.
 *
 * Figma draws this as a static arc sitting on a grey track - #211:6704 on
 * #211:6703 - which is the one thing on the screen that obviously ought to
 * move and the one thing a plate cannot do. The arc is its own node, so it
 * only needs separating and spinning about the track's centre.
 *
 * Unlike the badge screens this one never settles: a loader that stops is a
 * hung loader. That has a cost and it is stated in the adapter - `loading` is
 * the one screen whose pixel diff is not 0.000%, because there is no resting
 * state to measure.
 */

/* Measured render bounds, not layout boxes - the arc's stroke caps push its
   rendered extent 8px outside its box on every side. */
const RING = { left: 433.31, top: 778.1, width: 240, height: 240 };
const ARC = { left: 555.12, top: 777.71, width: 119, height: 121 };
const GLYPH = { left: 490, top: 861, width: 127, height: 75 };

/* The track's centre, expressed relative to the arc's own origin, so the arc
   turns about the ring rather than about itself. */
const ORIGIN_X = RING.left + RING.width / 2 - ARC.left;
const ORIGIN_Y = RING.top + RING.height / 2 - ARC.top;

export function LoadingScreen() {
  return (
    <>
      <Plate src="/screens/loading.png" alt="loading" />
      {/* The plate's own static ring, covered in the screen's flat white. */}
      <div className="loading-patch" style={RING} />
      <img className="layer" src="/layers/211-6703.png" alt="" draggable={false} style={RING} />
      <img
        className="layer loading-arc"
        src="/layers/211-6704.png"
        alt=""
        draggable={false}
        style={{ ...ARC, transformOrigin: `${ORIGIN_X}px ${ORIGIN_Y}px` }}
      />
      {/* Drawn after the ring in Figma, so it goes back on top of it here. */}
      <img className="layer" src="/layers/211-6705.png" alt="" draggable={false} style={GLYPH} />
    </>
  );
}
