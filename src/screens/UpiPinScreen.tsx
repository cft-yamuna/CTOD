import { useEffect, useState } from 'react'
import { HitTarget } from '../components/HitTarget'

/**
 * The UPI PIN screen - the one screen in this app that is not a plate with
 * taps laid over it.
 *
 * The prototype fakes PIN entry with two frames, empty dots and filled dots,
 * and a tap on the dots to cross between them. That is a storyboard, not a PIN
 * pad. A cardholder cannot enter a PIN by tapping the dots, so here the plate
 * supplies the artwork and this component supplies the state: the twelve
 * keypad hit areas, the six dots, and nothing else.
 *
 * The dots are the only thing anywhere in the flow that is DRAWN rather than
 * photographed, and only because they have to change. The plate already paints
 * six of them, so they are covered first (`.pin-strip`) and redrawn on top - a
 * live dot over a printed one is two dots a fraction apart, which reads as
 * blur. Empty, this screen has to come out pixel-identical to the plate it is
 * standing on, because that plate is the diff harness's reference for it; the
 * geometry here and the colours in `styles.css` are therefore read off the
 * exports rather than chosen, and are exact rather than tidy.
 *
 * Nothing is validated. There is no correct PIN in this flow - six digits is
 * the entire condition, and `onSubmit` fires when the sixth arrives.
 */

/** Six digits is a full PIN. Below that, Next does nothing at all. */
export const PIN_LENGTH = 6

/* Frame-relative pixels at the 1080x1920 design size, like every other
   coordinate in this app, so nothing is computed at runtime. */
const DOT_SIZE = 44
/* The ring is drawn INSIDE the 44px box, which is what a CSS border does by
   default - so no offset. Worth recording because the report's `strokeRisk`
   flags these ellipses as growing ~3px, which reads as a centre-aligned stroke
   and is the obvious thing to correct for. It is wrong here: drawing them at
   47 centred took the diff from 0.019% to 0.023%, and at 46.77 to 0.045%.
   The measurement decided this, not the metadata. */
const DOT_TOP = 973
const DOT_LEFT = [294, 383, 471, 560, 649, 737]

const KEY_W = 277
const KEY_H = 116
const KEY_COL = [102, 401, 700]
const KEY_ROW = [1300, 1438, 1576, 1715]

type Key = { label: string; digit?: string; action?: 'erase' | 'submit' }

/* Reading order, three across and four down, so the index below maps straight
   onto the grid with no table to keep in step. The bottom row is where Figma
   stops using `Key / Primary`: backspace is a `Key / Function` and Next a
   `Key / Special Function`, and they are the two that carry no digit. */
const KEYS: Key[] = [
  { label: '1', digit: '1' }, { label: '2', digit: '2' }, { label: '3', digit: '3' },
  { label: '4', digit: '4' }, { label: '5', digit: '5' }, { label: '6', digit: '6' },
  { label: '7', digit: '7' }, { label: '8', digit: '8' }, { label: '9', digit: '9' },
  { label: 'Backspace', action: 'erase' },
  { label: '0', digit: '0' },
  { label: 'Next', action: 'submit' },
]

/**
 * The keys the pad answers to.
 *
 * Exported because App's mouse-mode shortcuts sit on the same window and would
 * otherwise fight it: Backspace there means "go back one screen" and here it
 * means "delete a digit". App hands these over instead of guessing.
 */
export function pinKeypadOwns(key: string): boolean {
  return /^[0-9]$/.test(key) || key === 'Backspace' || key === 'Enter' || key === ' '
}

export function UpiPinScreen({
  mouse, onSubmit,
}: {
  mouse: boolean
  onSubmit: () => void
}) {
  /* The PIN lives here and nowhere else, so leaving the screen destroys it:
     App unmounts this component on any navigation away, and coming back from
     `methods` mounts a fresh one with an empty pin. There is no clearing step
     to forget, and no way for a half-typed PIN to survive the user walking
     off. */
  const [pin, setPin] = useState('')

  const type = (d: string) => setPin((p) => (p.length >= PIN_LENGTH ? p : p + d))
  const erase = () => setPin((p) => p.slice(0, -1))
  const submit = () => { if (pin.length === PIN_LENGTH) onSubmit() }

  const press = (k: Key) => {
    if (k.digit) type(k.digit)
    else if (k.action === 'erase') erase()
    else submit()
  }

  /* The panel is touched in the field and driven with a keyboard on the bench,
     and a pad that only answered to the mouse would be tested through a path
     the kiosk does not have. Both routes call the three functions above, so
     there is one PIN and not two that have to agree.

     Every claimed key is prevented, including Space, which claims nothing:
     Backspace would walk browser history, and Enter or Space would re-fire
     whichever pad button the last click left focused - a stray seventh digit
     landing on top of the submit that was actually asked for. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!pinKeypadOwns(e.key)) return
      e.preventDefault()
      if (/^[0-9]$/.test(e.key)) type(e.key)
      else if (e.key === 'Backspace') erase()
      else if (e.key === 'Enter') submit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pin])

  return (
    <>
      <div className="pin-strip" />

      {/* Filled up to the digit count, then one leading dot, then the rest.
          `i === pin.length` is the dot the next digit lands in, and at six
          digits no dot matches it - which is exactly the filled plate. */}
      {DOT_LEFT.map((left, i) => (
        <div
          key={left}
          className={
            i < pin.length ? 'pin-dot pin-dot-filled'
            : i === pin.length ? 'pin-dot pin-dot-next'
            : 'pin-dot pin-dot-empty'
          }
          style={{ left, top: DOT_TOP, width: DOT_SIZE, height: DOT_SIZE }}
        />
      ))}

      {KEYS.map((k, i) => (
        <HitTarget
          key={k.label}
          label={k.digit ? `PIN keypad ${k.digit}` : k.label}
          left={KEY_COL[i % 3]}
          top={KEY_ROW[Math.floor(i / 3)]}
          width={KEY_W}
          height={KEY_H}
          onSelect={() => press(k)}
        />
      ))}

      {/* Same outlines every other target gets in mouse mode, drawn here
          rather than by DevHits because these twelve are controls and have no
          destination for it to print. */}
      {mouse && KEYS.map((k, i) => (
        <div
          key={`outline-${k.label}`}
          className="dev-hit"
          style={{ left: KEY_COL[i % 3], top: KEY_ROW[Math.floor(i / 3)], width: KEY_W, height: KEY_H }}
        >
          <span className="dev-chip">{k.label}</span>
        </div>
      ))}
    </>
  )
}
