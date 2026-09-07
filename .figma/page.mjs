import { figmaGet } from 'file:///C:/Users/iamne/Desktop/figma-agent/skill/scripts/lib.mjs';
const j = await figmaGet('/files/jk3u8GQ1wxKd3Ge5hEPLaJ/nodes?ids=0:1&depth=2');
const d = j.nodes['0:1']?.document;
if(!d){ console.log('no node 0:1 -', Object.keys(j.nodes||{})); process.exit(0); }
console.log(`PAGE "${d.name}"  ${d.type}  children=${(d.children||[]).length}`);
for(const c of d.children||[]){
  const b=c.absoluteBoundingBox;
  console.log(` ${c.id.padEnd(12)} ${c.type.padEnd(13)} "${c.name.slice(0,44).padEnd(44)}" ${b?Math.round(b.width)+'x'+Math.round(b.height):''} kids=${(c.children||[]).length}`);
}
