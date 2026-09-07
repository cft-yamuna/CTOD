/**
 * A transparent hit area over a control the plate already draws.
 *
 * The button is IN the picture. This adds only the touch region, and must stay
 * invisible: a printed control and a live one a pixel out of register are both
 * on screen at once, and that is worse than either alone.
 *
 * `aria-label` is not decoration here. It is the only accessible name the
 * screen has, because every other word on it is pixels.
 */
export function HitTarget({
  left, top, width, height, onSelect, label, pressed,
}: {
  left: number
  top: number
  width: number
  height: number
  onSelect: () => void
  label: string
  /* Held for one beat after a tap so the press is visible before the screen
     changes. It is never true at rest, which is what keeps the pixel diff
     measuring the plate and not a highlight. */
  pressed?: boolean
}) {
  return (
    <button
      className={pressed ? 'hit hit-pressed' : 'hit'}
      style={{ left, top, width, height }}
      onClick={onSelect}
      aria-label={label}
    />
  )
}

/** Tap anywhere. Used by the screens that advance on any touch at all. */
export function FullScreenHit({
  onSelect, label, pressed,
}: {
  onSelect: () => void
  label: string
  pressed?: boolean
}) {
  return (
    <button
      className={pressed ? 'hit hit-full hit-pressed' : 'hit hit-full'}
      onClick={onSelect}
      aria-label={label}
    />
  )
}
