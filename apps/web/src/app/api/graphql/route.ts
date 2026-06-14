import { createYoga } from 'graphql-yoga';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { sessionOptions, SessionData } from '@/lib/session';
import { signCoreApiJwt } from '@/lib/jwt';
import { getStitchedSchema } from '@/lib/graphql/gateway';
import type { ViewerContext } from '@/lib/graphql/viewer-resolvers';

// Yoga + @graphql-tools rely on Node APIs and internal fetch — not Edge-safe.
export const runtime = 'nodejs';
// Reads the session cookie per request, so never statically optimized.
export const dynamic = 'force-dynamic';

// The stitched schema is built once; the Core-API JWT is minted per request and
// passed as Yoga server context (see POST below).
const yoga = createYoga<ViewerContext>({
  schema: getStitchedSchema(),
  graphqlEndpoint: '/api/graphql',
  // Use the platform Response so Yoga integrates with the Next.js runtime.
  fetchAPI: { Response },
});

export async function POST(request: NextRequest): Promise<Response> {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  const user = session.user ?? null;
  // Logged-out requests still execute: `viewer` resolves to null locally, while
  // delegated Core API fields error (no JWT). No blanket 401 — that is how the
  // browser learns it is logged out. The JWT never reaches the browser (ADR-001).
  const coreJwt = user ? await signCoreApiJwt(user.id) : null;

  return yoga.handleRequest(request, { user, coreJwt });
}
