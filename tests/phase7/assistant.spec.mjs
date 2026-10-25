import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';

const source = 'Tiada kebakaran dikesan pada 11:20 di Sayap Kiri. Ketua dimaklumkan.';
const report = {
  id_laporan: 801, id_pengguna: 3, id_pos: 1, tajuk_laporan: 'DEMO Pemeriksaan sayap',
  kandungan_laporan: source, nama_penuh: 'DEMO Pengawal', nama_pos: 'DEMO Pos A',
  syif: 'Pagi', tarikh_laporan: '2026-10-25', masa_laporan: '11:20', status_laporan: 'Dihantar',
  tahap_risiko: 'Unknown', lampiran_fail: '[]',
};
const metadata = {
  model: { type: 'multinomial_naive_bayes', version: 'test-artifact', scoreType: 'uncalibrated_model_score' },
  eventStatus: 'negated',
  title: 'Pemeriksaan tanpa kebakaran di Sayap Kiri',
  summary: source,
  evidence: [{ start: 0, end: 15, text: 'Tiada kebakaran', kind: 'context' }],
  extraction: {
    times: [{ text: '11:20', start: 29, end: 34, value: '11:20' }],
    locations: [{ text: 'Sayap Kiri', start: 38, end: 48, hotspot_id: 'HOTSPOT_LEFT_WING' }],
    assets: [], actions: [{ text: 'Ketua dimaklumkan', start: 50, end: 67 }],
  },
  quality: { missing: [], questions: [] },
  sourceChecks: { status: 'needs_review', findings: [{ code: 'negation', message: 'Kejadian dinafikan oleh ayat asal.', quote: 'Tiada kebakaran' }] },
  review: { status: 'unavailable', provider: 'gemini', reason: 'not_configured', findings: [] },
};
const analysis = { id_nlp: 901, id_laporan: 801, kategori_dikesan: 'Rondaan Biasa', tahap_risiko: 'Low', skor_risiko: 0, ringkasan_automatik: source, metadata };

async function setup(page, { role = 'Pengawal Keselamatan', assistUnavailable = false, review = metadata.review, pendingPolls = 0 } = {}) {
  const requests = [];
  let analysisCalls = 0;
  await page.addInitScript(({ role }) => {
    localStorage.setItem('token', 'synthetic-ui-token');
    localStorage.setItem('penjaga_user', JSON.stringify({ id_pengguna: role === 'Pengawal Keselamatan' ? 3 : role === 'Ketua Pengawal' ? 2 : 1, nama_penuh: 'DEMO Pengguna', nama_pengguna: 'demo_ui', nama_peranan: role }));
  }, { role });
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const request = route.request();
    const url = new URL(request.url());
    requests.push({ path: url.pathname, method: request.method(), body: request.postData() });
    if (url.pathname === '/api/meta') return route.fulfill({ json: { roles: [], guards: [], posts: [{ id_pos: 1, nama_pos: 'DEMO Pos A' }], categories: [{ id_kategori_insiden: 1, nama_kategori: 'Kebakaran' }], checklist: [] } });
    if (url.pathname === '/api/reports/assist') {
      if (assistUnavailable) return route.fulfill({ status: 503, json: { message: 'Pembantu belum tersedia' } });
      const text = request.postDataJSON().text;
      return route.fulfill({ json: { ...metadata, title: 'Cadangan tajuk daripada teks', summary: text, extraction: metadata.extraction, quality: { missing: [], questions: [] } } });
    }
    if (url.pathname === '/api/reports' && request.method() === 'POST') return route.fulfill({ status: 201, json: { message: 'Laporan dihantar', id_laporan: report.id_laporan, report, analysis: null, nlp: null, analysisJob: { status: 'pending', attempts: 0 } } });
    if (url.pathname === '/api/reports') return route.fulfill({ json: { data: [report], meta: { total: 1, page: 1, limit: 10, totalPages: 1 } } });
    if (url.pathname === '/api/reports/801/analysis') {
      analysisCalls += 1;
      return route.fulfill({ json: analysisCalls <= pendingPolls ? { analysis: null, job: { status: 'processing', attempts: 1 } } : { analysis: { ...analysis, metadata: { ...metadata, review } }, job: { status: 'completed', attempts: 1 } } });
    }
    if (url.pathname === '/api/reports/801/similar') return route.fulfill({ json: { method: 'tfidf', items: [] } });
    if (url.pathname === '/api/reports/801/analysis-feedback') return route.fulfill({ status: 201, json: { message: 'Maklum balas disimpan' } });
    if (url.pathname === '/api/reports/801') return route.fulfill({ json: { report, checklist: [], reviews: [], actions: [], analysis: { ...analysis, metadata: { ...metadata, review } }, analysisJob: { status: 'completed', attempts: 1 } } });
    if (url.pathname === '/api/nlp-training') return route.fulfill({ json: [{ id_kategori_insiden: 1, nama_kategori: 'Kebakaran', tahap_keutamaan: 'Critical', kata_kunci_rujukan: ['api', 'asap'], status_kategori: 'Aktif' }] });
    if (url.pathname === '/api/nlp/status') return route.fulfill({ json: { configured: false, provider: 'gemini', model: 'test-model', queue: {} } });
    if (url.pathname === '/api/nlp/801' || url.pathname === '/api/nlp/analysis/801') return route.fulfill({ json: { ...analysis, tajuk_laporan: report.tajuk_laporan, kandungan_laporan: source, metadata: { ...metadata, review } } });
    return route.fulfill({ json: [] });
  });
  return { requests, get analysisCalls() { return analysisCalls; } };
}

