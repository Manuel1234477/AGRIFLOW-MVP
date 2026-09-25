// Persistent LocalStorage store with in-memory fallback
const memoryStore = new Map<string, any>();
const PREFIX = 'agriflow_';

export const storageService = {
  get<T>(key: string): T | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const item = window.localStorage.getItem(PREFIX + key);
        if (item !== null) {
          return JSON.parse(item) as T;
        }
      }
    } catch {
      // ignore JSON parse error
    }
    return (memoryStore.get(key) as T) ?? null;
  },

  set<T>(key: string, value: T): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
      }
    } catch {
      // ignore localStorage quota or privacy error
    }
    memoryStore.set(key, value);
  },

  remove(key: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(PREFIX + key);
      }
    } catch {
      // ignore
    }
    memoryStore.delete(key);
  },

  clear(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        Object.keys(window.localStorage)
          .filter((k) => k.startsWith(PREFIX))
          .forEach((k) => window.localStorage.removeItem(k));
      }
    } catch {
      // ignore
    }
    memoryStore.clear();
  },
};

// Typed store keys
export const STORE_KEYS = {
  USERS: 'users',
  SESSION: 'session',
  TOKEN: 'token',
  LISTINGS: 'listings',
  DEMANDS: 'demands',
  MATCHES: 'matches',
  TRANSACTIONS: 'transactions',
  PAYMENTS: 'payments',
  LOGISTICS_JOBS: 'logistics_jobs',
  DISPUTES: 'disputes',
  NOTIFICATIONS: 'notifications',
  AUDIT_EVENTS: 'audit_events',
  WITHDRAWALS: 'withdrawals',
  SEEDED: 'seeded',
} as const;

