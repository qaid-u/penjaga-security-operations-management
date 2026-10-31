import {useState} from 'react';
import {Field,Select,Input} from './ui';
import {klToday,periodRange} from '../utils/periodRange';
export function PeriodControls({onChange,defaultMode='all'}) {
  const [mode,setMode]=useState(defaultMode),[anchor,setAnchor]=useState(klToday);
  const update=(next,value)=>{setMode(next);setAnchor(value);if(value||next==='all') {try{onChange(periodRange(next,value,value));}catch{/* Incomplete input retains the last valid period. */}}};
  return <div className="ops-period-controls"><Field label="Tempoh statistik"><Select value={mode} onChange={e=>{const today=klToday();update(e.target.value,e.target.value==='month'?today.slice(0,7):e.target.value==='year'?today.slice(0,4):today);}}><option value="fortnight">14 hari terakhir</option><option value="all">Semua masa</option><option value="week">Mingguan</option><option value="month">Bulanan</option><option value="year">Tahunan</option></Select></Field>{mode!=='all'&&<Field label={mode==='week'?'Tarikh dalam minggu':mode==='month'?'Bulan statistik':mode==='fortnight'?'Hingga tarikh':'Tahun statistik'}><Input type={mode==='month'?'month':mode==='year'?'number':'date'} min={mode==='year'?'1900':undefined} max={mode==='year'?'9999':undefined} value={anchor} onChange={e=>update(mode,e.target.value)}/></Field>}</div>;
}
