import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { registerViaApi, loginViaUI, apiGet, uniqueSuffix, API_URL, type TestUser } from './helpers';

// Issue #32 end to end: the supplier picks a photo and a video on the
// create-listing form, the browser uploads them straight to the storage
// bucket via presigned URLs, the API processes them (WebP renditions,
// video thumbnail), and the published listing carries them.
//
// Needs the API running with S3_* configured (a local SeaweedFS/MinIO
// bucket works -- see backend/README.md) and ffmpeg on PATH, which is also
// used here to generate the test files.
test('supplier uploads photo + video and publishes them on a listing', async ({ page, request }) => {
  const suffix = uniqueSuffix();
  const supplier: TestUser = { name: `E2E Media Supplier ${suffix}`, email: `media-supplier-${suffix}@e2e.agriflow`, password: 'testpass123', role: 'supplier' };
  const supplierReg = await registerViaApi(request, supplier);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agriflow-media-e2e-'));
  const photo = path.join(dir, 'maize-bags.jpg');
  const video = path.join(dir, 'warehouse.mp4');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=1600x1200', '-frames:v', '1', photo]);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=640x360:rate=25', '-t', '1', '-pix_fmt', 'yuv420p', video]);

  await loginViaUI(page, supplier.email, supplier.password);
  await page.goto('/app/supply/new');
  // The form's <label>s aren't associated with their controls, so locate
  // fields by placeholder / order rather than getByLabel.
  const selects = page.locator('form select');
  await selects.nth(0).selectOption('maize'); // Commodity
  await selects.nth(1).selectOption('A'); // Quality Grade
  await page.getByPlaceholder('e.g. 50', { exact: true }).fill('10');
  await page.getByPlaceholder('e.g. 850000').fill('450000');
  await page.getByPlaceholder(/Kaduna Central Silos/).fill('Kano, Kano State');
  await page.locator('form input[type="date"]').fill('2026-10-01');
  await page.locator('form textarea').fill(`E2E media listing ${suffix}`);

  await page.locator('input[type="file"]').setInputFiles([photo, video]);
  await expect(page.getByText('Uploaded Media (2/8)')).toBeVisible();
  // Uploading → Processing → done: both status badges disappear.
  await expect(page.getByText(/^(Uploading \d+%|Processing)$/)).toHaveCount(0, { timeout: 60_000 });
  await expect(page.getByText('Upload failed')).toHaveCount(0);

  await page.getByRole('button', { name: 'Publish Listing' }).click();
  await page.waitForURL('**/app/supply/manage');

  const listings = await apiGet(request, '/listings/mine', supplierReg.token);
  const created = listings.find((l: { description: string }) => l.description === `E2E media listing ${suffix}`);
  expect(created).toBeTruthy();
  expect(created.media).toHaveLength(2);
  const [cover, clip] = created.media;
  expect(cover).toMatchObject({ type: 'image', status: 'ready', isCover: true, name: 'maize-bags.jpg' });
  expect(clip).toMatchObject({ type: 'video', status: 'ready', name: 'warehouse.mp4' });

  // The listing's URLs resolve through the API redirect to real files.
  const large = await request.get(`http://localhost:5173${cover.url}`);
  expect(large.ok()).toBeTruthy();
  expect(large.headers()['content-type']).toBe('image/webp');
  const thumb = await request.get(`http://localhost:5173${clip.thumbnailUrl}`);
  expect(thumb.headers()['content-type']).toBe('image/webp');

  // A buyer-facing detail page renders the uploaded photo, not the stock image.
  await page.goto(`/app/supply/${created.id}`);
  await expect(page.locator(`img[src*="/api/media/${cover.id}/content"]`).first()).toBeVisible();
});

