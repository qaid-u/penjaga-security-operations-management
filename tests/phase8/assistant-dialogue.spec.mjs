import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';

const source = 'Tiada kebakaran dikesan di pondok. CCTV rosak dan skrin gelap.';
const official = { id_lokasi: 11, id_pos: 1, name: 'Pondok A', hotspot_id: 'HOTSPOT_DJM_POST_A', buildingId: 'DJM', buildingName: 'Bangunan Dato Jaafar Muhammad' };
const secondPost = { ...official, id_lokasi: 12, id_pos: 2, name: 'Pondok B', hotspot_id: 'HOTSPOT_DJM_POST_B' };
const hashFor = (text, postId) => createHash('sha256').update(`${text}\0${postId || ''}`).digest('hex');
const quote = (text, part) => ({ text: part, start: text.indexOf(part), end: text.indexOf(part) + part.length });
const questions = [
  { id: 'q-location', eventId: 'event-2', field: 'location', prompt: 'CCTV rosak di pos yang mana?', reason: 'Nama pondok sepadan dengan beberapa pos.', options: [{ value: '11', label: 'Pondok A' }, { value: '12', label: 'Pondok B' }, { value: 'unknown', label: 'Tidak pasti' }, { value: 'skip', label: 'Langkau' }] },
  { id: 'q-time', eventId: 'event-2', field: 'time', prompt: 'Bilakah CCTV didapati rosak?', options: [], acceptsFreeText: true, maxLength: 120 },
  { id: 'q-action', eventId: 'event-2', field: 'action', prompt: 'Apakah tindakan untuk CCTV tersebut?', options: [], acceptsFreeText: true, maxLength: 500 },
];
function assistFor(text, postId = 1, clarifications = []) {
  const answers = clarifications.map((answer) => {
    const question = questions.find((item) => item.id === answer.questionId);
    return { ...answer, eventId: question.eventId, field: question.field, label: question.options.find((item) => item.value === answer.value)?.label || answer.value, status: answer.value === 'unknown' ? 'unknown' : answer.value === 'skip' ? 'skipped' : 'answered', source: 'clarification' };
  });
  return {
    title: 'Pemeriksaan kebakaran dan kerosakan CCTV', eventStatus: 'reported', summary: text,
    events: [
      { id: 'event-1', category: 'Kebakaran', status: 'negated', source: quote(text, 'Tiada kebakaran dikesan di pondok.'), evidence: [], times: [], assets: [], actions: [], location: { state: 'confirmed', confirmed: official, candidates: [] } },
      { id: 'event-2', category: 'Kerosakan Aset', status: 'reported', source: quote(text, 'CCTV rosak dan skrin gelap.'), evidence: [{ text: 'PETIKAN REKAAN', start: 0, end: 14 }], times: [], assets: [quote(text, 'CCTV')], actions: [], location: { state: 'ambiguous', confirmed: null, candidates: [official, secondPost] } },
    ],
    dialogue: { draftHash: hashFor(text, postId), questions: questions.filter((item) => !clarifications.some((answer) => answer.questionId === item.id)), answers },
    extraction: {}, quality: { missing: [], questions: [] },
    review: { status: 'unavailable', provider: 'gemini', findings: [] },
  };
}
const report = { id_laporan: 881, id_pengguna: 3, id_pos: 1, tajuk_laporan: 'Pemeriksaan asal', kandungan_laporan: source, nama_penuh: 'Pengawal Ujian', nama_pos: 'Pondok A', syif: 'Pagi', tarikh_laporan: '2026-10-26', masa_laporan: '11:20', status_laporan: 'Dihantar', tahap_risiko: 'Low', lampiran_fail: '[]' };

