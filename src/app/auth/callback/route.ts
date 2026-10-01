import { NextResponse, type NextRequest } from "next/server";

import { isAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = request.nextUrl.searchParams.get("next");
  const destination =
    next?.startsWith("/") && !next.startsWith("//") ? next : "/admin";
  const supabase = await createClient();

  if (!code) {
    return NextResponse.redirect(
      new URL("/auth/login?error=callback", request.url),
    );
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL("/auth/login?error=callback", request.url),
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdmin(user)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/auth/access-denied", request.url));
  }

  return NextResponse.redirect(new URL(destination, request.url));
}
