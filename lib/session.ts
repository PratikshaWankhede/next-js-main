import { authOptions } from "@/lib/nextauth";
import { getServerSession as getNextAuthServerSession } from "next-auth/next";

export async function getServerSession() {
  return getNextAuthServerSession(authOptions);
}

export async function isAuthenticated(): Promise<boolean> {
  const session = await getServerSession();
  return !!session?.user?.id;
}

export async function getSessionWithRole() {
  const { getSessionWithRole: getWithRole } = await import("@/lib/rbac");
  return getWithRole();
}
