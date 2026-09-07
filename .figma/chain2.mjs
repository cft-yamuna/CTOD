import { figmaGet } from 'file:///C:/Users/iamne/Desktop/figma-agent/skill/scripts/lib.mjs';
const ids=[];
for(let i=941;i<=950;i++) ids.push('211:'+i);
for(let i=3317;i<=3326;i++) ids.push('211:'+i);
const j = await figmaGet(`/files/jk3u8GQ1wxKd3Ge5hEPLaJ/nodes?ids=${ids.join(',')}&depth=1`);
for(const id of ids){
  const v=j.nodes[id]; if(!v){ continue; }
  const d=v.document, b=d.absoluteBoundingBox;
  const ints=(d.interactions||[]).map(i=>{
    const a=(i.actions||[])[0]||{};
    return `${i.trigger?.type}${i.trigger?.timeout!=null?'('+i.trigger.timeout+'s)':''} -> ${a.destinationId||'-'} ${a.transition?a.transition.type+' '+(+a.transition.duration.toFixed(3))+'s '+(a.transition.easing?.type||''):''}`;
  }).join(' ; ')||'—';
  console.log(`${id.padEnd(10)} ${d.type.padEnd(14)} "${d.name}"  ${b?Math.round(b.width)+'x'+Math.round(b.height):''}`);
  console.log(`            ${ints}`);
}
