import { readFileSync, writeFileSync } from 'node:fs';
const SP=process.argv[2];
const doc=JSON.parse(readFileSync(SP+'/v2.json','utf8')).nodes['254:858'].document;

const frames=[]; // top-level 1080x1920 frames inside sections
const byId={};
function walkSections(n, section){
  if(n.type==='SECTION'){ for(const c of n.children||[]) walkSections(c, n.name); return; }
  if(n.type==='FRAME'){ frames.push({id:n.id,name:n.name,section,node:n,x:n.absoluteBoundingBox?.x,y:n.absoluteBoundingBox?.y,w:n.absoluteBoundingBox?.width,h:n.absoluteBoundingBox?.height}); }
}
walkSections(doc, null);
for(const f of frames) byId[f.id]=f;

// collect interactions per frame
const edges=[];
const texts={};
function walk(n, frame, depth){
  if(n.interactions?.length){
    for(const i of n.interactions){
      for(const a of (i.actions||[]).filter(Boolean)){
        if(a.destinationId||a.type==='NODE'){
          const bb=n.absoluteBoundingBox;
          edges.push({frame:frame.id, node:n.id, name:n.name, trigger:i.trigger?.type, timeout:i.trigger?.timeout,
            nav:a.navigation, to:a.destinationId,
            left: bb?Math.round(bb.x-frame.x):null, top: bb?Math.round(bb.y-frame.y):null,
            width: bb?Math.round(bb.width):null, height: bb?Math.round(bb.height):null,
            transition:a.transition?.type, dur:a.transition?.duration});
        }
      }
    }
  }
  if(n.type==='TEXT'&&n.characters) (texts[frame.id]=texts[frame.id]||[]).push(n.characters.replace(/\n/g,' | '));
  for(const c of n.children||[]) walk(c, frame, depth+1);
}
for(const f of frames) walk(f.node, f, 0);

writeFileSync(SP+'/frames.json', JSON.stringify(frames.map(f=>({id:f.id,name:f.name,section:f.section,x:f.x,y:f.y})),null,1));
writeFileSync(SP+'/edges.json', JSON.stringify(edges,null,1));
writeFileSync(SP+'/texts.json', JSON.stringify(texts));

console.log('frames',frames.length,'edges',edges.length);
const bySection={};
for(const f of frames){ (bySection[f.section]=bySection[f.section]||{})[f.name]=(bySection[f.section][f.name]||0)+1; }
console.log(JSON.stringify(bySection,null,1));
// entry frames: frames with no incoming edge
const incoming=new Set(edges.map(e=>e.to));
console.log('NO INCOMING:', frames.filter(f=>!incoming.has(f.id)).map(f=>f.id+' '+f.name).join('\n  '));
const outgoing=new Set(edges.map(e=>e.frame));
console.log('DEAD ENDS:', frames.filter(f=>!outgoing.has(f.id)).length);
