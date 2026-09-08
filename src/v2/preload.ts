/**
 * Artwork is decoded BEFORE it is put on screen, never after.
 *
 * Selecting an amount chip does not edit a chip - it swaps the whole scrolling
 * plate for another 385KB export of the same screen with one chip drawn
 * differently. Handed straight to the <img> that was showing the old one, the
 * browser drops the frame it had, fetches, decodes, and only then paints: on
 * the kiosk that is one to three blank frames across the entire body of the
 * screen, which is the flicker. It is not a slow machine and it is not React -
 * the same swap flickers on a warm cache the first time each variant is seen,
 * because a cached image is still decoded asynchronously.
 *
 * So every image this app is ABOUT to need is fetched and decoded ahead of the
 * tap that needs it, and a swap that somehow still arrives cold is held until
 * its bitmap is ready rather than shown half-made. Two rules, and between them
 * there is no moment where the screen has nothing to draw.
 *
 * `decode()` and not `onload`: onload fires when the bytes are in, which is
 * before the PNG is a bitmap, and the decode of a 1080x2717 plate is the part
 * that costs a frame.
 */

/** Every src that has finished - decoded, or failed and never worth retrying. */
const settled = new Set<string>();

/** In-flight loads, so a src asked for twice is fetched once. */
const running = new Map<string, Promise<void>>();

/** Kept alive: an Image dropped before it decodes can be collected mid-flight. */
const held = new Map<string, HTMLImageElement>();

/** True once this src can be painted in the frame it is assigned. */
export const isReady = (src: string) => settled.has(src);

/**
 * Fetch and decode one image.
 *
 * Never rejects. A missing plate is a bug in the flow, not a reason to strand
 * the kiosk mid-tap - it is recorded as settled so the flow moves on and the
 * broken <img> is visible, which is how a missing export gets noticed.
 */
export function preload(src: string): Promise<void> {
  if (!src || settled.has(src)) return Promise.resolve();
  const already = running.get(src);
  if (already) return already;

  const img = new Image();
  held.set(src, img);
  img.decoding = 'async';
  img.src = src;

  const done = (img.decode
    ? img.decode()
    : new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
      })
  )
    .catch(() => undefined)
    .then(() => {
      settled.add(src);
      running.delete(src);
      held.delete(src);
    });

  running.set(src, done);
  return done;
}

/** Fetch and decode a set of images. Resolves when the last one is ready. */
export const preloadAll = (srcs: Iterable<string>): Promise<void> =>
  Promise.all([...srcs].map(preload)).then(() => undefined);

/**
 * Wait for artwork to be ready, but never for longer than `budgetMs`.
 *
 * The budget is what keeps this honest. Holding a tap until its artwork is
 * decoded is right; holding it indefinitely because one plate is missing or the
 * disk is slow would make the kiosk look dead, and a screen that arrives one
 * frame rough is better than a screen that never arrives. With the prefetch
 * below doing its job this resolves on the spot and the budget is never spent.
 */
export function ready(srcs: Iterable<string>, budgetMs: number): Promise<void> {
  const list = [...srcs];
  if (list.every(isReady)) return Promise.resolve();
  return Promise.race([
    preloadAll(list),
    new Promise<void>((resolve) => window.setTimeout(resolve, budgetMs)),
  ]);
}

/**
 * Run when the browser is not busy - and definitely run.
 *
 * Prefetching the next screens must not compete with painting the one in front
 * of the customer, so it waits for idle; but `requestIdleCallback` is not
 * everywhere and a kiosk that is never idle would prefetch nothing, so the
 * timeout is both the fallback and the deadline.
 */
export function onIdle(fn: () => void, timeout = 400): () => void {
  const ric = (window as unknown as {
    requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
    cancelIdleCallback?: (h: number) => void;
  });
  if (ric.requestIdleCallback) {
    const h = ric.requestIdleCallback(fn, { timeout });
    return () => ric.cancelIdleCallback?.(h);
  }
  const t = window.setTimeout(fn, timeout);
  return () => window.clearTimeout(t);
}
