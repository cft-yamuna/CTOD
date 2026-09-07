import { figmaGet } from 'file:///C:/Users/iamne/Desktop/figma-agent/skill/scripts/lib.mjs';
const j = await figmaGet('/files/jk3u8GQ1wxKd3Ge5hEPLaJ/nodes?ids=211:944,211:3320&depth=0');
console.log('componentSets:', JSON.stringify(j.componentSets,null,1));
console.log('components:', JSON.stringify(j.components,null,1).slice(0,1200));
