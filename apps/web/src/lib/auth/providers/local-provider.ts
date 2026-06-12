import type { AuthProvider } from '@/lib/auth/types';

export const localAuthProvider: AuthProvider = {
  id: 'local',
  name: 'Local credentials',
  kind: 'local',
  passwordLogin: true,
  authenticateWithPassword: async ({ username, password }) => {
    if (!username || !password) {
      throw new Error('Missing credentials');
    }

    // TODO: replace with real user verification against domain auth service.
    return {
      id: `user-${username}`,
      username,
      providerId: 'local',
    };
  },
};

