import { figmaGet } from 'file:///C:/Users/iamne/Desktop/figma-agent/skill/scripts/lib.mjs';
const j = await figmaGet('/files/jk3u8GQ1wxKd3Ge5hEPLaJ/nodes?ids=211:6499&depth=2');
const root=j.nodes['211:6499'].document, ob=root.absoluteBoundingBox;
console.log(`FRAME "${root.name}" clips=${root.clipsContent} children=${(root.children||[]).length}`);
(root.children||[]).forEach((c,i)=>{
  const b=c.absoluteBoundingBox, rb=c.absoluteRenderBounds;
  const R=(v,o)=>v==null?'-':+(v-o).toFixed(2);
  console.log(` [${i}] ${c.id.padEnd(11)} "${c.name.slice(0,26).padEnd(26)}" ${c.type.padEnd(10)} op=${c.opacity??1} vis=${c.visible!==false}`);
  console.log(`      box    ${b?`${Math.round(b.width)}x${Math.round(b.height)} @(${R(b.x,ob.x)},${R(b.y,ob.y)})`:'-'}`);
  console.log(`      render ${rb?`${+rb.width.toFixed(2)}x${+rb.height.toFixed(2)} @(${R(rb.x,ob.x)},${R(rb.y,ob.y)})`:'null'}`);
});
