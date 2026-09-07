import { figmaGet } from 'file:///C:/Users/iamne/Desktop/figma-agent/skill/scripts/lib.mjs';
const j = await figmaGet('/files/jk3u8GQ1wxKd3Ge5hEPLaJ/nodes?ids=223:1733,223:1850,211:6689&depth=2');
for (const [k, v] of Object.entries(j.nodes)) {
  const root = v.document, ob = root.absoluteBoundingBox;
  console.log(`\n### ${k} "${root.name}"  children=${(root.children||[]).length}`);
  (root.children||[]).forEach((c,i)=>{
    const b=c.absoluteBoundingBox, rb=c.absoluteRenderBounds;
    console.log(` [${i}] ${c.id.padEnd(11)} "${c.name.slice(0,24).padEnd(24)}" ${c.type.padEnd(10)} ${b?`${Math.round(b.width)}x${Math.round(b.height)} @(${Math.round(b.x-ob.x)},${Math.round(b.y-ob.y)})`:'-'} render=${rb?'y':'NULL'} op=${c.opacity??1}`);
  });
}
