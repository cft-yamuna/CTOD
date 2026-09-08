/* Turns the staged, id-named PNGs into the public tree + .figma/v2/plates.json.
   Nothing here talks to Figma; it is pure file work, so it can be re-run. */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const N = JSON.parse(readFileSync('.figma/v2/tools/nodes.json','utf8'));
const stage = g => `.figma/v2/stage/${g}`;
const stagedPath = (g,id) => join(stage(g), id.replace(':','-') + '.png');
const png = p => { const b = readFileSync(p);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), sha: createHash('sha256').update(b).digest('hex'), bytes: b.length }; };
const R = v => Math.round(v*100)/100;
/* Two of the staged loader layers are instance sub-nodes, so the exporter's
   `id.replace(':','-')` leaves a colon in the name and Windows turns it into an
   NTFS alternate data stream. copyFileSync refuses those; read + write does not. */
const copy = (src,dst) => writeFileSync(dst, readFileSync(src));

/* Clear only what this manifest owns. public/v2/layers is shared - the
   node-id-named home crops belong to HomeScreen and a blanket wipe deletes
   work that is not ours, so that directory is pruned to the names this run
   will write rather than emptied. */
for (const d of ['public/v2/screens','public/v2/scroll','public/v2/chrome']) {
  if (existsSync(d)) for (const f of readdirSync(d)) rmSync(join(d,f));
  mkdirSync(d,{recursive:true});
}
mkdirSync('public/v2/layers',{recursive:true});
{
  const keep = new Set(Object.keys(N.layers).map(n => `${n}.png`));
  for (const f of readdirSync('public/v2/layers'))
    if (!keep.has(f) && !/^\d+-\d+\.png$/.test(f)) rmSync(join('public/v2/layers', f));
}

const failed = {};
const manifest = { generated:new Date().toISOString(), file:'jk3u8GQ1wxKd3Ge5hEPLaJ', section:'254:858',
                   screens:{}, chrome:{}, layers:{}, aliases:{}, failed };

/* ---------- pre-pass: the setup/recharge receipt question ----------
   `paid` was planned as paid-<bank>-<amount>-<leg> wherever both legs exist,
   because the brief said the leg might change the artwork. Hash first: where
   the two legs render identically the pair collapses onto the plain
   paid-<bank>-<amount> name the brief asked for, and only a genuine difference
   keeps the leg suffix. */
{
  const bySha = new Map();
  for (const s of N.screens) {
    const p = stagedPath('screens', s.node);
    if (existsSync(p)) bySha.set(s.slug, png(p).sha);
  }
  const dual = new Map();
  for (const s of N.screens) if (s.kind === 'paid' && s.baseSlug !== s.slug) {
    if (!dual.has(s.baseSlug)) dual.set(s.baseSlug, []);
    dual.get(s.baseSlug).push(s);
  }
  manifest.paidLegCheck = {};
  for (const [base, pair] of dual) {
    const same = pair.length === 2 && bySha.get(pair[0].slug) && bySha.get(pair[0].slug) === bySha.get(pair[1].slug);
    manifest.paidLegCheck[base] = { legs:pair.map(p=>p.leg), nodes:pair.map(p=>p.node), identical:!!same };
    if (same) for (const p of pair) p.slug = base;   // both collapse; dedup below keeps one file
  }
}

/* ---------- A + B: plates and their scroll content ---------- */
const shaToSlug = new Map();
const shaToScroll = new Map();
let bytesTotal = 0, filesTotal = 0;

