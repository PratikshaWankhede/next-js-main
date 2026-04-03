"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useNotificationSocket } from "@/contexts/notification-socket-context";
import {
  DashboardPieCard,
  DashboardPieVisualization,
} from "@/features/dashboard/dashboard-pie-card";
import type { DashboardSummary } from "@/features/dashboard/types";
import { emptyDashboardSummary } from "@/features/dashboard/types";
import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  Flame,
  Inbox,
  Loader2,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/** Reference-style palette: clear contrast between slices */
const STAGE_CHART_COLORS: Record<string, string> = {
  new: "#6366f1",
  contacted: "#8b5cf6",
  interested: "#a855f7",
  follow_up: "#d946ef",
  booking: "#f97316",
  no_show: "#94a3b8",
  done: "#77C37D",
  lost: "#EF476F",
};

const SOURCE_COLORS: Record<string, string> = {
  whatsapp: "#25D366",
  instagram: "#E4405F",
  manual: "#6366f1",
  referral: "#f59e0b",
  website: "#0ea5e9",
};

const CONVERSION_DONE = "#77C37D";
const CONVERSION_BOOKED = "#f97316";
const CONVERSION_OTHER = "#94a3b8";

export function DashboardClient() {
  const [summary, setSummary] = useState<DashboardSummary>(emptyDashboardSummary);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState("7d");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const { unreadCount } = useNotificationSocket();
  const prevUnreadRef = useRef<number | null>(null);

  const timezone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
    } catch {
      return "UTC";
    }
  }, []);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("range", range);
      params.set("timezone", timezone);
      if (isAdmin && assigneeId) params.set("assignedUserId", assigneeId);
      const res = await fetch(`/api/dashboard/summary?${params.toString()}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as DashboardSummary & { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Failed to load dashboard");
        setSummary(emptyDashboardSummary());
        return;
      }
      setSummary({
        kpis: json.kpis ?? { activePipelineCount: 0 },
        todayActions: json.todayActions ?? emptyDashboardSummary().todayActions,
        conversion: json.conversion ?? emptyDashboardSummary().conversion,
        missedOpportunities:
          json.missedOpportunities ?? emptyDashboardSummary().missedOpportunities,
        leadCountsByStage: json.leadCountsByStage ?? [],
        leadCountsBySource: json.leadCountsBySource ?? [],
        hotLeads: json.hotLeads ?? [],
        followUps: json.followUps ?? emptyDashboardSummary().followUps,
        unreadNotifications: json.unreadNotifications ?? 0,
        topAssignees: json.topAssignees ?? [],
      });
    } catch {
      setError("Network error");
      setSummary(emptyDashboardSummary());
    } finally {
      setLoading(false);
      setHasLoadedOnce(true);
    }
  }, [range, timezone, isAdmin, assigneeId]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setIsAdmin(d.role === "admin"))
      .catch(() => setIsAdmin(false));
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/users?page=1&limit=100")
      .then((r) => r.json())
      .then((d) => {
        const list = d.users as { id: string; name: string }[];
        setUsers(Array.isArray(list) ? list : []);
      })
      .catch(() => setUsers([]));
  }, [isAdmin]);

  useEffect(() => {
    if (prevUnreadRef.current === null) {
      prevUnreadRef.current = unreadCount;
      return;
    }
    if (prevUnreadRef.current === unreadCount) return;
    prevUnreadRef.current = unreadCount;
    const t = window.setTimeout(() => {
      void loadSummary();
    }, 450);
    return () => window.clearTimeout(t);
  }, [unreadCount, loadSummary]);

  const stagePie = useMemo(() => {
    return summary.leadCountsByStage
      .filter((s) => s.count > 0)
      .map((s) => ({
        name: s.stage
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase()),
        value: s.count,
        fill: STAGE_CHART_COLORS[s.stage] ?? "#94a3b8",
      }));
  }, [summary.leadCountsByStage]);

  const sourcePie = useMemo(() => {
    return summary.leadCountsBySource
      .filter((s) => s.count > 0)
      .map((s) => ({
        name: s.source.charAt(0).toUpperCase() + s.source.slice(1),
        value: s.count,
        fill: SOURCE_COLORS[s.source] ?? "#94a3b8",
      }));
  }, [summary.leadCountsBySource]);

  const conversionPie = useMemo(() => {
    const c = summary.conversion;
    const other = Math.max(0, c.totalLeads - c.done - c.booked);
    const rows = [
      { name: "Done", value: c.done, fill: CONVERSION_DONE },
      { name: "Booked", value: c.booked, fill: CONVERSION_BOOKED },
      { name: "Other stages", value: other, fill: CONVERSION_OTHER },
    ];
    return rows.filter((r) => r.value > 0);
  }, [summary.conversion]);

  const todayMixPie = useMemo(() => {
    const t = summary.todayActions;
    const rows = [
      { name: "Overdue follow-ups", value: t.overdueFollowUps, fill: "#EF476F" },
      { name: "Due today", value: t.followUpsToday, fill: "#f59e0b" },
      { name: "New leads today", value: t.newLeadsToday, fill: "#77C37D" },
      { name: "Hot (AI)", value: t.hotLeads, fill: "#ea580c" },
    ];
    return rows.filter((r) => r.value > 0);
  }, [summary.todayActions]);

  if (loading && !hasLoadedOnce && !error) {
    return (
      <div className="space-y-6 px-4 py-4 lg:px-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const ta = summary.todayActions;
  const conv = summary.conversion;
  const mo = summary.missedOpportunities;

  return (
    <div className="space-y-8 px-4 py-4 lg:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            {loading && hasLoadedOnce && (
              <Loader2 className="text-muted-foreground size-4 animate-spin" aria-hidden />
            )}
          </div>
          <p className="text-muted-foreground">
            What to focus on today, then pipeline health for the selected period.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          {isAdmin && (
            <Select
              value={assigneeId || "__all__"}
              onValueChange={(v) => setAssigneeId(v === "__all__" ? "" : v)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All assignees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All assignees</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-center gap-2 py-4 text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </CardContent>
        </Card>
      )}

      {/* 1. Today Focus */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Today focus</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className={ta.overdueFollowUps > 0 ? "border-amber-500/50" : ""}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Overdue follow-ups</CardTitle>
              <CalendarClock className="text-muted-foreground size-4" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tabular-nums">{ta.overdueFollowUps}</p>
              <Button variant="link" className="h-auto px-0 pt-1" asChild>
                <Link href="/follow-ups">
                  View all follow-ups <ArrowRight className="ml-1 size-3" />
                </Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Due today</CardTitle>
              <Inbox className="text-muted-foreground size-4" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tabular-nums">{ta.followUpsToday}</p>
              <p className="text-muted-foreground text-xs">Scheduled for today</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">New leads today</CardTitle>
              <Users className="text-muted-foreground size-4" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tabular-nums">{ta.newLeadsToday}</p>
              <Button variant="link" className="h-auto px-0 pt-1" asChild>
                <Link href="/leads">Open leads</Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Hot leads (AI)</CardTitle>
              <Flame className="text-orange-500 size-4" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tabular-nums">{ta.hotLeads}</p>
              <p className="text-muted-foreground text-xs">Score = hot</p>
            </CardContent>
          </Card>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="default" size="sm">
            <Link href="/follow-ups">View all follow-ups</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/leads">Add or manage leads</Link>
          </Button>
        </div>
        {todayMixPie.length > 0 && (
          <DashboardPieCard
            title="Today's mix"
            description="Only categories with activity appear as slices."
            data={todayMixPie}
            compact
            className="max-w-xl"
          />
        )}
      </section>

      {/* 2. KPIs */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Pipeline & alerts</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Active pipeline</CardTitle>
              <CardDescription>Open leads (not done/lost, not exited)</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">
                {summary.kpis.activePipelineCount}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Unread notifications</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">
                {summary.unreadNotifications}
              </p>
              <Button variant="link" className="h-auto px-0 pt-1" asChild>
                <Link href="/notifications">Open inbox</Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Missed opportunities</CardTitle>
              <CardDescription>Lost + no-show in period</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">{mo.total}</p>
              <p className="text-muted-foreground text-xs">
                Lost {mo.lost} · No-show {mo.noShow}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Upcoming follow-ups</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">
                {summary.followUps.upcoming}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Conversion: metrics + donut (same visual language as reference) */}
      <Card className="border bg-card shadow-md">
        <CardHeader className="text-center sm:text-left">
          <CardTitle className="flex items-center justify-center gap-2 text-base font-bold sm:justify-start">
            <TrendingUp className="size-4" />
            Conversion (selected period)
          </CardTitle>
          <CardDescription>
            Close rate (done / leads in period). Donut shows Done, Booked, and other stages in range.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
              <div>
                <p className="text-muted-foreground text-xs">Leads in period</p>
                <p className="text-xl font-semibold tabular-nums">{conv.totalLeads}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Booked</p>
                <p className="text-xl font-semibold tabular-nums">{conv.booked}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Done</p>
                <p className="text-xl font-semibold tabular-nums">{conv.done}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Close rate</p>
                <p className="text-xl font-semibold tabular-nums">{conv.conversionRate}%</p>
              </div>
            </div>
            <div className="rounded-xl border border-dashed bg-muted/20 px-2 py-4">
              <DashboardPieVisualization
                data={conversionPie}
                compact
                emptyMessage="No leads in period for chart"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Charts — reference-style legend + donut */}
      <div className="grid gap-6 lg:grid-cols-2">
        <DashboardPieCard
          title="Leads by stage"
          description="Leads created in the selected period (all stages)."
          data={stagePie}
          emptyMessage="No leads in this period"
        />
        <DashboardPieCard
          title="Leads by source"
          description="Distribution for the same period."
          data={sourcePie}
          emptyMessage="No source data"
        />
      </div>

      {/* 4. Hot leads */}
      <Card>
        <CardHeader>
          <CardTitle>Priority leads (AI)</CardTitle>
          <CardDescription>Hot first, then warm and cold — by recency.</CardDescription>
        </CardHeader>
        <CardContent>
          {summary.hotLeads.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              No scored leads yet
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {summary.hotLeads.map((l) => (
                <li key={l.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="font-medium">{l.name}</p>
                    <p className="text-muted-foreground text-xs capitalize">{l.score}</p>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/leads/${l.id}`}>Open</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* 5. Admin: top assignees */}
      {isAdmin && summary.topAssignees.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Team performance</CardTitle>
            <CardDescription>
              Top assignees by volume in period (active users, min. 1 lead).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Close rate %</TableHead>
                  <TableHead className="text-right">FU completion %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.topAssignees.map((row) => (
                  <TableRow key={row.userId}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.totalLeads}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.conversionRate}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.followUpCompletionRate}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
