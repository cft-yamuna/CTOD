// Assembles every node id that has to be exported, with the geometry that the
// manifest will carry. Pure data - no network.
import { readFileSync, writeFileSync } from 'node:fs';
const plan   = JSON.parse(readFileSync('.figma/v2/tools/plan.json','utf8'));
const scroll = JSON.parse(readFileSync('.figma/v2/tools/scroll.json','utf8'));

/* ---- chrome. One set per scrolling family, keyed by the scroll container's
   own Figma name so a state can be matched to its chrome mechanically.
   `Gradient Bkg` is VISIBLE only on the two Introduction frames; everywhere
   else the instance is visible:false and the background is the frame fill. */
const chrome = {
  amountFamily: { match:{kind:'amount'},
    bg:{node:'254:1688', hidden:true, fill:'#ffffff'},
    header:{node:'254:1718', name:'Header'},
    footer:{node:'254:1709', name:'gestureThreeButtons'} },
  methodsFamily: { match:{kind:'methods'},
    bg:{node:'254:16369', hidden:true, fill:'#ffffff'},
    header:{node:'254:16526', name:'Header'},
    footer:{node:'254:16556', name:'gestureThreeButtons'} },
  introFamily: { match:{slug:'intro'},
    bg:{node:'254:1022', name:'Gradient Bkg', overlay:true},
    header:{node:'254:988', name:'Header'},
    footer:{node:'254:972', name:'Frame 1686562600'} },
  introAcceptedFamily: { match:{slug:'introAccepted'},
    bg:{node:'254:906', name:'Gradient Bkg', overlay:true},
    header:{node:'254:907', name:'Header'},
    footer:{node:'254:891', name:'Frame 1686562600'} },
  balanceShortFamily: { match:{container:'Frame 1984080073'},
    bg:{node:'254:20025', hidden:true, fill:'#ffffff'},
    header:{node:'254:20046', name:'Frame 1984079979'},
    footer:{node:'254:20072', name:'Footer'} },
  balanceNoneFamily: { match:{container:'Frame 1984080057'},
    bg:{node:'254:21063', hidden:true, fill:'#ffffff'},
    header:{node:'254:21098', name:'Frame 1984079979'},
    footer:{node:'254:21084', name:'Footer'} },
  balanceTallFamily: { match:{container:'Frame 1984080062'},
    bg:{node:'254:21981', hidden:true, fill:'#ffffff'},
    header:{node:'254:22002', name:'Frame 1984079979'},
    footer:{node:'254:22028', name:'Footer'} },
  balanceSelectedFamily: { match:{container:null},
    bg:{node:'254:24142', hidden:true, fill:'#ffffff'},
    header:{node:'254:24177', name:'Frame 1984079979'},
    footer:{node:'254:24163', name:'Group 1686562600'} },
  homeFamily: { match:{slug:'home'},
    bg:{node:'254:1024', name:'Component 53'},
    header:{node:'254:1499', name:'Header'},
    footer:{node:'254:1420', name:'Group 1686562582'} },
  homeCardFamily: { match:{slug:'homeCard'},
    bg:{node:'254:58072', name:'Component 53'},
    header:{node:'254:58547', name:'Header'},
    footer:{node:'254:58468', name:'Group 1686562582'} },
};

/* ---- layers.

   The loading ring is NOT here. It turned out to be a determinate fill -
   component set `254:839`, `Progression` 0/50/100%, SMART_ANIMATE 1000ms
   linear - and is built as a single SVG arc over the plate's own track, so the
   track/arc/glyph nodes and the four `Component 52` home-background variants
   were dropped rather than shipped as dead weight.

   The eight `254-*.png` entries are owned by `src/v2/screens/HomeScreen.tsx`:
   they are the home layer crops that let the animated background sit at its
   correct depth under the artwork. They keep their node-id file names on
   purpose - HomeScreen references them by id - and they are listed here so a
   regeneration re-creates them instead of wiping them. */
const layers = {
  'home-carousel':          {node:'254:1319', note:'Frame 1686562866 - horizontal carousel content, home'},
  'home-carousel-dots':     {node:'254:1408', note:'Frame 1686562094 - carousel dots, home'},
  'homeCard-carousel':      {node:'254:58367', note:'horizontal carousel content, homeCard'},
  'homeCard-carousel-dots': {node:'254:58456', note:'carousel dots, homeCard'},
  '254-1028':  {node:'254:1028',  owner:'src/v2/screens/HomeScreen.tsx', note:'home - Group 1547753965, the body under the animated background'},
  '254-1318':  {node:'254:1318',  owner:'src/v2/screens/HomeScreen.tsx', note:'home - Frame 1686562867, carousel + dots'},
  '254-1413':  {node:'254:1413',  owner:'src/v2/screens/HomeScreen.tsx', note:'home - Frame 1686562563, the row above the carousel'},
  '254-1499':  {node:'254:1499',  owner:'src/v2/screens/HomeScreen.tsx', note:'home - Header'},
  '254-58076': {node:'254:58076', owner:'src/v2/screens/HomeScreen.tsx', note:'homeCard - Group 1547753965'},
  '254-58366': {node:'254:58366', owner:'src/v2/screens/HomeScreen.tsx', note:'homeCard - Frame 1686562867'},
  '254-58461': {node:'254:58461', owner:'src/v2/screens/HomeScreen.tsx', note:'homeCard - Frame 1686562563'},
  '254-58547': {node:'254:58547', owner:'src/v2/screens/HomeScreen.tsx', note:'homeCard - Header'},
};

function chromeKeyFor(p){
  const s = scroll[p.slug];
  if (p.slug==='intro') return 'introFamily';
  if (p.slug==='introAccepted') return 'introAcceptedFamily';
  if (p.slug==='home') return 'homeFamily';
  if (p.slug==='homeCard') return 'homeCardFamily';
  if (p.kind==='amount') return 'amountFamily';
  if (p.kind==='methods') return 'methodsFamily';
  if (p.kind==='balance') {
    if (!s.scroll) return 'balanceSelectedFamily';
    return {'Frame 1984080073':'balanceShortFamily','Frame 1984080057':'balanceNoneFamily',
            'Frame 1984080062':'balanceTallFamily'}[s.scroll.containerName] || null;
  }
  return null;
}

const screens = plan.map(p => ({...p, chrome: chromeKeyFor(p), scroll: scroll[p.slug]}));
writeFileSync('.figma/v2/tools/nodes.json', JSON.stringify({screens, chrome, layers}, null, 1));

const ids = {
  screens: screens.map(s=>s.node),
  scroll:  screens.filter(s=>s.scroll && s.scroll.scroll).map(s=>s.scroll.scroll.content),
  chrome:  Object.values(chrome).flatMap(c=>[c.bg,c.header,c.footer].filter(x=>!x.hidden).map(x=>x.node)),
  layers:  Object.values(layers).map(l=>l.node),
};
writeFileSync('.figma/v2/tools/ids.json', JSON.stringify(ids,null,1));
for(const [k,v] of Object.entries(ids)) console.log(k, v.length, '=>', [...new Set(v)].length, 'unique');