async function setup(page, { role = 'Pengawal Keselamatan', outage = false, answerOutage = false, answerDelay = 0, reviewMetadata, assistOverrides } = {}) {
  const requests = [];
  let submittedContext;
  let latest = reviewMetadata || assistFor(source, 1, [{ questionId: 'q-location', value: 'unknown' }]);
  await page.addInitScript(({ role }) => {
    localStorage.setItem('token', 'synthetic-phase8-token');
    localStorage.setItem('penjaga_user', JSON.stringify({ id_pengguna: role === 'Pengawal Keselamatan' ? 3 : role === 'Ketua Pengawal' ? 2 : 1, nama_penuh: 'Pengguna Ujian', nama_peranan: role }));
  }, { role });
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const request = route.request();
    const url = new URL(request.url());
    requests.push({ path: url.pathname, method: request.method(), body: request.postData() });
    if (url.pathname === '/api/meta') return route.fulfill({ json: { posts: [{ id_pos: 1, nama_pos: 'Pondok A' }, { id_pos: 2, nama_pos: 'Pondok B' }], categories: [], checklist: [] } });
    if (url.pathname === '/api/reports/assist') {
      const payload = request.postDataJSON();
      if (outage || (answerOutage && payload.clarifications?.length)) return route.fulfill({ status: 503, json: { message: 'Pembantu belum tersedia' } });
      if (answerDelay && payload.clarifications?.length) await new Promise(resolve => setTimeout(resolve, answerDelay));
      latest = assistFor(payload.text, payload.id_pos, payload.clarifications);
      if (assistOverrides) latest = { ...latest, ...assistOverrides, dialogue: { ...latest.dialogue, ...assistOverrides.dialogue } };
      return route.fulfill({ json: latest });
    }
    if (url.pathname === '/api/reports' && request.method() === 'POST') {
      const body = request.postData() || '';
      const matched = body.match(/name="nlp_context"\r\n\r\n([^\r]+)\r\n/);
      submittedContext = matched ? JSON.parse(matched[1]) : null;
      return route.fulfill({ status: 201, json: { report, analysis: null, analysisJob: { status: 'completed' } } });
    }
    if (url.pathname === '/api/reports') return route.fulfill({ json: { data: [report], meta: { total: 1, page: 1, totalPages: 1 } } });
    const analysis = { id_nlp: 991, id_laporan: 881, kategori_dikesan: 'Kerosakan Aset', tahap_risiko: 'Low', skor_risiko: 25, metadata: latest };
    if (url.pathname === '/api/reports/881') return route.fulfill({ json: { report, analysis, analysisJob: { status: 'completed' }, checklist: [], reviews: [], actions: [] } });
    if (url.pathname === '/api/reports/881/analysis') return route.fulfill({ json: { analysis, job: { status: 'completed' } } });
    if (url.pathname === '/api/reports/881/similar') return route.fulfill({ json: { items: [] } });
    return route.fulfill({ json: [] });
  });
  return { requests, get submittedContext() { return submittedContext; } };
}
async function fillReport(page) {
  await page.goto('/laporan');
  await page.getByRole('combobox', { name: 'Pos kawalan', exact: true }).selectOption('1');
  await page.getByRole('textbox', { name: 'Tajuk laporan', exact: true }).fill('Tajuk asal pengawal');
  await page.getByRole('textbox', { name: 'Kandungan laporan', exact: true }).fill(source);
  return page.getByRole('complementary', { name: 'Pembantu laporan' });
}
async function submitAndRead(page, api) {
  await page.getByRole('button', { name: 'Hantar laporan', exact: true }).click();
  await expect.poll(() => api.submittedContext).not.toBeUndefined();
  return api.submittedContext;
}

test('P8-UI01 mixed negation and fault keep separate exact source cards and one optional question', async ({ page }) => {
  await setup(page);
  const helper = await fillReport(page);
  await expect(helper.locator('.nlp-event-card')).toHaveCount(2);
  await expect(helper.locator('[data-event-id="event-1"]')).toContainText('Dinafikan dalam teks');
  await expect(helper.locator('[data-event-id="event-2"]')).toContainText('Dilaporkan');
  await expect(helper.locator('q')).toHaveText(['Tiada kebakaran dikesan di pondok.', 'CCTV rosak dan skrin gelap.']);
  await expect(helper.getByText('PETIKAN REKAAN')).toHaveCount(0);
  await expect(helper.getByRole('region', { name: 'Soalan penjelasan' })).toHaveCount(1);
  await expect(helper.getByText(questions[0].prompt)).toBeVisible();
  await expect(helper.getByText(questions[1].prompt)).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Kandungan laporan', exact: true })).toHaveValue(source);
  await expect(page.getByRole('textbox', { name: 'Tajuk laporan', exact: true })).toHaveValue('Tajuk asal pengawal');
  await expect(helper.getByRole('link', { name: 'Lihat pos dalam 3D' })).toHaveCount(0);
});

