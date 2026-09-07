import { figmaToken } from 'file:///C:/Users/iamne/Desktop/figma-agent/skill/scripts/lib.mjs';
const K='z22o3yPI7Q2pPtBCtPwG1O';
for (const path of [`/v1/files/${K}?depth=1`, `/v1/files/${K}/nodes?ids=1965:52201&depth=1`]) {
  const r = await fetch('https://api.figma.com'+path, { headers: { 'X-Figma-Token': figmaToken() } });
  console.log(r.status, r.statusText, '->', path.slice(0,52));
  if (!r.ok) console.log('   ', (await r.text()).slice(0,160));
}
