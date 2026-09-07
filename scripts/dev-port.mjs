/**
 * Find the port this app is actually on.
 *
 * Vite walks up from 5173 whenever a port is taken, and on this machine 5173
 * is usually held by the sibling TOTD kiosk - so the port moves between runs
 * and hardcoding it has already pointed the diff at the wrong app once. Probe
 * the range and identify ours by the guard string in its <title>, which is the
 * same check `--guard` makes at screenshot time.
 */
export const GUARD = 'TOTD ON-THE-GO Card Flow';

export async function findDevPort(guard = GUARD) {
  if (process.env.PORT) return process.env.PORT;
  const found = [];
  for (let p = 5173; p <= 5182; p++) {
    try {
      const res = await fetch(`http://127.0.0.1:${p}/`, { signal: AbortSignal.timeout(1500) });
      const html = await res.text();
      if (html.includes(guard)) found.push(String(p));
    } catch { /* nothing listening there - that is the normal case */ }
  }
  if (found.length === 0) {
    console.error(`  no dev server serving "${guard}" on 5173-5182.`);
    console.error('  Start one first:  npm run dev');
    process.exit(2);
  }
  /* More than one is not fatal, but it means a stale server is still up and
     the two can drift apart. Say which one is being measured. */
  if (found.length > 1) console.error(`  note: ${found.length} servers match (${found.join(', ')}); using ${found[0]}`);
  return found[0];
}