test('P8-UI02 unknown, skip and bounded text progress adaptively and submit only clarification context', async ({ page }) => {
  const api = await setup(page);
  const helper = await fillReport(page);
  const question = helper.getByRole('region', { name: 'Soalan penjelasan' });
  await question.getByRole('button', { name: 'Tidak pasti', exact: true }).click();
  await expect(question.getByText(questions[1].prompt)).toBeVisible();
  await expect(helper.getByRole('region', { name: 'Penjelasan pengguna' })).toContainText('Tidak pasti');
  await expect(question.getByLabel('Masa kejadian jika diketahui')).toHaveAttribute('maxlength', '120');
  await question.getByRole('button', { name: 'Langkau', exact: true }).click();
  await expect(question.getByText(questions[2].prompt)).toBeVisible();
  const input = question.getByLabel('Tindakan yang diambil jika diketahui');
  await expect(input).toHaveAttribute('maxlength', '500');
  await input.fill('Juruteknik telah dimaklumkan.');
  await question.getByRole('button', { name: 'Simpan jawapan', exact: true }).click();
  await expect(question).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Kandungan laporan', exact: true })).toHaveValue(source);
  const context = await submitAndRead(page, api);
  expect(context).toEqual({ draftHash: hashFor(source, 1), clarifications: [{ questionId: 'q-location', value: 'unknown' }, { questionId: 'q-time', value: 'skip' }, { questionId: 'q-action', value: 'Juruteknik telah dimaklumkan.' }] });
  expect(Object.keys(context)).toEqual(['draftHash', 'clarifications']);
  const requests = api.requests.filter(item => item.path.endsWith('/assist')).map(item => JSON.parse(item.body));
  expect(requests[1]).toMatchObject({ text: source, id_pos: 1, sourceHash: hashFor(source, 1), clarifications: [{ questionId: 'q-location', value: 'unknown' }] });
});

test('P8-UI03 selected option and free time answer are preserved as user provenance', async ({ page }) => {
  const api = await setup(page);
  const helper = await fillReport(page);
  const question = helper.getByRole('region', { name: 'Soalan penjelasan' });
  await question.getByRole('button', { name: 'Pondok B', exact: true }).click();
  await expect(question.getByText(questions[1].prompt)).toBeVisible();
  await question.getByLabel('Masa kejadian jika diketahui').fill('Sekitar 11:20');
  await question.getByRole('button', { name: 'Simpan jawapan', exact: true }).click();
  await expect(helper.getByRole('region', { name: 'Penjelasan pengguna' })).toContainText('Sekitar 11:20');
  const context = await submitAndRead(page, api);
  expect(context.clarifications).toEqual([{ questionId: 'q-location', value: '12' }, { questionId: 'q-time', value: 'Sekitar 11:20' }]);
});

for (const edit of ['text', 'post']) test(`P8-UI04 ${edit} edit discards earlier answers even if the source is restored`, async ({ page }) => {
  const api = await setup(page);
  const helper = await fillReport(page);
  await helper.getByRole('button', { name: 'Tidak pasti', exact: true }).click();
  await expect(helper.getByText(questions[1].prompt)).toBeVisible();
  if (edit === 'text') {
    const narrative = page.getByRole('textbox', { name: 'Kandungan laporan', exact: true });
    await narrative.fill(`${source} Ketua dimaklumkan.`);
    await narrative.fill(source);
  } else {
    const post = page.getByRole('combobox', { name: 'Pos kawalan', exact: true });
    await post.selectOption('2');
    await post.selectOption('1');
  }
  await expect(helper.getByRole('region', { name: 'Penjelasan pengguna' })).toHaveCount(0);
  expect(await submitAndRead(page, api)).toBeNull();
});

