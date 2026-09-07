import { figmaGet } from 'file:///C:/Users/iamne/Desktop/figma-agent/skill/scripts/lib.mjs';
const VAR=['211:941','211:944','211:947','211:950'];
const j = await figmaGet(`/files/jk3u8GQ1wxKd3Ge5hEPLaJ/nodes?ids=${VAR.join(',')},211:3317,211:3320&depth=2`);
const hex=c=>'#'+[c.r,c.g,c.b].map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('')+(c.a<1?` a=${+c.a.toFixed(3)}`:'');
for(const id of [...VAR,'211:3317','211:3320']){
  const v=j.nodes[id]; if(!v) continue;
  const d=v.document, ob=d.absoluteBoundingBox;
  console.log(`\n### ${id} "${d.name}"  ${Math.round(ob.width)}x${Math.round(ob.height)}  bg=${(d.backgroundColor?hex(d.backgroundColor):'-')}`);
  for(const c of d.children||[]){
    const b=c.absoluteBoundingBox;
    console.log(`  ${c.name}  ${c.type}  ${Math.round(b.width)}x${Math.round(b.height)} @(${+(b.x-ob.x).toFixed(2)},${+(b.y-ob.y).toFixed(2)})  op=${c.opacity??1}`);
    for(const f of c.fills||[]){
      if(f.type==='SOLID') console.log(`      fill SOLID ${hex(f.color)} op=${f.opacity??1}`);
      else if(f.type.startsWith('GRADIENT')) console.log(`      fill ${f.type} stops=${f.gradientStops.map(s=>hex(s.color)+'@'+(+s.position.toFixed(3))).join(' ')} handles=${JSON.stringify(f.gradientHandlePositions?.map(h=>[+h.x.toFixed(3),+h.y.toFixed(3)]))}`);
      else console.log(`      fill ${f.type}`);
    }
    for(const e of c.effects||[]) console.log(`      effect ${e.type} radius=${e.radius} visible=${e.visible!==false}`);
  }
}
