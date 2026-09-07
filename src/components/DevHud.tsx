import { SCREENS, type Hit, type Screen, type ScreenName } from '../flow'

/**
 * The mouse-mode overlays: hit outlines and the screen HUD.
 *
 * Nothing in here is a kiosk concern. App mounts it only under `?mode=mouse`,
 * and every rule it leans on is scoped to `body[data-mode="mouse"]`, so the
 * default mode has neither the elements nor a selector that could paint them.
 *
 * Everything shown is read off `flow.ts` - a target that moves, is renamed or
 * is re-pointed there cannot start lying here.
 */

/** Outlines the transparent hit areas, so a mouse can see what to aim at. */
export function DevHits({ hits }: { hits: Hit[] }) {
  return (
    <>
      {hits.map((h) => (
        <div
          key={h.node + h.label}
          className={h.addition ? 'dev-hit dev-hit-addition' : 'dev-hit'}
          style={{ left: h.left, top: h.top, width: h.width, height: h.height }}
        >
          <span className="dev-chip">{h.label} -&gt; {h.to}</span>
        </div>
      ))}
    </>
  )
}

/** Where you are, and a way to be somewhere else without walking the flow. */
export function DevHud({
  screen, onJump,
}: {
  screen: Screen
  onJump: (to: ScreenName) => void
}) {
  const index = SCREENS.indexOf(screen)

  return (
    <aside className="dev-hud">
      <div className="dev-hud-now">
        <b>{screen.name}</b>
        <span>{index + 1} / {SCREENS.length}</span>
      </div>
      <div className="dev-hud-node">{screen.node}</div>
      <ol className="dev-hud-jump">
        {SCREENS.map((s, i) => (
          <li key={s.name}>
            <button
              className={s.name === screen.name ? 'is-current' : undefined}
              onClick={() => onJump(s.name)}
            >
              <span>{i + 1}</span>{s.name}
            </button>
          </li>
        ))}
      </ol>
      <div className="dev-hud-keys">&larr; back &middot; &rarr; forward &middot; R home</div>
    </aside>
  )
}
