const { createHash } = require('node:crypto');
const { eventLocation, locationReferences, extractTimes } = require('./reportAnalysis');

const statuses = [
  { value: 'reported', label: 'Kejadian dilaporkan berlaku' },
  { value: 'suspected', label: 'Masih disyaki / belum disahkan' },
  { value: 'negated', label: 'Kejadian tidak berlaku' },
  { value: 'drill', label: 'Latihan atau simulasi' },
];
const abstentions = [{ value: 'unknown', label: 'Tidak pasti' }, { value: 'skip', label: 'Langkau' }];
const maxClarifications = 100;
const hash = value => createHash('sha256').update(value).digest('hex');
const draftHashFor = (text, selectedPostId) => hash(`${String(text || '')}\0${selectedPostId || ''}`);
const questionId = (draftHash, eventId, field) => `q-${hash(`${draftHash}\0${eventId}\0${field}`).slice(0, 24)}`;
const copy = value => JSON.parse(JSON.stringify(value));
const hasInvalidControl = value => [...value].some(character => {
  const code = character.charCodeAt(0);
  return code === 127 || code < 32 && ![9, 10, 13].includes(code);
});

function buildDialogue({ text = '', analysis = {}, locations = [], selectedPostId = null, clarifications = [] } = {}) {
  text = String(text);
  const draftHash = draftHashFor(text, selectedPostId);
  const references = locationReferences(locations);
  const events = copy(Array.isArray(analysis.events) ? analysis.events : []);
  const candidates = [];
  for (const event of events) {
    event.location = eventLocation(text, event.source, event.locations || [], locations, selectedPostId);
    event.clarifications = [];
    const add = (field, prompt, options, reason, priority, extra = {}) => {
      candidates.push({ id: questionId(draftHash, event.id, field), eventId: event.id, field, prompt,
        options: [...options, ...abstentions], reason, ...extra, priority });
    };
    const description = `${event.category}: “${event.source.text}”`;
    if (['unclear', 'suspected'].includes(event.status)) add('status', `Bagi ${description}, apakah konteks kejadian?`, statuses,
      event.status === 'suspected' ? 'Kejadian dalam teks masih disyaki.' : 'Konteks kejadian dalam teks belum jelas.', 10);
    if (!event.location.confirmed || event.location.conflict) {
      const options = event.location.candidates.length ? event.location.candidates : references;
      const reason = event.location.conflict ? 'Lokasi yang disebut berbeza daripada pos laporan yang dipilih.'
        : event.location.candidates.length > 1 ? 'Petunjuk lokasi merujuk kepada beberapa pos yang dibenarkan.'
          : event.location.candidates.length ? 'Petunjuk lokasi perlu disahkan; pos dipilih hanya memberi konteks.' : 'Tiada pos yang dinyatakan dengan jelas bagi kejadian ini.';
      if (options.length) add('location', `Bagi ${description}, pos manakah lokasi kejadian?`, options.map(ref => ({ value: String(ref.id_lokasi), label: ref.name })), reason, event.location.conflict ? 0 : 20);
    }
    if (!(event.times || []).some(time => time.role !== 'action')) add('time', `Bagi ${description}, pukul berapa kejadian atau pemeriksaan berlaku?`, [],
      'Masa bagi kejadian ini belum dinyatakan.', 30, { acceptsFreeText: true, maxLength: 120 });
    if (!(event.actions || []).some(action => action.status === 'reported')) add('action', `Bagi ${description}, apakah tindakan awal yang telah diambil?`, [],
      'Tindakan awal bagi kejadian ini belum dinyatakan sebagai telah diambil.', 40, { acceptsFreeText: true, maxLength: 500 });
  }
  const errors = [], answers = [], seen = new Set();
  const eventOrder = new Map(events.map((event, index) => [event.id, index]));
  const availableQuestions = () => candidates.filter(question => {
    if (seen.has(question.id)) return false;
    const event = events.find(event => event.id === question.eventId);
    // Replaying answers changes eligibility just as it did when each question
    // was offered. Dormant validation candidates are never answerable directly.
    if (['negated', 'drill'].includes(event.status)) return false;
    if (event.category.replace(/^DEMO\s+/iu, '').toLowerCase() === 'rondaan biasa' && question.field === 'action') return false;
    return true;
  }).sort((a, b) => a.priority - b.priority || eventOrder.get(a.eventId) - eventOrder.get(b.eventId));
  const fail = (code, index, questionId, message) => errors.push({ code, index, ...(typeof questionId === 'string' ? { questionId } : {}), message });
  if (!Array.isArray(clarifications)) {
    errors.push({ code: 'invalid_clarifications', message: 'Jawapan penjelasan mesti dalam bentuk senarai.' });
    clarifications = [];
  }
  if (clarifications.length > maxClarifications) errors.push({ code: 'too_many_clarifications', message: 'Terlalu banyak jawapan penjelasan.' });
  for (const [index, item] of clarifications.slice(0, maxClarifications).entries()) {
    if (!item || typeof item !== 'object' || Array.isArray(item) || typeof item.questionId !== 'string' || typeof item.value !== 'string') {
      fail('invalid_answer', index, item?.questionId, 'Jawapan penjelasan tidak sah.');
      continue;
    }
    const question = candidates.find(candidate => candidate.id === item.questionId);
    if (item.sourceHash != null && item.sourceHash !== draftHash) { fail('stale_draft', index, item.questionId, 'Jawapan adalah untuk draf terdahulu.'); continue; }
    if (!question) { fail('unknown_question', index, item.questionId, 'Soalan tidak sepadan dengan draf dan kejadian semasa.'); continue; }
    if (seen.has(question.id)) { fail('duplicate_answer', index, item.questionId, 'Satu soalan hanya boleh mempunyai satu jawapan.'); continue; }
    if (availableQuestions()[0]?.id !== question.id) { fail('unoffered_question', index, item.questionId, 'Jawapan mesti mengikut soalan semasa yang ditawarkan.'); continue; }
    const option = question.options.find(option => option.value === item.value);
    const value = item.value.trim();
    if (!option && (!question.acceptsFreeText || !value || value.length > question.maxLength || hasInvalidControl(value))) {
      fail('invalid_value', index, item.questionId, 'Jawapan tidak sepadan dengan pilihan atau had soalan.');
      continue;
    }
    // Choice values are exact identifiers: whitespace must not turn an invalid
    // location/status into a different accepted value.
    if (!question.acceptsFreeText && !option) { fail('invalid_value', index, item.questionId, 'Pilih satu jawapan yang tersedia.'); continue; }
    seen.add(question.id);
    const status = item.value === 'unknown' ? 'unknown' : item.value === 'skip' ? 'skipped' : 'answered';
    const answer = { questionId: question.id, eventId: question.eventId, field: question.field, value: option ? item.value : value,
      label: option?.label || value, status, source: 'clarification' };
    answers.push(answer);
    const event = events.find(event => event.id === answer.eventId);
    event.clarifications.push({ ...answer });
    if (status !== 'answered') continue;
    if (question.field === 'status') {
      event.originalStatus = event.status;
      event.status = answer.value;
      event.statusSource = 'clarification';
    }
    if (question.field === 'location') {
      const reference = references.find(ref => String(ref.id_lokasi) === answer.value);
      // A reply can only confirm a reference that still exists server-side.
      if (!reference) { fail('invalid_location', index, item.questionId, 'Pos jawapan tiada dalam rujukan semasa.'); continue; }
      event.location = { ...event.location, state: 'confirmed', confirmed: { ...reference, source: 'clarification' }, conflict: false,
        clarification: { questionId: question.id, value: answer.value } };
    }
    if (question.field === 'time') {
      const parsed = extractTimes(answer.value);
      event.clarifiedTime = { value: answer.value, normalizedTime: parsed.length === 1 ? parsed[0].normalizedTime : null, source: 'clarification', questionId: question.id };
    }
    if (question.field === 'action') event.clarifiedAction = { value: answer.value, source: 'clarification', questionId: question.id };
  }
  const available = availableQuestions();
  const limitReached = answers.length >= maxClarifications && available.length > 0;
  const publicQuestion = ({ priority: _priority, ...question }) => question;
  return { draftHash, questions: limitReached ? [] : available.slice(0, 1).map(publicQuestion), candidateQuestions: candidates.map(publicQuestion), answers, events, errors,
    complete: !available.length, limitReached, unresolved: available.length };
}

module.exports = { buildDialogue, draftHashFor };
