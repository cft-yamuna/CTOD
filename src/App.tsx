import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { Stage } from './components/Stage';
import { Plate } from './components/Plate';
import { HitTarget, FullScreenHit } from './components/HitTarget';
import { DevHits, DevHud } from './components/DevHud';
import { UpiPinScreen, pinKeypadOwns } from './screens/UpiPinScreen';
import { HomeScreen } from './screens/HomeScreen';
import { LoadingScreen } from './screens/LoadingScreen';
import { SCREENS, FIRST, resolveScreen, byName, type Screen, type ScreenName } from './flow';

/**
 * The whole app. Plate mode means there is nothing to compose per screen -
 * every screen is one exported frame plus the transparent hit areas the
 * prototype declares over it, so a single renderer covers all twenty-two and
 * `flow.ts` stays the only thing anyone has to edit.
 *
 * Four screens break that, and only four. `upipin2` and `addpin2` - one per
 * leg of the flow - each have to hold a PIN the user is typing, which is
 * state, and state cannot be photographed; they share one component, because
 * measurement says the two frames put the dots and the keys in the same place.
 * `home` has a looping animation on the BOTTOM layer of its frame, which a
 * flattened plate cannot move, so it is composited from its separate layers
 * instead, and `loading` splits its ring off the plate so it can turn. The two
 * success screens used to be a fifth and sixth: their badge was animated, and
 * that has been dropped - they are plates again, exactly as exported. Every
 * other screen still costs nothing but a row in `flow.ts`, and the exceptions
 * are named here so they stay exceptions.
 *
 * Two run modes. `kiosk` is the default and the one the visual diff
 * photographs: it renders the plate and the invisible hit areas, nothing else.
 * `?mode=mouse` is the test rig - outlines, labels, a HUD and the keyboard -
 * and every part of it hangs off the single `data-mode` attribute below.
 */

/* The screens that hold a typed PIN rather than a photographed one, and where
   a full six digits sends them. Both legs of the flow have one, they are the
   same pad over different plates, and this map is the only place that pairing
   is written down - `UpiPinScreen` itself knows nothing about the flow. */
const PIN_SCREENS: Partial<Record<ScreenName, ScreenName>> = {
  upipin2: 'success',
  addpin2: 'addsuccess',
};

/* `Back` and `Close` are the labels the prototype itself gives the reverse
   move; there is no direction flag in `flow.ts` to steer the arrow keys by. */
const BACK_LABELS = ['Back', 'Close'];
const forwardHit = (s: Screen) => s.hits.find((h) => !BACK_LABELS.includes(h.label));
const backHit = (s: Screen) => s.hits.find((h) => BACK_LABELS.includes(h.label));

