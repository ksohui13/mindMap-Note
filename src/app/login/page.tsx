import { redirect } from "next/navigation";

import { AuthScreen } from "@/features/auth/components/auth-screen";
import { getEnabledOAuthProviders } from "@/server/auth/oauth-provider";
import { getCurrentUser } from "@/server/auth/session";
import { getOAuthErrorMessage } from "@/shared/auth/oauth";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{ oauthError?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  if (await getCurrentUser()) redirect("/");
  const rawError = (await searchParams).oauthError;
  const errorCode = Array.isArray(rawError) ? rawError[0] : rawError;
  return (
    <AuthScreen
      enabledOAuthProviders={getEnabledOAuthProviders()}
      oauthError={getOAuthErrorMessage(errorCode)}
    />
  );
}
