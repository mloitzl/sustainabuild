import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/session';

export async function POST(req: Request) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  const body = await req.json() as { username: string; password: string };

  if (!body.username || !body.password) {
    return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
  }

  // TODO: Validate against Core API / user store in business logic phase
  session.user = { id: `user-${body.username}`, username: body.username };
  await session.save();

  return NextResponse.json({ ok: true, username: session.user.username });
}
