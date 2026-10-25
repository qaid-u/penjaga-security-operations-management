function invalid() { return Object.assign(new Error('Jawapan penjelasan tidak sah atau draf telah berubah. Semak draf semula.'), { status:400 }); }
function parseClarificationInput(value) {
  if (value === undefined || value === null || value === '') return {};
  if (typeof value === 'string') {
    if (value.length > 64000) throw invalid();
    try { value = JSON.parse(value); } catch { throw invalid(); }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !['draftHash','clarifications'].includes(key))) throw invalid();
  const answers = value.clarifications || [];
  if (!Array.isArray(answers) || answers.length > 100 || value.draftHash !== undefined && (typeof value.draftHash!=='string' || !/^[a-f0-9]{64}$/.test(value.draftHash))) throw invalid();
  if (answers.length && !value.draftHash) throw invalid();
  const seen = new Set();
  const clarifications = answers.map(answer => {
    if (!answer || typeof answer !== 'object' || Array.isArray(answer) || Object.keys(answer).some(key => !['questionId','value'].includes(key)) || typeof answer.questionId !== 'string' || !answer.questionId || answer.questionId.length > 180 || typeof answer.value !== 'string' || !answer.value.trim() || answer.value.length > 500 || seen.has(answer.questionId)) throw invalid();
    seen.add(answer.questionId);
    return { questionId:answer.questionId, value:answer.value };
  });
  return clarifications.length ? { draftHash:value.draftHash, clarifications } : {};
}
module.exports = { parseClarificationInput, invalid };
