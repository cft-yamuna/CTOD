import { figmaGet } from 'file:///C:/Users/iamne/Desktop/figma-agent/skill/scripts/lib.mjs';
const j = await figmaGet('/files/jk3u8GQ1wxKd3Ge5hEPLaJ/nodes?ids=211:944,211:3320,211:5562,211:6326&depth=1');
for(const [k,v] of Object.entries(j.nodes)){
  const d=v.document, b=d.absoluteBoundingBox;
  console.log(`${k}  "${d.name}"  ${d.type}  ${b?Math.round(b.width)+'x'+Math.round(b.height):'-'}  kids=${(d.children||[]).length}`);
  if(d.componentProperties) console.log('   props:',JSON.stringify(d.componentProperties));
  if(d.variantProperties) console.log('   variant:',JSON.stringify(d.variantProperties));
}
