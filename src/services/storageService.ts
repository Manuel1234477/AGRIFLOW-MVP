// In-Memory Storage runtime store — localStorage usage has been wiped out
// All entities are retrieved and synchronized via backend REST API endpoints

const memoryStore = new Map<string, any>();

// Auto-purge any stale agriflow localStorage keys from browser
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    Object.keys(window.localStorage)
      .filter((k) => k.startsWith('agriflow_') && k !== 'agriflow_jwt' && k !== 'agriflow_lang')
      .forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

export const storageService = {
  get<T>(key: string): T | null {
    if (memoryStore.has(key)) {
      return memoryStore.get(key) as T;
    }
    return null;
  },

  set<T>(key: string, value: T): void {
    memoryStore.set(key, value);
  },

  remove(key: string): void {
    memoryStore.delete(key);
  },

  clear(): void {
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
