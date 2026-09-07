import { figmaGet } from 'file:///C:/Users/iamne/Desktop/figma-agent/skill/scripts/lib.mjs';
import fs from 'node:fs';
// 1. does the OLD balance screen point into the new section?
const o = await figmaGet('/files/jk3u8GQ1wxKd3Ge5hEPLaJ/nodes?ids=211:6706,211:6499');
const walk=(n,cb)=>{cb(n);(n.children||[]).forEach(c=>walk(c,cb));};
console.log('=== OLD balance 211:6706 + paid 211:6499 interactions ===');
for(const k of Object.keys(o.nodes)){
  const d=o.nodes[k].document, fb=d.absoluteBoundingBox;
  walk(d,n=>{ for(const i of n.interactions||[]) for(const a of i.actions||[]){
    const bb=n.absoluteBoundingBox;
    console.log(` ${k} :: ${n.id} "${(n.name||'').slice(0,28)}" ${bb?Math.round(bb.width)+'x'+Math.round(bb.height)+' @('+Math.round(bb.x-fb.x)+','+Math.round(bb.y-fb.y)+')':''} ${i.trigger?.type} ${a.navigation} -> ${a.destinationId}`);
  }});
}
// 2. text content of the new frames
const doc = JSON.parse(fs.readFileSync('.figma/newsec.json','utf8'));
console.log('\n=== TEXT per new frame ===');
for(const f of doc.children){
  const fb=f.absoluteBoundingBox; const txt=[];
  walk(f,n=>{ if(n.type==='TEXT'&&n.characters) { const bb=n.absoluteBoundingBox; txt.push(`${JSON.stringify(n.characters.slice(0,44))}@(${bb?Math.round(bb.x-fb.x):'?'},${bb?Math.round(bb.y-fb.y):'?'})`);} });
  console.log(`\n### ${f.id} "${f.name}" (${txt.length} texts)`);
  console.log('   '+txt.join('  '));
}
