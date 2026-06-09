import { SignJWT, jwtVerify } from 'jose';

const CORE_API_JWT_SECRET = new TextEncoder().encode(
  process.env.CORE_API_JWT_SECRET ?? 'dev-core-api-secret-must-be-32chars',
);

/** 5-minute JWT for Core API requests */
export async function signCoreApiJwt(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(CORE_API_JWT_SECRET);
}

/** 10-second Auth Ticket for direct WebSocket subscriptions */
export async function signAuthTicket(userId: string): Promise<string> {
  return new SignJWT({ sub: userId, type: 'auth-ticket' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('10s')
    .sign(CORE_API_JWT_SECRET);
}

export async function verifyCoreApiJwt(token: string) {
  return jwtVerify(token, CORE_API_JWT_SECRET);
}
