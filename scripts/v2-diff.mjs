#!/usr/bin/env node
/**
 * Diff every V2 screen against its exported Figma frame, in one run.
 *
 * V1's `diff-all.mjs` with two differences, and only two.
 *
 * The first is that V2 has no screen NAMES to key off - the plate is chosen by
 * state, so `?screen=amount` is not one plate but eighteen. What is diffed here
 * is the state a deep link lands in: `INITIAL` plus the template, which is the
 * frame the designer drew first in each family. Anything else would need the
 * flow walked to reach it, and a broken transition would then show up here as a
 * mystery 40% mismatch instead of in `v2-flow-test.mjs` as a broken transition.
 *
 * The second is scroll. Four templates render a plate taller than the frame
 * inside a viewport; a deep link arrives with the panel at the top (Figma's own
 * `resetScrollPosition`), which is exactly the state the exported frame shows.
 * So these diff like any other screen - as long as nobody photographs one after
 * scrolling it, which is why this deep-links rather than walks.
 *
 * `--guard` is passed on every call and is not optional: this harness has
 * measured the wrong page before (a stranger's dev server on the same port, and
 * an empty 404 from a server bound IPv6-only), and both produced plausible
 * percentages. V2 needs one check more, because V1 is still in this build and
 * still served by the same port under `?v=1` - the guard string cannot tell the
 * two apps apart, so the preflight below asks the dev server for `src/v2` code
 * directly.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { findDevPort, GUARD as GUARD_STR } from './dev-port.mjs';

const DIFF = 'C:/Users/iamne/Desktop/figma-agent/skill/scripts/visual-diff.mjs';
const GUARD = GUARD_STR;
const PORT = await findDevPort();
const URL = `http://127.0.0.1:${PORT}/`;

/* V2 is the app at `/`; V1 is kept reachable at `?v=1` (see src/main.tsx). The
   two share an index.html and therefore a guard string, so the guard alone
   would happily photograph V1 and report it as V2. Ask for a module that only
   V2 has instead. */
try {
  const probe = await fetch(`${URL}src/v2/flow.ts`, { signal: AbortSignal.timeout(4000) });
  const body = await probe.text();
  if (!probe.ok || !/plateFor|HITS/.test(body)) {
    console.error(`  ${URL} serves the guard but not the V2 flow module.`);
    console.error('  Is this the ctod-setup dev server, and has src/v2 landed?');
    process.exit(2);
  }
} catch {
  console.error(`  no dev server on ${URL}. Start one first:  npm run dev`);
  process.exit(2);
}

/* ------------------------------------------------------------------------ *
 * What to diff, and against what
 * ------------------------------------------------------------------------ */

/**
 * The refs are named by node with the colon replaced by a dash, the way Figma's
 * own URLs write it and the way `.figma/ref/` already does for V1. Which
 * directory they land in is the export pass's call and has moved once already,
 * so look rather than assume - and say which one was used, because a diff run
 * against a stale directory is the one failure mode that still reports numbers.
 */
const REF_DIRS = ['.figma/v2/ref', '.figma/v2ref', '.figma/ref/v2', 'public/v2/ref'];

/** `254:1628` -> `254-1628`. */
const slugNode = (node) => String(node).replace(/:/g, '-');

/**
 * A reference has to be the frame at native size or the percentage it produces
 * is meaningless. `.figma/v2ref/` already holds half-scale scouting exports
 * under names that collide with the template names - `amount.png` is 540x960 -
 * and diffing against one of those would report a structural failure on artwork
 * that is perfect. The IHDR is the first chunk of a PNG, so this is a 24-byte
 * read and needs no image library.
 */
const frameSized = (path) => {
  try {
    const b = readFileSync(path);
    return b.readUInt32BE(16) === 1080 && b.readUInt32BE(20) === 1920;
  } catch { return false; }
};

const refFor = (name, node) => {
  const tries = [];
  for (const dir of REF_DIRS) {
    if (node) tries.push(`${dir}/${slugNode(node)}.png`);
    tries.push(`${dir}/${name}.png`);
  }
  const found = tries.filter(existsSync);
  const sized = found.find(frameSized);
  if (sized) return sized;
  if (found.length) console.log(`  note: ${found[0]} is not 1080x1920 - ignoring it`);
  return null;
};

const readJson = (path) => {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
};

