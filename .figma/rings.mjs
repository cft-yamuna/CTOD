import { figmaGet } from 'file:///C:/Users/iamne/Desktop/figma-agent/skill/scripts/lib.mjs';
const IDS = '211:6689,223:1733,223:1850,223:1489,223:1404';
const j = await figmaGet(`/files/jk3u8GQ1wxKd3Ge5hEPLaJ/nodes?ids=${IDS}&depth=3`);
for (const [k, v] of Object.entries(j.nodes)) {
  const root = v.document, ob = root.absoluteBoundingBox;
  console.log(`\n##### ${k} "${root.name}"`);
  const walk = (n, d = 1) => {
    const b = n.absoluteBoundingBox;
    const round = b && Math.abs(b.width - b.height) < 30 && b.width > 90;
    const interesting = round || /ellipse|circle|ring|spin|load|animation|check|badge|arc/i.test(n.name);
    if (interesting && b)
      console.log(`${'  '.repeat(d)}${n.id.padEnd(12)} "${n.name.slice(0,26).padEnd(26)}" ${n.type.padEnd(9)} ${Math.round(b.width)}x${Math.round(b.height)} @(${Math.round(b.x-ob.x)},${Math.round(b.y-ob.y)})`);
    (n.children || []).forEach(c => walk(c, d + 1));
  };
  (root.children || []).forEach(c => walk(c));
}
