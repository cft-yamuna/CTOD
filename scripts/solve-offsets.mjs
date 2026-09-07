/* Find where each exported layer actually belongs on the plate.
 *
 * Figma exports a node at its full render extent, unclipped by the parent
 * frame, so a carousel that runs off the edge comes back wider than its layout
 * box and its origin is not the box origin. Rather than guess, match it:
 * take the layer's fully-opaque pixels, slide it over the plate, and find the
 * offset where those pixels equal the plate's. An opaque pixel is an exact
 * colour match, so the right offset scores near zero and nothing else comes
 * close. */
import { PNG } from 'file:///C:/Users/iamne/Desktop/figma-agent/node_modules/pngjs/lib/png.js';
import fs from 'node:fs';

const PLATE = process.env.PLATE || '.figma/ref/211-5561.png';
const plate = PNG.sync.read(fs.readFileSync(PLATE));
const px = (img, x, y) => {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return null;
  const i = (img.width * y + x) << 2;
  return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]];
};

/* node -> the layout box we started from, as the centre of the search. */
const SETS = {
  home: [
    { node: '211-5566', bx: 0,  by: 784 },
    { node: '211-5840', bx: 44, by: 482 },
    { node: '211-5935', bx: 44, by: 366 },
    { node: '211-6014', bx: 0,  by: 0 },
  ],
  success: [
    { node: '211-6305', bx: -69, by: 1537 },
    { node: '211-6325', bx: 0,   by: -21 },
    { node: '211-6327', bx: 0,   by: 0 },
    { node: '211-6337', bx: 305, by: 1209 },
    { node: '211-6338', bx: 335, by: 753 },
  ],
  paid: [
    { node: '211-6501', bx: 89,  by: 958 },
    { node: '211-6510', bx: 0,   by: 0 },
    { node: '211-6512', bx: 461, by: 169 },
    { node: '211-6513', bx: 180, by: 352 },
    { node: '211-6515', bx: 391, by: 436 },
    { node: '211-6516', bx: 31,  by: 1294 },
    { node: '211-6524', bx: 366, by: 1120 },
    { node: '211-6526', bx: 302, by: 742 },
    { node: '211-6527', bx: 0,   by: 0 },
    { node: '211-6529', bx: 0,   by: 1477 },
  ],
};
const CASES = SETS[process.env.SET || 'home'];

for (const c of CASES) {
  const L = PNG.sync.read(fs.readFileSync(`.figma/layers/${c.node}.png`));
  /* Sample opaque pixels spread across the layer rather than all of them. */
  const pts = [];
  for (let y = 0; y < L.height && pts.length < 4000; y += 3)
    for (let x = 0; x < L.width && pts.length < 4000; x += 3) {
      const p = px(L, x, y);
      if (p && p[3] === 255) pts.push([x, y, p]);
    }
  if (!pts.length) { console.log(`${c.node}: no fully-opaque pixels to match on`); continue; }

  let best = null;
  for (let dy = c.by - 120; dy <= c.by + 120; dy++) {
    for (let dx = c.bx - 260; dx <= c.bx + 260; dx++) {
      let err = 0, n = 0;
      for (const [x, y, p] of pts) {
        const q = px(plate, x + dx, y + dy);
        if (!q) continue;
        err += Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]);
        n++;
        if (best && err / 1 > best.err * 3 && n > 400) break;   // early bail
      }
      if (n < 200) continue;
      const score = err / n;
      if (!best || score < best.score) best = { dx, dy, score, err, n };
    }
  }
  const moved = best.dx !== c.bx || best.dy !== c.by;
  console.log(`${c.node}  export ${L.width}x${L.height}  box (${c.bx},${c.by})  ->  BEST (${best.dx},${best.dy})  meanErr=${best.score.toFixed(3)} on ${best.n}px  ${moved ? '<-- MOVED' : 'box was right'}`);
}
