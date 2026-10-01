import "server-only";

import { z } from "zod";

import { getPublicEnv } from "@/lib/env";

const serverEnvSchema = z.object({
  ADMIN_GITHUB_USER_ID: z.string().regex(/^[1-9]\d*$/, {
    message: "muss eine unveränderliche numerische GitHub-Benutzer-ID sein",
  }),
});

export type ServerEnv = ReturnType<typeof getPublicEnv> &
  z.infer<typeof serverEnvSchema>;

let serverEnvCache: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  serverEnvCache ??= {
    ...getPublicEnv(),
    ...serverEnvSchema.parse({
      ADMIN_GITHUB_USER_ID: process.env.ADMIN_GITHUB_USER_ID,
    }),
  };
  return serverEnvCache;
}
