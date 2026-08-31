import "server-only";

import * as oidc from "openid-client";
import { z } from "zod";

import { parseOAuthEnv, type OAuthEnv } from "@/shared/config/env";
import type { OAuthProvider } from "@/shared/auth/oauth";

import { AuthError } from "./errors";

export const oauthProviderSchema = z.literal("google");
export type { OAuthProvider } from "@/shared/auth/oauth";

type ProviderSettings = Readonly<{
  clientId: string;
  clientSecret: string;
  issuer: string;
  scope: string;
}>;

export type OAuthIdentity = Readonly<{
  provider: OAuthProvider;
  providerAccountId: string;
  email: string;
}>;

export type OAuthAuthorizationInput = Readonly<{
  provider: OAuthProvider;
  state: string;
  nonce: string;
  codeVerifier: string;
}>;

export type OAuthCallbackInput = OAuthAuthorizationInput & Readonly<{
  callbackUrl: URL;
}>;

const configurationCache = new Map<string, Promise<oidc.Configuration>>();

export function getEnabledOAuthProviders(
  environment: Record<string, string | undefined> = process.env,
): OAuthProvider[] {
  const parsed = parseOAuthEnv(environment);
  return parsed.GOOGLE_CLIENT_ID ? ["google"] : [];
}

export function getOAuthRedirectUri(
  provider: OAuthProvider,
  environment: Record<string, string | undefined> = process.env,
): string {
  const baseUrl = parseOAuthEnv(environment).APP_BASE_URL;
  return new URL(`/api/auth/oauth/${provider}/callback`, baseUrl).href;
}

export async function buildOAuthAuthorizationUrl(
  input: OAuthAuthorizationInput,
  environment: Record<string, string | undefined> = process.env,
): Promise<URL> {
  const settings = getProviderSettings(input.provider, parseOAuthEnv(environment));
  const configuration = await getConfiguration(input.provider, settings);
  const codeChallenge = await oidc.calculatePKCECodeChallenge(input.codeVerifier);

  return oidc.buildAuthorizationUrl(configuration, {
    redirect_uri: getOAuthRedirectUri(input.provider, environment),
    response_type: "code",
    scope: settings.scope,
    state: input.state,
    nonce: input.nonce,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
}

export async function exchangeOAuthAuthorizationCode(
  input: OAuthCallbackInput,
  environment: Record<string, string | undefined> = process.env,
): Promise<OAuthIdentity> {
  const settings = getProviderSettings(input.provider, parseOAuthEnv(environment));
  const configuration = await getConfiguration(input.provider, settings);

  try {
    const tokens = await oidc.authorizationCodeGrant(
      configuration,
      input.callbackUrl,
      {
        expectedState: input.state,
        expectedNonce: input.nonce,
        pkceCodeVerifier: input.codeVerifier,
        idTokenExpected: true,
      },
    );
    const claims = tokens.claims();
    if (!claims) throw new Error("OIDC provider returned no ID token claims");

    const parsed = z.object({
      sub: z.string().min(1),
      email: z.email(),
      email_verified: z.literal(true),
    }).safeParse(claims);
    if (!parsed.success) {
      throw new AuthError(
        "OAUTH_EMAIL_REQUIRED",
        "Google 계정에서 인증된 이메일을 확인할 수 없습니다.",
      );
    }
    return {
      provider: "google",
      providerAccountId: parsed.data.sub,
      email: parsed.data.email,
    };
  } catch (error) {
    if (error instanceof AuthError) throw error;
    throw new AuthError(
      "OAUTH_PROVIDER_REJECTED",
      "소셜 로그인을 완료하지 못했습니다. 다시 시도해 주세요.",
      error,
    );
  }
}

function getProviderSettings(
  _provider: OAuthProvider,
  environment: OAuthEnv,
): ProviderSettings {
  const clientId = environment.GOOGLE_CLIENT_ID;
  const clientSecret = environment.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new AuthError(
      "OAUTH_NOT_CONFIGURED",
      "요청한 소셜 로그인이 아직 설정되지 않았습니다.",
    );
  }

  return {
    clientId,
    clientSecret,
    issuer: "https://accounts.google.com",
    scope: "openid email",
  };
}

function getConfiguration(
  provider: OAuthProvider,
  settings: ProviderSettings,
): Promise<oidc.Configuration> {
  const cacheKey = `${provider}:${settings.clientId}`;
  const existing = configurationCache.get(cacheKey);
  if (existing) return existing;

  const configuration = oidc.discovery(
    new URL(settings.issuer),
    settings.clientId,
    { client_secret: settings.clientSecret },
    oidc.ClientSecretPost(settings.clientSecret),
  );
  configurationCache.set(cacheKey, configuration);
  configuration.catch(() => configurationCache.delete(cacheKey));
  return configuration;
}
