import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { modeledBuildings, getBuilding } from '../../src/components/building/buildingModels.js';

const metrics = {
  schedule: { assignments: 0, confirmed: 0, draft: 0 },
  attendance: { checked_in: 0, checked_out: 0, no_check_in: 0, unknown: 0 },
  incidents: { total: 0, Low: 0, Medium: 0, High: 0, Critical: 0, Unknown: 0 },
  follow_up: { total: 0, open: 0, in_progress: 0, completed: 0 },
};
const marker = (page, post) => page.getByRole('button', { name: `Pilih ${post.name} (anggaran)`, exact: true });
const listButton = (page, post) => page.getByLabel('Pos keselamatan', { exact: true }).getByRole('button').filter({ hasText: post.name });

async function setup(page, { noWebGL = false } = {}) {
  await page.addInitScript(() => localStorage.setItem('penjaga_user', JSON.stringify({ id_pengguna: 2, nama_peranan: 'Ketua Pengawal', nama_penuh: 'Ujian Pos Anggaran' })));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  if (noWebGL) await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return type === 'webgl2' ? null : original.call(this, type, ...args);
    };
  });
  const calls = [];
  await page.route('**/api/3d/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const building = getBuilding(url.searchParams.get('building') || 'DJM');
    const rows = building.hotspots.map((post, index) => ({
      id_lokasi: 100 + modeledBuildings.indexOf(building) * 10 + index,
      hotspot_id: post.id, nama_paparan: post.name, kawasan: post.section, label_aras: post.floor,
      position: null, position_status: 'unconfirmed', id_pos: 1000 + modeledBuildings.indexOf(building) * 10 + index,
      status_aktif: true, tarikh_kemaskini: '2026-10-25T00:00:00Z',
    }));
    const period = {
      building: building.id, date: url.searchParams.get('date') || '2026-10-25',
      from: url.searchParams.get('from') || '2026-10-25', to: url.searchParams.get('to') || '2026-10-25',
    };
    calls.push({ path: url.pathname, building: building.id, method: request.method() });
    if (url.pathname.endsWith('/filters')) return route.fulfill({ json: {
      posts: rows.map((row) => ({ id_pos: row.id_pos, nama_pos: row.nama_paparan, nama_bangunan: building.name, status_pos: 'Aktif' })),
      categories: [], today: '2026-10-25', timezone: 'Asia/Kuala_Lumpur', building: building.id,
    } });
    if (url.pathname.endsWith('/overview')) return route.fulfill({ json: {
      locations: rows.map((row) => ({ ...row, in_scope: true, metrics })), period, refreshed_at: '2026-10-25T01:00:00Z',
      totals: { locations: rows.length, linked_posts: rows.length, posts: rows.length, assignments: 0, checked_in: 0, reports: 0, high_critical: 0, open_actions: 0, completed_actions: 0, unmapped_reports: 0 },
    } });
    if (url.pathname.endsWith('/incidents')) return route.fulfill({ json: { items: [], total: 0, page: 1, limit: 20, period } });
    const row = rows.find((item) => url.pathname.includes(`/locations/${item.id_lokasi}/`));
    if (!row) return route.fulfill({ status: 404, json: { message: 'Pos bangunan tidak ditemui' } });
    return route.fulfill({ json: {
      location: row, linked: true, period, refreshed_at: '2026-10-25T01:00:00Z', metrics,
      post: { id_pos: row.id_pos, nama_pos: row.nama_paparan, nama_bangunan: building.name, lokasi: `Rekod operasi ${building.id}`, status_pos: 'Aktif', waktu_operasi: null },
      assignments: [], reports: [], actions: [],
    } });
  });
  return calls;
}

async function modelWithoutReferences() {
  // Serve a changed asset in memory. Geometry and official post records stay intact.
  const bytes = await readFile(new URL('../../public/models/Bangunan_SUK.glb', import.meta.url));
  const jsonLength = bytes.readUInt32LE(12);
  const document = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8'));
  for (const node of document.nodes || []) if (node.name) node.name = `REFERENCE_REMOVED_${node.name}`;
  const text = JSON.stringify(document);
  const json = Buffer.alloc(Math.ceil(Buffer.byteLength(text) / 4) * 4, 0x20);
  json.write(text);
  const chunk = Buffer.alloc(8);
  chunk.writeUInt32LE(json.length, 0);
  chunk.writeUInt32LE(0x4e4f534a, 4);
  const header = Buffer.from(bytes.subarray(0, 12));
  const remainder = bytes.subarray(20 + jsonLength);
  header.writeUInt32LE(header.length + chunk.length + json.length + remainder.length, 8);
  return Buffer.concat([header, chunk, json, remainder]);
}