export default function App() {
  /* `?screen=` deep-links a single screen so the visual diff can photograph
     each one without walking the flow to reach it. Read once, at mount. */
  const [name, setName] = useState<ScreenName>(
    () => resolveScreen(new URLSearchParams(window.location.search).get('screen')).name,
  );

  /* Read once too, and never from state: switching mode mid-session would mean
     the kiosk could acquire dev chrome after the diff has started. */
  const [mouse] = useState(
    () => new URLSearchParams(window.location.search).get('mode') === 'mouse',
  );

  const screen = byName(name)!;

  /* A tap has to be acknowledged before it is acted on. Navigating on the
     raw click made the flow feel like it was skipping ahead on its own: the
     plate swaps within a frame, so there is no moment where anything says the
     press registered. `pressed` holds the target for one beat, the CSS dims it,
     and then the move happens. */
  const [pressed, setPressed] = useState<string | null>(null);

  const go = useCallback((to: ScreenName) => {
    setPressed(null);
    setName(to);
    /* Keep the URL honest, so a reload lands on the screen you were looking at
       and a bug report can be pasted as a link. Rewriting the current URL is
       also what carries `mode` across every jump - it is never dropped. */
    const url = new URL(window.location.href);
    url.searchParams.set('screen', to);
    window.history.replaceState(null, '', url);
  }, []);

  /* Long enough to read as feedback, short enough not to feel laggy. Applied
     on the way OUT of a control, never on the way in, so nothing about the
     screen at rest changes and the pixel diff still photographs the plate. */
  const TAP_FEEDBACK_MS = 140;

  const tap = useCallback((key: string, to: ScreenName) => {
    setPressed(key);
    window.setTimeout(() => go(to), TAP_FEEDBACK_MS);
  }, [go]);

  /* The one switch. Kiosk sets it too, so the mode a screen is in is legible in
     devtools, but no rule in `styles.css` matches anything but `mouse`. Layout
     effect rather than effect: it lands before the first paint, so mouse mode
     never flashes its overlays unstyled. */
  useLayoutEffect(() => {
    document.body.dataset.mode = mouse ? 'mouse' : 'kiosk';
  }, [mouse]);

  /* The timed transitions, driven entirely off `flow.ts`: `success` and
     `addsuccess` hold for the 3s the prototype declares, and `loading` for the
     2.6s we give it. None of the three has a tap target, so this timer is the
     only way out of them - if it does not fire, the flow stops. */
  useEffect(() => {
    if (!screen.autoAdvanceMs || !screen.autoTo) return;
    const to = screen.autoTo;
    const t = setTimeout(() => go(to), screen.autoAdvanceMs);
    return () => clearTimeout(t);
  }, [screen, go]);

  useEffect(() => {
    if (!mouse) return;
    const onKey = (e: KeyboardEvent) => {
      /* The PIN pad is on this window too, and it types. Backspace there means
         "delete a digit", not "go back a screen", and a digit is a digit - so
         the keys it claims are its own and never steer the flow as well. The
         arrows and R are untouched, and still walk the flow from that screen. */
      if (PIN_SCREENS[screen.name] && pinKeypadOwns(e.key)) return;
      let to: ScreenName | undefined;
      if (e.key === 'ArrowRight' || e.key === ' ') to = forwardHit(screen)?.to;
      else if (e.key === 'ArrowLeft' || e.key === 'Backspace') to = backHit(screen)?.to;
      else if (e.key === 'r' || e.key === 'R') to = FIRST;
      else return;
      /* Space would re-fire whichever hit button has focus and Backspace would
         walk browser history, both on top of the move we just made. */
      e.preventDefault();
      if (to) go(to);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mouse, screen, go]);

  return (
    <>
      <Stage>
        {/* `home` is layers, not a plate - see HomeScreen for why. */}
        {screen.name === 'home' ? <HomeScreen />
          : screen.name === 'loading' ? <LoadingScreen />
          : <Plate src={screen.plate} alt={screen.name} />}
        {/* Mounted by name, and unmounted the moment the flow moves on, which
            is what makes Close clear the PIN: there is no PIN left to clear.
            Rendered over the plate and under the flow's own hit areas. */}
        {PIN_SCREENS[screen.name] && (
          /* Keyed by screen name so moving between the two PIN screens
             remounts the pad rather than carrying a half-typed PIN across. */
          <UpiPinScreen
            key={screen.name}
            mouse={mouse}
            onSubmit={() => go(PIN_SCREENS[screen.name]!)}
          />
        )}
        {screen.hits.map((h) =>
          /* A target that covers the entire frame is the tap-anywhere case and
             gets the full-screen element rather than a 1080x1920 absolute box -
             same behaviour, but it survives a stage that is not exactly 1080 wide. */
          h.width === 1080 && h.height === 1920 && h.left === 0 && h.top === 0 ? (
            <FullScreenHit
              key={h.node + h.label}
              label={h.label}
              pressed={pressed === h.node + h.label}
              onSelect={() => tap(h.node + h.label, h.to)}
            />
          ) : (
            <HitTarget
              key={h.node + h.label}
              label={h.label}
              left={h.left}
              top={h.top}
              width={h.width}
              height={h.height}
              pressed={pressed === h.node + h.label}
              onSelect={() => tap(h.node + h.label, h.to)}
            />
          ),
        )}
        {mouse && <DevHits hits={screen.hits} />}
      </Stage>
      {/* Outside the stage on purpose: the stage carries a scale transform, and
          a fixed-position child of one is positioned against the transform. */}
      {mouse && <DevHud screen={screen} onJump={go} />}
    </>
  );
}

/* Exported for the flow test, which needs the order to walk. */
export { SCREENS };
