/* A minimal PNG reader - enough to check that a scroll plate's pixels land
   where the manifest says they do. Handles 8-bit RGB/RGBA, non-interlaced,
   which is everything Figma's /images endpoint returns. */
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

export function decode(path) {
  const buf = readFileSync(path);
  let off = 8, w = 0, h = 0, bitDepth = 0, colorType = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9];
      if (data[12] !== 0) throw new Error('interlaced PNG not supported');
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2))
    throw new Error(`unsupported PNG: depth ${bitDepth} colorType ${colorType}`);
  const ch = colorType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const px = Buffer.alloc(h * stride);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[p++];
    const line = raw.subarray(p, p + stride); p += stride;
    const cur = px.subarray(y * stride, (y + 1) * stride);
    const prev = y ? px.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= ch ? prev[x - ch] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      cur[x] = v & 255;
    }
  }
  return { w, h, ch, px };
}

/* Composite one decoded image over another (white ground) and count the
   fraction of pixels that differ by more than `tol` per channel. */
export function rowDiff(base, over, dx, dy, y0, y1, tol = 6) {
  let bad = 0, total = 0;
  for (let y = y0; y < y1; y++) {
    const by = y, oy = y - dy;
    if (oy < 0 || oy >= over.h || by < 0 || by >= base.h) continue;
    for (let x = 0; x < over.w; x++) {
      const bx = x + dx;
      if (bx < 0 || bx >= base.w) continue;
      const oi = (oy * over.w + x) * over.ch;
      const bi = (by * base.w + bx) * base.ch;
      const oa = over.ch === 4 ? over.px[oi + 3] : 255;
      if (oa < 250) continue;              // only compare opaque overlay pixels
      total++;
      for (let c = 0; c < 3; c++) if (Math.abs(over.px[oi + c] - base.px[bi + c]) > tol) { bad++; break; }
    }
  }
  return { total, bad, pct: total ? bad / total : 1 };
}