// Adding media to a listing that already exists, from My Supply: uploads
// attach straight to the listing, the first photo becomes the cover, the
// supplier can pick another cover, and removing the cover promotes the next.
test('supplier adds, re-covers and removes media on an existing listing', async ({ page, request }) => {
  const suffix = uniqueSuffix();
  const supplier: TestUser = { name: `E2E Media Editor ${suffix}`, email: `media-editor-${suffix}@e2e.agriflow`, password: 'testpass123', role: 'supplier' };
  const { token } = await registerViaApi(request, supplier);

  const created = await request.post(`${API_URL}/listings`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      commodity: 'maize', quantity: 20, unit: 'tonnes', qualityGrade: 'A', pricePerUnit: 400000,
      location: 'Kaduna', availabilityDate: '2026-11-01T00:00:00Z', description: `E2E edit media ${suffix}`,
    },
  });
  expect(created.ok()).toBeTruthy();
  const listing = await created.json();
  expect(listing.media).toEqual([]);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agriflow-media-edit-e2e-'));
  const first = path.join(dir, 'first.jpg');
  const second = path.join(dir, 'second.png');
  const video = path.join(dir, 'silo.webm');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=800x600', '-frames:v', '1', first]);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'smptebars=size=800x600', '-frames:v', '1', second]);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=25', '-t', '1', '-c:v', 'libvpx', video]);

  await loginViaUI(page, supplier.email, supplier.password);
  await page.goto('/app/supply/manage');
  const card = page.locator('div.bg-white.rounded-xl', { hasText: listing.id });
  await card.getByRole('button', { name: /Photos & videos \(0\)/ }).click();
  // Demo samples are never uploaded, so they aren't offered on a live listing.
  await expect(card.getByRole('button', { name: /Add Sample Produce Media/ })).toHaveCount(0);

  await card.locator('input[type="file"]').setInputFiles([first, second, video]);
  await expect(card.getByText('Uploaded Media (3/8)')).toBeVisible();
  await expect(card.getByText(/^(Uploading \d+%|Processing)$/)).toHaveCount(0, { timeout: 60_000 });
  await expect(card.getByRole('button', { name: /Photos & videos \(3\)/ })).toBeVisible();

  const media = async () => (await apiGet(request, `/listings/${listing.id}`, token)).media;
  await expect.poll(async () => (await media()).map((m: { status: string }) => m.status)).toEqual(['ready', 'ready', 'ready']);
  let items = await media();
  // Uploads run in parallel, so whichever photo finished first is the cover.
  const photos = items.filter((m: { type: string }) => m.type === 'image');
  const cover = photos.find((m: { isCover: boolean }) => m.isCover);
  const other = photos.find((m: { isCover: boolean }) => !m.isCover);
  expect(cover).toBeTruthy();
  expect(other).toBeTruthy();
  expect(items.find((m: { name: string }) => m.name === 'silo.webm').thumbnailUrl).toBeTruthy();

  // Pick the other photo as cover.
  const otherTile = card.locator('.group', { has: page.locator(`img[alt="${other.name}"]`) });
  await otherTile.hover();
  await otherTile.getByRole('button', { name: 'Set as cover' }).click();
  await expect(otherTile.getByText('Primary Cover')).toBeVisible();
  await expect.poll(async () => (await media()).find((m: { isCover: boolean }) => m.isCover)?.id).toBe(other.id);

  // Remove the new cover: it's deleted server-side and the remaining photo takes over.
  await otherTile.getByTitle('Remove item').click();
  await expect(card.getByText('Uploaded Media (2/8)')).toBeVisible();
  await expect.poll(async () => (await media()).length).toBe(2);
  items = await media();
  expect(items[0]).toMatchObject({ id: cover.id, isCover: true });
  const coverTile = card.locator('.group', { has: page.locator(`img[alt="${cover.name}"]`) });
  await expect(coverTile.getByText('Primary Cover')).toBeVisible();
  const gone = await request.get(`${API_URL}/media/${other.id}/content`, { maxRedirects: 0 });
  expect(gone.status()).toBe(404);
});
