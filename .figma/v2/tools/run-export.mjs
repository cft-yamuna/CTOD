import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const EXPORTER = 'C:/Users/iamne/Desktop/figma-agent/skill/scripts/export-frame.mjs';
const FILE = 'jk3u8GQ1wxKd3Ge5hEPLaJ';
const ids = JSON.parse(readFileSync('.figma/v2/tools/ids.json','utf8'));
const group = process.argv[2];
const list = [...new Set(ids[group])];
const dir = `.figma/v2/stage/${group}`;
mkdirSync(dir,{recursive:true});
const BATCH = 12;
for (let i=0;i<list.length;i+=BATCH){
  const b = list.slice(i,i+BATCH);
  process.stdout.write(`\n[${group}] batch ${i/BATCH+1}/${Math.ceil(list.length/BATCH)} (${b.length})\n`);
  try {
    const out = execFileSync(process.execPath, [EXPORTER,'--file',FILE,'--nodes',b.join(','),'--out-dir',dir],
      {encoding:'utf8', stdio:['ignore','pipe','pipe']});
    process.stdout.write(out);
  } catch(e){
    process.stdout.write((e.stdout||'')+(e.stderr||'')+`\n! batch had failures\n`);
  }
}
