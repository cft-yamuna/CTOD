import { figmaGet } from 'file:///C:/Users/iamne/Desktop/figma-agent/skill/scripts/lib.mjs';
const j = await figmaGet('/files/jk3u8GQ1wxKd3Ge5hEPLaJ/nodes?ids=211:6511&depth=2');
const root=j.nodes['211:6511'].document;
const F=j.nodes['211:6511'].document.absoluteBoundingBox;
/* frame origin of 211:6499 = hero box minus its own offset (180,168.92) */
const OX=F.x-180, OY=F.y-168.92;
const walk=(n,d=0)=>{
  const b=n.absoluteBoundingBox;
  console.log('  '.repeat(d)+`${n.id.padEnd(11)} "${n.name.slice(0,26).padEnd(26)}" ${n.type.padEnd(9)} ${b?`${+b.width.toFixed(2)}x${+b.height.toFixed(2)} @(${+(b.x-OX).toFixed(2)},${+(b.y-OY).toFixed(2)})`:'-'}`);
  (n.children||[]).forEach(c=>walk(c,d+1));
};
walk(root);
