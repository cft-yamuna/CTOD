import { figmaGet } from 'file:///C:/Users/iamne/Desktop/figma-agent/skill/scripts/lib.mjs';
import fs from 'node:fs';
const ids=['211:941','211:942','211:943','211:944','211:945','211:946','211:947','211:948','211:949','211:950','211:951','211:952','211:3317','211:3318','211:3319','211:3320','211:3321','211:3322'];
const j = await figmaGet(`/files/jk3u8GQ1wxKd3Ge5hEPLaJ/nodes?ids=${ids.join(',')}&depth=1`);
const hex=c=>'#'+[c.r,c.g,c.b].map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('');
const box=id=>{const v=j.nodes[id];return v?v.document.absoluteBoundingBox:null;};
const PARENT={'211:942':'211:941','211:943':'211:941','211:945':'211:944','211:946':'211:944','211:948':'211:947','211:949':'211:947','211:951':'211:950','211:952':'211:950','211:3318':'211:3317','211:3319':'211:3317','211:3321':'211:3320','211:3322':'211:3320'};
const dump={};
for(const id of ids){
  const v=j.nodes[id]; if(!v){console.log(id,'MISSING');continue;}
  const d=v.document, b=d.absoluteBoundingBox;
  const p=PARENT[id]?box(PARENT[id]):null;
  const rel=p&&b?{x:+(b.x-p.x).toFixed(2),y:+(b.y-p.y).toFixed(2),w:+b.width.toFixed(2),h:+b.height.toFixed(2)}:null;
  const fills=(d.fills||[]).map(f=>f.type==='SOLID'?`SOLID ${hex(f.color)} a=${+(f.color.a*(f.opacity??1)).toFixed(3)}`:
    f.type.startsWith('GRADIENT')?`${f.type} [${f.gradientStops.map(s=>hex(s.color)+'@'+(+s.position.toFixed(2))+(s.color.a<1?'/a'+(+s.color.a.toFixed(2)):'')).join(' ')}] h=${JSON.stringify((f.gradientHandlePositions||[]).map(h=>[+h.x.toFixed(3),+h.y.toFixed(3)]))}`:f.type).join(' | ');
  const fx=(d.effects||[]).filter(e=>e.visible!==false).map(e=>`${e.type} r=${e.radius}`).join(' | ');
  dump[id]={name:d.name,type:d.type,parent:PARENT[id]||null,rel,opacity:d.opacity??1,fills,fx};
  console.log(`${id.padEnd(10)} ${(PARENT[id]||'-').padEnd(9)} ${d.type.padEnd(9)} "${d.name.slice(0,26).padEnd(26)}" ${rel?`${rel.w}x${rel.h} @(${rel.x},${rel.y})`:''} op=${d.opacity??1}`);
  if(fills) console.log(`             fill: ${fills}`);
  if(fx)    console.log(`             fx:   ${fx}`);
}
fs.writeFileSync('.figma/anim-keyframes.json',JSON.stringify(dump,null,2));
