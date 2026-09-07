import { figmaGet } from 'file:///C:/Users/iamne/Desktop/figma-agent/skill/scripts/lib.mjs';
const j = await figmaGet('/files/jk3u8GQ1wxKd3Ge5hEPLaJ/nodes?ids=211:6706,223:1404,223:1574');
const walk=(n,cb,parent=null)=>{cb(n,parent);(n.children||[]).forEach(c=>walk(c,cb,n));};
for(const k of ['211:6706','223:1404','223:1574']){
  const d=j.nodes[k].document, fb=d.absoluteBoundingBox;
  console.log(`\n===== ${k} "${d.name}" =====`);
  walk(d,(n,p)=>{
    if(n.type!=='TEXT'||!/^₹(100|200|300|400|500)$/.test(n.characters||''))return;
    const pb=p?.absoluteBoundingBox;
    console.log(`  chip ${n.characters.padEnd(5)} text@(${Math.round(n.absoluteBoundingBox.x-fb.x)},${Math.round(n.absoluteBoundingBox.y-fb.y)})   parent ${p.id} "${(p.name||'').slice(0,26)}" ${pb?Math.round(pb.width)+'x'+Math.round(pb.height)+' @('+Math.round(pb.x-fb.x)+','+Math.round(pb.y-fb.y)+')':''}`);
  });
}
