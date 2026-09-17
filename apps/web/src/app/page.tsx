import { auth } from "@tccpet/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  redirect(session?.user ? "/dashboard" : "/login");
}
