import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { getServerEnv } from "@/lib/env.server";
import { createClient } from "@/lib/supabase/server";

export function getGitHubProviderId(user: User): string | null {
  const id = user.identities?.find(
    (identity) => identity.provider === "github",
  )?.id;
  return typeof id === "string" && /^[1-9]\d*$/.test(id) ? id : null;
}

export function isAdmin(user: User): boolean {
  return getGitHubProviderId(user) === getServerEnv().ADMIN_GITHUB_USER_ID;
}

export async function getRequestUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function requireUser(): Promise<User> {
  const user = await getRequestUser();
  if (!user) redirect("/auth/login");
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (!isAdmin(user)) redirect("/auth/access-denied");
  return user;
}
