#!/usr/bin/env node
/**
 * Split the success badge into the rosette and the tick inside it.
 *
 * The reference recording animates these separately - the rosette scales in
 * first and the tick fades in afterwards - but Figma exports layer #211:6338
 * ("Animation", the designer's own placeholder name) as one flat image with
 * the tick already drawn. So it is separated here rather than by hand.
 *
 * Inside the tick's own padded box, every pixel that is not pure white is
 * part of the tick - including its antialiased fringe, which is greyer than a
 * clean white-to-tick blend and was what an earlier colour-matching rule left
 * behind. Forty-two stray pixels do not sound like much; they read on screen
 * as a ghost of the tick sitting in the rosette before the tick fades in.
 *
 * plain + tick recomposited equals the original exactly, which is what keeps
 * `success` diffing at 0.000% once the animation has settled.
 */
import { PNG } from 'file:///C:/Users/iamne/Desktop/figma-agent/node_modules/pngjs/lib/png.js';
import fs from 'node:fs';

/* Both flows carry the same badge at the same size, so the same box works for
   either. Pass a node to split the add-money flow's copy. */
const NODE = process.argv[2] || '211-6338';
const OUT = process.argv[3] || 'badge';
const SRC = `.figma/layers/${NODE}.png`;
/* The tick's own bounding box (172,184 72x50), padded so its antialiased
   fringe is inside it. Deliberately tight: the rosette's white interior runs
   (122,122)-(293,293), and its own antialiased rim would look exactly like a
   very faint tick pixel if the region were widened to include it. */
const BOX = { x0: 166, y0: 178, x1: 249, y1: 239 };

const src = PNG.sync.read(fs.readFileSync(SRC));
const plain = new PNG({ width: src.width, height: src.height });
const tick = new PNG({ width: src.width, height: src.height });
src.data.copy(plain.data);
tick.data.fill(0);

let n = 0;
for (let y = 0; y < src.height; y++) {
  for (let x = 0; x < src.width; x++) {
    const i = (src.width * y + x) << 2;
    if (src.data[i + 3] < 250) continue;
    if (x < BOX.x0 || x > BOX.x1 || y < BOX.y0 || y > BOX.y1) continue;
    const [r, g, b] = [src.data[i], src.data[i + 1], src.data[i + 2]];
    if (r >= 250 && g >= 250 && b >= 250) continue;

    /* The tick layer keeps the ORIGINAL pixel and is fully opaque, and the
       rosette underneath is set to white. Recompositing at alpha 1 then
       returns the source exactly, and fading the layer down blends each pixel
       back toward the white it covers - which is what the reference does. */
    plain.data[i] = 255; plain.data[i + 1] = 255; plain.data[i + 2] = 255;
    tick.data[i] = r; tick.data[i + 1] = g; tick.data[i + 2] = b;
    tick.data[i + 3] = 255;
    n++;
  }
}

fs.writeFileSync(`public/layers/${OUT}-plain.png`, PNG.sync.write(plain));
fs.writeFileSync(`public/layers/${OUT}-tick.png`, PNG.sync.write(tick));

/* Prove it round-trips: recomposite and compare against the source. */
let worst = 0;
for (let i = 0; i < src.data.length; i += 4) {
  const a = tick.data[i + 3] / 255;
  for (let c = 0; c < 3; c++) {
    const back = plain.data[i + c] * (1 - a) + tick.data[i + c] * a;
    worst = Math.max(worst, Math.abs(back - src.data[i + c]));
  }
}
console.log(`tick pixels: ${n}`);
console.log(`recomposite worst channel error: ${worst.toFixed(2)} / 255`);
