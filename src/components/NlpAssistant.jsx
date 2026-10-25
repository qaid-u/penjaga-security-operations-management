import { useEffect, useState } from 'react';
import { Check, FileText, LoaderCircle, Sparkles } from 'lucide-react';
import api from '../api/axios';
import { Button } from './ui';
import './nlp.css';

const itemText = (item) => typeof item === 'string' ? item : item?.text || item?.value || item?.name || item?.label || '';

export function NlpAssistant({ text = '', postId, reportTime, title = '', onApplyTitle }) {
  const [response, setResponse] = useState(null);
  const [requestState, setRequestState] = useState({ source: '', status: 'idle' });
  const sourceKey = `${postId || ''}:${text}`;
  const current = response?.source === sourceKey ? response.data : null;
  const status = requestState.source === sourceKey ? requestState.status : 'idle';
  const enoughText = text.trim().length >= 15 && text.length <= 20000;

  useEffect(() => {
    if (!enoughText) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setRequestState({ source: sourceKey, status: 'loading' });
      try {
        const { data } = await api.post('/reports/assist', { text, ...(postId ? { id_pos: Number(postId) } : {}) }, { signal: controller.signal });
        if (!controller.signal.aborted) {
          setResponse({ source: sourceKey, data });
          setRequestState({ source: sourceKey, status: 'ready' });
        }
      } catch (error) {
        if (!controller.signal.aborted && error.code !== 'ERR_CANCELED') setRequestState({ source: sourceKey, status: 'unavailable' });
      }
    }, 900);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [text, postId, enoughText, sourceKey]);

  const questions = (current?.quality?.questions || []).filter((_question, index) => {
    const code = current.quality.missing?.[index];
    return !(code === 'time' && reportTime) && !(code === 'known_location' && postId);
  }).slice(0, 2);
  const extracted = [
    { label: 'Masa disebut', values: current?.extraction?.times },
    { label: 'Lokasi disebut', values: current?.extraction?.locations },
    { label: 'Tindakan dilaporkan', values: current?.extraction?.actions },
  ].map(({ label, values }) => ({ label, text: (values || []).map(itemText).filter(Boolean).slice(0, 3).join(' · ') })).filter((item) => item.text);

  return <aside className="nlp-assistant" aria-label="Pembantu laporan">
    <div className="nlp-assistant-heading">
      <span className="nlp-assistant-icon" aria-hidden="true"><Sparkles size={20} /></span>
      <div><h3>Pembantu laporan</h3><p>Tulis seperti biasa. Cadangan muncul selepas anda berhenti menaip.</p></div>
      {enoughText && status === 'loading' && <LoaderCircle className="nlp-loading-icon" size={18} aria-label="Menyemak draf" />}
    </div>
    {!enoughText && <p className="nlp-helper-hint">Nyatakan apa yang berlaku, lokasi dan tindakan yang telah diambil. Butiran yang tidak diketahui boleh dinyatakan sebagai tidak pasti.</p>}
    {enoughText && !current && status !== 'unavailable' && <p className="nlp-helper-hint" role="status">{status === 'loading' ? 'Menyemak draf anda…' : 'Menunggu anda selesai menaip…'}</p>}
    {enoughText && !current && status === 'unavailable' && <p className="nlp-helper-hint" role="status">Bantuan draf belum tersedia. Anda masih boleh melengkapkan dan menghantar laporan.</p>}
    {current && <div className="nlp-assistant-content">
      {current.title && <div className="nlp-title-suggestion">
        <div><p className="label-caps">Cadangan tajuk</p><p className="font-semibold text-primary-token">{current.title}</p></div>
        {onApplyTitle && <Button type="button" variant="ghost" disabled={title === current.title} onClick={() => onApplyTitle(current.title)}>
          {title === current.title ? <><Check size={16} /> Digunakan</> : <><FileText size={16} /> {title ? 'Gantikan tajuk' : 'Gunakan tajuk'}</>}
        </Button>}
      </div>}
      {!!extracted.length && <dl className="nlp-extracted-list">{extracted.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.text}</dd></div>)}</dl>}
      {!!questions.length && <div className="nlp-missing-details">
        <p className="font-semibold text-primary-token">Butiran yang boleh dilengkapkan</p>
        <ul>{questions.map((question, index) => <li key={`${itemText(question)}-${index}`}>{itemText(question)}</li>)}</ul>
        <p>Tambah dalam kandungan laporan jika diketahui. Pembantu tidak mengisi fakta yang belum dinyatakan.</p>
      </div>}
      {!questions.length && <p className="nlp-helper-hint flex items-center gap-2"><Check size={16} aria-hidden="true" /> Cadangan tersedia. Semak fakta sebelum menghantar.</p>}
    </div>}
  </aside>;
}
