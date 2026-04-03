"use client";

import { AiImpactDashboard } from "@/features/analytics/ai-impact-dashboard";
import { ChannelPerformance } from "@/features/analytics/channel-performance";
import { FunnelChart } from "@/features/analytics/funnel-chart";
import { FollowUpDashboard } from "@/features/analytics/follow-up-dashboard";
import { SalesPerformanceTable } from "@/features/analytics/sales-performance-table";
import { SlaDashboard } from "@/features/analytics/sla-dashboard";
import { ChartBar, Loader2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AnalyticsPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => {
        setIsAdmin(data.role === "admin");
      })
      .catch(() => {
        setIsAdmin(false);
      });
  }, []);

  const handleUserSelect = useCallback((userId: string | null) => {
    setSelectedUserId(userId);
  }, []);

  if (isAdmin === false) {
    return (
      <div className="px-4 py-4 lg:px-6">
        <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <ChartBar className="size-12 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Access Restricted</h2>
          <p className="text-muted-foreground max-w-sm">
            Analytics are only visible to administrators.
          </p>
          <Link
            href="/leads"
            className="text-sm text-primary hover:underline cursor-pointer"
          >
            Back to Leads
          </Link>
        </div>
      </div>
    );
  }

  if (isAdmin === null) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="px-4 py-4 lg:px-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">
          Business intelligence and conversion metrics. Admin only.
        </p>
      </div>

      <Tabs defaultValue="funnel" className="space-y-4">
        <TabsList className="flex flex-wrap gap-2">
          <TabsTrigger value="funnel">Funnel</TabsTrigger>
          <TabsTrigger value="sales">Sales Performance</TabsTrigger>
          <TabsTrigger value="sla">SLA</TabsTrigger>
          <TabsTrigger value="followups">Follow-Ups</TabsTrigger>
          <TabsTrigger value="channels">Channels</TabsTrigger>
          <TabsTrigger value="ai">AI Impact</TabsTrigger>
        </TabsList>
        <TabsContent value="funnel" className="space-y-4">
          <FunnelChart />
        </TabsContent>
        <TabsContent value="sales" className="space-y-4">
          <SalesPerformanceTable onUserSelect={handleUserSelect} />
        </TabsContent>
        <TabsContent value="sla" className="space-y-4">
          <SlaDashboard userId={selectedUserId} />
        </TabsContent>
        <TabsContent value="followups" className="space-y-4">
          <FollowUpDashboard />
        </TabsContent>
        <TabsContent value="channels" className="space-y-4">
          <ChannelPerformance />
        </TabsContent>
        <TabsContent value="ai" className="space-y-4">
          <AiImpactDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
