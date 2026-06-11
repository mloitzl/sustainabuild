import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/session';

function getEnvironmentLabel(): string {
  return process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development';
}

export async function GET() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  const environment = getEnvironmentLabel();

  if (!session.user) {
    return NextResponse.json({
      authenticated: false,
      environment,
    });
  }

  return NextResponse.json({
    authenticated: true,
    environment,
    user: {
      id: session.user.id,
      username: session.user.username,
    },
  });
}
