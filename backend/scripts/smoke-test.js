const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000/api';
const username = process.env.SMOKE_USERNAME || 'admin';
const password = process.env.SMOKE_PASSWORD || 'Password123!';

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${path} failed with ${response.status}: ${data?.message || text}`);
  }
  return data;
}

async function main() {
  const ready = await request('/ready');
  if (!ready.ok) throw new Error('Readiness check failed');

  const login = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  const headers = { Authorization: `Bearer ${login.token}` };
  const [me, meta, dashboard] = await Promise.all([
    request('/auth/me', { headers }),
    request('/meta', { headers }),
    request('/dashboard', { headers }),
  ]);

  console.log(JSON.stringify({
    ok: true,
    user: me.nama_pengguna,
    role: me.nama_peranan,
    posts: meta.posts.length,
    guards: meta.guards.length,
    reports: dashboard.cards.total_laporan,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
