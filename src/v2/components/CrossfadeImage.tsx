import { useEffect, useRef, useState } from 'react';

/**
 * One artwork replacing another, with no frame where neither is on screen.
 *
 * Two images stacked in the same box: the incoming one underneath, the
 * outgoing one over it, and the outgoing one is not removed until the incoming
 * one has actually loaded - then it fades, and what is under it is already
 * painted. A plain <img src=...> swap cannot do this at all: there is exactly
 * one bitmap, and between dropping the old and decoding the new there is
 * nothing to show. That gap is the flicker on the amount chips.
 *
 * DOM ORDER IS LOAD-BEARING, twice over. The incoming image is first, so it is
 * what `querySelector('img')` finds - the flow harness identifies a screen by
 * the src of the first image in the panel, and putting the outgoing one first
 * would report the screen the user has just left. Painting order then comes
 * free: a later sibling with no z-index paints on top, which is where the
 * outgoing image has to be for the dissolve to read the right way round.
 *
 * `group` is the screen the image belongs to. Within a group - the same screen
 * redrawing itself, which is what selecting a chip is - the change dissolves.
 * Across groups it cuts, because a dissolve between two different screens is a
 * transition the prototype does not declare, and inventing one would put this
 * app's own motion into a flow whose timings were all measured off Figma.
 */

/** Long enough to read as a change of state, short enough not to be a wipe. */
const FADE_MS = 140;

const STYLE_ID = 'v2-crossfade-style';
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent =
    /* The outgoing copy: never interactive, and never in the accessibility
       tree - the hit targets belong to the state that is arriving. */
    '.v2-crossfade-out{pointer-events:none}' +
    `.v2-crossfade-fading{animation:v2-crossfade-out ${FADE_MS}ms linear forwards}` +
    '@keyframes v2-crossfade-out{from{opacity:1}to{opacity:0}}';
  document.head.appendChild(style);
}

export function CrossfadeImage(props: {
  src: string;
  /** The screen this artwork belongs to. A change of group cuts, not fades. */
  group?: string;
  className?: string;
  alt?: string;
  width?: number;
  height?: number;
}): JSX.Element {
  const { src, group, className, alt = '', width, height } = props;

  /* Derived from props during render, not in an effect. An effect runs AFTER
     paint, so the outgoing copy would be mounted one frame too late - which is
     precisely the frame this component exists to fill.

     `loaded` rides in the same object rather than in a state of its own for the
     same reason: it is a fact about THIS src, and left to be cleared by an
     effect it would still read true for the image that has just left, so the
     outgoing copy would begin fading over an incoming one that has not painted
     yet. Reset it where the src is set and the two cannot disagree. */
  const [shown, setShown] = useState({ src, group, out: null as string | null, loaded: false });
  if (shown.src !== src) {
    setShown({ src, group, out: shown.group === group ? shown.src : null, loaded: false });
  }

  const img = useRef<HTMLImageElement | null>(null);
  const settle = () =>
    setShown((s) => (s.src === src && !s.loaded ? { ...s, loaded: true } : s));

  /* A cached image assigned during render can already be complete by the time
     the ref lands, and a load event that has fired is not fired again - so the
     hold below would wait for an event that is never coming. Asked, not
     assumed: an image that is NOT complete still has its onLoad to come. */
  useEffect(() => {
    if (img.current?.complete) settle();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [src]);

  /* The outgoing copy holds at full opacity until the incoming one has loaded.
     Fading on a plain timer instead would dissolve to whatever is behind the
     panel - white - on any swap the prefetch did not reach first. */
  useEffect(() => {
    if (!shown.out || !shown.loaded) return;
    const leaving = shown.out;
    const t = window.setTimeout(
      () => setShown((s) => (s.out === leaving ? { ...s, out: null } : s)),
      FADE_MS,
    );
    return () => window.clearTimeout(t);
  }, [shown.out, shown.loaded]);

  const arriving = shown.src;
  const leaving = shown.out;
  const loaded = shown.loaded;

  return (
    <>
      <img
        key={arriving}
        ref={img}
        className={className}
        src={arriving}
        alt={alt}
        width={width}
        height={height}
        draggable={false}
        onLoad={settle}
        /* A plate that will not load must not pin the old one on screen. */
        onError={settle}
      />
      {leaving && (
        <img
          key={leaving}
          className={
            `${className ?? ''} v2-crossfade-out${loaded ? ' v2-crossfade-fading' : ''}`.trim()
          }
          src={leaving}
          alt=""
          aria-hidden="true"
          width={width}
          height={height}
          draggable={false}
        />
      )}
    </>
  );
}
