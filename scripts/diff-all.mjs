#!/usr/bin/env node
/**
 * Diff every screen against its exported Figma frame, in one run.
 *
 * The screens are deep-linked with `?screen=`, so each one is photographed
 * directly rather than by walking the flow to reach it - a broken transition
 * then shows up in flow-test.mjs as a broken transition, and not here as a
 * mystery 40% mismatch on the screen after it.
 *
 * `--guard` is passed on every call and is not optional: this harness has
 * measured the wrong page before (a stranger's dev server on the same port,
 * and an empty 404 from a server bound IPv6-only), and both produced
 * plausible-looking percentages.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { findDevPort, GUARD as GUARD_STR } from './dev-port.mjs';

const DIFF = 'C:/Users/iamne/Desktop/figma-agent/skill/scripts/visual-diff.mjs';
const GUARD = GUARD_STR;
const URL = `http://127.0.0.1:${await findDevPort()}/`;

/* slug -> the exported frame it must match. The refs are on disk with the
   node id dash-separated, the way Figma's own URLs write it. */
const REF = {
  // Setup, Figma section #211:5455.
  home: '211-5561', intro: '211-5505', terms: '211-5456', cities: '211-6054',
  issuer: '211-6137', cardstyle: '211-6253', amount: '211-6178', methods: '211-6530',
  upipin2: '211-6419', upipin: '211-6339', success: '211-6304', paid: '211-6499',
  loading: '211-6689', balance: '211-6706',
  // Add Money, Figma section #223:1403.
  addmoney2: '223-1574', addmoney: '223-1404', addmethods: '223-1881',
  addpin2: '223-1652', addpin: '223-1769', addsuccess: '223-1733',
  addpaid: '223-1850', addbalance: '223-1489',
};

const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const names = only.length ? only : Object.keys(REF);

const results = [];
for (const name of names) {
  const ref = `.figma/ref/${REF[name]}.png`;
  if (!existsSync(ref)) { console.log(`  SKIP ${name} - no ref at ${ref}`); continue; }
  const r = spawnSync(process.execPath, [
    DIFF,
    '--url', `${URL}?screen=${name}`,
    '--ref', ref,
    '--width', '1080', '--height', '1920',
    '--out', `.figma/diff/${name}`,
    '--guard', GUARD,
    '--report',
  ], { encoding: 'utf8' });

  const out = (r.stdout || '') + (r.stderr || '');
  const pct = out.match(/([\d.]+)\s*%/)?.[1];
  results.push({ name, pct: pct ? Number(pct) : null, out });
  console.log(`\n===== ${name} =====`);
  console.log(out.trim());
}

console.log('\n\n================ SUMMARY ================');
for (const r of results.sort((a, b) => (b.pct ?? 999) - (a.pct ?? 999))) {
  const v = r.pct == null ? '  ??  ' : `${r.pct.toFixed(3)}%`.padStart(8);
  const verdict = r.pct == null ? 'NO NUMBER' : r.pct < 0.5 ? 'pass' : r.pct < 3 ? 'one or two elements out' : 'STRUCTURAL';
  console.log(`${v}  ${r.name.padEnd(10)} ${verdict}`);
}
const bad = results.filter((r) => r.pct == null || r.pct >= 0.5);
console.log(bad.length ? `\n${bad.length} of ${results.length} screens need work.` : `\nAll ${results.length} screens under 0.5%.`);
