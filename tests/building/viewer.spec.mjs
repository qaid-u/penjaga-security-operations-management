import { test, expect } from '@playwright/test';
import { mockOperations } from './operations-fixture.mjs';
import { buildingHotspots } from '../../src/components/building/buildingHotspots.js';
test.beforeEach(async ({ page }) => { await mockOperations(page); });
const url = '/3d-command-centre';
const names = buildingHotspots.map(post => post.name);
async function auth(page, role) {
  await page.addInitScript((nama_peranan) => { localStorage.setItem('penjaga_user', JSON.stringify({ nama_peranan, nama_penuh: 'Ujian Tempatan' })); }, role);
}

test('admin loads model and selects all official posts without inventing indoor markers', async ({ page }) => {
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await auth(page, 'Pentadbir Sistem');
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto(url);
  await expect(page.getByRole('heading', { name: 'Pusat Kawalan Keselamatan 3D' })).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByRole('button', { name: /01.*Pos Lobi Utama/ })).toBeVisible();
  for (const name of names) {
    await page.getByRole('button', { name: 'Tetap semula' }).click();
    // Official posts remain selectable even though their indoor coordinates are unknown.
    await page.getByRole('button', { name: new RegExp(`0[1-7].*${name}`) }).click();
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: new RegExp(`0[1-7].*${name}`) })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByLabel('Panel lokasi')).toContainText('Kedudukan 3D belum disahkan');
    await expect(page.getByLabel('Panel lokasi')).toContainText(`Aras: ${buildingHotspots.find(post => post.name === name).floor || 'Belum disahkan'}`);
    await expect(page.getByLabel('Pratetap kamera').locator('option[value="selected"]')).toHaveJSProperty('disabled',true);
  }
  await expect(page.getByText(/Tiada rekod operasi dipautkan/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Lihat Jadual' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Zum masuk', exact: true }).click();
  await page.getByRole('button', { name: 'Zum keluar', exact: true }).click();
  await page.getByRole('button', { name: 'Tetap semula' }).click();
  await expect(page.getByRole('heading', { name: 'Pilih lokasi bangunan' })).toBeVisible();
  await expect(page.locator('.building-hotspot')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Penanda', exact: true })).toHaveCount(0);
  const canvas = page.locator('canvas'); const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width * .3, box.y + box.height * .5);
  await page.mouse.down(); await page.mouse.move(box.x + box.width * .5, box.y + box.height * .55, { steps: 12 }); await page.mouse.up();
  await page.mouse.wheel(0, 100);
  await page.getByRole('button', { name: 'Tetap semula' }).click();
  await page.waitForTimeout(1200); // Settle the animated overview before visual inspection.
  await page.screenshot({ path: 'artifacts/suk/djm-posts-desktop.png', fullPage: true });
  expect(errors).toEqual([]);
});
test('chief has access on mobile and can select locations with keyboard', async ({ page }) => {
  await auth(page, 'Ketua Pengawal'); await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto(url);
  const button = page.getByRole('button', { name: /01.*Pos Lobi Utama/ });
  await expect(button).toBeVisible(); await button.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Pos Lobi Utama', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/suk/djm-posts-mobile.png', fullPage: true });
});
test('guard is denied without fetching the model and anonymous users reach login', async ({ page }) => {
  const requests = []; page.on('request', (r) => { if (r.url().endsWith('.glb')) requests.push(r.url()); });
  await auth(page, 'Pengawal Keselamatan'); await page.goto(url);
  await expect(page.getByRole('heading', { name: 'Akses Tidak Dibenarkan' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Pusat Kawalan 3D' })).toHaveCount(0);
  expect(requests).toEqual([]);
  await page.evaluate(() => localStorage.clear());
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
});
test('download failure has a working retry', async ({ page }) => {
  await auth(page, 'Pentadbir Sistem');
  await page.route('**/models/Bangunan_SUK.glb', (route) => route.fulfill({ status: 503, body: 'unavailable' }));
  await page.goto(url); await expect(page.getByRole('alert')).toContainText('HTTP 503');
  await page.unroute('**/models/Bangunan_SUK.glb'); await page.getByRole('button', { name: 'Cuba lagi' }).click();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.building-hotspot')).toHaveCount(0);
});
test('unsupported WebGL produces an explanation', async ({ page }) => {
  await auth(page, 'Pentadbir Sistem');
  await page.addInitScript(() => { const original = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (type, ...args) { return type === 'webgl2' ? null : original.call(this, type, ...args); }; });
  await page.goto(url); await expect(page.getByRole('alert')).toContainText('WebGL 2 tidak tersedia');
});