test('estimated markers are distinct and select an honest operation panel', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const calls = await setup(page);
  await page.goto('/3d-command-centre?building=DJM');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.building-stage-stamp')).toHaveAttribute('data-state', 'ready');
  await expect(page.locator('.building-estimate-notice[role="status"]')).toContainText('7 penanda anggaran');
  const post = getBuilding('DJM').hotspots[0];
  const button = marker(page, post);
  await expect(button).toBeVisible();
  expect(await button.evaluate((element) => getComputedStyle(element).borderTopStyle)).toBe('dashed');
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  const panel = page.getByLabel('Panel lokasi');
  await expect(panel.getByRole('heading', { name: post.name, exact: true })).toBeVisible();
  await expect(panel).toContainText(/anggaran/iu);
  await expect(panel).toContainText(/asas/iu);
  await expect(panel).toContainText(/rendah/iu);
  await expect(panel).toContainText(/belum disahkan|bukan.*disahkan/iu);
  expect(calls.every((call) => call.method === 'GET')).toBe(true);
  await page.locator('.building-canvas').screenshot({ path: 'artifacts/integration/estimated-markers.png', scale: 'css' });
});

test('marker toggle preserves list selection and supplied floor labels', async ({ page }) => {
  await setup(page);
  await page.goto('/3d-command-centre?building=DJM');
  await expect(page.locator('canvas')).toBeVisible();
  const level3 = getBuilding('DJM').hotspots.find((post) => post.floor === 'Tingkat 3');
  const toggle = page.getByRole('button', { name: 'Penanda anggaran', exact: true });
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await toggle.click();
  await expect(page.locator('.building-hotspot')).toHaveCount(0);
  await expect(page.locator('.building-estimate-notice[role="status"]')).toHaveText('Penanda anggaran disembunyikan · Gunakan senarai pos');
  await listButton(page, level3).click();
  await expect(page.getByLabel('Panel lokasi')).toContainText('Tingkat 3');
  await expect(page.getByLabel('Panel lokasi')).toContainText(/anggaran/iu);
  await toggle.click();
  await expect(page.locator('.building-hotspot')).toHaveCount(7);
  await expect(page.locator('.building-estimate-notice[role="status"]')).toContainText('7 penanda anggaran');
  await expect(page.locator(`button[aria-label="Pilih ${level3.name} (anggaran)"]`)).toHaveAttribute('aria-pressed', 'true');
});

test('shared geometry keeps residence markers and record identities separate', async ({ page }) => {
  await setup(page);
  await page.goto('/3d-command-centre?building=RUMAH_SS');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.building-hotspot')).toHaveCount(1);
  await listButton(page, getBuilding('RUMAH_SS').hotspots[0]).click();
  await expect(page.getByLabel('Panel lokasi')).toContainText('Rekod operasi RUMAH_SS');
  await page.getByRole('combobox', { name: 'Pilih bangunan', exact: true }).selectOption('RUMAH_VIP');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.building-hotspot')).toHaveCount(1);
  await expect(page.locator('button[aria-label="Pilih Pos Rumah SS (anggaran)"]')).toHaveCount(0);
  await expect(page.locator('button[aria-label="Pilih Pos Rumah VIP (anggaran)"]')).toHaveCount(1);
  await listButton(page, getBuilding('RUMAH_VIP').hotspots[0]).click();
  await expect(page.getByLabel('Panel lokasi')).toContainText('Rekod operasi RUMAH_VIP');
  await expect(page.getByLabel('Panel lokasi')).not.toContainText('Rekod operasi RUMAH_SS');
});

test('post records stay usable without WebGL and do not claim a surveyed coordinate', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page, { noWebGL: true });
  await page.goto('/3d-command-centre?building=UTC_JOHOR');
  await expect(page.getByRole('alert').filter({ hasText: 'WebGL 2 tidak tersedia' })).toBeVisible();
  await expect(page.locator('.building-stage-stamp')).toHaveAttribute('data-state', 'unavailable');
  await expect(page.locator('.building-estimate-notice')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Zum masuk', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Pratetap kamera')).toBeDisabled();
  await listButton(page, getBuilding('UTC_JOHOR').hotspots[0]).click();
  await expect(page.getByLabel('Panel lokasi')).toContainText('Rekod operasi UTC_JOHOR');
  await expect(page.getByLabel('Panel lokasi')).toContainText(/belum disahkan|bukan.*disahkan/iu);
  await expect(page.locator('.building-hotspot')).toHaveCount(0);
});

