const validDate = value => typeof value === 'string' && /^[1-9]\d{3}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value+'T00:00:00Z')) && new Date(value+'T00:00:00Z').toISOString().slice(0,10) === value;
function dateRange(query) {
  if (query.from === undefined && query.to === undefined) return null;
  if (!validDate(query.from) || !validDate(query.to) || query.from > query.to) throw Object.assign(new Error('Julat tarikh tidak sah'), {status:400});
  return {from:query.from,to:query.to};
}
module.exports = {dateRange};
