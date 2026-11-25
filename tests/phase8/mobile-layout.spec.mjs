import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true });

const user = { id_pengguna: 2, id_peranan: 3, nama_penuh: 'Muhammad Abdullah bin Abdul Rahman', nama_pengguna: 'abdullah', emel: 'muhammad.abdullah.rahman@contoh.johor.gov.my', nama_peranan: 'Pengawal Keselamatan', status_akaun: 'Aktif' };

async function signIn(page) {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'synthetic-mobile-layout');
    localStorage.setItem('penjaga_user', JSON.stringify({ id_pengguna: 1, nama_penuh: 'Test User', nama_peranan: 'Pentadbir Sistem' }));
  });
  await page.route((url) => url.pathname.startsWith('/api/'), (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === '/api/meta') return route.fulfill({ json: { roles: [{ id_peranan: 3, nama_peranan: user.nama_peranan }], posts: [], guards: [], categories: [], checklist: [] } });
    if (pathname === '/api/users') return route.fulfill({ json: [user] });
    if (pathname === '/api/notifications/unread-count') return route.fulfill({ json: { unread: 0 } });
    return route.fulfill({ json: [] });
  });
}

test('phone login keeps the still image and downloads no 3D model', async ({ page }) => {
  const heavy = [];
  page.on('request', (request) => { if (/\.glb$|LoginBuilding|useBuildingAsset/.test(new URL(request.url()).pathname)) heavy.push(request.url()); });
  await page.goto('/login', { waitUntil: 'networkidle' });
  await expect(page.locator('.login-building-preview')).toBeVisible();
  await expect(page.locator('.login-landscape canvas')).toHaveCount(0);
  expect(heavy).toEqual([]);
});

test('phone user management fits the screen with fields that do not trigger zoom', async ({ page }) => {
  await signIn(page);
  await page.goto('/pengguna');
  await expect(page.getByText(user.emel, { exact: false })).toBeVisible();
  // isMobile widens the layout viewport to fit overflowing content, so compare with the device width.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  const sizes = await page.locator('main input, main select').evaluateAll((fields) => fields.map((field) => parseFloat(getComputedStyle(field).fontSize)));
  expect(sizes.length).toBeGreaterThan(0);
  expect(Math.min(...sizes)).toBeGreaterThanOrEqual(16);
  const toggle = await page.getByRole('button', { name: 'Tunjuk kata laluan' }).boundingBox();
  expect(Math.min(toggle.width, toggle.height)).toBeGreaterThanOrEqual(44);
});

test('a page that fails to download offers a reload and keeps navigation', async ({ page }) => {
  await signIn(page);
  await page.route(/UsersPage\.jsx/, (route) => route.abort());
  await page.goto('/pengguna');
  await expect(page.getByRole('button', { name: 'Muat semula', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Navigasi mudah alih' })).toBeVisible();
});
