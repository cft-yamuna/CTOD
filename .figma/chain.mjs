import { figmaGet } from 'file:///C:/Users/iamne/Desktop/figma-agent/skill/scripts/lib.mjs';
const j = await figmaGet('/files/jk3u8GQ1wxKd3Ge5hEPLaJ/nodes?ids=211:940,211:3316&depth=2');
for(const [k,v] of Object.entries(j.nodes)){
  const d=v.document, b=d.absoluteBoundingBox;
  console.log(`\n### SET ${k} "${d.name}"  ${d.type}  variants=${(d.children||[]).length}`);
  for(const c of d.children||[]){
    const ints=(c.interactions||[]).map(i=>{
      const a=(i.actions||[])[0]||{};
      return `${i.trigger?.type}${i.trigger?.timeout!=null?'('+i.trigger.timeout+'s)':''} ${a.navigation||''}->${a.destinationId||'-'} ${a.transition?a.transition.type+' '+a.transition.duration+'s '+(a.transition.easing?.type||''):''}`;
    }).join(' ; ')||'no interactions';
    const cb=c.absoluteBoundingBox;
    console.log(`  ${c.id.padEnd(10)} "${c.name}"  ${cb?Math.round(cb.width)+'x'+Math.round(cb.height):''}`);
    console.log(`      ${ints}`);
  }
}
