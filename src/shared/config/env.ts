import { z } from "zod";

const databaseEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
});

const optionalCredential = z.preprocess(
  (value) => value === "" ? undefined : value,
  z.string().min(1).optional(),
);

const oauthEnvironmentShape = {
  APP_BASE_URL: z.url().refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  }, "APP_BASE_URL must use http or https").default("http://localhost:3000"),
  GOOGLE_CLIENT_ID: optionalCredential,
  GOOGLE_CLIENT_SECRET: optionalCredential,
  KAKAO_CLIENT_ID: optionalCredential,
  KAKAO_CLIENT_SECRET: optionalCredential,
};

function validateOAuthCredentialPairs(
  environment: z.infer<z.ZodObject<typeof oauthEnvironmentShape>>,
  context: z.RefinementCtx,
) {
  for (const provider of ["GOOGLE", "KAKAO"] as const) {
    const clientId = environment[`${provider}_CLIENT_ID`];
    const clientSecret = environment[`${provider}_CLIENT_SECRET`];
    if (Boolean(clientId) !== Boolean(clientSecret)) {
      context.addIssue({
        code: "custom",
        path: [`${provider}_CLIENT_ID`],
        message: `${provider} OAuth client ID and secret must be configured together`,
      });
    }
  }
}

const oauthEnvSchema = z.object(oauthEnvironmentShape).superRefine(
  validateOAuthCredentialPairs,
);

const serverEnvSchema = databaseEnvSchema.extend({
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  ...oauthEnvironmentShape,
}).superRefine(validateOAuthCredentialPairs);

export type DatabaseEnv = z.infer<typeof databaseEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type OAuthEnv = z.infer<typeof oauthEnvSchema>;

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

export function parseOAuthEnv(
  environment: Record<string, string | undefined> = process.env,
): OAuthEnv {
  return oauthEnvSchema.parse(environment);
}
