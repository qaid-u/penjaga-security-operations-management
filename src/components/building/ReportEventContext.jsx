import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';

export function ReportEventContext({ report, event, building, post }) {
  const { user } = useAuth();
  const valid = /^[1-9]\d{0,9}$/.test(report || '') && Number(report) <= 2147483647 && typeof event === 'string' && event.length > 0 && event.length <= 100 && Boolean(post);
  const query = useQuery({
    queryKey:['event3DContext',user?.id_pengguna,user?.nama_peranan,report],
    enabled:valid,
    queryFn:async({signal})=>(await api.get(`/reports/${report}`,{signal})).data,
    staleTime:30000,retry:false,
  });
  if(!report && !event)return null;
  if(!valid)return <p className="building-source-context" role="status">Pautan kejadian tidak lengkap. Pilih pos daripada model atau buka semula laporan asal.</p>;
  if(query.isPending)return <p className="building-source-context" role="status">Memuatkan petikan laporan…</p>;
  if(query.isError)return <p className="building-source-context" role="status">Petikan laporan tidak tersedia atau akses tidak dibenarkan. Rekod pos masih boleh dilihat.</p>;
  const metadata=query.data?.analysis?.metadata || query.data?.report?.nlp_metadata || {};
  const item=Array.isArray(metadata.events)?metadata.events.find(item=>item.id===event):null;
  const location=item?.location?.confirmed;
  const source=item?.source;
  const narrative=query.data?.report?.kandungan_laporan || '';
  const grounded=item?.location?.state==='confirmed' && !item.location.conflict && location?.buildingId===building.id && location.hotspot_id===post && Number.isSafeInteger(Number(location.id_pos)) && Number(location.id_pos)>0 && source?.text && Number.isInteger(source.start) && Number.isInteger(source.end) && source.start>=0 && source.end>source.start && source.end<=narrative.length && narrative.slice(source.start,source.end)===source.text;
  if(!grounded)return <p className="building-source-context" role="status">Kejadian ini belum dipautkan dengan jelas kepada pos yang dipilih. Semak laporan asal; pemetaan pos tidak diubah.</p>;
  const labels={reported:'Dilaporkan',suspected:'Disyaki',negated:'Dinafikan',drill:'Latihan',unclear:'Belum jelas'};
  return <aside className="building-source-context" aria-label="Sumber kejadian dipilih">
    <p>Laporan #{report} · {item.category} · {labels[item.status] || 'Belum jelas'}</p>
    <blockquote>“{source.text}”</blockquote>
    <p>Pos: {location.name}{location.source==='clarification'?' · Dijelaskan pengguna':''}</p>
    <small>Petikan dan kaitan pos daripada laporan. Penanda 3D kekal anggaran; kiraan operasi mengikut pos laporan asal.</small>
  </aside>;
}
