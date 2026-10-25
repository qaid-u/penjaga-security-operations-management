import { useEffect, useRef, useState } from 'react';
import { Check, FileText, LoaderCircle, Sparkles } from 'lucide-react';
import api from '../api/axios';
import { Button } from './ui';
import { NlpEventList } from './NlpEventList';
import './nlp.css';

function ClarificationQuestion({ question, busy, onAnswer }) {
  const [value, setValue] = useState('');
  const options = (question.options || []).filter((option) => !['unknown', 'skip'].includes(option.value));
  const acceptsText = question.acceptsFreeText && ['time', 'action'].includes(question.field);
  const maxLength = Math.min(question.maxLength || (question.field === 'time' ? 120 : 500), question.field === 'time' ? 120 : 500);

  return <section className="nlp-clarification" aria-label="Soalan penjelasan">
    <p className="label-caps">Satu butiran lagi · pilihan</p>
    <h4>{question.prompt}</h4>
    {question.reason && <p className="nlp-helper-hint">{question.reason}</p>}
    <div className="nlp-answer-options">{options.map((option) => <Button key={option.value} type="button" variant="ghost" disabled={busy} onClick={() => onAnswer(option.value)}>{option.label}</Button>)}</div>
    {acceptsText && <div className="nlp-answer-input">
      <label htmlFor={`clarification-${question.id}`}>{question.field === 'time' ? 'Masa kejadian jika diketahui' : 'Tindakan yang diambil jika diketahui'}</label>
      <input id={`clarification-${question.id}`} className="app-input" maxLength={maxLength} value={value} onChange={(event) => setValue(event.target.value)} disabled={busy} />
      <Button type="button" disabled={busy || !value.trim()} onClick={() => onAnswer(value.trim())}>Simpan jawapan</Button>
    </div>}
    <div className="nlp-answer-options"><Button type="button" variant="ghost" disabled={busy} onClick={() => onAnswer('unknown')}>Tidak pasti</Button><Button type="button" variant="ghost" disabled={busy} onClick={() => onAnswer('skip')}>Langkau</Button></div>
    <p className="nlp-helper-hint">Jawapan disimpan sebagai penjelasan anda. Teks laporan asal dikekalkan. Anda boleh terus menghantar laporan.</p>
  </section>;
}

export function NlpAssistant({ text = '', postId, ...props }) {
  // A changed source starts a fresh conversation, even if an earlier source is restored.
  return <DraftAssistant key={JSON.stringify([String(postId || ''), text])} text={text} postId={postId} {...props} />;
}

