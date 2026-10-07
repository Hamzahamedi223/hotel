import { create } from 'zustand';
import type { UserRole } from '../../shared/types';
import { loadSession, saveSession, setUnauthorizedHandler } from '../lib/api';

export interface CurrentUser {
  id: number;
  username: string;
  full_name: string;
  role: UserRole;
}

interface AuthState {
  user: CurrentUser | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  /** After an admin edits their own account, so the header/session show the new name. */
  patchUser: (changes: Partial<CurrentUser>) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  // Stay signed in across reloads / reopening the phone app
  user: loadSession()?.user ?? null,
  login: async (username, password) => {
    const { token, ...user } = await (window.api.auth.login(username, password) as Promise<CurrentUser & { token: string }>);
    saveSession({ token, user });
    set({ user });
  },
  logout: () => {
    saveSession(null);
    set({ user: null });
  },
  patchUser: (changes) =>
    set((s) => {
      if (!s.user) return {};
      const user = { ...s.user, ...changes };
      const session = loadSession();
      if (session) saveSession({ ...session, user });
      return { user };
    }),
}));

setUnauthorizedHandler(() => useAuthStore.getState().logout());
