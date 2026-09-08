import { Plate } from '../../components/Plate';
import './v2-screens.css';

/**
 * The loading screen, with its ring actually filling.
 *
 * This is the one place V2 does not simply restate V1. V1's loader was a
 * static arc sitting on a grey track (#211:6704 on #211:6703) - two exported
 * layers, and the only honest thing to do with a spinner drawn at rest is to
 * turn it. V2 replaces that with a real progress component: instance
 * #254:19356 of the set #254:839 "Loader", and it is DETERMINATE. Three
 * variants, chained by the designer's own CHANGE_TOs:
 *
 *   Progression=0%   #254:840 --0.05s--> 50%
 *   Progression=50%  #254:846 --0.001s--> 100%   SMART_ANIMATE 1000ms LINEAR
 *   Progression=100% #254:852 --0.05s--> 0%      no transition, an instant snap
 *
 * Both animated legs run 1000ms for half the ring each, so the two of them are
 * one continuous linear ramp and the whole cycle is 2101ms - against the
 * frame's own declared AFTER_TIMEOUT of 2000ms. The fill is sized to the wait:
 * the ring reaches full about a tenth of a second after the app has already
 * left. The app owns that timer; this component only turns.
 *
 * Nothing is exported for it. The loader is two flat colours and a circle -
 * #f2f2f2 track, #189254 progress, innerRadius 0.8 - so the arc is drawn as an
 * SVG stroke rather than as a cropped PNG, and the plate's own track shows
 * through underneath it unaltered. At 0% the screen is the plate exactly.
 */

/* Frame-relative pixels off #254:19323. The loader sits in `Frame 1984080076`
   at (404, 741), 274.809 square, and the ring is that box: Figma's arcData
   gives innerRadius 0.8, so the stroke is the outer fifth of the radius. Both
   were checked against the exported plate - the track band reads x 404..431
   and 651..679 through the centre row, and 741..768 / 989..1016 down the
   centre column, which is this circle to the pixel. */
const SIZE = 274.809;
const CX = 404 + SIZE / 2;          /* 541.405 */
const CY = 741 + SIZE / 2;          /* 878.405 */
const R_OUTER = SIZE / 2;           /* 137.405 */
const THICKNESS = R_OUTER * 0.2;    /* 27.481 - the 0.8 innerRadius */
const R_MID = R_OUTER - THICKNESS / 2;  /* 123.664, the stroke's centre line */

/* #254:846 at 4x says which way it goes: green from twelve o'clock clockwise
   to six o'clock at 50%, and there is no gap at either end. SVG starts a
   circle at three o'clock, hence the quarter turn. */
const ARC_COLOUR = '#189254';

export function LoadingScreen({ plate }: { plate: string }) {
  return (
    <>
      <Plate src={plate} alt="loading" />
      <svg
        className="v2-loading-ring"
        width={1080}
        height={1920}
        viewBox="0 0 1080 1920"
        aria-hidden="true"
      >
        {/* No track element: the plate already paints #f2f2f2 there, at
            Progression=0%, and re-drawing it would put two rings a fraction of
            a pixel apart. `pathLength` normalises the circumference to 100 so
            the keyframes in `v2-screens.css` stay plain numbers and the
            geometry stays in this file. Butt caps, which is Figma's arc. */}
        <circle
          className="v2-loading-arc"
          cx={CX}
          cy={CY}
          r={R_MID}
          pathLength={100}
          fill="none"
          stroke={ARC_COLOUR}
          strokeWidth={THICKNESS}
          strokeDasharray={100}
          strokeDashoffset={100}
          transform={`rotate(-90 ${CX} ${CY})`}
        />
      </svg>
    </>
  );
}
