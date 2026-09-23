// Users, supply listings, demand requests and transactions are now owned by
// the backend (see backend/README.md) — they're no longer seeded into
// localStorage. Use `node scripts/seed-backend.mjs` to seed demo accounts
// and sample data through the API instead.
//
// What's left here just clears out the localStorage keys those entities
// used to occupy, once, so stale data from before the backend migration
// doesn't shadow real API responses.

import { storageService, STORE_KEYS } from './storageService';

const BACKEND_OWNED_KEYS = [STORE_KEYS.USERS, STORE_KEYS.LISTINGS, STORE_KEYS.DEMANDS, STORE_KEYS.TRANSACTIONS, STORE_KEYS.MATCHES] as const;

// Local-only hybrid data (not yet backed by the API — see backend/README.md
// "Not built yet"). Deliberately excludes SESSION/TOKEN so clearing this
// doesn't log the current user out.
const LOCAL_ONLY_KEYS = [STORE_KEYS.PAYMENTS, STORE_KEYS.LOGISTICS_JOBS, STORE_KEYS.DISPUTES, STORE_KEYS.NOTIFICATIONS, STORE_KEYS.AUDIT_EVENTS] as const;

const MIGRATION_FLAG = 'migrated_to_backend_v1';

export function clearBackendOwnedLocalData(): void {
  const migrated = storageService.get<boolean>(MIGRATION_FLAG);
  if (migrated) return;
  for (const key of BACKEND_OWNED_KEYS) storageService.remove(key);
  storageService.set(MIGRATION_FLAG, true);
}

export function resetPlatformData(): void {
  for (const key of LOCAL_ONLY_KEYS) storageService.remove(key);
}

export function hashPassword(pw: string): string {
  return `pwd_hash_${pw}`;
}