test('P8-UI05 an answer arriving after text changes cannot revive stale context', async ({ page }) => {
  const api = await setup(page, { answerDelay: 800 });
  const helper = await fillReport(page);
  await helper.getByRole('button', { name: 'Tidak pasti', exact: true }).click();
  await page.getByRole('textbox', { name: 'Kandungan laporan', exact: true }).fill(`${source} Pemeriksaan diteruskan.`);
  await expect(helper.getByText(questions[0].prompt)).toBeVisible();
  await expect(helper.getByRole('region', { name: 'Penjelasan pengguna' })).toHaveCount(0);
  expect(await submitAndRead(page, api)).toBeNull();
});

test('P8-UI06 helper outage and answer outage leave submission available without inventing an answer', async ({ page }) => {
  const api = await setup(page, { answerOutage: true });
  const helper = await fillReport(page);
  await helper.getByRole('button', { name: 'Tidak pasti', exact: true }).click();
  await expect(helper.getByText('Jawapan belum disimpan. Cuba pilihan sekali lagi atau terus hantar laporan.')).toBeVisible();
  expect(await submitAndRead(page, api)).toBeNull();
});

test('P8-UI07 initial helper outage does not block saving', async ({ page }) => {
  const api = await setup(page, { outage: true });
  const helper = await fillReport(page);
  await expect(helper.getByText('Bantuan draf belum tersedia. Anda masih boleh melengkapkan dan menghantar laporan.')).toBeVisible();
  expect(await submitAndRead(page, api)).toBeNull();
});

