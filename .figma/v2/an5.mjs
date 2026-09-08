import { readFileSync } from 'node:fs';
const SP=process.argv[2];
const doc=JSON.parse(readFileSync(SP+'/v2.json','utf8')).nodes['254:858'].document;
const want=new Set(process.argv.slice(3));
function walkS(n,sec){ if(n.type==='SECTION'){for(const c of n.children||[])walkS(c,n.name);return;} if(n.type==='FRAME'&&want.has(n.id)) dump(n); }
function dump(f){
  console.log('\n### '+f.name+' #'+f.id+'  '+f.absoluteBoundingBox.width+'x'+f.absoluteBoundingBox.height+' clips='+f.clipsContent+' overflow='+f.overflowDirection+' layout='+f.layoutMode);
  const ox=f.absoluteBoundingBox.x, oy=f.absoluteBoundingBox.y;
  const rec=(n,d)=>{
    const bb=n.absoluteBoundingBox;
    if(d<=2) console.log('  '.repeat(d)+`- ${n.type} "${n.name}" ${bb?`${Math.round(bb.width)}x${Math.round(bb.height)}@(${Math.round(bb.x-ox)},${Math.round(bb.y-oy)})`:''} ${n.overflowDirection&&n.overflowDirection!=='NONE'?'SCROLL:'+n.overflowDirection:''} ${n.scrollBehavior&&n.scrollBehavior!=='SCROLLS'?n.scrollBehavior:''} ${n.layoutMode||''}`);
    if(d<2) for(const c of n.children||[]) rec(c,d+1);
  };
  for(const c of f.children||[]) rec(c,1);
}
walkS(doc,null);
