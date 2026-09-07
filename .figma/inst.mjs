import { figmaGet } from 'file:///C:/Users/iamne/Desktop/figma-agent/skill/scripts/lib.mjs';
const ids=['211:5562','I211:5562;2619:2138','I211:5562;2619:2139','211:6326','I211:6326;2154:5806'];
const j = await figmaGet(`/files/jk3u8GQ1wxKd3Ge5hEPLaJ/nodes?ids=${ids.map(encodeURIComponent).join(',')}&depth=2`);
const hex=c=>'#'+[c.r,c.g,c.b].map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('');
const show=(d,indent='')=>{
  const b=d.absoluteBoundingBox;
  console.log(`${indent}${d.id}  "${d.name}"  ${d.type}  ${b?`${+b.width.toFixed(2)}x${+b.height.toFixed(2)} @abs(${Math.round(b.x)},${Math.round(b.y)})`:''} op=${d.opacity??1} clips=${d.clipsContent??'-'}`);
  for(const f of d.fills||[]) console.log(`${indent}    fill ${f.type} ${f.type==='SOLID'?hex(f.color)+' a='+(+(f.color.a*(f.opacity??1)).toFixed(3)):''} ${f.visible===false?'(hidden)':''}`);
  for(const e of (d.effects||[]).filter(e=>e.visible!==false)) console.log(`${indent}    fx ${e.type} r=${e.radius}`);
  for(const c of d.children||[]) show(c, indent+'  ');
};
for(const id of ids){ const v=j.nodes[id]; if(!v){console.log(id,'MISSING');continue;} console.log('\n#####'); show(v.document); }