for (const role of ['Pengawal Keselamatan', 'Ketua Pengawal', 'Pentadbir Sistem']) test(`P8-UI08 stored events show exact evidence and role-appropriate official post links for ${role}`, async ({ page }) => {
  await setup(page, { role });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(role === 'Pengawal Keselamatan' ? '/laporan?report=881' : '/semakan?report=881');
  const panel = page.getByRole('region', { name: 'Ringkasan dan semakan automatik' });
  await expect(panel.locator('.nlp-event-card')).toHaveCount(2);
  await expect(panel.locator('q')).toHaveText(['Tiada kebakaran dikesan di pondok.', 'CCTV rosak dan skrin gelap.']);
  await expect(panel.getByRole('region', { name: 'Penjelasan pengguna' })).toContainText('Tidak pasti');
  const links = panel.getByRole('link', { name: 'Lihat pos dalam 3D' });
  if (role === 'Pengawal Keselamatan') await expect(links).toHaveCount(0);
  else {
    await expect(links).toHaveCount(1);
    await expect(links.first()).toHaveAttribute('href', '/3d-command-centre?building=DJM&post=HOTSPOT_DJM_POST_A&report=881&event=event-1');
  }
  await expect(panel.locator('[data-event-id="event-2"]').getByRole('link', { name: 'Lihat pos dalam 3D' })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (role === 'Ketua Pengawal') {
    await mkdir('docs/testing/evidence/phase8-ui', { recursive: true });
    await panel.locator('.nlp-event-card').first().screenshot({ path: 'docs/testing/evidence/phase8-ui/mobile-event-negation.png' });
    await panel.locator('.nlp-event-card').last().screenshot({ path: 'docs/testing/evidence/phase8-ui/mobile-event-fault.png' });
  }
});

test('P8-UI09 clarified status and action keep source quotes distinct; unmapped confirmed post has no 3D link', async ({ page }) => {
  const metadata = assistFor(source);
  metadata.events[0] = { ...metadata.events[0], originalStatus: 'negated', status: 'reported', statusSource: 'clarification', location: { state: 'confirmed', confirmed: { ...official, id_pos: null, source: 'clarification' }, candidates: [] } };
  metadata.dialogue.answers = [
    { questionId: 'q-status', eventId: 'event-1', field: 'status', value: 'reported', label: 'Kejadian dilaporkan berlaku', status: 'answered', source: 'clarification' },
    { questionId: 'q-action', eventId: 'event-2', field: 'action', value: 'Tindakan pengguna sahaja', label: 'Tindakan pengguna sahaja', status: 'answered', source: 'clarification' },
  ];
  await setup(page, { role: 'Ketua Pengawal', reviewMetadata: metadata });
  await page.goto('/semakan?report=881');
  const panel = page.getByRole('region', { name: 'Ringkasan dan semakan automatik' });
  await expect(panel.locator('[data-event-id="event-1"]')).toContainText('Dinafikan dalam teks');
  await expect(panel.locator('[data-event-id="event-1"]')).toContainText('Pos dijelaskan pengguna');
  await expect(panel.getByRole('region', { name: 'Penjelasan pengguna' })).toContainText('Kejadian dilaporkan berlaku');
  await expect(panel.getByRole('region', { name: 'Penjelasan pengguna' })).toContainText('Tindakan pengguna sahaja');
  await expect(panel.locator('q')).toHaveText(['Tiada kebakaran dikesan di pondok.', 'CCTV rosak dan skrin gelap.']);
  await expect(panel.getByRole('link', { name: 'Lihat pos dalam 3D' })).toHaveCount(0);
});

test('P8-UI10 invalid source offsets cannot become a source quote through negative slice indexing', async ({ page }) => {
  const metadata = assistFor(source);
  metadata.events[1].source = { text: 'CCTV rosak dan skrin gelap.', start: -'CCTV rosak dan skrin gelap.'.length, end: source.length };
  await setup(page, { role: 'Ketua Pengawal', reviewMetadata: metadata });
  await page.goto('/semakan?report=881');
  const event = page.getByRole('region', { name: 'Ringkasan dan semakan automatik' }).locator('[data-event-id="event-2"]');
  await expect(event).toContainText('Petikan sumber belum tersedia.');
  await expect(event.locator('q')).toHaveCount(0);
});

test('P8-UI11 clarification and event limits are disclosed while submission stays available', async ({ page }) => {
  const api = await setup(page, { assistOverrides: { eventsTruncated: true, dialogue: { questions: [], complete: false, limitReached: true } } });
  const helper = await fillReport(page);
  await expect(helper.getByText('Had penjelasan dicapai. Semak butiran dalam laporan atau teruskan penghantaran.')).toBeVisible();
  await expect(helper.getByText('Sebahagian kejadian sahaja dianalisis. Semak keseluruhan laporan asal.')).toBeVisible();
  await expect(helper.getByText('Cadangan tersedia. Semak fakta sebelum menghantar.')).toHaveCount(0);
  expect(await submitAndRead(page, api)).toBeNull();
  await expect(page.getByRole('region', { name: 'Ringkasan dan semakan automatik' }).getByText('Sebahagian kejadian sahaja dianalisis. Semak keseluruhan laporan asal.')).toBeVisible();
});

test('P8-UI12 a confirmed location with a conflict remains uncertain and cannot link to 3D', async ({ page }) => {
  const metadata = assistFor(source);
  metadata.events[0].location = { state: 'confirmed', conflict: true, confirmed: official, candidates: [official, secondPost] };
  await setup(page, { role: 'Ketua Pengawal', reviewMetadata: metadata });
  await page.goto('/semakan?report=881');
  const panel = page.getByRole('region', { name: 'Ringkasan dan semakan automatik' });
  const event = panel.locator('[data-event-id="event-1"]');
  await expect(event).toContainText('Lokasi belum dipastikan');
  await expect(event).toContainText('Lokasi dalam teks berbeza daripada pos laporan. Penjelasan diperlukan.');
  await expect(event).toContainText('Pondok A');
  await expect(event).toContainText('Pondok B');
  await expect(event.getByText('Pos dikenal pasti', { exact: true })).toHaveCount(0);
  await expect(panel.getByRole('link', { name: 'Lihat pos dalam 3D' })).toHaveCount(0);
});
