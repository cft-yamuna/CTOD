import { figmaGet } from 'file:///C:/Users/iamne/Desktop/figma-agent/skill/scripts/lib.mjs';
const j = await figmaGet('/files/jk3u8GQ1wxKd3Ge5hEPLaJ/nodes?ids=211:5561,211:6304&depth=4');
const walk=(n,cb)=>{cb(n);(n.children||[]).forEach(c=>walk(c,cb));};
for(const k of Object.keys(j.nodes)) walk(j.nodes[k].document, n=>{
  for(const i of n.interactions||[]) if(i.trigger?.type==='AFTER_TIMEOUT')
    console.log(n.id, n.name, 'timeout=', i.trigger.timeout, 's  ->', (i.actions||[]).map(a=>a.navigation+':'+a.destinationId).join(','));
});
