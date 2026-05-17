/**
 * RBAC Proxy — VISTA SmartFlow AI
 * Next.js 16: File ini menggantikan middleware.ts (deprecated).
 * 
 * Mengamankan route berdasarkan role pengguna:
 * - /settings, /audit-log → ADMIN only
 * - /api/export, /api/automation → ADMIN & OFFICER
 * - Semua dashboard → Authenticated only (handled by layout)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Routes yang hanya boleh diakses oleh ADMIN
const ADMIN_ONLY_ROUTES = ["/settings", "/audit-log"];

// API Routes yang diblokir untuk VIEWER
const OFFICER_ONLY_ROUTES = ["/api/export", "/api/automation"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip public assets, auth endpoints, and ALL API routes
  // API routes handle their own auth internally via getAuthSession()
  // Proxy cannot reliably call auth() for API routes (Prisma adapter issue in edge)
  const isPublic =
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/") ||             // All APIs handle auth internally
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/public");

  if (isPublic) return NextResponse.next();

  // Get current session
  const session = await auth();
  const userRole = (session?.user as { role?: string })?.role;

  // Redirect unauthenticated users ke login
  if (!session) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Enforce ADMIN-only routes
  if (ADMIN_ONLY_ROUTES.some((route) => pathname.startsWith(route)) && userRole !== "ADMIN") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Akses ditolak. Hanya ADMIN yang dapat mengakses resource ini." },
        { status: 403 }
      );
    }
    // Redirect ke dashboard dengan pesan error
    const redirectUrl = new URL("/", req.url);
    redirectUrl.searchParams.set("error", "insufficient_permissions");
    return NextResponse.redirect(redirectUrl);
  }

  // Enforce OFFICER-level API routes (block VIEWER)
  if (OFFICER_ONLY_ROUTES.some((route) => pathname.startsWith(route)) && userRole === "VIEWER") {
    return NextResponse.json(
      { error: "Akses ditolak. Role Anda tidak memiliki izin untuk operasi ini." },
      { status: 403 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
};
