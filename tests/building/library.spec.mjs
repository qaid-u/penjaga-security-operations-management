import { test, expect } from '@playwright/test';
import { modeledBuildings, getBuilding } from '../../src/components/building/buildingModels.js';

const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
const pathOf = (url) => new URL(url, 'http://models.test').pathname;
const metrics = {
  schedule: { assignments: 0, confirmed: 0, draft: 0 },
  attendance: { checked_in: 0, checked_out: 0, no_check_in: 0, unknown: 0 },
  incidents: { total: 0, Low: 0, Medium: 0, High: 0, Critical: 0, Unknown: 0 },
  follow_up: { total: 0, open: 0, in_progress: 0, completed: 0 },
};

async function setup(page, { role = 'Pentadbir Sistem', delayBuilding = '', noWebGL = false } = {}) {
  await page.addInitScript((nama_peranan) => {
    localStorage.setItem('penjaga_user', JSON.stringify({ id_pengguna: 1, nama_peranan, nama_penuh: 'Ujian Perpustakaan Model' }));
  }, role);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  if (noWebGL) await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return type === 'webgl2' ? null : original.call(this, type, ...args);
    };
  });
  const calls = [];
  const models = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.endsWith('.glb')) models.push(new URL(request.url()).pathname);
  });
  const rowsFor = (building) => building.hotspots.map((post, index) => ({
    id_lokasi: 100 + modeledBuildings.indexOf(building) * 10 + index,
    hotspot_id: post.id, nama_paparan: post.name, kawasan: post.section,
    label_aras: post.floor, position: null, position_status: 'unconfirmed',
    id_pos: 1000 + modeledBuildings.indexOf(building) * 10 + index,
    status_aktif: true, tarikh_kemaskini: '2026-10-25T00:00:00Z',
  }));
  await page.route('**/api/3d/**', async (route) => {
    const url = new URL(route.request().url());
    const building = getBuilding(url.searchParams.get('building') || 'DJM');
    const rows = rowsFor(building);
    const period = {
      building: building.id, date: url.searchParams.get('date') || '2026-10-25',
      from: url.searchParams.get('from') || '2026-10-25', to: url.searchParams.get('to') || '2026-10-25',
    };
    calls.push({ path: url.pathname, building: url.searchParams.get('building'), params: url.searchParams });
    if (url.pathname.endsWith('/filters')) return route.fulfill({ json: {
      posts: rows.map((row) => ({ id_pos: row.id_pos, nama_pos: row.nama_paparan, nama_bangunan: building.name, status_pos: 'Aktif' })),
      categories: [], today: '2026-10-25', timezone: 'Asia/Kuala_Lumpur', building: building.id,
    } });
    if (url.pathname.endsWith('/overview')) return route.fulfill({ json: {
      locations: rows.map((row) => ({ ...row, in_scope: true, metrics })), period,
      refreshed_at: '2026-10-25T01:00:00Z',
      totals: { locations: rows.length, linked_posts: rows.length, posts: rows.length, assignments: 0, checked_in: 0, reports: 0, high_critical: 0, open_actions: 0, completed_actions: 0, unmapped_reports: 0 },
    } });
    if (url.pathname.endsWith('/incidents')) return route.fulfill({ json: {
      items: [], total: 0, page: 1, limit: 20, period, refreshed_at: '2026-10-25T01:00:00Z',
    } });
    const row = rows.find((item) => url.pathname.includes(`/locations/${item.id_lokasi}/`));
    if (!row) return route.fulfill({ status: 404, json: { message: 'Lokasi bangunan tidak ditemui' } });
    if (building.id === delayBuilding) await new Promise((resolve) => setTimeout(resolve, 700));
    return route.fulfill({ json: {
      location: row, linked: true, period, refreshed_at: '2026-10-25T01:00:00Z',
      post: { id_pos: row.id_pos, nama_pos: row.nama_paparan, nama_bangunan: building.name, lokasi: `Rekod operasi ${building.id}`, status_pos: 'Aktif', waktu_operasi: null },
      metrics, assignments: [], reports: [], actions: [],
    } }).catch(() => {}); // An abandoned summary can be cancelled during a building switch.
  });
  return { calls, models };
}

const postButton = (page, post) => page.getByRole('button', { name: new RegExp(`01.*${escape(post.name)}`, 'u') });

test('all eight buildings load their selected model and distinct official post lists', async ({ page }) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 1440, height: 1100 });
  const { models } = await setup(page);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/3d-command-centre');
  const selector = page.getByRole('combobox', { name: 'Pilih bangunan', exact: true });
  await expect(selector.locator('option')).toHaveCount(8);
  await expect(page.locator('canvas')).toBeVisible();
  expect(new Set(models)).toEqual(new Set([pathOf(getBuilding('DJM').modelUrl)]));
  const visited = new Set();
  for (const building of modeledBuildings) {
    await selector.selectOption(building.id);
    await expect(selector).toHaveValue(building.id);
    await expect(page.locator('canvas')).toBeVisible();
    await expect(postButton(page, building.hotspots[0])).toBeVisible();
    await expect(page.getByLabel('Pos keselamatan bangunan').locator('option')).toHaveCount(building.postCount + 1);
    await expect(page.locator('.building-hotspot')).toHaveCount(building.postCount);
    await expect(page.locator('.building-hotspot[data-placement="verified"]')).toHaveCount(0);
    visited.add(pathOf(building.modelUrl));
    expect(new Set(models)).toEqual(visited);
    if (['BSI_KOTA_ISKANDAR', 'UTC_JOHOR'].includes(building.id)) {
      await page.screenshot({ path: `artifacts/integration/library-${building.id}-desktop.png`, fullPage: true });
    }
  }
  expect(new Set(models).size).toBe(6);
  expect(errors).toEqual([]);
});

