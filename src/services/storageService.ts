// Storage abstraction — single source of localStorage access

const PREFIX = 'agriflow_';

export const storageService = {
  get<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },

  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      console.error('Storage write failed for key:', key);
    }
  },

  remove(key: string): void {
    localStorage.removeItem(PREFIX + key);
  },

  clear(): void {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k));
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
