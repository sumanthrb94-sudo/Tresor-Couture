import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { User } from '../types';
import { ensureAdminSeed, usersStore } from '../data/storage';
import { sha256 } from '../data/hash';

const SESSION_KEY = 'tresor:auth:v1';

interface AuthContextValue {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { email: string; password: string; fullName: string; phone?: string }) => Promise<void>;
  logout: () => void;
  updateProfile: (patch: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const loadSession = (): User | null => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as User) : null;
  } catch {
    return null;
  }
};

const saveSession = (user: User | null) => {
  if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  else localStorage.removeItem(SESSION_KEY);
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => loadSession());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ensureAdminSeed().finally(() => setLoading(false));
  }, []);

  // Refresh stored user if its record changes in the users store.
  useEffect(() => {
    if (!user) return;
    return usersStore.subscribe(async () => {
      const fresh = await usersStore.get(user.id);
      if (fresh) {
        setUser(fresh);
        saveSession(fresh);
      }
    });
  }, [user]);

  const login = useCallback(async (email: string, password: string) => {
    const normalised = email.trim().toLowerCase();
    const passwordHash = await sha256(password);
    const all = await usersStore.list();
    const match = all.find(u => u.email.toLowerCase() === normalised && u.passwordHash === passwordHash);
    if (!match) throw new Error('Invalid email or password.');
    setUser(match);
    saveSession(match);
  }, []);

  const register = useCallback(
    async ({ email, password, fullName, phone }: { email: string; password: string; fullName: string; phone?: string }) => {
      const normalised = email.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalised)) throw new Error('Enter a valid email.');
      if (password.length < 6) throw new Error('Password must be at least 6 characters.');
      const all = await usersStore.list();
      if (all.some(u => u.email.toLowerCase() === normalised)) {
        throw new Error('An account with this email already exists.');
      }
      const passwordHash = await sha256(password);
      const newUser: User = {
        id: 'u-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        email: normalised,
        passwordHash,
        fullName: fullName.trim(),
        phone: phone?.trim(),
        role: 'customer',
        createdAt: new Date().toISOString()
      };
      await usersStore.create(newUser);
      setUser(newUser);
      saveSession(newUser);
    },
    []
  );

  const logout = useCallback(() => {
    setUser(null);
    saveSession(null);
  }, []);

  const updateProfile = useCallback(
    async (patch: Partial<User>) => {
      if (!user) throw new Error('Not signed in.');
      const updated = await usersStore.update(user.id, patch);
      setUser(updated);
      saveSession(updated);
    },
    [user]
  );

  return (
    <AuthContext.Provider
      value={{ user, isAdmin: user?.role === 'admin', loading, login, register, logout, updateProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
