import { auth } from "@tccpet/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import DashboardHome from "./dashboard-home";

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  return <DashboardHome />;
}
