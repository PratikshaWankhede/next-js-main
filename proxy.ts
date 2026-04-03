import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function proxy(request: NextRequest) {
  let sessionUserId: string | null = null;
  try {
    const token = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
    });
    sessionUserId = typeof token?.sub === "string" ? token.sub : null;
  } catch (error) {
    // Database unreachable (e.g. ENOTFOUND), network error, or auth failure.
    // Treat as unauthenticated so the app keeps working; API routes will return 401/503 as needed.
    console.warn(
      "[proxy] Session lookup failed, treating as unauthenticated:",
      (error as Error).message,
    );
  }

  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const publicRoutes = [
    "/sign-in",
    "/sign-in-1",
    "/sign-in-2",
    "/sign-up-1",
    "/sign-up-2",
    "/reset-password-1",
    "/reset-password-2",
    "/api/auth",
    "/api/webhooks/whatsapp",
    "/api/webhooks/instagram",
  ];
  const isPublicRoute =
    pathname === "/" ||
    publicRoutes.some((route) => pathname.startsWith(route));

  // If accessing a protected route without a session, redirect to sign-in
  if (!isPublicRoute && !sessionUserId) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  // If accessing sign-in/sign-up pages while authenticated, redirect to dashboard
  const authPages = [
    "/sign-in",
    "/sign-in-1",
    "/sign-in-2",
    "/sign-up-1",
    "/sign-up-2",
  ];
  if (authPages.includes(pathname) && sessionUserId) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (pathname === "/" && sessionUserId) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
