import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const S = JSON.parse(readFileSync('.figma/v2/states.json','utf8'));
const slugBank = b => ({'Pine Labs':'pinelabs','Indian Overseas Bank':'iob','RBL Bank':'rbl'})[b] || b.toLowerCase().replace(/\s+/g,'-');
const plan = []; // {slug, node, kind}
const add=(slug,node,kind,meta)=>plan.push({slug,node,kind,...(meta||{})});

add('unlocked','254:51878','static');
add('home','254:1023','static');
add('homeCard','254:58071','static');
add('intro','254:941','static');
add('introAccepted','254:860','static');
add('issuer','254:1550','static');
add('methods','254:16368','methods');
add('pin','254:4833','pin');
add('success','254:4158','success');
add('loading','254:19323','loading');

// paid: one per unique leg|bank|amount
const paidGroups=new Map();
for(const [id,v] of Object.entries(S.paid)){
  const k=[v.leg,v.bank,v.amount].join('|');
  if(!paidGroups.has(k)) paidGroups.set(k,{...v, ids:[]});
  paidGroups.get(k).ids.push(id);
}
// how many legs per bank|amount
const legsFor=new Map();
for(const [k,v] of paidGroups){ const kk=slugBank(v.bank)+'|'+v.amount; legsFor.set(kk,(legsFor.get(kk)||[]).concat(v.leg)); }
for(const [k,v] of paidGroups){
  const kk=slugBank(v.bank)+'|'+v.amount;
  const dual = legsFor.get(kk).length>1;
  const slug = dual ? `paid-${slugBank(v.bank)}-${v.amount}-${v.leg}` : `paid-${slugBank(v.bank)}-${v.amount}`;
  add(slug, v.ids[0], 'paid', {leg:v.leg, bank:v.bank, amount:v.amount, siblings:v.ids, baseSlug:`paid-${slugBank(v.bank)}-${v.amount}`});
}
// amount: 18
for(const [id,v] of Object.entries(S.amount)){
  add(`amount-${v.issuer}-${v.selected==null?'none':v.selected}`, id, 'amount', {issuer:v.issuer, selected:v.selected});
}
// balance: keyed by {leg, issuer, balance, variant} - `issuer` is the card art
// (IOB / RBL only ever appear on the first-payment landing frames) and
// `variant` separates the two wired states from the 40 unwired landings.
const ISS = JSON.parse(readFileSync('.figma/v2/tools/balance-issuer.json','utf8'));
const issuerOf = id => { const a = (ISS[id]||[])[0]||''; return /^IOB/.test(a)?'iob':/^RBL/.test(a)?'rbl':'pinelabs'; };
const variantOf = v => Array.isArray(v.selected) ? 'landing' : (v.selected==null ? 'unselected' : 'selected');
const balGroups=new Map();
for(const [id,v] of Object.entries(S.balance)){
  const issuer=issuerOf(id), variant=variantOf(v);
  const k=[v.leg,issuer,v.balance,variant,v.selected].join('|');
  if(!balGroups.has(k)) balGroups.set(k,{...v, issuer, variant, ids:[]});
  balGroups.get(k).ids.push(id);
}
for(const [k,v] of balGroups){
  const tail = v.variant==='landing' ? 'landing' : (v.variant==='unselected' ? 'none' : String(v.selected));
  add(`balance-${v.leg}-${v.issuer}-${v.balance}-${tail}`, v.ids[0], 'balance',
      {leg:v.leg, issuer:v.issuer, balance:v.balance, variant:v.variant,
       selected: Array.isArray(v.selected)?null:v.selected,
       chipTop:v.chipTop, siblings:v.ids});
}
const seen=new Set(); for(const p of plan){ if(seen.has(p.slug)) console.error('DUP SLUG', p.slug); seen.add(p.slug); }
mkdirSync('.figma/v2/tools',{recursive:true});
writeFileSync('.figma/v2/tools/plan.json', JSON.stringify(plan,null,1));
console.log('plates planned:', plan.length);
const byKind={}; for(const p of plan) byKind[p.kind]=(byKind[p.kind]||0)+1;
console.log(byKind);
