import { NextResponse, type NextRequest } from 'next/server';

const protectedApiPrefixes = [
  '/api/admin',
  '/api/game',
  '/api/wallet'
];

const publicApiPrefixes = [
  '/api/auth',
  '/api/webhook'
];

function isProtectedApi(pathname: string) {
  return protectedApiPrefixes.some((prefix) => pathname.startsWith(prefix));
}

function isPublicApi(pathname: string) {
  return publicApiPrefixes.some((prefix) => pathname.startsWith(prefix));
}

function withSecurityHeaders(response: NextResponse) {
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'same-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  return response;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api/') && !isPublicApi(pathname) && isProtectedApi(pathname)) {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');
    if (origin && host && new URL(origin).host !== host) {
      return NextResponse.json({ error: 'Origem nao autorizada.' }, { status: 403 });
    }

    const authorization = request.headers.get('authorization') || '';
    const demoUid = request.headers.get('x-owner-demo-uid');
    const allowDemoHeader = !process.env.FIREBASE_SERVICE_ACCOUNT_KEY && Boolean(demoUid);
    if (!authorization.toLowerCase().startsWith('bearer ') && !allowDemoHeader) {
      return NextResponse.json({ error: 'Acesso restrito.' }, { status: 401 });
    }
  }

  return withSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|images).*)'
  ]
};
