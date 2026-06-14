export type AuthProviderKind = 'local' | 'oauth';

export type AuthUser = {
  id: string;
  username: string;
  providerId: string;
  avatarUrl?: string;
  email?: string;
};

export type PublicAuthProvider = {
  id: string;
  name: string;
  kind: AuthProviderKind;
  passwordLogin: boolean;
  loginPath: string | null;
};

export type BrowserLoginStart = {
  authorizationUrl: string;
  state: string;
  nonce: string;
  codeVerifier: string;
};

export type BrowserLoginContext = {
  origin: string;
  callbackPath: string;
};

export type BrowserCallbackContext = {
  code: string;
  redirectUri: string;
  codeVerifier: string;
  nonce: string;
};

export type PasswordLoginContext = {
  username: string;
  password: string;
};

export interface AuthProvider {
  id: string;
  name: string;
  kind: AuthProviderKind;
  passwordLogin: boolean;
  beginLogin?: (ctx: BrowserLoginContext) => Promise<BrowserLoginStart>;
  completeLogin?: (ctx: BrowserCallbackContext) => Promise<AuthUser>;
  authenticateWithPassword?: (ctx: PasswordLoginContext) => Promise<AuthUser>;
}

