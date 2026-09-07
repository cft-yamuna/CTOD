import fs from 'node:fs';
const m=JSON.parse(fs.readFileSync('.figma/meta.json','utf8'));
const r=JSON.parse(fs.readFileSync('.figma/report.json','utf8'));

const SLUG={'211:5561':'home','211:5505':'intro','211:5456':'terms','211:6054':'cities',
'211:6137':'issuer','211:6253':'cardstyle','211:6178':'amount','211:6530':'methods',
'211:6339':'upipin','211:6419':'upipin2','211:6304':'success','211:6499':'paid',
'211:6689':'loading','211:6706':'balance'};

// frame absolute origins, from the frame-level findings
const origin={};
for(const f of m.findings) if(SLUG[f.id]&&f.box) origin[f.id]={x:f.box.x,y:f.box.y};
// elements by id, frame-relative, from report.json
const rel={};
for(const fr of r.frames){ for(const e of fr.elements) rel[e.id]={frame:fr.node,left:e.left,top:e.top,width:e.width,height:e.height}; }

const out={};
for(const f of m.findings){
  const frameId=Object.keys(SLUG).find(id=>(f.path||'').startsWith(m.findings.find(x=>x.id===id)?.name||'\0'));
  for(const i of f.interactions||[]){
    for(const a of i.actions||[]){
      if(!a.destination&&a.type!=='NODE') continue;
      // which frame does this element live in? use the report element, else nearest origin by absolute box
      let fid=rel[f.id]?.frame, box=rel[f.id];
      if(!fid&&f.box){
        let best=null,bd=1e9;
        for(const [id,o] of Object.entries(origin)){
          const dx=f.box.x-o.x, dy=f.box.y-o.y;
          if(dx>=-2&&dy>=-2&&dx<1082&&dy<1922&&dx+dy<bd){bd=dx+dy;best=id;}
        }
        if(best){fid=best;box={left:Math.round(f.box.x-origin[best].x),top:Math.round(f.box.y-origin[best].y),width:Math.round(f.box.width),height:Math.round(f.box.height)};}
      }
      if(!fid||!box) continue;
      (out[SLUG[fid]]=out[SLUG[fid]]||[]).push({
        id:f.id,name:f.name,trigger:i.trigger,nav:a.navigation,
        to:SLUG[a.destination]||a.destination,
        left:Math.round(box.left),top:Math.round(box.top),width:Math.round(box.width),height:Math.round(box.height)
      });
    }
  }
}
fs.writeFileSync('.figma/controls.json',JSON.stringify(out,null,2));
const ORDER=['home','intro','terms','cities','issuer','cardstyle','amount','methods','upipin2','upipin','success','paid','loading','balance'];
for(const s of ORDER){
  console.log('\n### '+s);
  for(const c of out[s]||[]) console.log(`   ${String(c.width).padStart(4)}x${String(c.height).toString().padEnd(4)} @(${c.left},${c.top})  ${c.trigger} ${c.nav} -> ${c.to}   [${c.name.slice(0,30)}]`);
}
