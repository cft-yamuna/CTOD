import { useEffect, useState } from 'react';
import { Plate } from '../../components/Plate';
import { HitTarget } from '../../components/HitTarget';
import './v2-screens.css';

/**
 * The UPI PIN screen - one of the three V2 screens that is not a plate with
 * taps laid over it.
 *
 * V2 storyboards PIN entry across 360 frames: every one of the 3 issuers x 5
 * amounts x 7 PIN lengths is drawn, and the seven lengths are wired into a
 * chain - #254:4833 (no digits) -> 6168 -> 7503 -> 8838 -> 10173 -> 11508 ->
 * 12843 (six), each step an ON_CLICK on one particular key. That is a
 * storyboard of somebody typing, not a keypad: it advances on the 1 key, then
 * the 2 key, then the 3, and a cardholder who presses anything else is stuck.
 * So the plate supplies the artwork and this component supplies the state -
 * twelve keypad hit areas, six dots, and nothing else. The 360 frames are not
 * built; the single zero-digit plate is.
 *
 * All twelve keys are live here, which is the whole point, and the keypad's
 * geometry was diffed out of the chain rather than assumed: #254:4833 against
 * #254:12843 differ in exactly six ellipses (the dots) and one key (the "6",
 * drawn held down - a storyboard artefact, and the reason the pressed-key
 * highlight is NOT reproduced: rendering it would mean redrawing the digit in
 * white over the plate, and no glyph in this build is ever live).
 *
 * Nothing is validated. There is no correct PIN in this flow - six digits is
 * the entire condition.
 */

/** Six digits is a full PIN. Below that, Next does nothing at all. */
export const PIN_LENGTH = 6;

/**
 * The designer's own dwell, declared on #254:12843: AFTER_TIMEOUT 0.4s ->
 * #254:14178, the settled six-digit frame. It is the beat where the last dot
 * has filled and the screen has not moved yet, and it is the only thing that
 * stops the sixth keypress and the next screen landing in the same frame.
 */
export const PIN_DWELL_MS = 400;

/* Frame-relative pixels at the 1080x1920 design size, like every other
   coordinate in this app, so nothing is computed at runtime. Straight off
   #254:4833; the fractions are real - the artboard was scaled up on its way to
   1080 and almost nothing in V2 lands on an integer.

   The dots are SVG circles rather than V1's bordered divs, and that is a
   measurement rather than a preference: Chrome snaps a `border-width` to whole
   device pixels, so a 2.769px ring comes out at 2 and prints visibly lighter
   than the plate underneath it. An SVG stroke is not snapped. Counted on the
   export, the bordered version left the ring band differing on roughly 2000
   pixels; the stroked one lands within antialiasing of the artwork. */
const DOT_R = 44.30769 / 2;                 /* 22.154 - the ellipse's own radius */
const DOT_STROKE = 2.76923;                 /* Figma aligns it INSIDE the box */
const DOT_RING_R = DOT_R - DOT_STROKE / 2;  /* so the stroke's centre line */
const DOT_CY = 854.38 + DOT_R;
const DOT_CX = [294.09, 382.71, 471.32, 559.94, 648.55, 737.17].map((l) => l + DOT_R);

/* The plate's own colours, sampled off #254:4833 rather than chosen. A dot the
   PIN has not reached is grey; the dot the next digit lands in already carries
   the blue ring in the artwork; a filled one is that blue solid. */
const DOT_INK = '#26387e';
const DOT_GREY = '#6e6e72';

const KEY_W = 276.92;
const KEY_H = 116.31;
const KEY_COL = [101.63, 400.71, 699.78];
const KEY_ROW = [1168.54, 1307.0, 1445.46, 1583.93];

type Key = { label: string; digit?: string; action?: 'erase' | 'submit' };

/* Reading order, three across and four down, so the index below maps straight
   onto the grid with no table to keep in step. The bottom row is where Figma
   stops using `Key / Primary`: backspace is a `Key / Function` (#254:4852,
   filled #bdc6dc) and Next is a `Key / Special Function` inside `Group 12934`
   (#254:4862, filled #26387e), and they are the two that carry no digit. */
const KEYS: Key[] = [
  { label: '1', digit: '1' }, { label: '2', digit: '2' }, { label: '3', digit: '3' },
  { label: '4', digit: '4' }, { label: '5', digit: '5' }, { label: '6', digit: '6' },
  { label: '7', digit: '7' }, { label: '8', digit: '8' }, { label: '9', digit: '9' },
  { label: 'Backspace', action: 'erase' },
  { label: '0', digit: '0' },
  { label: 'Next', action: 'submit' },
];

