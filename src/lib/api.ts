const API_BASE = import.meta.env.VITE_API_URL || 'https://agriflow-api-production.up.railway.app';

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
