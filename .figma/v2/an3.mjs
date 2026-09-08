import { readFileSync } from 'node:fs';
const SP=process.argv[2];
const frames=JSON.parse(readFileSync(SP+'/frames.json','utf8'));
const edges=JSON.parse(readFileSync(SP+'/edges.json','utf8'));
const texts=JSON.parse(readFileSync(SP+'/texts.json','utf8'));
const F={}; for(const f of frames) F[f.id]=f;
const out={}; for(const e of edges) (out[e.frame]=out[e.frame]||[]).push(e);
const lab=id=>F[id]?`${F[id].name.trim()}#${id}`:`EXT#${id}`;
function show(id){
  const t=texts[id]||[];
  console.log('\n--- '+lab(id)+'   texts: '+t.slice(0,8).map(x=>JSON.stringify(x)).join(' ')); 
  for(const e of out[id]||[]) console.log('    '+(e.trigger==='AFTER_TIMEOUT'?`TIMEOUT ${e.timeout}s`:e.trigger)+` ${e.width}x${e.height}@(${e.left},${e.top}) [${e.name}] -> `+lab(e.to));
}
for(const id of process.argv.slice(3)) show(id);
