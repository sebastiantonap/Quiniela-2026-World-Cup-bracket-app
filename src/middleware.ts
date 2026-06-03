import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED = ['/dashboard', '/entries', '/admin']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const session = request.cookies.get('quiniela_session')?.value

  const isProtected = PROTECTED.some((p) => pathname.startsWith(p))

  if (isProtected && !session) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // NOTE: we intentionally do NOT redirect '/' → '/dashboard' on cookie presence here.
  // The cookie can be stale (e.g. the session row was deleted), and middleware can't
  // cheaply validate it against the DB. Bouncing a stale cookie to /dashboard would trap
  // the user on a page with no valid session and no sign-out button. Instead the landing
  // page validates the session server-side and redirects only when it's actually valid.
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
