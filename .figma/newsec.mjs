import { figmaGet } from 'file:///C:/Users/iamne/Desktop/figma-agent/skill/scripts/lib.mjs';
import fs from 'node:fs';
const j = await figmaGet('/files/jk3u8GQ1wxKd3Ge5hEPLaJ/nodes?ids=223:1403');
const doc = j.nodes['223:1403'].document;
fs.writeFileSync('.figma/newsec.json', JSON.stringify(doc));
const frames = (doc.children||[]);
console.log('SECTION', doc.name, 'frames=', frames.length);
const byId = {};
const walk=(n,frame,cb)=>{cb(n,frame);(n.children||[]).forEach(c=>walk(c,frame,cb));};
for(const f of frames){
  const b=f.absoluteBoundingBox;
  byId[f.id]={name:f.name,x:b.x,y:b.y,w:b.width,h:b.height};
}
const order = Object.entries(byId).sort((a,c)=>a[1].x-c[1].x);
console.log('\n--- FRAMES by canvas x ---');
for(const [id,f] of order) console.log(`${id.padEnd(10)} x=${String(Math.round(f.x)).padStart(6)} ${Math.round(f.w)}x${Math.round(f.h)}  "${f.name}"`);
console.log('\n--- INTERACTIONS ---');
for(const [fid,fr] of order){
  const f = frames.find(x=>x.id===fid);
  console.log(`\n### ${fid} "${fr.name}"`);
  walk(f, fid, (n)=>{
    for(const i of n.interactions||[]){
      for(const a of i.actions||[]){
        const dest = a.destinationId;
        if(!dest && i.trigger?.type!=='AFTER_TIMEOUT') continue;
        const bb=n.absoluteBoundingBox;
        const rel = bb ? `${Math.round(bb.width)}x${Math.round(bb.height)} @(${Math.round(bb.x-fr.x)},${Math.round(bb.y-fr.y)})` : 'no-box';
        const to = dest ? (byId[dest]?`${dest} "${byId[dest].name}"`:dest+' (OUTSIDE)') : '-';
        console.log(`  ${n.id.padEnd(24)} ${rel.padEnd(26)} ${i.trigger?.type}${i.trigger?.timeout!=null?'('+i.trigger.timeout+'s)':''} ${a.navigation||''} -> ${to}   [${(n.name||'').slice(0,34)}]`);
      }
    }
  });
}
