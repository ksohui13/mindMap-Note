import { DashboardScreen } from "@/features/dashboard/components/dashboard-screen";
import { requireCurrentUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await requireCurrentUser();
  return <DashboardScreen user={{ email: user.email }} />;
}
