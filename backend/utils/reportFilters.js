const roles = require('../config/roles');
function reportFilters(query, user) {
  const params = [];
  const conditions = [];
  const invalid = () => { throw Object.assign(new Error('Penapis laporan tidak sah'), { status: 400 }); };
  const add = (sql, value) => { params.push(value); conditions.push(sql.replaceAll('?', `$${params.length}`)); };
  if (user.nama_peranan === roles.guard) add('id_pengguna = ?', user.id_pengguna);
  for (const key of ['search', 'status', 'post', 'shift', 'risk', 'date', 'attention', 'follow_up']) {
    if (query[key] !== undefined && typeof query[key] !== 'string') invalid();
  }
  for (const [key, column, values] of [
    ['status', 'status_laporan', ['Dihantar', 'Diluluskan', 'Ditolak', 'Semua']],
    ['shift', 'syif', ['Pagi', 'Petang', 'Malam', 'Office Hour']],
    ['risk', 'tahap_risiko', ['Low', 'Medium', 'High', 'Critical', 'Unknown']],
  ]) {
    if (query[key]) {
      if (!values.includes(query[key])) invalid();
      if (query[key] !== 'Semua') add(`${column} = ?`, query[key]);
    }
  }
  if (query.post) {
    if (!/^[1-9]\d*$/.test(query.post) || Number(query.post) > 2147483647) invalid();
    add('id_pos = ?', Number(query.post));
  }
  if (query.date) {
    const date = new Date(`${query.date}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(query.date) || Number.isNaN(date.valueOf()) || date.toISOString().slice(0,10) !== query.date) invalid();
    add('tarikh_laporan = ?::date', query.date);
  }
  if (query.search?.trim()) {
    if (query.search.length > 500) invalid();
    // Literal substring search: user % and _ do not become SQL wildcards.
    add("(strpos(lower(coalesce(tajuk_laporan,'')), ?) > 0 or strpos(lower(coalesce(nama_penuh,'')), ?) > 0 or strpos(lower(coalesce(nama_pos,'')), ?) > 0 or strpos(lower(coalesce(kandungan_laporan,'')), ?) > 0)", query.search.trim().toLowerCase());
  }
  if (query.attention && !['true', 'false'].includes(query.attention)) invalid();
  if (query.attention === 'true') conditions.push("(nlp_review_status='needs_review' or nlp_metadata->'sourceChecks'->>'status'='needs_review')");
  if (query.follow_up) {
    if (query.follow_up !== 'pending') invalid();
    conditions.push("(status_laporan='Diluluskan' and perlu_tindakan_susulan=true and ada_tindakan_susulan=false)");
  }
  return { params, where: conditions.length ? ` where ${conditions.join(' and ')}` : '' };
}
module.exports = { reportFilters };
