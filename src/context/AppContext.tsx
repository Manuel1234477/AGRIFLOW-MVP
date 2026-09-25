import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { AuthSession, Notification, UserRole } from '../types';
import { authService } from '../services/authService';
import { notificationService } from '../services/notificationService';
import { seedInitialLocalDataIfEmpty } from '../services/seedService';

interface RegisterParams {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  organizationName?: string;
  phone?: string;
  location?: string;
}

interface AppContextValue {
  session: AuthSession | null;
  setSession: (s: AuthSession | null) => void;
  login: (email: string, pw: string) => Promise<AuthSession>;
  register: (params: RegisterParams) => Promise<AuthSession>;
  notifications: Notification[];
  unreadCount: number;
  refreshNotifications: () => void;
  logout: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [session, setSessionState] = useState<AuthSession | null>(() => authService.getSession());
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Seed default data if local storage is empty
  useEffect(() => {
    seedInitialLocalDataIfEmpty();
  }, []);

  // Validate token and sync live session on mount without logging out offline users
  useEffect(() => {
    authService.fetchMe().then((user) => {
      if (user) {
        setSessionState({
          userId: user.id,
          role: user.role,
          name: user.name,
          email: user.email,
        });
      }
    }).catch(() => {
      // Keep existing storage session if offline
    });
  }, []);


  const refreshNotifications = useCallback(() => {
    if (session) {
      setNotifications(notificationService.getForUser(session.userId));
    } else {
      setNotifications([]);
    }
  }, [session]);

  useEffect(() => {
    refreshNotifications();
  }, [refreshNotifications]);

  const setSession = useCallback((s: AuthSession | null) => {
    setSessionState(s);
    if (!s) {
      setNotifications([]);
    }
  }, []);

  const login = useCallback(async (email: string, pw: string) => {
    const s = await authService.login(email, pw);
    setSession(s);
    return s;
  }, [setSession]);

  const register = useCallback(async (params: RegisterParams) => {
    const s = await authService.register(params);
    setSession(s);
    return s;
  }, [setSession]);

  const logout = useCallback(() => {
    authService.logout();
    setSession(null);
  }, [setSession]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <AppContext.Provider
      value={{
        session,
        setSession,
        login,
        register,
        notifications,
        unreadCount,
        refreshNotifications,
        logout,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
