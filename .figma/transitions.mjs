import { figmaGet } from 'file:///C:/Users/iamne/Desktop/figma-agent/skill/scripts/lib.mjs';
import fs from 'node:fs';
const IDS='211:5456,211:5505,211:5561,211:6054,211:6137,211:6178,211:6253,211:6304,211:6339,211:6419,211:6499,211:6530,211:6689,211:6706';
const j = await figmaGet(`/files/jk3u8GQ1wxKd3Ge5hEPLaJ/nodes?ids=${IDS}`);
const SLUG={'211:5561':'home','211:5505':'intro','211:5456':'terms','211:6054':'cities','211:6137':'issuer','211:6253':'cardstyle','211:6178':'amount','211:6530':'methods','211:6419':'upipin2','211:6339':'upipin','211:6304':'success','211:6499':'paid','211:6689':'loading','211:6706':'balance'};
const rows=[];
const walk=(n,root)=>{
  for(const i of n.interactions||[]) for(const a of i.actions||[]){
    if(a.type!=='NODE') continue;
    rows.push({from:SLUG[root]||root, el:n.name, elId:n.id,
      trigger:i.trigger?.type, timeout:i.trigger?.timeout,
      nav:a.navigation, to:SLUG[a.destinationId]||a.destinationId,
      transition:a.transition, preserveScroll:a.preserveScrollPosition});
  }
  (n.children||[]).forEach(c=>walk(c,root));
};
for(const k of Object.keys(j.nodes)) walk(j.nodes[k].document,k);
fs.writeFileSync('.figma/transitions.json',JSON.stringify(rows,null,2));
for(const r of rows){
  const t=r.transition;
  console.log(`${(r.from||'').padEnd(10)} ${(r.trigger||'').padEnd(14)} -> ${String(r.to).padEnd(10)} ${t? t.type+' '+(t.direction||'')+' '+(t.duration!=null?t.duration+'s':'')+' ease='+(t.easing?.type||'?')+(t.matchLayers?' matchLayers':'') : 'NO TRANSITION (instant)'}`);
}
