import type { Page, APIRequestContext } from '@playwright/test';

export const API_URL = process.env.VITE_API_URL ?? 'http://localhost:8080/api';

export interface TestUser {
  name: string;
  email: string;
  password: string;
  role: 'buyer' | 'supplier' | 'logistics' | 'admin';
}

/** Registers a user directly against the API — used for admin, since the
 * register UI deliberately doesn't offer an admin role option. Admin
 * registration needs ADMIN_REGISTRATION_KEY to match the API's. */
export async function registerViaApi(request: APIRequestContext, user: TestUser) {
  const adminKey = process.env.ADMIN_REGISTRATION_KEY;
  const res = await request.post(`${API_URL}/auth/register`, {
    data: { name: user.name, email: user.email, password: user.password, role: user.role },
    headers: user.role === 'admin' && adminKey ? { 'X-Admin-Registration-Key': adminKey } : {},
  });
  if (!res.ok()) throw new Error(`register ${user.email} failed: ${res.status()} ${await res.text()}`);
  return res.json();
}

export async function registerViaUI(page: Page, user: TestUser) {
  await page.goto('/register');
  // Step 1: role select. The label wraps the radio, so getByLabel substring-matches.
  const roleLabel = { buyer: 'Buyer', supplier: 'Supplier', logistics: 'Logistics Provider' }[user.role as 'buyer' | 'supplier' | 'logistics'];
  await page.getByText(roleLabel, { exact: false }).first().click();
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 2: account details (plain inputs, no label association — Name is
  // the first type="text" input in DOM order).
  await page.locator('input[type="text"]').first().fill(user.name);
  await page.locator('input[type="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill(user.password);
  await page.getByRole('button', { name: 'Create Account' }).click();
  await page.waitForURL('**/app/dashboard');
}

export async function loginViaUI(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/app/dashboard');
}

export async function logoutViaUI(page: Page) {
  await page.locator('header button[type="button"]').first().click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL('**/login');
}

export async function getStoredToken(page: Page): Promise<string> {
  const raw = await page.evaluate(() => localStorage.getItem('agriflow_token'));
  if (!raw) throw new Error('no token in localStorage — is the user logged in?');
  return JSON.parse(raw);
}

export async function apiGet(request: APIRequestContext, path: string, token: string) {
  const res = await request.get(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok()) throw new Error(`GET ${path} failed: ${res.status()} ${await res.text()}`);
  return res.json();
}

export function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