test('shared residence geometry never shares selected posts or delayed operation summaries', async ({ page }) => {
  await setup(page, { delayBuilding: 'RUMAH_SS' });
  await page.goto('/3d-command-centre?building=RUMAH_SS');
  await expect(page.locator('canvas')).toBeVisible();
  const ss = getBuilding('RUMAH_SS');
  const vip = getBuilding('RUMAH_VIP');
  await postButton(page, ss.hotspots[0]).click();
  await page.getByRole('combobox', { name: 'Pilih bangunan', exact: true }).selectOption('RUMAH_VIP');
  await expect(postButton(page, vip.hotspots[0])).toBeVisible();
  await expect(postButton(page, ss.hotspots[0])).toHaveCount(0);
  await postButton(page, vip.hotspots[0]).click();
  await expect(page.getByLabel('Panel lokasi')).toContainText('Rekod operasi RUMAH_VIP');
  await page.waitForTimeout(850);
  await expect(page.getByLabel('Panel lokasi')).not.toContainText('Rekod operasi RUMAH_SS');
  await expect(page.getByLabel('Panel lokasi')).toContainText('Kedudukan 3D belum disahkan');
});

test('deep links scope reference, overview, summary and history requests to the selected building', async ({ page }) => {
  const { calls } = await setup(page, { role: 'Ketua Pengawal' });
  await page.goto('/3d-command-centre?building=BSI_KOTA_ISKANDAR');
  await expect(page.getByRole('combobox', { name: 'Pilih bangunan', exact: true })).toHaveValue('BSI_KOTA_ISKANDAR');
  await postButton(page, getBuilding('BSI_KOTA_ISKANDAR').hotspots[0]).click();
  await expect(page.getByLabel('Panel lokasi')).toContainText('Rekod operasi BSI_KOTA_ISKANDAR');
  await page.getByLabel('Paparan operasi').selectOption('incidents');
  await expect.poll(() => calls.some((call) => call.path.endsWith('/incidents'))).toBe(true);
  expect(calls.every((call) => call.building === 'BSI_KOTA_ISKANDAR')).toBe(true);
  expect(calls.some((call) => call.path.endsWith('/filters'))).toBe(true);
  expect(calls.some((call) => call.path.endsWith('/summary'))).toBe(true);
});

test('mobile building selection and post data remain usable without WebGL', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page, { role: 'Ketua Pengawal', noWebGL: true });
  await page.goto('/3d-command-centre?building=UTC_JOHOR');
  await expect(page.getByRole('alert').filter({ hasText: 'WebGL 2 tidak tersedia' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Pilih bangunan', exact: true })).toHaveValue('UTC_JOHOR');
  const post = postButton(page, getBuilding('UTC_JOHOR').hotspots[0]);
  await post.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Panel lokasi')).toContainText('Rekod operasi UTC_JOHOR');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.locator('.building-hotspot')).toHaveCount(0);
  await page.screenshot({ path: 'artifacts/integration/library-utc-mobile-fallback.png', fullPage: true });
});

test('mobile 3D stage fits the viewport and keeps the chosen building identity', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page, { role: 'Ketua Pengawal' });
  await page.goto('/3d-command-centre?building=BDARA');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Pilih bangunan', exact: true })).toHaveValue('BDARA');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/integration/library-bdara-mobile.png', fullPage: true });
});

test('compact dashboard link opens 3D without preloading models and gallery is optional', async ({ page }) => {
  const { models } = await setup(page);
  await page.route('**/api/dashboard*', route => route.fulfill({ json: { cards: {}, priority: {}, latest: [] } }));
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Terokai pos dalam 3D' })).toBeVisible();
  expect(models).toEqual([]);
  await page.locator('.workspace-map-link').click();
  await expect(page).toHaveURL(/\/3d-command-centre$/u);
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Pilihan bangunan 3D' })).toBeHidden();
  await page.getByText('Galeri bangunan', { exact: false }).click();
  await page.getByRole('button', { name: 'Lihat ' + getBuilding('UTC_JOHOR').name, exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Pilih bangunan', exact: true })).toHaveValue('UTC_JOHOR');
  await expect(postButton(page, getBuilding('UTC_JOHOR').hotspots[0])).toBeVisible();
});

test('one unavailable model does not block another building or retain its error', async ({ page }) => {
  await setup(page);
  const failedPath = pathOf(getBuilding('BDARA').modelUrl);
  await page.route(`**${failedPath}`, (route) => route.fulfill({ status: 503, body: 'unavailable' }));
  await page.goto('/3d-command-centre?building=BDARA');
  await expect(page.getByRole('alert').filter({ hasText: 'HTTP 503' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Pilih bangunan', exact: true }).selectOption('UTC_JOHOR');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(postButton(page, getBuilding('UTC_JOHOR').hotspots[0])).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: 'HTTP 503' })).toHaveCount(0);
});
