import { db } from "@/db";
import { USER } from "@/db/collections";

/** CRM roles: admin sees org-wide data; sales and follow_up_candidate are scoped to assigned leads (see canAccessLead, dashboard summary). */
export type UserRole = "admin" | "sales" | "follow_up_candidate";

export interface SessionWithRole {
  user: { id: string; name: string; email: string; image?: string | null };
  role: UserRole;
}

export async function getSessionWithRole(): Promise<SessionWithRole | null> {
  const { getServerSession } = await import("@/lib/session");
  const session = await getServerSession();
  if (!session?.user?.id) return null;

  const dbUser = await db.collection(USER).findOne<{ role?: string }>({
    id: session.user.id,
  });
  const roleFromSession =
    typeof (session.user as { role?: unknown }).role === "string"
      ? ((session.user as { role: string }).role as UserRole)
      : undefined;
  const role = (roleFromSession ??
    (dbUser?.role as UserRole) ??
    "sales") as UserRole;
  return {
    user: {
      id: session.user.id,
      name: session.user.name ?? "",
      email: session.user.email ?? "",
      image: session.user.image ?? null,
    },
    role,
  };
}

export function requireAuth(
  session: SessionWithRole | null,
): asserts session is SessionWithRole {
  if (!session) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export function requireAdmin(session: SessionWithRole): void {
  if (session.role !== "admin") {
    throw new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export function canAccessLead(
  session: SessionWithRole,
  lead: { assignedUserId?: string | null },
): boolean {
  if (session.role === "admin") return true;
  if (session.role === "sales" || session.role === "follow_up_candidate") {
    return lead.assignedUserId === session.user.id;
  }
  return false;
}
