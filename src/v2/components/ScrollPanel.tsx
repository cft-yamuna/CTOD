import { useLayoutEffect, useRef, type PointerEvent, type ReactNode } from 'react'

/**
 * A genuine Figma scroll region: a plate TALLER than the 1080x1920 frame,
 * scrolling inside a fixed window, with the frame's chrome composited over it.
 *
 * V1 got away with rendering these clipped and static because every control it
 * needed was already above the fold. V2 cannot: the Continue button on Amount
 * details sits at frame-y 2718, three quarters of a frame below the bottom
 * edge, and no amount of tapping reaches it. So this scrolls for real.
 *
 * The panel owns ONLY the scrolling window. The background, the fixed header
 * and the fixed footer/CTA are separate plates the caller composites over the
 * top - never put them inside here, or they will scroll away with the content.
 *
 * `contentH` is the height of the exported plate, from `.figma/v2/plates.json`.
 * It is NOT the scroll container's height in Figma: that box under-reports -
 * Amount's container claims 1800 while its own CTA sits 900px below that - so a
 * panel sized from it clips the very control the scroll exists to reach.
 */

/** The window the content is seen through, in frame pixels at 1080x1920. */
export type ScrollViewport = { x: number; y: number; w: number; h: number }

/** A box the prototype declares, in frame pixels - what `flow.ts` stores. */
export type FrameBox = { left: number; top: number; width: number; height: number }

/** Where the exported content's own pixels begin, in frame coordinates. */
export type ContentOrigin = { contentX?: number; contentY?: number }

/**
 * Frame coordinates -> content coordinates. THE one conversion this component
 * needs the caller to get right, so it is a function rather than a sentence.
 *
 * Children are positioned in CONTENT space, not frame space, because the
 * content moves and the frame does not. Content (0,0) is the exported plate's
 * own top-left, which at scrollTop 0 sits at frame `(contentX, contentY)` - the
 * viewport origin only where the export says the two coincide. So a target the
 * prototype declares at frame-y 1982 on Amount, whose content begins at
 * frame-y 299, belongs at content-y `1982 - 299`. Pass every hit box on a
 * scrolling screen through here and the arithmetic cannot go the wrong way
 * round, whichever of the two origins applies.
 *
 * Whatever the origins are, a hit still LANDS back at its declared frame box:
 * the offset cancels between this conversion and the panel's own margin. That
 * is what `v2-flow-test.mjs` asserts, and it is why an export that labels the
 * origins differently cannot silently move a control.
 *
 * A frame-space box below `viewport.y + viewport.h` is not a mistake - it is
 * exactly the case this component exists for. Amount's CTA at frame-y 2718
 * lands at content-y 2419 and is reached by scrolling to it.
 */
export function toContent(
  box: FrameBox,
  viewport: ScrollViewport,
  origin?: ContentOrigin,
): FrameBox {
  /* The content's own top-left, which is NOT the viewport's: the exported plate
     is the union of the region's descendants, and on Card balance that union
     starts at frame (32,282) against a viewport at (44,299). Falling back to
     the viewport is right for the regions where the two do coincide. */
  const ox = origin?.contentX ?? viewport.x
  const oy = origin?.contentY ?? viewport.y
  return {
    left: box.left - ox,
    top: box.top - oy,
    width: box.width,
    height: box.height,
  }
}

/**
 * How far a pointer may travel, in stage pixels, and still count as a tap.
 *
 * SCREEN pixels, not stage pixels - see the note in `onPointerMove`.
 *
 * A kiosk panel reports several pixels of wobble under a stationary finger and
 * a mouse drifts a pixel or two between press and release, so zero would turn
 * half the taps into one-pixel drags; much more than this and a short flick on
 * a 1490px-tall window feels like the screen is ignoring you. Ten reads as
 * "held still" on both. Below it nothing scrolls and the click reaches the hit
 * target underneath; at or above it the panel takes the gesture and swallows
 * the click, so a drag that starts over a button never fires the button.
 */