/**
 * template -> the Figma node its deep link lands on.
 *
 * Read, not re-typed. `.figma/v2/plates.json` is the export pass's own manifest
 * and wins when it is there; until it is, the same node ids are already in the
 * hit map the app itself is built from. Both are tolerated in several shapes,
 * because this script has to keep running while the export agent is still
 * settling on one - a diff harness that only works after everything else is
 * finished is a diff harness nobody runs during the build.
 */
function screenNodes() {
  const plates = readJson('.figma/v2/plates.json');
  const fromPlates = new Map();
  if (plates) {
    const rows = Array.isArray(plates) ? plates
      : Array.isArray(plates.plates) ? plates.plates
      : Object.entries(plates).map(([k, v]) => (typeof v === 'string' ? { slug: k, node: v } : { slug: k, ...v }));
    for (const r of rows) {
      const slug = r.template ?? r.screen ?? r.slug ?? r.name;
      /* The manifest is keyed by plate slug (`paid-iob-150`), and a template's
         representative plate is the one whose slug is the bare template name or
         its first segment. Keep the first, which is the order the plan was
         written in and therefore the designer's own first frame per family. */
      const template = String(slug ?? '').split('-')[0];
      if (template && !fromPlates.has(template)) fromPlates.set(template, { node: r.node, ref: r.ref });
    }
  }

  const hits = readJson('src/v2/hits.json') ?? readJson('.figma/v2/hits.json');
  const fromHits = new Map(Object.entries(hits?.templates ?? {}).map(([t, s]) => [t, { node: s.node }]));

  /* Union, manifest first. A template in one and not the other is reported
     rather than skipped silently. */
  const all = new Map(fromHits);
  for (const [t, v] of fromPlates) all.set(t, { ...(all.get(t) ?? {}), ...v });
  return { all, sources: [plates && '.figma/v2/plates.json', hits && 'hits.json'].filter(Boolean) };
}

const { all: NODES, sources } = screenNodes();
if (NODES.size === 0) {
  console.error('  no template list found. Expected .figma/v2/plates.json or src/v2/hits.json.');
  process.exit(2);
}

const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const names = only.length ? only : [...NODES.keys()];

console.log(`  ${URL} - ${names.length} templates, from ${sources.join(' + ')}`);

/* ------------------------------------------------------------------------ */

const results = [];
for (const name of names) {
  const entry = NODES.get(name);
  if (!entry) { console.log(`  SKIP ${name} - not a template in the hit map`); continue; }
  const ref = entry.ref && existsSync(entry.ref) && frameSized(entry.ref) ? entry.ref : refFor(name, entry.node);
  if (!ref) {
    console.log(`  SKIP ${name} - no ref for node ${entry.node ?? '?'} in ${REF_DIRS.join(', ')}`);
    results.push({ name, pct: null, out: 'no reference export' });
    continue;
  }
  const r = spawnSync(process.execPath, [
    DIFF,
    '--url', `${URL}?screen=${name}`,
    '--ref', ref,
    '--width', '1080', '--height', '1920',
    '--out', `.figma/v2/diff/${name}`,
    '--guard', GUARD,
    '--report',
  ], { encoding: 'utf8' });

  const out = (r.stdout || '') + (r.stderr || '');
  const pct = out.match(/([\d.]+)\s*%/)?.[1];
  results.push({ name, pct: pct ? Number(pct) : null, out, ref });
  console.log(`\n===== ${name}  (ref ${ref}) =====`);
  console.log(out.trim());
}

console.log('\n\n================ SUMMARY ================');
for (const r of results.sort((a, b) => (b.pct ?? 999) - (a.pct ?? 999))) {
  const v = r.pct == null ? '  ??  ' : `${r.pct.toFixed(3)}%`.padStart(8);
  const verdict = r.pct == null ? 'NO NUMBER' : r.pct < 0.5 ? 'pass' : r.pct < 3 ? 'one or two elements out' : 'STRUCTURAL';
  console.log(`${v}  ${r.name.padEnd(14)} ${verdict}`);
}
const bad = results.filter((r) => r.pct == null || r.pct >= 0.5);
console.log(bad.length ? `\n${bad.length} of ${results.length} screens need work.` : `\nAll ${results.length} screens under 0.5%.`);

/* `exitCode` rather than `exit()`. On Windows, node 24 aborts with a libuv
   assertion (`UV_HANDLE_CLOSING`, src\win\async.c) when `process.exit()` is
   called with this much output still in flight to a pipe or a file - so a run
   that had merely failed would look like a crashed harness. Setting the code
   and letting the loop drain gives the same exit status and no abort. */
process.exitCode = bad.length ? 1 : 0;
