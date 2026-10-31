import {useEffect,useRef,useState} from 'react';
import {Download, CalendarRange, X} from 'lucide-react';
import {Button,Field,Input,Select,AlertMessage} from './ui';
import {downloadCsv} from '../utils/helpers';
import {klToday,periodRange} from '../utils/periodRange';

export function ExportButton({endpoint,filename,filters={},label='CSV',onExport,dashboard=false}) {
  const [open,setOpen]=useState(false),[period,setPeriod]=useState('current'),[anchor,setAnchor]=useState(klToday),[end,setEnd]=useState(klToday),[format,setFormat]=useState('csv'),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const dialog=useRef(null);
  let preview;try {preview=periodRange(period,anchor,end);}catch {preview=null;}
  useEffect(()=>{if(open)dialog.current?.showModal();else dialog.current?.close();},[open]);
  const changePeriod=value=>{setPeriod(value);const today=klToday();setAnchor(value==='month'?today.slice(0,7):value==='year'?today.slice(0,4):today);setError('');};
  const close=()=>{if(!busy)setOpen(false);};
  const submit=async e=>{
    e.preventDefault();setError('');setBusy(true);
    try {
      const range=periodRange(period,anchor,end);
      const params={...filters};
      if(period!=='current') {for(const key of ['date','dateMode','month','year','from','to'])delete params[key];Object.assign(params,range);}
      if(onExport)await onExport(params,format);else if(await downloadCsv(endpoint,filename,{...params,format:'csv'}) === false) throw new Error('Eksport gagal. Sila kecilkan tempoh atau cuba lagi.');
      setOpen(false);
    }catch(err){setError(err.response?.data?.message||err.message||'Eksport gagal. Cuba lagi.');}finally{setBusy(false);}
  };
  return <><Button type="button" variant="ghost" onClick={()=>setOpen(true)}><Download size={16}/>{label}</Button>
    <dialog ref={dialog} className="ops-export-dialog" aria-labelledby="export-title" onCancel={e=>{e.preventDefault();close();}} onClose={()=>setOpen(false)}>
      <form onSubmit={submit} className="space-y-5">
        <div className="flex items-center justify-between gap-3"><div><p className="workspace-note">PENJAGA / EKSPORT</p><h2 id="export-title">{dashboard?'Muat turun dashboard':'Muat turun CSV'}</h2></div><Button type="button" variant="ghost" disabled={busy} onClick={close} aria-label="Tutup eksport"><X size={18}/></Button></div>
        <p className="workspace-note">Pilih tempoh muat turun. Penapis pos, status dan carian semasa dikekalkan.</p>
        <Field label="Tempoh eksport"><Select value={period} onChange={e=>changePeriod(e.target.value)}><option value="current">Paparan semasa</option><option value="week">Mingguan (Isnin–Ahad)</option><option value="month">Bulanan</option><option value="year">Tahunan</option><option value="custom">Julat tersuai</option><option value="all">Semua masa</option></Select></Field>
        {period!=='current'&&period!=='all'&&<Field label={period==='month'?'Bulan eksport':period==='year'?'Tahun eksport':period==='week'?'Tarikh dalam minggu':'Dari tarikh'}><Input required type={period==='month'?'month':period==='year'?'number':'date'} min={period==='year'?'1900':undefined} max={period==='year'?'9999':undefined} value={anchor} onChange={e=>setAnchor(e.target.value)}/></Field>}
        {period==='custom'&&<Field label="Hingga tarikh"><Input type="date" required value={end} min={anchor} onChange={e=>setEnd(e.target.value)}/></Field>}
        {preview?.from&&<p className="ops-export-range"><CalendarRange size={16}/><span>{preview.from} <span aria-hidden="true">→</span> {preview.to}</span></p>}
        {period==='week'&&anchor&&<p className="workspace-note"><CalendarRange size={15} className="inline mr-2"/>Minggu penuh Isnin hingga Ahad, termasuk kedua-dua tarikh.</p>}
        {dashboard&&<Field label="Format muat turun"><Select value={format} onChange={e=>setFormat(e.target.value)}><option value="csv">CSV · Data ringkasan</option><option value="svg">SVG · Dashboard visual</option></Select></Field>}
        {error&&<AlertMessage>{error}</AlertMessage>}
        <Button type="submit" disabled={busy} className="w-full"><Download size={17}/>{busy?'Menyediakan...':'Muat turun'}</Button>
      </form>
    </dialog>
  </>;
}
