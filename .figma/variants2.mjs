import { figmaGet } from 'file:///C:/Users/iamne/Desktop/figma-agent/skill/scripts/lib.mjs';
const j = await figmaGet('/files/jk3u8GQ1wxKd3Ge5hEPLaJ/nodes?ids=211:5561,211:6304&depth=2');
for(const [k,v] of Object.entries(j.nodes)){
  console.log('=== under',k,'===');
  const cs=v.componentSets||{}, cmp=v.components||{};
  console.log('componentSets:',Object.entries(cs).map(([id,c])=>`${id} "${c.name}"`).join(' | ')||'none');
  for(const [id,c] of Object.entries(cmp)) console.log(`  component ${id} "${c.name}" set=${c.componentSetId||'-'}`);
}
