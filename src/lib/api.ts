// No env var set: use a same-origin relative path, not a hardcoded
// production URL. `npm run dev` proxies /api to the local backend (see
// vite.config.ts), and the deployed frontend's /api is rewritten to the
// Railway backend by vercel.json -- hardcoding production here meant local
// dev silently talked to production instead of using either of those
// already-configured proxies. Set VITE_API_URL explicitly to override
// (e.g. for a preview host with no /api rewrite configured).
const API_BASE = import.meta.env.VITE_API_URL || '';

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  const token = localStorage.getItem('agriflow_jwt');

  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const message = errorData.error || errorData.message || `Request failed with status ${res.status}`;
    throw new Error(message);
  }

  if (res.status === 204) {
    return {} as T;
  }

  return res.json();
}
