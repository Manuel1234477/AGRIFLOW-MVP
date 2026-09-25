import { apiFetch } from '../lib/api';
import type { User, UserRole } from '../types';
import { mapUserPublic } from './apiMappers';
import { storageService, STORE_KEYS } from './storageService';

export const adminService = {
  async fetchUsers(params?: {
    role?: UserRole;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ users: Omit<User, 'passwordHash'>[]; total: number }> {
    try {
      const query = new URLSearchParams();
      if (params?.role) query.set('role', params.role);
      if (params?.search) query.set('search', params.search);
      if (params?.page) query.set('page', String(params.page));
      if (params?.limit) query.set('limit', String(params.limit));

      const queryStr = query.toString();
      const url = `/api/admin/users${queryStr ? `?${queryStr}` : ''}`;
      const data = await apiFetch<{ users: any[]; total: number }>(url);
      const mapped = data.users.map(mapUserPublic);

      // Update local storage cache
      const existing = storageService.get<Omit<User, 'passwordHash'>[]>(STORE_KEYS.USERS) ?? [];
      const mergedMap = new Map<string, Omit<User, 'passwordHash'>>();
      existing.forEach((u) => mergedMap.set(u.id, u));
      mapped.forEach((u) => mergedMap.set(u.id, u));
      const updatedList = Array.from(mergedMap.values());
      storageService.set(STORE_KEYS.USERS, updatedList);

      return { users: mapped, total: data.total };
    } catch {
      const existing = storageService.get<Omit<User, 'passwordHash'>[]>(STORE_KEYS.USERS) ?? [];
      const filtered = params?.role ? existing.filter((u) => u.role === params.role) : existing;
      return { users: filtered, total: filtered.length };
    }
  },

  async verifyUser(userId: string, verified: boolean): Promise<Omit<User, 'passwordHash'>> {
    const data = await apiFetch<any>(`/api/admin/users/${userId}/verify`, {
      method: 'PATCH',
      body: JSON.stringify({ verified }),
    });
    const mapped = mapUserPublic(data);
    const existing = storageService.get<Omit<User, 'passwordHash'>[]>(STORE_KEYS.USERS) ?? [];
    const idx = existing.findIndex((u) => u.id === userId);
    if (idx >= 0) existing[idx] = mapped;
    else existing.push(mapped);
    storageService.set(STORE_KEYS.USERS, existing);
    return mapped;
  },
};