const DRAG_SLOP = 10

/* The scrollbar has to go, and it cannot go in `src/styles.css`: that file is
   V1's. A visible scrollbar would be ~15 real pixels of chrome the exported
   Figma frame does not have, sitting inside the diff region and narrowing the
   content besides - it would fail the pixel diff on artwork that is correct.
   `scrollbar-width` covers Firefox and Chromium 121+; the webkit rule covers
   every older Chromium, which is what most kiosk shells are. */
const STYLE_ID = 'v2-scroll-panel-style'
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent =
    '.scroll-panel{position:absolute;overflow-x:hidden;overflow-y:auto;' +
    'scrollbar-width:none;-ms-overflow-style:none;overscroll-behavior:contain;' +
    '-webkit-overflow-scrolling:touch;touch-action:pan-y}' +
    '.scroll-panel::-webkit-scrollbar{width:0;height:0;display:none}' +
    '.scroll-panel-content{position:relative}' +
    '.scroll-panel-plate{position:absolute;left:0;top:0;display:block;' +
    'pointer-events:none;-webkit-user-select:none;user-select:none}'
  document.head.appendChild(style)
}

export function ScrollPanel(props: {
  /**
   * The tall plate, e.g. `/v2/scroll/amount-pinelabs-300.png`.
   *
   * Optional, because one region is not a plate: the home screen scrolls a
   * composite - an animated background with four exported layers over it - and
   * has no single image to slide. It passes its layers as `children` instead
   * and gets the same touch, drag, threshold and reset behaviour.
   */
  content?: string
  contentW: number
  contentH: number
  /** Frame-relative, at the 1080x1920 design size. */
  viewport: ScrollViewport
  /** Where the content plate's own pixels begin, in frame coordinates. Defaults
      to the viewport origin, which is only correct where the two coincide. */
  contentX?: number
  contentY?: number
  /** Changing it scrolls back to the top. */
  resetKey?: string
  /** Hit targets, positioned in CONTENT space - see `toContent` above. */
  children?: ReactNode
}): JSX.Element {
  const { content, contentW, contentH, viewport, resetKey, children } = props
  /* At scrollTop 0 the content sits where its own bounds put it, so its offset
     inside the scroller is the gap between the two origins - negative when the
     content begins above or left of the window, which is the usual case. */
  const contentX = props.contentX ?? viewport.x
  const contentY = props.contentY ?? viewport.y
  const box = useRef<HTMLDivElement | null>(null)

  /**
   * Every navigation in the prototype carries `resetScrollPosition: true`, so
   * arriving at a screen must never inherit where the last one was left. This
   * is a layout effect rather than an effect on purpose: an ordinary effect
   * runs after paint, and the user would see one frame of the previous
   * screen's scroll offset before it snapped back.
   *
   * Mount is covered too - the dependency changes from undefined on the first
   * run - which is what makes a deep link land at the top.
   */
  useLayoutEffect(() => {
    const node = box.current
    if (!node) return
    node.scrollTop = 0
    node.scrollLeft = 0
  }, [resetKey])

  /**
   * Pointer drag, for the dev rig only.
   *
   * Touch already scrolls: `touch-action: pan-y` hands a vertical swipe to the
   * browser, which pans it with momentum and - the part that matters - does not
   * synthesise a click afterwards, so a swipe over a button is not a tap on it.
   * Reimplementing that for touch would mean fighting the native pan for the
   * same gesture and double-scrolling until `pointercancel` arrived.
   *
   * A mouse gets none of that: there is no drag-to-scroll for a mouse, and the
   * dev rig has no touchscreen and may have no trackpad either, so a wheel is
   * not a given. Hence this, for `pointerType === 'mouse'` and nothing else.
   */
  const drag = useRef({ id: -1, x0: 0, y0: 0, left0: 0, top0: 0, scale: 1, moved: false })

  /**
   * The stage carries a CSS `transform: scale()` whenever the panel is not
   * exactly 1080x1920, and pointer coordinates are in real screen pixels while
   * `scrollTop` is in the element's own unscaled pixels. Dividing by the scale
   * is what keeps the content under the cursor instead of lagging behind it on
   * a small window and racing ahead of it on a large one.
   *
   * Measured off the element rather than read from Stage: the ratio of the
   * painted box to the laid-out box IS the total scale, whatever ancestor
   * applied it, so this stays right if the stage is ever nested or zoomed
   * again. Guarded against a zero-height box, which is what a display:none
   * ancestor reports.
   */
  const readScale = (node: HTMLDivElement) => {
    const painted = node.getBoundingClientRect().height
    const laidOut = node.offsetHeight
    return laidOut > 0 && painted > 0 ? painted / laidOut : 1
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const node = box.current
    if (!node || e.pointerType !== 'mouse') return
    drag.current = {
      id: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      left0: node.scrollLeft,
      top0: node.scrollTop,
      scale: readScale(node),
      moved: false,
    }
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const node = box.current
    const d = drag.current
    if (!node || d.id !== e.pointerId) return
    /* Inverted: dragging the content up scrolls down, the way a finger does. */
    const rawY = d.y0 - e.clientY
    const rawX = d.x0 - e.clientX
    const dy = rawY / d.scale
    const dx = rawX / d.scale
    if (!d.moved) {
      /* The threshold is measured in SCREEN pixels, not stage pixels.
         The two are the same only at 1:1. On a laptop window the stage scales
         to about a third, so dividing first turned three physical pixels of
         hand-wobble into ten stage pixels and called it a drag - and because a
         drag swallows the click, a perfectly still tap did nothing at all. The
         smaller the window, the worse it got. What the hand did is a fact about
         the screen, so it is judged on the screen. */
      if (Math.abs(rawY) < DRAG_SLOP && Math.abs(rawX) < DRAG_SLOP) return
      d.moved = true
      /* Captured only once it is definitely a drag. Capturing on press would
         retarget the click a plain tap still has to deliver. */
      node.setPointerCapture?.(e.pointerId)
    }
    node.scrollTop = d.top0 + dy
    node.scrollLeft = d.left0 + dx
    /* Otherwise the browser starts a text selection halfway down the plate. */
    e.preventDefault()
  }

  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (d.id !== e.pointerId) return
    d.id = -1
    if (box.current?.hasPointerCapture?.(e.pointerId)) {
      box.current.releasePointerCapture(e.pointerId)
    }
    /* `moved` deliberately survives: the click that decides whether this was a
       tap has not been dispatched yet. The next pointerdown clears it. */
  }

  /**
   * A drag is not a tap. Capture phase, so this runs before any hit target
   * inside the content sees the click and can cancel it outright - which is the
   * whole reason for the movement threshold above.
   */
  const onClickCapture = (e: { preventDefault: () => void; stopPropagation: () => void }) => {
    if (!drag.current.moved) return
    e.preventDefault()
    e.stopPropagation()
  }

  return (
    <div
      ref={box}
      className="scroll-panel"
      /* Frame pixels, exactly like every other coordinate in this app. */
      style={{ left: viewport.x, top: viewport.y, width: viewport.w, height: viewport.h }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClickCapture={onClickCapture}
      /* The harness reads scroll offsets off these, and they are the only way
         to tell one panel from another in the DOM. */
      data-scroll-panel=""
      data-content={content ?? ''}
    >
      <div
        className="scroll-panel-content"
        style={{
          width: contentW,
          height: contentH,
          marginLeft: contentX - viewport.x,
          marginTop: contentY - viewport.y,
        }}
      >
        {content && (
          <img
            className="scroll-panel-plate"
            src={content}
            alt=""
            width={contentW}
            height={contentH}
            draggable={false}
          />
        )}
        {children}
      </div>
    </div>
  )
}
