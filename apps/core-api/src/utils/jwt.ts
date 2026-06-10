import { jwtVerify, SignJWT } from 'jose';

/**
 * JWT utilities for provisioning token generation and verification
 * Uses the CORE_API_JWT_SECRET for signing
 */

const JWT_SECRET = process.env.CORE_API_JWT_SECRET || 'dev-secret-must-be-at-least-32-chars-long-here!';
const secretKey = new TextEncoder().encode(JWT_SECRET);

/**
 * Generate a provisioning token (1-hour validity)
 * Used by cluster administrators to provision new agents
 */
export async function generateProvisioningToken(clusterId: string): Promise<string> {
  const now = Date.now();
  const expiresIn = 3600; // 1 hour

  const token = await new SignJWT({
    type: 'provisioning',
    clusterId,
    iat: Math.floor(now / 1000),
    exp: Math.floor((now + expiresIn * 1000) / 1000),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .sign(secretKey);

  return token;
}

/**
 * Exchange a provisioning token for a long-lived device JWT
 * Device JWT is valid for 10 years (allows offline operation)
 */
export async function exchangeProvisioningToken(
  provisioningToken: string,
): Promise<{ deviceJwt: string; clusterId: string }> {
  try {
    const verified = await jwtVerify(provisioningToken, secretKey);
    const payload = verified.payload as any;

    if (payload.type !== 'provisioning') {
      throw new Error('Invalid token type');
    }

    const clusterId = payload.clusterId;
    if (!clusterId) {
      throw new Error('Missing clusterId in token');
    }

    // Generate device JWT valid for 10 years
    const now = Date.now();
    const expiresIn = 10 * 365 * 24 * 3600; // 10 years

    const deviceJwt = await new SignJWT({
      type: 'device',
      clusterId,
      iat: Math.floor(now / 1000),
      exp: Math.floor((now + expiresIn * 1000) / 1000),
    })
      .setProtectedHeader({ alg: 'HS256' })
      .sign(secretKey);

    return { deviceJwt, clusterId };
  } catch (err) {
    throw new Error(`Failed to exchange provisioning token: ${(err as Error).message}`);
  }
}

/**
 * Verify and decode a device JWT
 */
export async function verifyDeviceJwt(
  deviceJwt: string,
): Promise<{ clusterId: string; type: string }> {
  try {
    const verified = await jwtVerify(deviceJwt, secretKey);
    const payload = verified.payload as any;

    if (payload.type !== 'device') {
      throw new Error('Invalid token type');
    }

    return {
      clusterId: payload.clusterId,
      type: payload.type,
    };
  } catch (err) {
    throw new Error(`Failed to verify device JWT: ${(err as Error).message}`);
  }
}
