import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const hostname = request.headers.get("host") ?? "";
  const pathname = request.nextUrl.pathname;

  const isLocalhost =
    hostname.includes("localhost") || hostname.includes("127.0.0.1");
  const isAppSubdomain = hostname.startsWith("app.") || isLocalhost;
  const isWww =
    hostname.startsWith("www.") || hostname === "flowfd.com";

  // app.flowfd.com 루트 → /login 으로 redirect
  if (isAppSubdomain && !isLocalhost && pathname === "/") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // www.flowfd.com 에서 앱 경로 접근 → app 서브도메인으로 redirect
  if (
    isWww &&
    pathname !== "/" &&
    !pathname.startsWith("/_next") &&
    !pathname.startsWith("/favicon") &&
    !pathname.startsWith("/images") &&
    !pathname.startsWith("/icons")
  ) {
    const appOrigin =
      process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
    return NextResponse.redirect(`${appOrigin}${pathname}`);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
