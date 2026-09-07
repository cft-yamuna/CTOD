import { figmaGet } from 'file:///C:/Users/iamne/Desktop/figma-agent/skill/scripts/lib.mjs';
const j = await figmaGet('/files/jk3u8GQ1wxKd3Ge5hEPLaJ/nodes?ids=211:5561,211:6304&depth=3');
for(const [k,v] of Object.entries(j.nodes)){
  const root=v.document, ob=root.absoluteBoundingBox;
  console.log(`\n##### ${k} "${root.name}"  ${Math.round(ob.width)}x${Math.round(ob.height)}  clips=${root.clipsContent}`);
  (root.children||[]).forEach((c,i)=>{
    const b=c.absoluteBoundingBox;
    const rel=b?`${Math.round(b.width)}x${Math.round(b.height)} @(${Math.round(b.x-ob.x)},${Math.round(b.y-ob.y)})`:'-';
    console.log(` [${i}] ${c.id.padEnd(12)} "${c.name}"`.padEnd(56)+` ${c.type.padEnd(10)} ${rel} op=${c.opacity??1} blend=${c.blendMode||'-'} kids=${(c.children||[]).length}`);
    (c.children||[]).forEach(g=>{
      const gb=g.absoluteBoundingBox;
      console.log(`      - ${g.id.padEnd(12)} "${g.name.slice(0,28)}" ${g.type} ${gb?Math.round(gb.width)+'x'+Math.round(gb.height)+' @('+Math.round(gb.x-ob.x)+','+Math.round(gb.y-ob.y)+')':''}`);
    });
  });
}
