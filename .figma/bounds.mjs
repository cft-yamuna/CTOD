import { figmaGet } from 'file:///C:/Users/iamne/Desktop/figma-agent/skill/scripts/lib.mjs';
import fs from 'node:fs';
const j = await figmaGet('/files/jk3u8GQ1wxKd3Ge5hEPLaJ/nodes?ids=211:5561,211:6304&depth=2');
const out={};
for(const [k,v] of Object.entries(j.nodes)){
  const root=v.document, ob=root.absoluteBoundingBox;
  out[k]=[];
  console.log(`\n##### ${k} "${root.name}"`);
  (root.children||[]).forEach((c,i)=>{
    const b=c.absoluteBoundingBox, rb=c.absoluteRenderBounds;
    const rec={i,id:c.id,name:c.name,type:c.type,visible:c.visible!==false,
      opacity:c.opacity??1,blend:c.blendMode,
      box:b?{left:Math.round(b.x-ob.x),top:Math.round(b.y-ob.y),w:Math.round(b.width),h:Math.round(b.height)}:null,
      render:rb?{left:+(rb.x-ob.x).toFixed(2),top:+(rb.y-ob.y).toFixed(2),w:+rb.width.toFixed(2),h:+rb.height.toFixed(2)}:null,
      fills:(c.fills||[]).map(f=>f.type+(f.visible===false?'(hidden)':'')).join(','),
      hasImage:JSON.stringify(c.fills||[]).includes('IMAGE')};
    out[k].push(rec);
    console.log(` [${i}] ${c.id.padEnd(11)} ${c.name.slice(0,24).padEnd(25)} vis=${rec.visible} op=${rec.opacity} blend=${rec.blend}`);
    console.log(`      box    ${JSON.stringify(rec.box)}`);
    console.log(`      render ${JSON.stringify(rec.render)}   fills=[${rec.fills}] image=${rec.hasImage}`);
  });
}
fs.writeFileSync('.figma/layer-bounds.json',JSON.stringify(out,null,2));
