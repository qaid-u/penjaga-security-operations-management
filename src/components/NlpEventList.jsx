import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLE } from '../utils/helpers';

const statusLabels = { reported: 'Dilaporkan', suspected: 'Disyaki', negated: 'Dinafikan dalam teks', drill: 'Latihan / simulasi', unclear: 'Belum jelas' };
const fieldLabels = { status: 'Konteks kejadian', location: 'Lokasi', time: 'Masa', action: 'Tindakan' };
const textOf = (value) => typeof value === 'string' ? value : value?.text || value?.label || value?.name || '';
const sourceQuote = (item, sourceText) => {
  const quote = textOf(item);
  if (!quote) return '';
  if (item && typeof item === 'object' && (item.start !== undefined || item.end !== undefined)) {
    const bounded = Number.isInteger(item.start) && Number.isInteger(item.end) && item.start >= 0 && item.end > item.start && item.end <= sourceText.length;
    return bounded && sourceText.slice(item.start, item.end) === quote ? quote : '';
  }
  return sourceText.includes(quote) ? quote : '';
};

function OfficialPost({ post, canOpen3D, reportId, eventId }) {
  if (!post?.name) return null;
  const mappedPost = Number.isInteger(Number(post.id_pos)) && Number(post.id_pos) > 0;
  const storedReport = Number.isInteger(Number(reportId)) && Number(reportId) > 0;
  const context = storedReport && eventId ? `&report=${encodeURIComponent(reportId)}&event=${encodeURIComponent(eventId)}` : '';
  const target = mappedPost && post.buildingId && post.hotspot_id ? `/3d-command-centre?building=${encodeURIComponent(post.buildingId)}&post=${encodeURIComponent(post.hotspot_id)}${context}` : null;
  return <span className="nlp-official-post">{post.name}{post.buildingName && <small>{post.buildingName}</small>}{canOpen3D && target && <Link to={target}>Lihat pos dalam 3D</Link>}</span>;
}

export function NlpEventList({ events = [], dialogue, sourceText = '', reportId }) {
  const { user } = useAuth();
  const canOpen3D = [ROLE.chief, ROLE.admin].includes(user?.nama_peranan);
  const answers = Array.isArray(dialogue?.answers) ? dialogue.answers : [];
  const visibleEvents = Array.isArray(events) ? events : [];
  if (!visibleEvents.length && !answers.length) return null;

  return <div className="nlp-events">
    {!!visibleEvents.length && <section aria-label="Kejadian dalam laporan"><h4>Kejadian dalam laporan</h4><p className="nlp-helper-hint">Setiap kejadian disemak mengikut petikan asalnya.</p>
      <ol className="nlp-event-list">{visibleEvents.map((event, index) => {
        const source = sourceQuote(event.source || (!Array.isArray(event.evidence) ? event.evidence : null), sourceText);
        const evidence = (Array.isArray(event.evidence) ? event.evidence : []).map((item) => sourceQuote(item, sourceText)).filter((quote) => quote && quote !== source);
        const facts = [{ label: 'Masa', values: event.times }, { label: 'Aset', values: event.assets }, { label: 'Tindakan', values: event.actions }]
          .map((item) => ({ ...item, quotes: (item.values || []).map((value) => sourceQuote(value, sourceText)).filter(Boolean) })).filter((item) => item.quotes.length);
        const location = event.location || {};
        const uncertainPosts = [...(location.candidates || []), ...(location.conflict && location.confirmed ? [location.confirmed] : [])]
          .filter((post, index, items) => items.findIndex((candidate) => (candidate.id_lokasi || candidate.hotspot_id || candidate.name) === (post.id_lokasi || post.hotspot_id || post.name)) === index);
        const sourceStatus = event.originalStatus || event.status;
        return <li key={event.id || index} className="nlp-event-card" data-event-id={event.id}>
          <div className="nlp-event-heading"><h5>{index + 1}. {event.category || 'Kejadian belum dikenal pasti'}</h5><span className={`nlp-event-status nlp-event-${sourceStatus}`}>{statusLabels[sourceStatus] || 'Belum jelas'}</span></div>
          {source ? <blockquote className="nlp-source-quote"><span>Petikan laporan asal</span><q>{source}</q></blockquote> : <p className="nlp-helper-hint">Petikan sumber belum tersedia.</p>}
          {!!evidence.length && <details className="nlp-event-evidence"><summary>Petikan sokongan</summary>{[...new Set(evidence)].map((quote) => <blockquote key={quote} className="nlp-source-quote"><q>{quote}</q></blockquote>)}</details>}
          {!!facts.length && <dl className="nlp-extracted-list">{facts.map(({ label, quotes }) => <div key={label}><dt>{label} dalam teks</dt><dd>{quotes.join(' · ')}</dd></div>)}</dl>}
          {location.state === 'confirmed' && !location.conflict && location.confirmed ? <p className="nlp-event-location"><strong>{location.confirmed.source === 'clarification' ? 'Pos dijelaskan pengguna' : 'Pos dikenal pasti'}</strong><OfficialPost post={location.confirmed} canOpen3D={canOpen3D} reportId={reportId} eventId={event.id} /></p> : location.state === 'ambiguous' || location.conflict ? <div className="nlp-event-location"><strong>Lokasi belum dipastikan</strong><p>{location.conflict ? 'Lokasi dalam teks berbeza daripada pos laporan. Penjelasan diperlukan.' : 'Beberapa pos sepadan. Penjelasan diperlukan.'}</p>{uncertainPosts.map((post) => <OfficialPost key={post.id_lokasi || post.hotspot_id || post.name} post={post} canOpen3D={false} />)}</div> : <p className="nlp-helper-hint">Pos kejadian belum dikenal pasti.</p>}
        </li>;
      })}</ol>
    </section>}
    {!!answers.length && <section className="nlp-clarification-history" aria-label="Penjelasan pengguna"><h4>Penjelasan pengguna</h4><p className="nlp-helper-hint">Jawapan tambahan daripada pengguna, berasingan daripada petikan laporan asal.</p><ul>{answers.map((answer, index) => <li key={`${answer.questionId}-${index}`}><span>{fieldLabels[answer.field] || 'Butiran'}{answer.eventId && visibleEvents.some((event) => event.id === answer.eventId) ? ` · Kejadian ${visibleEvents.findIndex((event) => event.id === answer.eventId) + 1}` : ''}</span><strong>{answer.status === 'unknown' || answer.value === 'unknown' ? 'Tidak pasti' : answer.status === 'skipped' || answer.value === 'skip' ? 'Dilangkau' : answer.label || String(answer.value || '')}</strong></li>)}</ul></section>}
  </div>;
}
