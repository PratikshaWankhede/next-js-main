import { KanbanBoard } from "@/features/kanban/components/kanban-board";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type LeadStage,
  STAGE_ORDER,
} from "@/features/leads/types/lead.types";
import { headers } from "next/headers";

interface LeadFromAPI {
  id: string;
  name: string;
  phone: string;
  source: string;
  stage: LeadStage;
  assignedUserId: string | null;
  assignedUserName: string | null;
  createdAt: string;
  updatedAt: string;
  slaStatus?: "pending" | "met" | "breached";
  firstResponseAt?: string | null;
}

function groupLeadsByStage(
  leads: LeadFromAPI[]
): Record<LeadStage, LeadFromAPI[]> {
  const grouped = STAGE_ORDER.reduce(
    (acc, stage) => {
      acc[stage] = [];
      return acc;
    },
    {} as Record<LeadStage, LeadFromAPI[]>
  );
  for (const lead of leads) {
    if (grouped[lead.stage]) {
      grouped[lead.stage].push(lead);
    }
  }
  return grouped;
}

async function fetchLeads() {
  const headersList = await headers();
  const cookieHeader = headersList.get("cookie") ?? "";
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

  const res = await fetch(`${baseUrl}/api/leads?limit=500`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });

  if (!res.ok) {
    return { leads: [], error: true };
  }

  const json = await res.json();
  return { leads: json.leads ?? [], error: false };
}

async function fetchMe() {
  const headersList = await headers();
  const cookieHeader = headersList.get("cookie") ?? "";
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

  const res = await fetch(`${baseUrl}/api/me`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });

  if (!res.ok) {
    return { role: "sales" as const, userId: null };
  }

  const json = await res.json();
  return {
    role: (json.role ?? "sales") as "admin" | "sales" | "follow_up_candidate",
    userId: json.user?.id ?? null,
  };
}

export default async function KanbanPage() {
  const [{ leads, error }, { role, userId }] = await Promise.all([
    fetchLeads(),
    fetchMe(),
  ]);

  const leadsByStage = groupLeadsByStage(leads);

  return (
    <>
      <div className="px-4 py-4 lg:px-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Sales Pipeline</h1>
          <p className="text-muted-foreground">
            Drag leads through stages. Click a card to view details.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-hidden px-4 pb-4 lg:px-6">
        <KanbanBoard
          initialLeadsByStage={leadsByStage}
          currentUserRole={role}
          currentUserId={userId}
          fetchError={error}
        />
      </div>
    </>
  );
}
