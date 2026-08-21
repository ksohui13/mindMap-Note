import { redirect } from "next/navigation";

import { AuthScreen } from "@/features/auth/components/auth-screen";
import { getCurrentUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return <AuthScreen />;
}
