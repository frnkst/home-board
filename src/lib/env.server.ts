import "server-only";

import { z } from "zod";

import { getPublicEnv } from "@/lib/env";

const serverEnvSchema = z.object({
  ADMIN_GITHUB_USER_ID: z.string().regex(/^[1-9]\d*$/, {
    message: "muss eine unveränderliche numerische GitHub-Benutzer-ID sein",
  }),
  OPENROUTER_API_KEY: z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().min(1).optional(),
  ),
});

export type ServerEnv = ReturnType<typeof getPublicEnv> &
  z.infer<typeof serverEnvSchema>;

let serverEnvCache: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  serverEnvCache ??= {
    ...getPublicEnv(),
    ...serverEnvSchema.parse({
      ADMIN_GITHUB_USER_ID: process.env.ADMIN_GITHUB_USER_ID,
      OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    }),
  };
  return serverEnvCache;
}
