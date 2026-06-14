import type { SessionData } from '@/lib/session';

/**
 * Per-request context for the stitched BFF schema.
 *
 * `user` is the iron-session user (or null when logged out) and resolves the
 * local `viewer` field. `coreJwt` is the freshly minted short-lived Core-API
 * JWT (or null when logged out) forwarded to the remote executor for delegated
 * Core API fields. See gateway.ts.
 */
export type ViewerContext = {
  user: NonNullable<SessionData['user']> | null;
  coreJwt: string | null;
};

type ViewerUser = {
  id: string;
  username: string;
  providerId: string | null;
  avatarUrl: string | null;
  email: string | null;
};

export const viewerResolvers = {
  Query: {
    // Returns null (NOT an error) when there is no session — this is how the
    // browser learns it is logged out.
    viewer: (_parent: unknown, _args: unknown, context: ViewerContext): ViewerUser | null => {
      const user = context.user;
      if (!user) {
        return null;
      }

      return {
        id: user.id,
        username: user.username,
        providerId: user.providerId ?? null,
        avatarUrl: user.avatarUrl ?? null,
        email: user.email ?? null,
      };
    },
  },
};