test('all seven mobile callouts have separate reachable touch targets', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
  try {
    const page = await context.newPage();
    await setup(page);
    await page.goto(`${baseURL}/3d-command-centre?building=DJM`);
    await expect(page.locator('canvas')).toBeVisible();
    const stage = page.locator('.building-canvas');
    const markers = page.locator('.building-hotspot[data-placement="estimated"]');
    await expect(markers).toHaveCount(7);
    await stage.scrollIntoViewIfNeeded();
    const targetIssues = () => markers.evaluateAll((buttons) => {
      const boxes = buttons.map((button) => ({ button, box: button.getBoundingClientRect() }));
      const issues = [];
      for (const [{ button, box }, index] of boxes.map((item, index) => [item, index])) {
        const name = button.getAttribute('aria-label');
        // CSS transforms can round a 44px box a few millionths below its CSS size.
        if (box.width < 43.99 || box.height < 43.99) issues.push(`${name}: target ${box.width}x${box.height}`);
        const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
        if (hit?.closest('button') !== button) issues.push(`${name}: centre at ${Math.round(box.x + box.width / 2)},${Math.round(box.y + box.height / 2)} hits ${hit?.outerHTML.slice(0, 180) || 'outside viewport'}`);
        for (const { button: otherButton, box: other } of boxes.slice(index + 1)) {
          if (box.right > other.left && other.right > box.left && box.bottom > other.top && other.bottom > box.top) issues.push(`${name}: overlaps ${otherButton.getAttribute('aria-label')}`);
        }
      }
      return issues;
    });
    await expect.poll(targetIssues).toEqual([]);
    for (const post of getBuilding('DJM').hotspots) {
      await page.getByRole('button', { name: 'Tetap semula', exact: true }).tap();
      await stage.scrollIntoViewIfNeeded();
      await expect.poll(targetIssues).toEqual([]);
      await marker(page, post).tap();
      await expect(page.getByLabel('Panel lokasi').getByRole('heading', { name: post.name, exact: true })).toBeVisible();
      await expect(page.getByLabel('Panel lokasi')).toContainText('Keyakinan: rendah');
      await page.getByRole('button', { name: 'Tutup maklumat lokasi', exact: true }).tap();
    }
  } finally {
    await context.close();
  }
});

test('keyboard users can reach each marker and return from its panel on desktop and mobile', async ({ page }) => {
  await setup(page);
  await page.goto('/3d-command-centre?building=DJM');
  await expect(page.locator('.building-hotspot')).toHaveCount(7);
  const posts = getBuilding('DJM').hotspots;
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 1100, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    const first = marker(page, posts[0]);
    await first.focus();
    for (const post of posts.slice(1)) {
      await page.keyboard.press('Tab');
      await expect(marker(page, post)).toBeFocused();
    }
    await page.keyboard.press('Shift+Tab');
    await expect(marker(page, posts.at(-2))).toBeFocused();
    await first.focus();
    await page.keyboard.press('Enter');
    const panel = page.getByLabel('Panel lokasi');
    await expect(panel).toBeFocused();
    await expect(panel.getByRole('heading', { name: posts[0].name, exact: true })).toBeVisible();
    const headingBox = await panel.getByRole('heading', { name: posts[0].name, exact: true }).boundingBox();
    expect(headingBox.y).toBeGreaterThanOrEqual(0);
    expect(headingBox.y + headingBox.height).toBeLessThanOrEqual(viewport.height);
    await expect(panel).toContainText('Keyakinan: rendah');
    await page.keyboard.press('Escape');
    await expect(first).toBeFocused();
    await expect(panel).toHaveAttribute('data-sheet', 'false');
    if (viewport.width < 1440) {
      await page.keyboard.press('Enter');
      await expect(panel).toBeFocused();
      await page.keyboard.press('Tab');
      const close = page.getByRole('button', { name: 'Tutup maklumat lokasi', exact: true });
      await expect(close).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(first).toBeFocused();
      await expect(close).toBeHidden();
    }
  }
});

