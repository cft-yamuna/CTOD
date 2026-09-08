import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { Stage } from '../components/Stage';
import { Plate } from '../components/Plate';
import { HitTarget } from '../components/HitTarget';
import { ScrollPanel, toContent } from './components/ScrollPanel';
import { PinScreen, pinKeypadOwns } from './screens/PinScreen';
import { LoadingScreen } from './screens/LoadingScreen';
import { HomeScreen } from './screens/HomeScreen';
import {
  INITIAL, OWNS_FRAME, hitsFor, backTarget, timerFor, plateFor, scrollFor,
  chromeFor, patchesFor, apply, arrive, resolveTemplate, seedFor, type FlowState, type Hit,
} from './flow';

/**
 * The V2 app.
 *
 * One renderer for all thirteen templates, exactly as V1 had one for its
 * twenty-two screens - but where V1 keyed the plate off the screen name, this
 * keys it off the whole state. See `flow.ts` for why that is the entire
 * difference between 614 frames and thirteen screens.
 *
 * Three screens are not plates, and only three. `pin` types a PIN, which is
 * state and cannot be photographed; `loading` turns a ring, which a flattened
 * plate cannot move; `home` animates a layer that sits UNDER the rest of the
 * frame. Everything else is the exported artwork with transparent hit areas
 * over it, and costs nothing but a row in `hits.json`.
 *
 * Two run modes. `kiosk` is the default and the one the visual diff
 * photographs: plate plus invisible hit areas, nothing else. `?mode=mouse` is
 * the test rig, and every part of it hangs off the `data-mode` attribute.
 */

