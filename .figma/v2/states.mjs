import { readFileSync, writeFileSync } from 'node:fs';
const SP=process.argv[2];
const frames=JSON.parse(readFileSync(SP+'/frames.json','utf8'));
const edges=JSON.parse(readFileSync(SP+'/edges.json','utf8'));
const texts=JSON.parse(readFileSync(SP+'/texts.json','utf8'));
const F={}; for(const f of frames) F[f.id]=f;
const out={}; for(const e of edges) (out[e.frame]=out[e.frame]||[]).push(e);
const T=id=>texts[id]||[];
const CHIP=['Frame 1984079992','Frame 1984079993','Frame 1984079994','Frame 1984079995','Frame 1984079996'];
const AMT=[100,200,300,400,500];
const rupee=s=>{const m=/₹\s?([\d,]+)/.exec(s||''); return m?Number(m[1].replace(/,/g,'')):null;};

// ---- AMOUNT DETAILS -------------------------------------------------------
const ISSUER={'254:1628':'pinelabs','254:1973':'iob','254:2088':'rbl'};
const amount={};
for(const [base,iss] of Object.entries(ISSUER)){
  amount[base]={issuer:iss,selected:null,node:base};
  for(const e of out[base]||[]) { const i=CHIP.indexOf(e.name); if(i>=0&&F[e.to]) amount[e.to]={issuer:iss,selected:AMT[i],node:e.to}; }
}
// selected frames cross-link; walk once more to catch all
let grew=true;
while(grew){ grew=false;
  for(const id of Object.keys(amount)){ for(const e of out[id]||[]){ const i=CHIP.indexOf(e.name);
    if(i>=0&&F[e.to]&&!amount[e.to]){ amount[e.to]={issuer:amount[id].issuer,selected:AMT[i],node:e.to}; grew=true; } } }
}
for(const id of Object.keys(amount)){
  const t=T(id); const total=rupee(t.find((x,i)=>i>15&&/^₹\d+$/.test(x))||'');
  amount[id].totalText=t[17]; amount[id].continueTo=(out[id]||[]).find(e=>e.name==='Button')?.to||null;
}
// ---- PAID ------------------------------------------------------------------
const paid={};
for(const f of frames.filter(f=>f.name.trim()==='Payment successful')){
  const t=T(f.id);
  paid[f.id]={leg:f.section==='Setup'?'setup':'recharge', bank:(t.find(x=>/^Paid to/.test(x))||'').replace('Paid to ',''),
    amount:rupee(t[5]), nextTo:(out[f.id]||[]).find(e=>e.name==='Button')?.to||null};
}
// ---- BALANCE ---------------------------------------------------------------
const balance={};
for(const f of frames.filter(f=>f.name.trim()==='Card balance and add money')){
  const t=T(f.id);
  const cur=rupee(t.find(x=>/^Current balance/.test(x)));
  const chipEdges=(out[f.id]||[]).filter(e=>CHIP.includes(e.name));
  const present=new Set(chipEdges.map(e=>CHIP.indexOf(e.name)));
  const missing=AMT.filter((_,i)=>!present.has(i));
  const cta=(out[f.id]||[]).find(e=>e.name==='Button');
  const scrolled=chipEdges.length?Math.min(...chipEdges.map(e=>e.top)):null;
  balance[f.id]={leg:f.section==='Setup'?'setup':'recharge', balance:cur,
    selected: chipEdges.length===5?null:(missing.length===1?missing[0]:missing),
    chipTop:scrolled, addMoneyTo:cta?cta.to:null};
}
// ---- INVARIANT FAMILIES ----------------------------------------------------
const fam={};
for(const n of ['All Payment methods','Success enabled','Loading','UPI PIN verification'])
  fam[n]=frames.filter(f=>f.name.trim()===n).map(f=>f.id);

writeFileSync('.figma/v2/states.json',JSON.stringify({amount,paid,balance,families:fam},null,1));
const u=o=>[...new Set(Object.values(o).map(v=>JSON.stringify({...v,node:undefined,continueTo:undefined,nextTo:undefined,addMoneyTo:undefined})))];
console.log('amount frames',Object.keys(amount).length,'unique states',u(amount).length);
console.log(u(amount).join('\n'));
console.log('\npaid frames',Object.keys(paid).length,'unique',u(paid).length);
console.log(u(paid).slice(0,25).join('\n'));
console.log('\nbalance frames',Object.keys(balance).length,'unique',u(balance).length);
console.log(u(balance).slice(0,90).join('\n'));
