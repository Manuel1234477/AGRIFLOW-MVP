// Thin fetch wrapper for the AgriFlow backend — attaches the JWT, parses
// JSON, and turns `{ error }` responses into thrown Errors. A 401 clears the
// stored session/token and sends the user to /login.

import { storageService, STORE_KEYS } from './storageService';

function resolveApiUrl(): string {
  // Explicit VITE_API_URL always wins — required for a production build
  // hosted anywhere that doesn't proxy /api (Vercel does, via vercel.json).
  const explicit = import.meta.env.VITE_API_URL as string | undefined;
  if (explicit) return explicit;

  // No explicit URL: use a same-origin relative path. `npm run dev` proxies
  // /api to the backend container-side (see vite.config.ts), so the browser
  // never makes a cross-origin request — this is what makes local dev work
  // both plain and behind a forwarded dev-container URL (Codespaces), where
  // a cross-origin request to a separately-forwarded backend port would hit
  // that port's own private-tunnel auth gate and fail.
  return '/api';
}

const BASE_URL = resolveApiUrl();

export function getToken(): string | null {
  return storageService.get<string>(STORE_KEYS.TOKEN);
}

export function setToken(token: string): void {
  storageService.set(STORE_KEYS.TOKEN, token);
}

function handleUnauthorized(): void {
  storageService.remove(STORE_KEYS.TOKEN);
  storageService.remove(STORE_KEYS.SESSION);
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> | undefined),
  };

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  } catch {
    throw new Error('Could not reach the AgriFlow server. Check your connection and try again.');
  }

  if (res.status === 401) {
    handleUnauthorized();
  }

  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    const message =
      body && typeof body === 'object' && 'error' in body
        ? String((body as { error: unknown }).error)
        : `Request failed with status ${res.status}.`;
    throw new Error(message);
  }

  return body as T;
}

function toQueryString(params?: Record<string, string | undefined>): string {
  if (!params) return '';
  const entries = Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][];
  if (entries.length === 0) return '';
  return `?${new URLSearchParams(entries).toString()}`;
}

export const apiClient = {
  get<T>(path: string, params?: Record<string, string | undefined>): Promise<T> {
    return request<T>(`${path}${toQueryString(params)}`, { method: 'GET' });
  },
  post<T>(path: string, data?: unknown): Promise<T> {
    return request<T>(path, {
      method: 'POST',
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });
  },
  patch<T>(path: string, data?: unknown): Promise<T> {
    return request<T>(path, {
      method: 'PATCH',
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });
  },
};
