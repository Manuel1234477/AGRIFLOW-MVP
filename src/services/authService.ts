import type { User, AuthSession, UserRole } from '../types';
import { storageService, STORE_KEYS } from './storageService';
import { auditService } from './auditService';
import { hashPassword } from './seedService';

const API_BASE = import.meta.env.VITE_API_URL || 'https://agriflow-api-production.up.railway.app';

interface ApiAuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    organizationName?: string;
    phone?: string;
    location?: string;
    verified?: boolean;
    profileComplete?: boolean;
    createdAt?: string;
  };
}

export const authService = {
  async register(params: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    organizationName?: string;
    phone?: string;
    location?: string;
  }): Promise<AuthSession> {
    // Admin accounts are privileged and provisioned directly on the client
    if (params.role === 'admin') {
      return this.registerOfflineFallback(params);
    }

    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          name: params.name,
          email: params.email,
          password: params.password,
          role: params.role,
          organizationName: params.organizationName || params.name,
          phone: params.phone,
          location: params.location,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || `Registration failed with status ${res.status}`);
      }

      const data: ApiAuthResponse = await res.json();
      const token = data.token;
      const apiUser = data.user;

      if (token) {
        localStorage.setItem('agriflow_jwt', token);
      }

      const session: AuthSession = {
        userId: apiUser.id,
        role: apiUser.role,
        name: apiUser.name,
        email: apiUser.email,
      };

      storageService.set(STORE_KEYS.SESSION, session);

      // Also mirror user in local state
      const users = storageService.get<User[]>(STORE_KEYS.USERS) ?? [];
      const localUser: User = {
        id: apiUser.id,
        email: apiUser.email,
        passwordHash: '',
        name: apiUser.name,
        role: apiUser.role,
        organizationName: apiUser.organizationName || apiUser.name,
        phone: apiUser.phone,
        location: apiUser.location,
        verified: apiUser.verified ?? true,
        profileComplete: apiUser.profileComplete ?? true,
        createdAt: apiUser.createdAt || new Date().toISOString(),
      };
      const filtered = users.filter((u) => u.id !== localUser.id && u.email.toLowerCase() !== localUser.email.toLowerCase());
      filtered.push(localUser);
      storageService.set(STORE_KEYS.USERS, filtered);

      auditService.log({
        action: 'user_registered',
        actorId: apiUser.id,
        actorName: apiUser.name,
        actorRole: apiUser.role,
        entityId: apiUser.id,
        entityType: 'User',
        detail: `${apiUser.name} registered as ${apiUser.role} on live backend.`,
      });

      return session;
    } catch (err: unknown) {
      // Offline fallback if network fails
      if (err instanceof Error && err.message.includes('fetch')) {
        return this.registerOfflineFallback(params);
      }
      throw err;
    }
  },

  async login(email: string, password: string): Promise<AuthSession> {
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (!res.ok) {
        // If live login fails, check local admin or offline users before failing
        try {
          return this.loginOfflineFallback(email, password);
        } catch {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || 'Invalid email or password.');
        }
      }

      const data: ApiAuthResponse = await res.json();
      const token = data.token;
      const apiUser = data.user;

      if (token) {
        localStorage.setItem('agriflow_jwt', token);
      }

      const session: AuthSession = {
        userId: apiUser.id,
        role: apiUser.role,
        name: apiUser.name,
        email: apiUser.email,
      };

      storageService.set(STORE_KEYS.SESSION, session);

      // Mirror into local users for fast offline access
      const users = storageService.get<User[]>(STORE_KEYS.USERS) ?? [];
      const localUser: User = {
        id: apiUser.id,
        email: apiUser.email,
        passwordHash: '',
        name: apiUser.name,
        role: apiUser.role,
        organizationName: apiUser.organizationName || apiUser.name,
        phone: apiUser.phone,
        location: apiUser.location,
        verified: apiUser.verified ?? true,
        profileComplete: apiUser.profileComplete ?? true,
        createdAt: apiUser.createdAt || new Date().toISOString(),
      };
      const filtered = users.filter((u) => u.id !== localUser.id && u.email.toLowerCase() !== localUser.email.toLowerCase());
      filtered.push(localUser);
      storageService.set(STORE_KEYS.USERS, filtered);

      return session;
    } catch (err: unknown) {
      // If network error, check local storage
      if (err instanceof Error && (err.message.includes('fetch') || err.message.includes('Failed to fetch'))) {
        return this.loginOfflineFallback(email, password);
      }
      throw err;
    }
  },

  logout(): void {
    localStorage.removeItem('agriflow_jwt');
    storageService.remove(STORE_KEYS.SESSION);
  },

  async fetchMe(): Promise<User | null> {
    const token = localStorage.getItem('agriflow_jwt');
    if (!token) return null;
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });
      if (!res.ok) {
        if (res.status === 401) {
          this.logout();
        }
        return null;
      }
      const apiUser = await res.json();
      const user: User = {
        id: apiUser.id,
        email: apiUser.email,
        passwordHash: '',
        name: apiUser.name,
        role: apiUser.role,
        organizationName: apiUser.organizationName || apiUser.name,
        phone: apiUser.phone,
        location: apiUser.location,
        verified: apiUser.verified ?? true,
        profileComplete: apiUser.profileComplete ?? true,
        createdAt: apiUser.createdAt || new Date().toISOString(),
      };
      const session: AuthSession = {
        userId: user.id,
        role: user.role,
        name: user.name,
        email: user.email,
      };
      storageService.set(STORE_KEYS.SESSION, session);
      const users = storageService.get<User[]>(STORE_KEYS.USERS) ?? [];
      const filtered = users.filter((u) => u.id !== user.id && u.email.toLowerCase() !== user.email.toLowerCase());
      filtered.push(user);
      storageService.set(STORE_KEYS.USERS, filtered);
      return user;
    } catch {
      return this.getCurrentUser();
    }
  },

  getSession(): AuthSession | null {
    return storageService.get<AuthSession>(STORE_KEYS.SESSION);
  },

  getCurrentUser(): User | null {
    const session = this.getSession();
    if (!session) return null;
    const users = storageService.get<User[]>(STORE_KEYS.USERS) ?? [];
    return users.find((u) => u.id === session.userId) ?? {
      id: session.userId,
      email: session.email,
      passwordHash: '',
      name: session.name,
      role: session.role,
      organizationName: session.name,
      verified: true,
      profileComplete: true,
      createdAt: new Date().toISOString(),
    };
  },

  async updateProfile(userId: string, updates: Partial<User>): Promise<User> {
    const users = storageService.get<User[]>(STORE_KEYS.USERS) ?? [];
    const idx = users.findIndex((u) => u.id === userId);
    if (idx < 0) throw new Error('User not found.');
    const updated = { ...users[idx], ...updates, updatedAt: new Date().toISOString() };
    users[idx] = updated;
    storageService.set(STORE_KEYS.USERS, users);
    return updated;
  },

  // Fallbacks for local demo / offline mode
  registerOfflineFallback(params: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    organizationName?: string;
    phone?: string;
    location?: string;
  }): AuthSession {
    const prefix = params.role === 'buyer' ? 'USR-BUY' : params.role === 'supplier' ? 'USR-SUP' : params.role === 'logistics' ? 'USR-LOG' : 'USR-ADM';
    const id = `${prefix}-${String(Date.now()).slice(-6)}`;
    const users = storageService.get<User[]>(STORE_KEYS.USERS) ?? [];
    const existingIdx = users.findIndex((u) => u.email.toLowerCase() === params.email.toLowerCase());
    if (existingIdx >= 0) {
      users[existingIdx] = {
        ...users[existingIdx],
        name: params.name,
        passwordHash: hashPassword(params.password),
        role: params.role,
        organizationName: params.organizationName || params.name,
        phone: params.phone,
        location: params.location,
      };
      storageService.set(STORE_KEYS.USERS, users);
      const session: AuthSession = {
        userId: users[existingIdx].id,
        role: users[existingIdx].role,
        name: users[existingIdx].name,
        email: users[existingIdx].email,
      };
      storageService.set(STORE_KEYS.SESSION, session);
      return session;
    }
    const user: User = {
      id,
      email: params.email,
      passwordHash: hashPassword(params.password),
      name: params.name,
      role: params.role,
      organizationName: params.organizationName || params.name,
      phone: params.phone,
      location: params.location,
      verified: true,
      profileComplete: true,
      createdAt: new Date().toISOString(),
    };
    users.push(user);
    storageService.set(STORE_KEYS.USERS, users);
    const session: AuthSession = { userId: user.id, role: user.role, name: user.name, email: user.email };
    storageService.set(STORE_KEYS.SESSION, session);
    return session;
  },

  loginOfflineFallback(email: string, password: string): AuthSession {
    const users = storageService.get<User[]>(STORE_KEYS.USERS) ?? [];
    const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user || (user.passwordHash && user.passwordHash !== hashPassword(password))) {
      throw new Error('Invalid email or password. Please verify your credentials.');
    }
    const session: AuthSession = { userId: user.id, role: user.role, name: user.name, email: user.email };
    storageService.set(STORE_KEYS.SESSION, session);
    return session;
  },
};
