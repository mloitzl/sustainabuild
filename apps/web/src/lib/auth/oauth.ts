import { createHash, randomBytes } from 'crypto';

function toBase64Url(buffer: Buffer): string {
  return buffer.toString('base64url');
}

export function randomUrlSafeString(byteLength = 32): string {
  return toBase64Url(randomBytes(byteLength));
}

export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = randomUrlSafeString(64);
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export async function parseJsonResponse<T>(res: Response, context: string): Promise<T> {
  const contentType = res.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  if (!isJson) {
    const body = await res.text();
    throw new Error(`${context} returned non-JSON response (${res.status}): ${body.slice(0, 200)}`);
  }

  return (await res.json()) as T;
}

export function parseJwtPayload(token: string): Record<string, unknown> {
  const segments = token.split('.');
  if (segments.length < 2) {
    throw new Error('Invalid JWT format');
  }

  const payloadBuffer = Buffer.from(segments[1], 'base64url');
  const payloadText = payloadBuffer.toString('utf8');
  return JSON.parse(payloadText) as Record<string, unknown>;
}