test('missing model references suppress estimates while official records and floor labels stay usable', async ({ page }) => {
  const body = await modelWithoutReferences();
  await setup(page);
  await page.route('**/models/Bangunan_SUK.glb', (route) => route.fulfill({ contentType: 'model/gltf-binary', body }));
  await page.goto('/3d-command-centre?building=DJM');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.building-hotspot')).toHaveCount(0);
  await expect(page.locator('.building-stage-stamp')).toHaveAttribute('data-state', 'ready');
  await expect(page.locator('.building-estimate-notice[role="status"]')).toHaveText('Penanda anggaran tidak tersedia · Gunakan senarai pos');
  await expect(page.getByRole('button', { name: 'Penanda anggaran', exact: true })).toHaveCount(0);
  const post = getBuilding('DJM').hotspots.find((item) => item.floor === 'Tingkat 3');
  await listButton(page, post).click();
  const panel = page.getByLabel('Panel lokasi');
  await expect(panel).toContainText('Komponen rujukan tidak ditemui');
  await expect(panel).toContainText('Penanda anggaran tidak dipaparkan');
  await expect(panel).toContainText('Aras: Tingkat 3');
  await expect(panel).toContainText('Rekod operasi DJM');
  await expect(page.getByLabel('Pratetap kamera').locator('option[value="selected"]')).toHaveJSProperty('disabled', true);
  await expect(page.getByLabel('Pratetap kamera')).toHaveValue('overview');
  await expect(page.locator('.building-hotspot[data-placement="verified"]')).toHaveCount(0);
});

test('graphics context loss preserves records and keyboard retry restores the model', async ({ page }) => {
  await setup(page);
  await page.goto('/3d-command-centre?building=UTC_JOHOR');
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  await expect(page.locator('.building-hotspot')).toHaveCount(1);
  await canvas.evaluate((element) => element.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await expect(page.getByRole('alert')).toContainText('Konteks grafik terputus');
  await expect(page.locator('.building-hotspot')).toHaveCount(0);
  await expect(page.locator('.building-stage-stamp')).toHaveAttribute('data-state', 'unavailable');
  await expect(page.locator('.building-estimate-notice')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Zum masuk', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Zum keluar', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Pratetap kamera')).toBeDisabled();
  const post = getBuilding('UTC_JOHOR').hotspots[0];
  await listButton(page, post).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Panel lokasi')).toContainText('Rekod operasi UTC_JOHOR');
  await page.keyboard.press('Escape');
  await expect(listButton(page, post)).toBeFocused();
  const retry = page.getByRole('button', { name: 'Cuba lagi', exact: true });
  await retry.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.building-hotspot')).toHaveCount(1);
  await expect(page.locator('.building-stage-stamp')).toHaveAttribute('data-state', 'ready');
  await expect(page.locator('.building-estimate-notice[role="status"]')).toContainText('1 penanda anggaran');
  await expect(page.getByRole('button', { name: 'Zum masuk', exact: true })).toBeEnabled();
  await expect(page.getByLabel('Pratetap kamera')).toBeEnabled();
  await expect(page.getByRole('alert').filter({ hasText: 'Konteks grafik terputus' })).toHaveCount(0);
});

test('pending model download keeps truthful status and keyboard access to operational records', async ({ page }) => {
  await setup(page);
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  await page.route('**/models/Bangunan_SUK.glb', async (route) => { await pending; await route.continue(); });
  try {
    await page.goto('/3d-command-centre?building=DJM');
    await expect(page.locator('.building-stage-stamp')).toHaveAttribute('data-state', 'loading');
    await expect(page.locator('.building-stage-stamp')).toContainText('Memuatkan model');
    await expect(page.locator('.building-estimate-notice')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Zum masuk', exact: true })).toBeDisabled();
    await expect(page.getByLabel('Pratetap kamera')).toBeDisabled();
    const post = getBuilding('DJM').hotspots[0];
    await listButton(page, post).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('Panel lokasi')).toContainText('Rekod operasi DJM');
    await page.keyboard.press('Escape');
    await expect(listButton(page, post)).toBeFocused();
    release();
    await expect(page.locator('canvas')).toBeVisible();
    await expect(page.locator('.building-stage-stamp')).toHaveAttribute('data-state', 'ready');
    await expect(page.locator('.building-estimate-notice[role="status"]')).toContainText('7 penanda anggaran');
    await expect(page.getByLabel('Panel lokasi')).toContainText('Kedudukan 3D belum disahkan');
  } finally {
    release();
  }
});
