import { z } from "zod";

const databaseEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
});

const serverEnvSchema = databaseEnvSchema.extend({
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
});

export type DatabaseEnv = z.infer<typeof databaseEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseDatabaseEnv(
  environment: Record<string, string | undefined> = process.env,
): DatabaseEnv {
  return databaseEnvSchema.parse(environment);
}

export function parseServerEnv(
  environment: Record<string, string | undefined> = process.env,
): ServerEnv {
  return serverEnvSchema.parse(environment);
}