/**
 * The keys the pad answers to.
 *
 * Exported because App's arrow-key flow control sits on the same window and
 * would otherwise fight it: Backspace there means "go back one screen" and
 * here it means "delete a digit", and Space there advances the flow while here
 * it would re-fire a focused key. App hands these over instead of guessing.
 */
export function pinKeypadOwns(key: string): boolean {
  return /^[0-9]$/.test(key) || key === 'Backspace' || key === 'Enter' || key === ' ';
}

export function PinScreen({
  plate, mouse, onSubmit,
}: {
  plate: string;
  mouse?: boolean;
  onSubmit: () => void;
}) {
  /* The PIN lives here and nowhere else, so leaving the screen destroys it:
     App unmounts this component on any navigation away and keys it on the leg,
     so a half-typed PIN cannot ride from the setup pad across to the recharge
     one. There is no clearing step to forget. */
  const [pin, setPin] = useState('');

  const type = (d: string) => setPin((p) => (p.length >= PIN_LENGTH ? p : p + d));
  const erase = () => setPin((p) => p.slice(0, -1));

  const press = (k: Key) => {
    if (k.digit) type(k.digit);
    else if (k.action === 'erase') erase();
    else if (armed) onSubmit();
  };

  /**
   * The dwell ARMS Next. It does not press it.
   *
   * `#254:12843` declares AFTER_TIMEOUT 0.4s -> `#254:14178`, and it is easy to
   * read that as "the screen leaves by itself once six digits are in". It is
   * not: the dots are already filled on `#254:12843`, and all the dwell does is
   * release the held-down key and settle onto the frame where Next is live. The
   * user then presses Next, and THAT is what reaches Success.
   *
   * Submitting on the timer instead took the screen away under the user's
   * finger - six digits typed and the flow moved on before they had touched
   * anything. Entering a PIN and authorising a payment are two decisions, and
   * the designer separated them deliberately.
   */
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (pin.length < PIN_LENGTH) { setArmed(false); return; }
    const t = setTimeout(() => setArmed(true), PIN_DWELL_MS);
    return () => clearTimeout(t);
  }, [pin]);

  /* The panel is touched in the field and driven with a keyboard on the bench,
     and a pad that only answered to the mouse would be tested through a path
     the kiosk does not have. Both routes call the same two functions above, so
     there is one PIN and not two that have to agree.

     Every claimed key is prevented, including Space, which claims nothing:
     Backspace would walk browser history, and Enter or Space would re-fire
     whichever pad button the last click left focused - a stray seventh digit
     landing on top of the submit that was actually asked for. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!pinKeypadOwns(e.key)) return;
      e.preventDefault();
      if (/^[0-9]$/.test(e.key)) type(e.key);
      else if (e.key === 'Backspace') erase();
      else if (e.key === 'Enter' && armed) onSubmit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pin, onSubmit]);

  return (
    <>
      <Plate src={plate} alt="UPI PIN verification" />

      <div className="v2-pin-strip" />

      {/* Filled up to the digit count, then one leading dot, then the rest.
          `i === pin.length` is the dot the next digit lands in, and at six
          digits no dot matches it - which is exactly #254:12843.

          The designer's own six-digit frames leave the LAST dot's ring grey
          (#6e6e72) while filling it navy, so the sixth reads with a visible
          rim the other five do not have. That is a slip in five hundred frames
          of variant, not a state, and it is not reproduced. */}
      <svg className="v2-pin-dots" width={1080} height={1920} viewBox="0 0 1080 1920" aria-hidden="true">
        {DOT_CX.map((cx, i) =>
          i < pin.length ? (
            /* Filled: Figma sets fill AND stroke to the same blue, which is a
               solid circle at the ellipse's full radius. */
            <circle key={cx} cx={cx} cy={DOT_CY} r={DOT_R} fill={DOT_INK} />
          ) : (
            <circle
              key={cx}
              cx={cx}
              cy={DOT_CY}
              r={DOT_RING_R}
              fill="none"
              stroke={i === pin.length ? DOT_INK : DOT_GREY}
              strokeWidth={DOT_STROKE}
            />
          ),
        )}
      </svg>

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

      {/* Same outlines every other target gets in mouse mode, drawn here rather
          than by App because these twelve are controls and have no destination
          for it to print. */}
      {mouse && KEYS.map((k, i) => (
        <div
          key={`outline-${k.label}`}
          className="v2-dev-hit"
          style={{ left: KEY_COL[i % 3], top: KEY_ROW[Math.floor(i / 3)], width: KEY_W, height: KEY_H }}
        >
          <span className="v2-dev-chip">{k.label}</span>
        </div>
      ))}
    </>
  );
}
