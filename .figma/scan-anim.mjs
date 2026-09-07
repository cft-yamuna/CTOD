import { figmaGet } from 'file:///C:/Users/iamne/Desktop/figma-agent/skill/scripts/lib.mjs';
/* Everything on the page except the section already built (211:5455). */
const IDS='204:288,210:397,192:2,192:12,192:23,192:57,192:71,192:80,192:84,189:105,187:2,187:42';
const j = await figmaGet(`/files/jk3u8GQ1wxKd3Ge5hEPLaJ/nodes?ids=${IDS}`);
const hits=[];
const walk=(n,root)=>{
  for(const i of n.interactions||[]){
    for(const a of i.actions||[]){
      const t=a.transition;
      if(i.trigger?.type==='AFTER_TIMEOUT' || (t && t.type!=='INSTANT_TRANSITION'))
        hits.push({root,id:n.id,name:n.name,trig:i.trigger?.type,to:a.destinationId,
          nav:a.navigation,tr:t?`${t.type} ${+(t.duration??0).toFixed(2)}s ${t.easing?.type||''}`:'-',
          timeout:i.trigger?.timeout});
    }
  }
  (n.children||[]).forEach(c=>walk(c,root));
};
for(const [k,v] of Object.entries(j.nodes)) walk(v.document, `${k} "${v.document.name}"`);
console.log(`animated interactions found: ${hits.length}\n`);
const byRoot={};
for(const h of hits) (byRoot[h.root]=byRoot[h.root]||[]).push(h);
for(const [r,hs] of Object.entries(byRoot)){
  console.log(`### ${r}   (${hs.length})`);
  for(const h of hs.slice(0,14)) console.log(`   ${h.id.padEnd(11)} "${h.name.slice(0,26).padEnd(26)}" ${h.trig}${h.timeout!=null?'('+(+h.timeout.toFixed(2))+'s)':''} -> ${h.to}  ${h.tr}`);
  if(hs.length>14) console.log(`   ... ${hs.length-14} more`);
}
