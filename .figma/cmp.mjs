import fs from 'node:fs';
const { PNG } = await import('file:///C:/Users/iamne/Desktop/figma-agent/node_modules/pngjs/lib/png.js');
const load=p=>PNG.sync.read(fs.readFileSync(p));
const [a,b]=process.argv.slice(2);
const A=load(a),B=load(b);
if(A.width!==B.width||A.height!==B.height){console.log('SIZE DIFF',A.width,A.height,'vs',B.width,B.height);process.exit(0);}
let n=0, minY=1e9,maxY=-1,minX=1e9,maxX=-1;
for(let y=0;y<A.height;y++)for(let x=0;x<A.width;x++){
  const i=(y*A.width+x)*4;
  if(Math.abs(A.data[i]-B.data[i])>8||Math.abs(A.data[i+1]-B.data[i+1])>8||Math.abs(A.data[i+2]-B.data[i+2])>8||Math.abs(A.data[i+3]-B.data[i+3])>8){
    n++; if(y<minY)minY=y; if(y>maxY)maxY=y; if(x<minX)minX=x; if(x>maxX)maxX=x;
  }
}
const pct=(100*n/(A.width*A.height)).toFixed(4);
console.log(`${a} vs ${b}: ${n} px differ (${pct}%)` + (n?`  bbox x[${minX}..${maxX}] y[${minY}..${maxY}]`:''));
