import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
export function parseCSV(text) {
  const rows=[];let row=[],field='',quoted=false;
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted && text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}else if(!quoted && (c===',' || c==='\n')){row.push(field.replace(/\r$/,''));field='';if(c==='\n'){if(row.some(Boolean))rows.push(row);row=[];}}else field+=c;}
  if(quoted)throw new Error('Unclosed CSV quotation');if(field || row.length){row.push(field.replace(/\r$/,''));if(row.some(Boolean))rows.push(row);}
  const headers=rows.shift() || [];return rows.map((r)=>{if(r.length!==headers.length)throw new Error('CSV row has unexpected column count');return Object.fromEntries(headers.map((h,i)=>[h,r[i]]));});
}
const mean=(xs)=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
const median=(xs)=>{if(!xs.length)return null;const s=[...xs].sort((a,b)=>a-b),m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2;};
export function analyze(records) {
  const seen=new Set();
  for(const r of records){const key=`${r.participant_id}:${r.interface}:${r.task_id}`;if(!/^P\d{2,4}$/.test(r.participant_id) || !['AB','BA'].includes(r.order) || !['A','B'].includes(r.interface) || !['T1','T2','T3','T4'].includes(r.task_id) || !['0','1'].includes(r.completed) || !['0','1'].includes(r.accuracy) || ['seconds','errors','interactions'].some((k)=>r[k]==='' || !Number.isFinite(Number(r[k])) || Number(r[k])<0) || !Number.isInteger(Number(r.errors)) || !Number.isInteger(Number(r.interactions)) || seen.has(key))throw new Error(`Invalid or duplicate trial: ${key}`);seen.add(key);}
  const groups=[];
  for(const task of ['T1','T2','T3','T4'])for(const ui of ['A','B']){const rows=records.filter((r)=>r.task_id===task && r.interface===ui),completed=rows.filter((r)=>r.completed==='1'),times=completed.map((r)=>Number(r.seconds));groups.push({task,interface:ui,participants:new Set(rows.map((r)=>r.participant_id)).size,trials:rows.length,completed:completed.length,completion_rate:rows.length?completed.length/rows.length:null,successful_time_mean_seconds:mean(times),successful_time_median_seconds:median(times),errors:rows.reduce((n,r)=>n+Number(r.errors),0),accuracy_rate:rows.length?rows.filter((r)=>r.accuracy==='1').length/rows.length:null,interactions_mean:mean(rows.map((r)=>Number(r.interactions)))});}
  const paired=[];for(const task of ['T1','T2','T3','T4']){const deltas=[];for(const pid of new Set(records.map((r)=>r.participant_id))){const a=records.find((r)=>r.participant_id===pid && r.task_id===task && r.interface==='A'),b=records.find((r)=>r.participant_id===pid && r.task_id===task && r.interface==='B');if(a?.completed==='1' && b?.completed==='1')deltas.push(Number(b.seconds)-Number(a.seconds));}paired.push({task,successful_pairs:deltas.length,time_difference_B_minus_A_mean_seconds:mean(deltas),time_difference_B_minus_A_median_seconds:median(deltas)});}
  return{status:records.length?'Measured supplied participant data':'Pending Data Collection',participants:new Set(records.map((r)=>r.participant_id)).size,groups,paired,interpretation:'Negative paired time differences favor B. Descriptive results only; no significance claim.'};
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){const file=process.argv[2] || 'docs/psm-evaluation/EVALUATION_DATA_TEMPLATE.csv';try{console.log(JSON.stringify(analyze(parseCSV(await readFile(file,'utf8'))),null,2));}catch(error){console.error(error.message);process.exitCode=1;}}
