import fs from 'node:fs';
const { PNG } = await import('file:///C:/Users/iamne/Desktop/figma-agent/node_modules/pngjs/lib/png.js');
const load=p=>PNG.sync.read(fs.readFileSync(p));
const [a,b]=process.argv.slice(2);
const A=load(a),B=load(b); const rows=[];
for(let y=0;y<A.height;y++){let n=0;
  for(let x=0;x<A.width;x++){const i=(y*A.width+x)*4;
    if(Math.abs(A.data[i]-B.data[i])>8||Math.abs(A.data[i+1]-B.data[i+1])>8||Math.abs(A.data[i+2]-B.data[i+2])>8)n++;}
  if(n)rows.push([y,n]);}
// collapse into bands
let bands=[],cur=null;
for(const [y,n] of rows){ if(cur&&y-cur.end<=6){cur.end=y;cur.max=Math.max(cur.max,n);cur.sum+=n;} else {cur&&bands.push(cur);cur={start:y,end:y,max:n,sum:n};} }
cur&&bands.push(cur);
for(const b of bands) console.log(`  y ${String(b.start).padStart(4)}..${String(b.end).padStart(4)}  peak=${b.max}  total=${b.sum}`);
