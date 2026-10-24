// Reconstruct only the measured legacy loader/query implementations, then restore all current edits.
import {readFile,writeFile,copyFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const files=['src/components/building/useBuildingAsset.js','backend/controllers/dashboardController.js','backend/controllers/reportController.js','backend/controllers/actionController.js'];
const baselineRef='0fed3f7';
const saved=new Map();
await mkdir('docs/psm-evaluation/evidence',{recursive:true});
try{await copyFile('docs/psm-evaluation/evidence/performance-before.json','docs/psm-evaluation/evidence/performance-initial.json');}catch{}
try {
  for(const file of files){saved.set(file,await readFile(file));await writeFile(file,execFileSync('git',['show',`${baselineRef}:${file}`],{windowsHide:true}));}
  const viewer='src/components/building/BuildingViewer.jsx';saved.set(viewer,await readFile(viewer));await writeFile(viewer,saved.get(viewer).toString().replace('shadow-autoUpdate={false} shadow-needsUpdate={true} ',''));
  execFileSync(process.execPath,['node_modules/@playwright/test/cli.js','test','--config','playwright.phase5.config.mjs','--grep','benchmark'],{windowsHide:true,stdio:'inherit',env:{...process.env,PHASE5_BENCHMARK:'before'}});
} finally {for(const[file,bytes]of saved)await writeFile(file,bytes);}
