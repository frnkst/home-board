import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next");
  const destination =
    next?.startsWith("/") && !next.startsWith("//") ? next : "/admin";
  const callback = new URL("/auth/callback", request.url);
  callback.searchParams.set("next", destination);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: { redirectTo: callback.toString() },
  });

  if (error || !data.url) {
    return NextResponse.redirect(new URL("/auth/login?error=oauth", request.url));
  }
  return NextResponse.redirect(data.url);
}