for (const s of N.screens) {
  const src = stagedPath('screens', s.node);
  if (!existsSync(src)) { failed[s.slug] = { node:s.node, why:'plate did not export' }; continue; }
  const m = png(src);
  const rec = { file:`/v2/screens/${s.slug}.png`, node:s.node, w:m.w, h:m.h, sha:m.sha, chrome:s.chrome };
  if (s.kind === 'paid')    Object.assign(rec, { leg:s.leg, bank:s.bank, amount:s.amount });
  if (s.kind === 'amount')  Object.assign(rec, { issuer:s.issuer, selected:s.selected });
  if (s.kind === 'balance') Object.assign(rec, { leg:s.leg, issuer:s.issuer, balance:s.balance,
    selected:s.selected, variant:s.variant, figmaFrames:s.siblings });
  /* The 30 `selected` balance frames carry no scroll node: the designer scrolled
     the panel by 482 and flattened it, so the plate IS the scrolled view. */
  if (s.kind === 'balance' && s.variant === 'selected') Object.assign(rec, { preScrolled:true, scrollTop:482 });

  const canon = shaToSlug.get(m.sha);
  if (canon === s.slug) {                       // collapsed setup/recharge pair
    const prev = manifest.screens[canon];
    prev.alsoNodes = [...(prev.alsoNodes||[]), s.node];
    prev.legs = [...new Set([prev.leg, s.leg].filter(Boolean))];
    continue;
  }
  if (canon) { manifest.aliases[s.slug] = canon; rec.file = manifest.screens[canon].file; rec.aliasOf = canon; }
  else { shaToSlug.set(m.sha, s.slug); copy(src, `public/v2/screens/${s.slug}.png`); bytesTotal += m.bytes; filesTotal++; }

  const sc = s.scroll && s.scroll.scroll;
  if (sc) {
    const csrc = stagedPath('scroll', sc.content);
    if (!existsSync(csrc)) { failed[s.slug+':scroll'] = { node:sc.content, why:'scroll content did not export' }; }
    else {
      const cm = png(csrc);
      const [cx,cy,cw,ch] = sc.layoutBox;
      const [ux,uy,uw,uh] = sc.unionBox;
      const [ox,oy] = sc.renderOrigin || [cx,cy];
      const [vx,vy,vw,vh] = sc.containerBox;
      const scrollRec = {
        content:`/v2/scroll/${s.slug}.png`, contentNode:sc.content, contentName:sc.contentName,
        container:sc.container, containerName:sc.containerName, containerClips:sc.containerClips,
        contentW:cm.w, contentH:cm.h, sha:cm.sha,
        /* The container's box is the viewport everywhere except All Payment
           methods entered from `amount`, where the container is sized to its
           own content (2751) and it is the FRAME that clips. Clamp to the
           frame so `viewport.h` always means "how much of the content shows". */
        viewport:{ x:R(vx), y:R(vy), w:R(vw), h:R(Math.min(vh, 1920 - vy)) },
        viewportClamped: vy + vh > 1920 ? { rawContainerHeight:R(vh), clampedTo:R(1920 - vy) } : null,
        /* Where the content sits, two ways. `contentX/Y` is the union of
           descendant BOUNDING boxes - what the hit boxes are declared against.
           `offsetX/Y` is where the exported PNG's own top-left lands, measured
           against the frame plate. They are not the same number and the
           difference is the mask geometry that renders nothing. */
        contentX:R(ux), contentY:R(uy),
        offsetX:R(ox), offsetY:R(oy),
        contentInsetX:R(ox-ux), contentInsetY:R(oy-uy),
        layoutBox:{ x:R(cx), y:R(cy), w:R(cw), h:R(ch) },
        unionBox:{ x:R(ux), y:R(uy), w:R(uw), h:R(uh) },
        heights:{ png:cm.h, layout:R(ch), union:R(uh) }
      };
      scrollRec.heightMismatch = Math.abs(cm.h - ch) > 2 || Math.abs(cm.h - uh) > 2;
      scrollRec.mismatchNote = scrollRec.heightMismatch ? `png=${cm.h} layout=${R(ch)} union=${R(uh)}` : null;
      const ccanon = shaToScroll.get(cm.sha);
      if (ccanon) { scrollRec.content = `/v2/scroll/${ccanon}.png`; scrollRec.aliasOf = ccanon; manifest.aliases[s.slug+':scroll'] = ccanon; }
      else { shaToScroll.set(cm.sha, s.slug); copy(csrc, `public/v2/scroll/${s.slug}.png`); bytesTotal += cm.bytes; filesTotal++; }
      rec.scroll = scrollRec;
    }
  } else if (s.scroll && s.scroll.clippedPanel) {
    const cp = s.scroll.clippedPanel;
    rec.scroll = null;
    rec.scrollable = false;
    rec.clippedPanel = { node:cp.id, name:cp.name,
      box:{x:R(cp.box[0]),y:R(cp.box[1]),w:R(cp.box[2]),h:R(cp.box[3])},
      unionBox:{x:R(cp.unionBox[0]),y:R(cp.unionBox[1]),w:R(cp.unionBox[2]),h:R(cp.unionBox[3])},
      note:'no VERTICAL_SCROLLING child - this state IS a scroll position; content top sits above the panel' };
  }
  manifest.screens[s.slug] = rec;
}

