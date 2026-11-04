import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Tags, RefreshCw, Clock3, ShieldCheck, AlertCircle } from 'lucide-react';
import api from '../api/axios';
import { Badge, Button } from './ui';
import './report-summary.css';

export function ClassificationSummary({report={},analysis:initialAnalysis,job:initialJob}) {
  const [started]=useState(()=>Date.now());
  const published=useRef(null);
  const cache=useQueryClient();
  const id=report.id_laporan;
  const query=useQuery({
    queryKey:['reportAnalysis',id],
    queryFn:async({signal})=>(await api.get(`/reports/${id}/analysis`,{signal})).data,
    enabled:Boolean(id),retry:false,
    refetchInterval:q=>['pending','processing'].includes((q.state.data?.job||initialJob)?.status)&&Date.now()-started<90000?2500:false,
  });
  const analysis=query.data?.analysis||initialAnalysis;
  const job=query.data?.job||initialJob;
  const pending=['pending','processing'].includes(job?.status);
  const category=analysis?.kategori_dikesan||analysis?.topCategory||report.kategori_dikesan;
  const risk=analysis?.tahap_risiko||analysis?.riskLevel||report.tahap_risiko;
  const riskHint={Low:'Semakan rutin',Medium:'Perlu perhatian',High:'Utamakan semakan',Critical:'Semak segera'}[risk]||'Semak kandungan asal';
  useEffect(()=>{
    if(!analysis?.id_nlp||pending||published.current===analysis.id_nlp)return;
    published.current=analysis.id_nlp;
    cache.invalidateQueries({queryKey:['reports']});cache.invalidateQueries({queryKey:['myReports']});cache.invalidateQueries({queryKey:['dashboard']});
  },[analysis?.id_nlp,pending,cache]);
  const waiting=pending||Boolean(id)&&query.isPending&&!initialAnalysis&&!report.kategori_dikesan;
  const unavailable=query.isError&&!category;
  const failed=job?.status==='failed';
  return <section className="report-classification" aria-label="Klasifikasi automatik">
    <div className="report-classification-head"><span className="report-classification-icon"><Tags size={18}/></span><div><strong>Klasifikasi automatik</strong><span>Ringkasan untuk membantu semakan</span></div><span className="report-suggestion-label">Cadangan sistem</span></div>
    {unavailable||failed?<div className="report-analysis-state" role="status"><AlertCircle size={19}/><p>{unavailable?'Klasifikasi belum dapat dimuatkan. Laporan anda kekal disimpan.':'Klasifikasi belum selesai. Ketua Pengawal boleh menyemak laporan berdasarkan kandungan asal.'}</p></div>:waiting?<div className="report-analysis-state" role="status"><Clock3 size={19}/><div><strong>Sedang diproses</strong><p>Kategori dan tahap risiko sedang dikenal pasti.</p><small>Keputusan akan dikemas kini secara automatik.</small></div></div>:<div className="report-classification-values"><div><span className="report-field-caption">Kategori laporan</span><strong>{category&&category!=='Unknown'?category:'Perlu semakan'}</strong></div><div><span className="report-field-caption">Tahap risiko</span><div className="report-risk-value"><Badge tone={risk}>{risk&&risk!=='Unknown'?risk:'Belum ditentukan'}</Badge><span>{riskHint}</span></div></div></div>}
    <div className="report-classification-foot"><ShieldCheck size={15}/><p>Keputusan rasmi dibuat oleh Ketua Pengawal berdasarkan laporan asal.</p></div>
    {(query.isError||waiting)&&<Button type="button" variant="ghost" className="mt-3" disabled={query.isFetching} onClick={()=>query.refetch()}><RefreshCw size={14} className={query.isFetching?'ops-spin':''}/>Muat semula status</Button>}
  </section>;
}
