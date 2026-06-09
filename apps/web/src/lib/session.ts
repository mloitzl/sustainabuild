import { SessionOptions } from 'iron-session';

export interface SessionData {
  user?: {
    id: string;
    username: string;
  };
}

export const sessionOptions: SessionOptions = {
  cookieName: 'sustainabuild-session',
  // In production this must be a 32+ character secret from env
  password: process.env.SESSION_SECRET ?? 'dev-secret-must-be-32-chars-long!!',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  },
};
