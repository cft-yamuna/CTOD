import { useEffect, useState } from 'react';
import type { Still } from '../flow';

/**
 * The selected artwork, painted into the panel it belongs to.
 *
 * The balance screen's selection is a flattened frame - see `selectionStill` -
 * and this is where it goes: a window at the content rows those pixels
 * describe, clipped exactly as the panel clips, riding inside the scrolling
 * content so it moves with the page instead of replacing it. Selecting a chip
 * changes what is drawn and nothing else; the page does not move a pixel.
 *
 * It fades, both ways. A selection appearing is the one thing on this screen
 * the customer needs to SEE happen, and a still that cuts in over identical
 * artwork reads as a flash rather than as a chip lighting up. 140ms, the same
 * beat `CrossfadeImage` uses on the amount screen, so the two money screens
 * answer a tap the same way.
 */

const FADE_MS = 140;

const STYLE_ID = 'v2-still-style';
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent =
    '.v2-still{position:absolute;overflow:hidden;pointer-events:none}' +
    '.v2-still img{position:absolute;display:block;pointer-events:none;' +
    '-webkit-user-select:none;user-select:none}' +
    `.v2-still-in{animation:v2-still-in ${FADE_MS}ms linear}` +
    `.v2-still-out{animation:v2-still-out ${FADE_MS}ms linear forwards}` +
    '@keyframes v2-still-in{from{opacity:0}to{opacity:1}}' +
    '@keyframes v2-still-out{from{opacity:1}to{opacity:0}}';
  document.head.appendChild(style);
}

export function SelectionStill({ still }: { still?: Still }): JSX.Element | null {
  /* Derived during render, not in an effect: a still that is cleared has to be
     held on screen from the very frame it goes, or the fade has nothing to fade
     and the selection vanishes in one frame - the cut, back again. */
  const [shown, setShown] = useState<{ still?: Still; leaving: boolean }>({ still, leaving: false });
  if (still?.src !== shown.still?.src) {
    if (still) setShown({ still, leaving: false });
    else if (!shown.leaving) setShown({ still: shown.still, leaving: true });
  }

  useEffect(() => {
    if (!shown.leaving) return;
    const t = window.setTimeout(() => setShown({ still: undefined, leaving: false }), FADE_MS);
    return () => window.clearTimeout(t);
  }, [shown.leaving]);

  const s = shown.still;
  if (!s) return null;
  return (
    <div
      className={`v2-still ${shown.leaving ? 'v2-still-out' : 'v2-still-in'}`}
      style={{ left: s.window.left, top: s.window.top, width: s.window.width, height: s.window.height }}
    >
      <img
        src={s.src}
        alt=""
        draggable={false}
        style={{ left: s.left, top: s.top, width: s.width, height: s.height }}
      />
    </div>
  );
}
