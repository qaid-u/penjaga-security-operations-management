const escapeCSV = (str) => {
  if (str == null) return '';
  const s = String(str).replace(/"/g, '""');
  return /[",\n]/.test(s) ? `"${s}"` : s;
};

const dateToString = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toISOString().slice(0, 10);
};

module.exports = { escapeCSV, dateToString };
