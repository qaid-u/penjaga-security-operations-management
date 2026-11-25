// Rules for new passwords, following NIST SP 800-63B: length and a blocklist, no composition rules.
// Existing passwords keep working; the policy applies when a password is created or changed.
const MIN_LENGTH = 10;
const MAX_BYTES = 72; // bcrypt silently ignores anything longer

const COMMON_WORDS = new Set([
  'password', 'passw', 'pass', 'katalaluan', 'penjaga', 'pengawal', 'ketua', 'admin', 'administrator',
  'welcome', 'letmein', 'qwerty', 'qwertyuiop', 'asdfghjkl', 'iloveyou', 'security', 'keselamatan',
  'malaysia', 'changeme', 'abc', 'abcd', 'abcdef',
]);

const lettersOf = value => value.toLowerCase().replace(/[^\p{L}]/gu, '');

function passwordProblem(password, { username } = {}) {
  if (typeof password !== 'string' || password.length < MIN_LENGTH || Buffer.byteLength(password, 'utf8') > MAX_BYTES) {
    return `Kata laluan mesti sekurang-kurangnya ${MIN_LENGTH} aksara dan maksimum ${MAX_BYTES} bait.`;
  }
  const letters = lettersOf(password);
  if (/^\d+$/.test(password) || new Set(password).size < 4 || COMMON_WORDS.has(letters)) {
    return 'Kata laluan ini terlalu mudah diteka. Gunakan frasa yang lebih unik.';
  }
  // Rejects the username padded with only digits and symbols, e.g. "amir123456!".
  const name = typeof username === 'string' ? lettersOf(username) : '';
  if (name.length >= 3 && letters === name) {
    return 'Kata laluan tidak boleh berdasarkan nama pengguna.';
  }
  return null;
}

module.exports = { passwordProblem, MIN_LENGTH, MAX_BYTES };
