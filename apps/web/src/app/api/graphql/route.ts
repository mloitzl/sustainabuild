import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/session';
import { signCoreApiJwt } from '@/lib/jwt';

const CORE_API_URL = process.env.CORE_API_URL ?? 'http://localhost:4000/graphql';

export async function POST(req: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

  if (!session.user) {
    return NextResponse.json({ errors: [{ message: 'Unauthorized' }] }, { status: 401 });
  }

  const body = await req.text();
  const jwt = await signCoreApiJwt(session.user.id);

  const upstream = await fetch(CORE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body,
  });

  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}