/* ---------- C: chrome ---------- */
const geom = JSON.parse(readFileSync('.figma/v2/tools/chrome-geom.json','utf8'));
const shaToChrome = new Map();
for (const [fam, c] of Object.entries(N.chrome)) {
  const parts = [];
  for (const role of ['bg','header','footer']) {
    const p = c[role];
    if (p.hidden) { parts.push({ role, node:p.node, hidden:true, fill:p.fill,
      note:`Gradient Bkg instance is visible:false on this family - the background is the frame fill ${p.fill}` }); continue; }
    const src = stagedPath('chrome', p.node);
    if (!existsSync(src)) { failed[`${fam}:${role}`] = { node:p.node, why:'chrome node did not export' }; continue; }
    const m = png(src);
    const g = geom[p.node] || {};
    const name = `${fam.replace(/Family$/,'')}-${role}`;
    let file = `/v2/chrome/${name}.png`;
    const canon = shaToChrome.get(m.sha);
    if (canon) { file = canon.file; manifest.aliases[`chrome:${name}`] = canon.name; }
    else { shaToChrome.set(m.sha, {file,name}); copy(src, `public/v2/chrome/${name}.png`); bytesTotal += m.bytes; filesTotal++; }
    parts.push({ role, file, node:p.node, figmaName:p.name||g.name,
      left:R((g.render||g.layout||[0,0])[0]), top:R((g.render||g.layout||[0,0])[1]),
      width:m.w, height:m.h,
      layoutBox: g.layout ? {x:R(g.layout[0]),y:R(g.layout[1]),w:R(g.layout[2]),h:R(g.layout[3])} : null,
      zIndex: g.z, overlay: !!p.overlay, sha:m.sha,
      ...(canon ? {aliasOf:canon.name} : {}) });
  }
  manifest.chrome[fam] = parts;
}

/* ---------- D: layers ---------- */
const shaToLayer = new Map();
for (const [name, l] of Object.entries(N.layers)) {
  const src = stagedPath('layers', l.node);
  if (!existsSync(src)) { failed[`layer:${name}`] = { node:l.node, why:'layer node did not export' }; continue; }
  const m = png(src);
  const g = geom[l.node] || {};
  let file = `/v2/layers/${name}.png`;
  /* Owned layers are referenced by file name from HomeScreen, so they are
     never collapsed onto a twin even when the bytes match. */
  const canon = l.owner ? null : shaToLayer.get(m.sha);
  if (canon) { file = canon.file; manifest.aliases[`layer:${name}`] = canon.name; }
  else { shaToLayer.set(m.sha, {file,name}); copy(src, `public/v2/layers/${name}.png`); bytesTotal += m.bytes; filesTotal++; }
  manifest.layers[name] = { file, node:l.node, w:m.w, h:m.h, note:l.note, sha:m.sha,
    ...(l.owner ? { owner:l.owner } : {}),
    left: g.render?R(g.render[0]):null, top: g.render?R(g.render[1]):null,
    layoutBox: g.layout ? {x:R(g.layout[0]),y:R(g.layout[1]),w:R(g.layout[2]),h:R(g.layout[3])} : null,
    frame: g.frame || null, ...(canon?{aliasOf:canon.name}:{}) };
}

/* ---------- verification: do the scroll pixels really start where we say? ----
   One representative per scroll-container shape. The content plate is slid
   over its own frame plate at the recorded offset and the opaque overlay
   pixels are compared; the true offset is the one that reads ~0%. */
{
  const { decode, rowDiff } = await import('./png.mjs');
  const seen = new Set();
  manifest.verified = {};
  for (const [slug, rec] of Object.entries(manifest.screens)) {
    const sc = rec.scroll; if (!sc) continue;
    if (seen.has(sc.containerName)) continue; seen.add(sc.containerName);
    try {
      const base = decode(stagedPath('screens', rec.node));
      const over = decode(stagedPath('scroll', sc.contentNode));
      const y0 = Math.round(sc.viewport.y) + 40, y1 = Math.min(base.h - 60, Math.round(sc.viewport.y + sc.viewport.h) - 40);
      const cand = [];
      for (const dx of [-14,-13,-12,-2,-1,0,1,2])
        for (const dy of [-18,-17,-16,-2,-1,0,1,2])
          cand.push({ dx, dy, r: rowDiff(base, over, Math.round(sc.offsetX)+dx, Math.round(sc.offsetY)+dy, y0, y1) });
      const best = cand.sort((a,b) => a.r.pct - b.r.pct)[0];
      const claimed = cand.find(c => c.dx === 0 && c.dy === 0);
      manifest.verified[slug] = { containerName:sc.containerName,
        claimed:{ x:sc.offsetX, y:sc.offsetY, mismatchPct: Math.round(claimed.r.pct*1e5)/1e3 },
        unionOrigin:{ x:sc.contentX, y:sc.contentY },
        best:{ x: Math.round(sc.offsetX)+best.dx, y: Math.round(sc.offsetY)+best.dy,
               mismatchPct: Math.round(best.r.pct*1e5)/1e3 },
        comparedPixels: best.r.total,
        /* `ok` means no other offset in +/-2px (or at the union origin) reads
           better - i.e. the recorded offset IS the right one. The residual is
           not misalignment: a content node whose own origin is fractional
           (43.81, 34.31, 6.62) rasterises on a different sub-pixel phase when
           Figma renders it alone than when it renders it inside the frame, so
           high-contrast text rows never diff to zero. Only `amount`, whose
           content origin is the integer (0,299), reaches 0.001%. */
        ok: best.dx === 0 && best.dy === 0,
        exact: best.dx === 0 && best.dy === 0 && best.r.pct < 0.005,
        residual: (best.dx === 0 && best.dy === 0 && best.r.pct >= 0.005)
          ? 'sub-pixel raster phase (fractional content origin) and, on intro, the visible Gradient Bkg overlay that is chrome' : null };
    } catch (e) { manifest.verified[slug] = { error: String(e.message) }; }
  }
}

