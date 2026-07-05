import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';

const COOKIE_NAME = 'visioncraft_visitor';
const ONE_YEAR = 60 * 60 * 24 * 365;

export type VisitorSession = {
  visitorId: string;
  ownerHash: string;
  isNew: boolean;
};

function readCookie(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;

  for (const pair of cookieHeader.split(';')) {
    const [key, ...valueParts] = pair.trim().split('=');
    if (key === name) return decodeURIComponent(valueParts.join('='));
  }

  return null;
}

function getSessionSecret() {
  const secret =
    process.env.VISITOR_SESSION_SECRET ||
    process.env.RATE_LIMIT_SECRET ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret) {
    throw new Error('缺少 VISITOR_SESSION_SECRET，无法安全隔离访客作品。');
  }

  return secret;
}

export function getVisitorSession(request: Request): VisitorSession {
  const existing = readCookie(request.headers.get('cookie'), COOKIE_NAME);
  const visitorId = existing || randomUUID();
  const ownerHash = createHash('sha256')
    .update(`${getSessionSecret()}:${visitorId}`)
    .digest('hex');

  return {
    visitorId,
    ownerHash,
    isNew: !existing,
  };
}

export function withVisitorCookie<T>(response: NextResponse<T>, session: VisitorSession) {
  if (session.isNew) {
    response.cookies.set({
      name: COOKIE_NAME,
      value: session.visitorId,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: ONE_YEAR,
    });
  }

  return response;
}