export default function App() {
  const [state, setState] = useState<FlowState>(() => {
    const param = new URLSearchParams(window.location.search).get('screen');
    /* Seeded, not bare: a template name alone does not name a picture on the
       screens that are a function of state. See `seedFor`. */
    return seedFor(resolveTemplate(param));
  });

  /* Read once, and never from state: switching mode mid-session would mean the
     kiosk could acquire dev chrome after a diff has started. */
  const [mouse] = useState(
    () => new URLSearchParams(window.location.search).get('mode') === 'mouse',
  );

  /* An installed kiosk with a mouse plugged into it does not want a pointer
     parked on the artwork. Everywhere else does - the screen is driven by one
     on the bench and in every demo, and every control is painted into the
     plate, so an invisible pointer leaves nothing to aim at. Visible is
     therefore the default and this is the opt-out, not the other way round. */
  const [hideCursor] = useState(
    () => new URLSearchParams(window.location.search).get('cursor') === 'none',
  );

  const plate = plateFor(state);
  const hits = hitsFor(state);
  const timer = timerFor(state.template);

  /* A scroll region only exists where the prototype declares one AND the
     artwork is not already flattened at an offset: the balance screen's
     selected state is a pre-scrolled export, so it is a plain plate and
     scrolling it again would move artwork that has already been moved. */
  const scroll = scrollFor(state);
  /* Home scrolls inside `HomeScreen`, not here - the screen is a composite of
     animated layers, not a plate - so the app supplies the targets that ride in
     its panel and lets the screen mount the panel itself. */
  const ownPanel = OWNS_FRAME.has(state.template);
  const patches = patchesFor(state);
  const chrome = scroll && !ownPanel ? chromeFor(state) : [];

  /* A tap is acknowledged before it is acted on. Navigating on the raw click
     made V1 feel like it was skipping ahead on its own - the plate swaps within
     a frame, so nothing says the press registered. Applied only between the
     click and the move, so a screen at rest is unchanged and the pixel diff
     still measures the plate. */
  const [pressed, setPressed] = useState<string | null>(null);
  const TAP_FEEDBACK_MS = 140;

  const commit = useCallback((raw: FlowState) => {
    /* Arrivals are counted here, where both the screen being left and the one
       being reached are in hand. */
    const next = arrive(state, raw);
    setPressed(null);
    setState(next);
    /* Keep the URL honest, so a reload lands where you were looking and a bug
       report can be pasted as a link. Rewriting it is also what carries `mode`
       across every jump - it is never dropped. */
    const url = new URL(window.location.href);
    url.searchParams.set('screen', next.template);
    window.history.replaceState(null, '', url);
  }, [state]);

  const tap = useCallback((key: string, next: FlowState) => {
    setPressed(key);
    window.setTimeout(() => commit(next), TAP_FEEDBACK_MS);
  }, [commit]);

  /* The one switch. Kiosk sets it too, so the mode a screen is in is legible in
     devtools. Layout effect rather than effect: it lands before the first
     paint, so mouse mode never flashes its overlays unstyled. */
  useLayoutEffect(() => {
    document.body.dataset.mode = mouse ? 'mouse' : 'kiosk';
    if (hideCursor) document.body.dataset.cursor = 'none';
    else delete document.body.dataset.cursor;
  }, [mouse, hideCursor]);

  /* The run's state, on the body, so what the app believes can be read straight
     out of devtools. `round` is the one worth having: whether the balance
     screen still offers a top-up is a question about a counter, and a counter
     you cannot see is a counter you end up arguing about. */
  useLayoutEffect(() => {
    document.body.dataset.round = String(state.balanceVisits);
    document.body.dataset.balance = String(state.balance);
    document.body.dataset.issuer = state.issuer;
  }, [state.balanceVisits, state.balance, state.issuer]);

  /**
   * The declared timed transitions: `success` holds for the 1850ms the
   * prototype declares and `loading` for its 2000ms. Neither screen carries a
   * tap target at all, so this timer is the only way out of them - if it does
   * not fire, the kiosk is stranded mid-payment.
   */
  useEffect(() => {
    if (!timer?.to) return;
    const to = timer.to;
    const t = setTimeout(() => commit({ ...state, template: to }), timer.ms);
    return () => clearTimeout(t);
  }, [timer, state, commit]);

  useEffect(() => {
    if (!mouse) return;
    const onKey = (e: KeyboardEvent) => {
      /* The PIN pad is on this window too, and it types. Backspace there means
         "delete a digit", not "go back a screen". */
      if (state.template === 'pin' && pinKeypadOwns(e.key)) return;
      let hit: Hit | undefined;
      if (e.key === 'ArrowRight' || e.key === ' ') hit = hits.find((h) => h.kind !== 'global');
      else if (e.key === 'ArrowLeft' || e.key === 'Backspace') {
        const back = backTarget(state);
        if (back) commit({ ...state, template: back });
        e.preventDefault();
        return;
      } else if (e.key === 'r' || e.key === 'R') { e.preventDefault(); commit({ ...INITIAL }); return; }
      else return;
      /* Space would re-fire whichever hit button has focus and Backspace would
         walk browser history, both on top of the move we just made. */
      e.preventDefault();
      if (hit) commit(apply(state, hit));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mouse, state, hits, commit]);

  /**
   * The back arrow is the one control the map cannot answer alone.
   *
   * `methods` returns to whichever screen opened it and `balance` returns to
   * the home screen of its own leg, so both are resolved against the state.
   * The box itself is still the prototype's, and it is dropped entirely on the
   * templates that do not declare one.
   */
  const withBack = (h: Hit): FlowState => {
    if (h.label === 'Back' || h.label.startsWith('Close')) {
      const back = h.to ?? backTarget(state);
      return back ? { ...state, template: back } : state;
    }
    return apply(state, h);
  };

  const target = (h: Hit) => {
    /* Inside a scroll region the box is declared in frame coordinates but
       rendered in content coordinates. `toContent` is the conversion, and it is
       used rather than open-coded because doing it by hand here got the X wrong
       once already: `balance` has a viewport inset 44px from the frame edge, so
       dropping the X term shifted every chip 44px right - still inside a 147px
       chip, so the flow kept working and only the harness noticed. */
    let box = h.scrolled && scroll?.viewport ? toContent(h, scroll.viewport, scroll) : h;
    /* A tap-anywhere target covers the CONTENT, not the frame - otherwise only
       the first screenful of a scrolled panel answers. */
    if (h.node === '-' && scroll) {
      box = { left: 0, top: 0, width: scroll.contentW, height: scroll.contentH };
    }
    return (
      <HitTarget
        key={h.node + h.label}
        label={h.label}
        left={box.left}
        top={box.top}
        width={box.width}
        height={box.height}
        pressed={pressed === h.node + h.label}
        onSelect={() => tap(h.node + h.label, withBack(h))}
      />
    );
  };

  const inScroll = scroll ? hits.filter((h) => h.scrolled) : [];
  const onFrame = scroll ? hits.filter((h) => !h.scrolled) : hits;

  /**
   * Mouse mode draws every live target, outlined and labelled.
   *
   * V2 shipped without this and it cost real time: a control that does nothing
   * and a control that is not there look identical on a plate, so "the chip
   * does not work" and "the chip is not where you are clicking" could not be
   * told apart from the screen. Scrolled targets are drawn inside the panel so
   * their outline moves with the artwork they belong to.
   */
  const outline = (h: Hit) => {
    const box = h.scrolled && scroll?.viewport ? toContent(h, scroll.viewport, scroll) : h;
    return (
      <div
        key={'dev' + h.node + h.label}
        className="dev-hit"
        style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
      >
        <span className="dev-chip">{h.label} -&gt; {h.to ?? h.kind}</span>
      </div>
    );
  };

  /**
   * A scrolling screen is NOT its full-frame plate plus a scroller.
   *
   * That plate is a still of the frame, content included, so putting the
   * scrolling artwork over it draws the content twice - the card art appeared
   * once in the plate and again in the panel, a screen-height apart. A scroll
   * region is composited the way Figma composites it: the frame's fill, the
   * content scrolling inside its window, then the fixed chrome over the top.
   */
  const scrollBg = chrome.find((c) => c.role === 'bg');

  return (
    <Stage>
      {state.template === 'home' || state.template === 'homeCard' ? (
        <HomeScreen variant={state.template === 'home' ? 'setup' : 'card'}>
          {inScroll.map(target)}
          {mouse && inScroll.map(outline)}
        </HomeScreen>
      ) : state.template === 'loading' ? (
        <LoadingScreen plate={plate} />
      ) : state.template === 'pin' ? (
        /* Keyed on the leg so moving between the two PIN screens remounts the
           pad rather than carrying a half-typed PIN across. */
        <PinScreen
          key={state.leg}
          plate={plate}
          mouse={mouse}
          onSubmit={() => commit({ ...state, template: 'success' })}
        />
      ) : scroll ? (
        <div
          className="v2-scroll-bg"
          style={{ background: scrollBg?.fill ?? '#ffffff' }}
        />
      ) : (
        <Plate src={plate} alt={state.template} />
      )}


      {scroll && !ownPanel && (
        <ScrollPanel
          content={scroll.content}
          contentW={scroll.contentW}
          contentH={scroll.contentH}
          viewport={scroll.viewport ?? { x: 0, y: 0, w: 1080, h: 1920 }}
          contentX={scroll.contentX}
          contentY={scroll.contentY}
          /* Figma sets resetScrollPosition on every navigation, so arriving at
             a screen must not inherit the last one's offset. Selecting a chip
             is deliberately NOT in this key: in the prototype that is a frame
             change and resets, but here it is a state change on the screen you
             are already looking at, and throwing the user back to the top of a
             panel they just scrolled is the prototype's artefact, not its
             intent. */
          resetKey={`${state.template}:${state.leg}:${state.balance}`}
        >
          {inScroll.map(target)}
          {mouse && inScroll.map(outline)}
        </ScrollPanel>
      )}

      {/* Both screens that borrow another state's artwork put the wrong part
          back here: the issuer's card over a borrowed balance plate, and the
          issuer's name over a borrowed receipt. See `patchesFor`.

          AFTER the panel, not before. Both are absolutely positioned siblings
          with no z-index, so DOM order decides, and drawn first the card was
          simply repainted by the panel underneath it - the screen still read
          "BharatYatra / By Pine Labs" on every unselected balance. */}
      {patches.map((p) => (
        <img
          key={p.src}
          className="v2-patch"
          src={p.src}
          alt=""
          draggable={false}
          style={{ left: p.left, top: p.top, width: p.width, height: p.height }}
        />
      ))}

      {/* Over the scrolling content, never inside it: the header, and the
          footer or sticky CTA band the frame pins to its bottom edge. */}
      {chrome
        .filter((c) => c.file && !c.hidden)
        .map((c) => (
          <img
            key={c.file}
            className="v2-chrome"
            src={c.file}
            alt=""
            draggable={false}
            style={{
              left: c.left, top: c.top, width: c.width, height: c.height,
              zIndex: c.zIndex,
            }}
          />
        ))}

      {onFrame.map(target)}
      {mouse && onFrame.map(outline)}
    </Stage>
  );
}