/* ---------- near-duplicates ----------
   sha256 only collapses byte-identical files, and that under-reports how much
   of this set is really the same picture. The Amount details plates are the
   case that matters: the chips sit at frame-y 1982 and the total at 2545, both
   below the 1920 fold, so selecting a chip changes nothing inside the plate -
   all six plates per issuer are the same image, differing only in a handful of
   sub-pixel AA samples. Recorded, not collapsed: the brief asked for sha
   dedup, so the files stay and the build can fold them further if it likes. */
{
  const { decode } = await import('./png.mjs');
  const canon = Object.entries(manifest.screens).filter(([,r]) => !r.aliasOf);
  const fp = new Map(), imgs = new Map();
  for (const [slug, r] of canon) {
    const img = decode(stagedPath('screens', r.node));
    imgs.set(slug, img);
    let h = '';
    for (let by = 0; by < img.h; by += 64) for (let bx = 0; bx < img.w; bx += 64) {
      let sum = 0, n = 0;
      for (let y = by; y < Math.min(by+64, img.h); y += 8) for (let x = bx; x < Math.min(bx+64, img.w); x += 8) {
        const i = (y*img.w + x) * img.ch; sum += img.px[i] + img.px[i+1] + img.px[i+2]; n += 3;
      }
      h += String.fromCharCode(65 + Math.round(sum/n/8));
    }
    if (!fp.has(h)) fp.set(h, []);
    fp.get(h).push(slug);
  }
  manifest.nearAliases = {};
  for (const group of fp.values()) {
    if (group.length < 2) continue;
    const base = imgs.get(group[0]);
    for (const slug of group.slice(1)) {
      const o = imgs.get(slug);
      if (o.w !== base.w || o.h !== base.h) continue;
      let bad = 0;
      for (let i = 0; i < base.px.length; i += base.ch)
        if (Math.abs(base.px[i]-o.px[i]) > 2 || Math.abs(base.px[i+1]-o.px[i+1]) > 2 || Math.abs(base.px[i+2]-o.px[i+2]) > 2) bad++;
      const pct = bad / (base.w * base.h);
      if (pct < 0.0005) manifest.nearAliases[slug] = { sameAs: group[0], differingPixels: bad, pct: Math.round(pct*1e6)/1e4 };
    }
  }
}

/* fold the pixel verdict back into the leg question the brief asked */
for (const [base, v] of Object.entries(manifest.paidLegCheck)) {
  const rech = `${base}-recharge`;
  v.pixelIdentical = !!manifest.nearAliases[rech];
  v.differingPixels = manifest.nearAliases[rech]?.differingPixels ?? null;
  v.verdict = v.identical ? 'byte-identical'
            : v.pixelIdentical ? 'same artwork, different PNG bytes (sub-pixel AA only) - one plate would do'
            : 'genuinely different artwork - both kept';
}

manifest.summary = {
  platesPlanned: N.screens.length,
  platesDistinct: shaToSlug.size,
  scrollPlanned: N.screens.filter(s=>s.scroll&&s.scroll.scroll).length,
  scrollDistinct: shaToScroll.size,
  chromeDistinct: shaToChrome.size,
  layersDistinct: Object.values(manifest.layers).filter(l=>!l.aliasOf).length,
  platesDistinctByPixels: shaToSlug.size - Object.keys(manifest.nearAliases).length,
  filesWritten: filesTotal,
  megabytes: R(bytesTotal/1048576),
  failed: Object.keys(failed).length
};
writeFileSync('.figma/v2/plates.json', JSON.stringify(manifest,null,1));
console.log(JSON.stringify(manifest.summary,null,1));
