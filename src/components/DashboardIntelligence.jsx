import {useState} from 'react';
import { Link } from 'react-router-dom';
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowDownRight, ArrowUpRight, ArrowRight, BarChart3, ShieldAlert, ScanLine, FileCheck2, MapPin, Layers3, Clock3, Sparkles } from 'lucide-react';
import { EmptyState } from './ui';
const percentage=(n,d)=>d?Math.round(n/d*1000)/10:null;
const showRate=value=>value===null?'—':`${value}%`;
const shortDate=value=>value?new Intl.DateTimeFormat('ms-MY',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(value+'T00:00:00Z')):'—';
export function DashboardIntelligence({data,metrics,filters}) {
  const [exploreOpen,setExploreOpen]=useState(false);
  const [trendMetric,setTrendMetric]=useState('reports');
  const info=data.insights;
  const classified=(data.byRisk||[]).filter(r=>r.name!=='Unknown').reduce((sum,r)=>sum+Number(r.value),0);
  const current=info?.current||{total:Number(data.cards?.total_laporan)||0,high:Number(data.cards?.risiko_tinggi)||0,classified,reviewed:null,attachments:Number(data.cards?.laporan_berlampiran)||0};
  const previous=info?.previous;
  const quality=percentage(current.classified,current.total),risk=percentage(current.high,current.classified),review=current.reviewed===null?null:percentage(current.reviewed,current.total);
  const delta=info?.comparison?.volumeChange??null;
  const chartDelta=trendMetric==='reports'?delta:info?.previous?.high?Math.round((current.high-info.previous.high)/info.previous.high*1000)/10:null;
  const trend=info?.series||(data.trend||[]).map(d=>({date:d.date,reports:d.laporan,previous:null}));
  const pendingKnown=info?.backlog?.length===3;
  const pending=(info?.backlog||[]).reduce((sum,r)=>sum+r.count,0);
  const missing=current.total-current.classified;
  const riskChange=info?.comparison?.riskShareChange;
  const period=info?.period;
  const range=period?`${shortDate(period.from)} – ${shortDate(info.futurePeriod?period.to:period.observedTo)}${info.futurePeriod?' (akan datang)':''}`:filters.from?`${shortDate(filters.from)} – ${shortDate(filters.to)}`:'Tempoh dipilih';
  const postUrl=id=>'/semakan?'+new URLSearchParams({post:String(id),status:'Semua',...(filters.risk?{risk:filters.risk}:{}),...(period?.days?{from:period.from,to:period.observedTo}:{})}).toString();
  const cards=[
    {label:'Laporan direkod',value:current.total,icon:BarChart3,tone:'violet',foot:previous?`${previous.total} laporan dalam tempoh lepas`:'Bilangan dalam tempoh dipilih',delta:delta===null?null:`${delta>0?'+':''}${delta}%`,direction:delta>0?'up':'down'},
    {label:'Bahagian High / Critical',value:showRate(risk),icon:ShieldAlert,tone:'coral',foot:`${current.high} daripada ${current.classified} laporan dikelaskan`,delta:typeof riskChange==='number'?`${riskChange>0?'+':''}${riskChange} pp`:null,direction:riskChange>0?'up':'down'},
    {label:'Semakan selesai',value:showRate(review),icon:FileCheck2,tone:'teal',foot:current.reviewed===null?'Data semakan belum tersedia':`${current.reviewed} daripada ${current.total} laporan diputuskan`},
    {label:'Liputan klasifikasi',value:showRate(quality),icon:ScanLine,tone:'blue',foot:current.total?`${missing} laporan belum dikelaskan`:'Belum ada laporan dalam tempoh ini'},
  ];
  return <section className="ops-dashboard-summary ds-intelligence" aria-label="Dashboard ringkas">
    <div className="ds-section-label"><span><Layers3 size={14}/>Prestasi laporan</span><span className="ds-period-chip">{range}</span></div>
    {info?.futurePeriod&&<p className="ds-method-note">Tempoh ini belum bermula. Tiada perbandingan masa hadapan dibuat.</p>}
    <div className="ds-kpis">{cards.map(({label,value,icon:Icon,tone,foot,delta,direction})=><article key={label} className={'ds-kpi ds-'+tone}><div className="ds-kpi-top"><span className="ds-icon"><Icon size={19}/></span>{delta&&<span className="ds-delta">{direction==='up'?<ArrowUpRight size={13}/>:<ArrowDownRight size={13}/>} {delta}</span>}</div><span className="ds-kpi-label">{label}</span><strong>{value}</strong><small>{foot}</small></article>)}</div>
    <div className="ds-chart-grid">
      <article className="ds-panel ds-trend"><div className="ds-panel-heading"><div><span className="ds-eyebrow">VOLUME & PERUBAHAN</span><h2>Rentak laporan</h2></div><span className="ds-chart-total">{current.total}<small>laporan</small></span></div>
        <div className="ds-trend-switch" aria-label="Metrik trend"><button aria-pressed={trendMetric==='reports'} onClick={()=>setTrendMetric('reports')}>Jumlah laporan</button><button disabled={!info} aria-pressed={trendMetric==='high'} onClick={()=>setTrendMetric('high')}>High/Critical</button></div><div className="ds-chart-legend"><span><i/>Tempoh ini</span>{info?.comparison&&<span><i className="is-previous"/>Tempoh lepas, panjang sama</span>}</div>
        <div className="ds-chart" role="img" aria-label="Trend harian laporan semasa dan tempoh sebelumnya"><ResponsiveContainer width="100%" height={220}><ComposedChart data={trend} margin={{top:15,right:6,bottom:0,left:-22}}><defs><linearGradient id="ds-volume" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7165e8" stopOpacity={.28}/><stop offset="100%" stopColor="#7165e8" stopOpacity={.01}/></linearGradient></defs><CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#edf0f5"/><XAxis dataKey="date" tickFormatter={shortDate} minTickGap={34} tick={{fontSize:10,fill:'#8490a4'}} axisLine={false} tickLine={false}/><YAxis allowDecimals={false} tick={{fontSize:10,fill:'#8490a4'}} axisLine={false} tickLine={false}/><Tooltip labelFormatter={shortDate} contentStyle={{borderRadius:12,border:'1px solid #e7eaf2',fontSize:12}}/><Area type="monotone" dataKey={trendMetric} name={trendMetric==='reports'?'Laporan tempoh ini':'High/Critical tempoh ini'} stroke="#7165e8" strokeWidth={3} fill="url(#ds-volume)" isAnimationActive={false}/>{info?.comparison&&<Line type="monotone" dataKey={trendMetric==='reports'?'previous':'previous_high'} name="Tempoh lepas (hari sepadan)" stroke="#aeb7c8" strokeDasharray="4 4" strokeWidth={2} dot={false} isAnimationActive={false}/>}</ComposedChart></ResponsiveContainer></div>
        <div className="ds-chart-footer">{info?.comparison?<><span>{shortDate(info.comparison.from)} – {shortDate(info.comparison.to)} sebagai pembanding</span><strong>{chartDelta===null?'Asas tempoh lepas = 0':`${Math.abs(chartDelta)}% ${chartDelta>=0?'lebih banyak':'lebih sedikit'}`}</strong></>:<span>Perbandingan tersedia apabila tempoh tertentu dipilih.</span>}</div>
        {period?.trendLimited&&<p className="ds-method-note">Trend dihadkan kepada 366 hari terakhir. Kad statistik merangkumi keseluruhan tempoh.</p>}
      </article>
      <article className="ds-panel ds-quality"><div className="ds-panel-heading"><div><span className="ds-eyebrow">KEBOLEHGUNAAN DATA</span><h2>Sejauh mana data lengkap?</h2></div><ScanLine size={20}/></div>
        <div className="ds-quality-ring" style={{'--quality':(quality||0)+'%'}}><div><strong>{showRate(quality)}</strong><span>telah dikelaskan</span></div></div>
        <div className="ds-quality-detail"><span><i className="ds-dot teal"/>Dikelaskan</span><strong>{current.classified}</strong></div><div className="ds-quality-detail"><span><i className="ds-dot gray"/>Belum dikelaskan</span><strong>{missing}</strong></div>
        <p className="ds-method-note">Risiko ialah klasifikasi NLP tersimpan. Laporan tanpa klasifikasi tidak dianggap Low.</p>
      </article>
    </div>
    <div className="ds-insight"><span className="ds-insight-icon"><Sparkles size={19}/></span><div><strong>{missing>0?'Lengkapkan data sebelum mentafsir corak':current.total?'Konteks di sebalik angka':'Belum cukup data untuk dibandingkan'}</strong><p>{missing>0?`${missing} daripada ${current.total} laporan belum mempunyai klasifikasi. Bahagian risiko menggunakan ${current.classified} laporan yang dikelaskan sahaja.`:current.total?`${current.high} laporan diklasifikasikan High/Critical. Bilangan laporan menggambarkan aktiviti pelaporan; ia bukan kadar kejadian sebenar.`:'Pilih tempoh lain atau tunggu laporan baharu. Tiada skor atau ramalan dibuat daripada data kosong.'}</p></div></div>
    <div className="ds-section-label"><span><Clock3 size={14}/>Tindakan sekarang</span><span className="ds-scope-note">Snapshot semasa · Semua pos & tempoh</span></div>
    <div className="workspace-metrics ds-queue">{metrics.map(({label,value,to,hint,icon:Icon})=><Link key={label} to={to} className="workspace-metric"><span className="ds-icon"><Icon size={18}/></span><div><strong>{value??0}</strong><span>{label}</span><small>{hint}</small></div><ArrowRight size={16}/></Link>)}</div>
    {Number(data.priority?.laporan_kritikal_menunggu)>0&&<Link to="/semakan?status=Dihantar&risk=HighCritical" className="ds-alert-link"><ShieldAlert size={18}/><span><strong>{data.priority.laporan_kritikal_menunggu}</strong> laporan High/Critical menunggu semakan</span><ArrowRight size={16}/></Link>}
<button className="ds-explore-toggle" aria-expanded={exploreOpen} aria-controls="ds-explore-grid" onClick={()=>setExploreOpen(value=>!value)}><MapPin size={17}/><span>{exploreOpen?'Tutup butiran pos & semakan':'Terokai pos & usia semakan'}</span><ArrowRight size={16}/></button>
    <div id="ds-explore-grid" className={`ds-lower-grid ${exploreOpen?'is-open':''}`}>
      <article className="ds-panel"><div className="ds-panel-heading"><div><span className="ds-eyebrow">UTAMAKAN SEMAKAN</span><h2>Pos dengan laporan High/Critical</h2></div><MapPin size={19}/></div>
        {info?.posts?.length?info.posts.map((p,i)=><Link to={postUrl(p.id_pos)} className="ds-post-row" key={p.id_pos}><span className="ds-rank">{String(i+1).padStart(2,'0')}</span><div><strong>{p.name}</strong><small>{p.reports} laporan · {p.classified} dikelaskan</small></div><span className="ds-post-high">{p.high}<small>High/Critical</small></span><ArrowUpRight size={15}/></Link>):<EmptyState title="Tiada data pos" description="Laporan dalam tempoh dipilih akan membentuk senarai ini."/>}
        <p className="ds-method-note">Disusun mengikut bilangan High/Critical, kemudian jumlah laporan; bukan ukuran bahaya atau prestasi pengawal. Klik pos untuk laporan sumber.</p>
      </article>
      <article className="ds-panel ds-backlog"><div className="ds-panel-heading"><div><span className="ds-eyebrow">ALIRAN SEMAKAN</span><h2>Berapa lama laporan menunggu?</h2></div><Clock3 size={19}/></div><div className="ds-backlog-total"><strong>{pendingKnown?pending:'—'}</strong><span>belum diputuskan</span></div>
        {(info?.backlog||[]).map((b,i)=><div className="ds-age-row" key={b.age}><span>{b.age}</span><div><i style={{width:(pending?b.count/pending*100:0)+'%',background:['#55b6a5','#dba354','#c46b80'][i]}}/></div><strong>{b.count}</strong></div>)}
        <Link to={'/semakan?'+new URLSearchParams({status:'Dihantar',...(filters.location?{post:filters.location}:{}),...(filters.risk?{risk:filters.risk}:{})}).toString()} className="ds-text-link">Buka barisan semakan <ArrowRight size={15}/></Link><p className="ds-method-note">Usia sejak tarikh laporan hingga hari ini (MYT). Mengikut penapis pos/risiko, merentas semua tarikh; bukan ukuran SLA.</p>
      </article>
    </div>
    <p className="ds-method-note">Peratus dipaparkan bersama saiz sampel. “pp” ialah beza mata peratusan. Perubahan volum tidak ditafsirkan sebagai peningkatan atau penurunan keselamatan.</p>
  </section>;
}