function DraftAssistant({ text, postId, title = '', onApplyTitle, onClarificationsChange }) {
  const [response, setResponse] = useState(null);
  const [requestState, setRequestState] = useState({ source: '', status: 'idle' });
  const answerRequest = useRef(null);
  const sourceKey = JSON.stringify([String(postId || ''), text]);
  const current = response?.source === sourceKey ? response.data : null;
  const analysis = current?.analysis || current;
  const dialogue = current?.dialogue || analysis?.dialogue;
  const clarifications = current ? response.clarifications : [];
  const status = requestState.source === sourceKey ? requestState.status : 'idle';
  const enoughText = text.trim().length >= 15 && text.length <= 20000;

  useEffect(() => {
    answerRequest.current?.abort();
    if (!enoughText) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setRequestState({ source: sourceKey, status: 'loading' });
      try {
        const { data } = await api.post('/reports/assist', { text, ...(postId ? { id_pos: Number(postId) } : {}) }, { signal: controller.signal });
        if (!controller.signal.aborted) {
          setResponse({ source: sourceKey, data, clarifications: [] });
          setRequestState({ source: sourceKey, status: 'ready' });
        }
      } catch (error) {
        if (!controller.signal.aborted && error.code !== 'ERR_CANCELED') setRequestState({ source: sourceKey, status: 'unavailable' });
      }
    }, 900);
    return () => { clearTimeout(timer); controller.abort(); answerRequest.current?.abort(); };
  }, [text, postId, enoughText, sourceKey]);

  const answeredIds = new Set([...(dialogue?.answers || []).map((answer) => answer.questionId), ...clarifications.map((answer) => answer.questionId)]);
  const question = (dialogue?.questions || []).find((item) => !answeredIds.has(item.id));
  const answerQuestion = async (value) => {
    if (!question || !dialogue?.draftHash || status === 'answering') return;
    answerRequest.current?.abort();
    const controller = new AbortController();
    answerRequest.current = controller;
    const next = [...clarifications.filter((answer) => answer.questionId !== question.id), { questionId: question.id, value }];
    setRequestState({ source: sourceKey, status: 'answering' });
    try {
      const { data } = await api.post('/reports/assist', { text, ...(postId ? { id_pos: Number(postId) } : {}), sourceHash: dialogue.draftHash, clarifications: next }, { signal: controller.signal });
      if (controller.signal.aborted) return;
      const nextDialogue = data.dialogue || data.analysis?.dialogue;
      if (!nextDialogue?.draftHash || nextDialogue.draftHash !== dialogue.draftHash) throw new Error('Draft changed');
      setResponse({ source: sourceKey, data, clarifications: next });
      setRequestState({ source: sourceKey, status: 'ready' });
      onClarificationsChange?.({ draftHash: nextDialogue.draftHash, clarifications: next }, { text, postId });
    } catch (error) {
      if (!controller.signal.aborted && error.code !== 'ERR_CANCELED') setRequestState({ source: sourceKey, status: 'answer-error' });
    }
  };

  return <aside className="nlp-assistant" aria-label="Pembantu laporan">
    <div className="nlp-assistant-heading">
      <span className="nlp-assistant-icon" aria-hidden="true"><Sparkles size={20} /></span>
      <div><h3>Pembantu laporan</h3><p>Tulis seperti biasa. Cadangan muncul selepas anda berhenti menaip.</p></div>
      {['loading', 'answering'].includes(status) && <LoaderCircle className="nlp-loading-icon" size={18} aria-label="Menyemak draf" />}
    </div>
    {!enoughText && <p className="nlp-helper-hint">Nyatakan apa yang berlaku, lokasi dan tindakan yang telah diambil. Butiran yang tidak diketahui boleh dinyatakan sebagai tidak pasti.</p>}
    {enoughText && !current && status !== 'unavailable' && <p className="nlp-helper-hint" role="status">{status === 'loading' ? 'Menyemak draf anda…' : 'Menunggu anda selesai menaip…'}</p>}
    {enoughText && !current && status === 'unavailable' && <p className="nlp-helper-hint" role="status">Bantuan draf belum tersedia. Anda masih boleh melengkapkan dan menghantar laporan.</p>}
    {current && <div className="nlp-assistant-content">
      {analysis?.title && <div className="nlp-title-suggestion">
        <div><p className="label-caps">Cadangan tajuk</p><p className="font-semibold text-primary-token">{analysis.title}</p></div>
        {onApplyTitle && <Button type="button" variant="ghost" disabled={title === analysis.title} onClick={() => onApplyTitle(analysis.title)}>
          {title === analysis.title ? <><Check size={16} /> Digunakan</> : <><FileText size={16} /> {title ? 'Gantikan tajuk' : 'Gunakan tajuk'}</>}
        </Button>}
      </div>}
      <NlpEventList events={dialogue?.events || analysis?.events} dialogue={dialogue} sourceText={text} />
      {analysis?.eventsTruncated && <p className="nlp-helper-hint" role="status">Sebahagian kejadian sahaja dianalisis. Semak keseluruhan laporan asal.</p>}
      {question && <ClarificationQuestion key={`${sourceKey}:${question.id}`} question={question} busy={status === 'answering'} onAnswer={answerQuestion} />}
      {status === 'answer-error' && <p className="nlp-helper-hint" role="status">Jawapan belum disimpan. Cuba pilihan sekali lagi atau terus hantar laporan.</p>}
      {!question && (dialogue?.limitReached ? <p className="nlp-helper-hint" role="status">Had penjelasan dicapai. Semak butiran dalam laporan atau teruskan penghantaran.</p> : <p className="nlp-helper-hint flex items-center gap-2"><Check size={16} aria-hidden="true" /> Cadangan tersedia. Semak fakta sebelum menghantar.</p>)}
    </div>}
  </aside>;
}
