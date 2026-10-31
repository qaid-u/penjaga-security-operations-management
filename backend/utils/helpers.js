const escapeCSV = (str) => {
  if (str == null) return '';
  const value = String(str);
  const s = (/^[\s]*[=+@-]/.test(value) || /^[\t\r\n]/.test(value) ? `'${value}` : value).replace(/"/g, '""');
  return /[",\r\n]/.test(s) ? `"${s}"` : s;
};

const dateToString = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toISOString().slice(0, 10);
};

module.exports = { escapeCSV, dateToString };