async function fillReport(page) {
  await expect(page.getByRole('combobox', { name: 'Pos kawalan', exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Pos kawalan', exact: true }).selectOption('1');
  await page.getByRole('textbox', { name: 'Tajuk laporan', exact: true }).fill('Tajuk asal pengawal');
  await page.getByRole('textbox', { name: 'Kandungan laporan', exact: true }).fill(source);
}

test('P7-UI01 helper proposes a title without replacing the original narrative or title automatically', async ({ page }) => {
  await setup(page);
  await page.goto('/laporan');
  await fillReport(page);
  const helper = page.getByRole('complementary', { name: 'Pembantu laporan' });
  await expect(helper.getByText('Cadangan tajuk daripada teks', { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Tajuk laporan', exact: true })).toHaveValue('Tajuk asal pengawal');
  await helper.getByRole('button', { name: 'Gantikan tajuk' }).click();
  await expect(page.getByRole('textbox', { name: 'Tajuk laporan', exact: true })).toHaveValue('Cadangan tajuk daripada teks');
  await expect(page.getByRole('textbox', { name: 'Kandungan laporan', exact: true })).toHaveValue(source);
  await expect(helper.getByText('Cadangan tersedia. Semak fakta sebelum menghantar.')).toBeVisible();
  await expect(page.getByLabel('Kategori insiden pilihan')).toBeHidden();
});

test('P7-UI02 report submission remains available when the draft helper is unavailable; completed source checks are distinct from Gemini', async ({ page }) => {
  const api = await setup(page, { assistUnavailable: true, pendingPolls: 1 });
  await page.goto('/laporan');
  await fillReport(page);
  await expect(page.getByText('Bantuan draf belum tersedia. Anda masih boleh melengkapkan dan menghantar laporan.')).toBeVisible();
  await page.getByRole('button', { name: 'Hantar laporan', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Ringkasan dan semakan automatik' });
  await expect(panel.getByText('Sedang dianalisis', { exact: true })).toBeVisible();
  await expect(panel.getByText('Semakan AI belum tersedia', { exact: true })).toBeVisible({ timeout: 10000 });
  await expect(panel.getByText('Ini semakan konsistensi berasaskan teks, berasingan daripada semakan Gemini.')).toBeVisible();
  await expect(panel.getByText('Tiada percanggahan dikesan', { exact: true })).toHaveCount(0);
  expect(api.requests.some(row => row.path === '/api/reports' && row.method === 'POST')).toBe(true);
  expect(api.analysisCalls).toBeGreaterThan(1);
  await fs.mkdir('docs/testing/evidence/phase7-ui', { recursive: true });
  await page.screenshot({ path: 'docs/testing/evidence/phase7-ui/guard-report-assistant.png', fullPage: true });
});

test('P7-UI03 phone layout exposes an honest review finding and no model-editing controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page, { review: { status: 'needs_review', provider: 'gemini', model: 'synthetic-test-model', findings: [{ code: 'negation', message: 'Teks menafikan kebakaran; cadangan perlu disemak.', quote: 'Tiada kebakaran' }] } });
  await page.goto('/laporan');
  await fillReport(page);
  await page.getByRole('button', { name: 'Hantar laporan', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Ringkasan dan semakan automatik' });
  await expect(panel.getByText('Perlu semakan', { exact: true })).toBeVisible();
  await expect(panel.getByText('Teks menafikan kebakaran; cadangan perlu disemak.')).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Membantu', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await fs.mkdir('docs/testing/evidence/phase7-ui', { recursive: true });
  await page.screenshot({ path: 'docs/testing/evidence/phase7-ui/mobile-review-finding.png', fullPage: true });
});

test('P7-UI04 chief feedback applies to the analysis without approving the report or editing categories', async ({ page }) => {
  const api = await setup(page, { role: 'Ketua Pengawal', review: { status: 'needs_review', provider: 'gemini', model: 'synthetic-test-model', findings: [{ code: 'negation', message: 'Semak konteks penafian dalam laporan asal.', quote: 'Tiada kebakaran' }] } });
  await page.goto('/semakan?report=801');
  const panel = page.getByRole('region', { name: 'Ringkasan dan semakan automatik' });
  await expect(panel.getByText('Perlu semakan', { exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'Perlu pembetulan', exact: true }).click();
  await panel.getByLabel('Catatan pembetulan (pilihan)').fill('DEMO: Penafian perlu dikekalkan dalam ringkasan.');
  await panel.getByRole('button', { name: 'Hantar maklum balas', exact: true }).click();
  await expect(panel.getByText('Maklum balas direkodkan untuk semakan penambahbaikan. Keputusan laporan tidak berubah.')).toBeVisible();
  expect(api.requests.some(row => row.path.endsWith('/analysis-feedback') && row.method === 'POST')).toBe(true);
  expect(api.requests.some(row => row.path.endsWith('/review') && row.method === 'PATCH')).toBe(false);
  expect(api.requests.some(row => row.path.startsWith('/api/nlp-training') && row.method !== 'GET')).toBe(false);
  await fs.mkdir('docs/testing/evidence/phase7-ui', { recursive: true });
  await page.screenshot({ path: 'docs/testing/evidence/phase7-ui/chief-analysis-review.png', fullPage: true });
});

test('P7-UI05 administrator maintenance is collapsed while report review is the primary task', async ({ page }) => {
  await setup(page, { role: 'Pentadbir Sistem' });
  await page.goto('/nlp');
  const summary = page.getByText('Penyelenggaraan kategori — Pentadbir Sistem', { exact: true });
  await expect(summary).toBeVisible();
  const maintenance = page.locator('details').filter({ has: summary });
  await expect(maintenance).not.toHaveAttribute('open', '');
  await page.getByRole('button', { name: 'Buka ringkasan', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Ringkasan dan semakan automatik' })).toBeVisible();
  await expect(maintenance).not.toHaveAttribute('open', '');
  await fs.mkdir('docs/testing/evidence/phase7-ui', { recursive: true });
  await page.screenshot({ path: 'docs/testing/evidence/phase7-ui/admin-analysis-maintenance-collapsed.png', fullPage: true });
});
