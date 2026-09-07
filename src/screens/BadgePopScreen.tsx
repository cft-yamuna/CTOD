import { useEffect, useState } from 'react';
import { Plate } from '../components/Plate';

/**
 * A plate with one badge animated on it, and nothing else touched.
 *
 * Used wherever a screen's only motion is the round check badge - which is
 * three of them, across both flows. Rather than decompose those frames into
 * layers, the plate stays the base and only the badge's own box is rebuilt:
 * a patch of the layer that sits behind it, to hide the badge the plate
 * already draws, and the animated badge over that. Ten static layers left
 * alone are ten layers that cannot be misaligned.
 *
 * The plate is handed back once the motion is over, so the resting screen is
 * the exported frame pixel for pixel.
 */

export type Box = { left: number; top: number; width: number; height: number };

/** Just past the badge's own timing (780ms scale, +400ms tick where present). */
const SETTLE_MS = (hasTick: boolean) => (hasTick ? 1220 : 900);

export function BadgePopScreen({
  plate, badge, tick, box, bg,
}: {
  plate: string;
  badge: string;
  /** Present only where the tick fades in separately from the rosette. */
  tick?: string;
  box: Box;
  /** The layer behind the badge, and where it sits in the frame. */
  bg: { src: string; left: number; top: number; width: number; height: number };
}) {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    setSettled(false);
    const t = setTimeout(() => setSettled(true), SETTLE_MS(!!tick));
    return () => clearTimeout(t);
  }, [plate, tick]);

  return (
    <>
      <Plate src={plate} alt="" />
      {!settled && (
        <>
          {/* Shows the pixels that were underneath the badge, by offsetting the
              background layer by the badge's own origin. */}
          <div className="badge-patch" style={box}>
            <img
              src={bg.src}
              alt=""
              draggable={false}
              style={{
                position: 'absolute',
                left: bg.left - box.left,
                top: bg.top - box.top,
                width: bg.width,
                height: bg.height,
              }}
            />
          </div>
          <img className="layer success-badge" src={badge} alt="" draggable={false} style={box} />
          {tick && <img className="layer success-tick" src={tick} alt="" draggable={false} style={box} />}
        </>
      )}
    </>
  );
}
