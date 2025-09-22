import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  async function middleware(req) {
    const token = req.nextauth.token;
    const isAuthPage = req.nextUrl.pathname === "/login" || req.nextUrl.pathname === "/register";

    if (isAuthPage) {
      if (token) {
        // If logged in, redirect from login/register to home
        return NextResponse.redirect(new URL("/", req.url));
      }
      return NextResponse.next();
    }

    // Protect all other routes if not authenticated
    if (!token) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|login|register).*) "],
};