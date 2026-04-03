"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCallback, useEffect, useState } from "react";
import { Line, LineChart, XAxis, YAxis } from "recharts";
import { format } from "date-fns";

interface SlaData {
  totalLeads: number;
  slaMet: number;
  slaBreached: number;
  slaMetPct: number;
  slaBreachedPct: number;
  avgResponseDelaySeconds: number | null;
  breachesPerDay: { date: string; count: number }[];
}

function getDateRange(preset: string): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  switch (preset) {
    case "7d":
      from.setDate(from.getDate() - 7);
      break;
    case "30d":
      from.setDate(from.getDate() - 30);
      break;
    case "90d":
      from.setDate(from.getDate() - 90);
      break;
    case "1y":
      from.setFullYear(from.getFullYear() - 1);
      break;
    default:
      from.setDate(from.getDate() - 30);
  }
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

const chartConfig = {
  count: { label: "Breaches", color: "var(--chart-1)" },
};

interface SlaDashboardProps {
  userId?: string | null;
}

export function SlaDashboard({ userId }: SlaDashboardProps) {
  const [dateRange, setDateRange] = useState("30d");
  const [data, setData] = useState<SlaData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { from, to } = getDateRange(dateRange);
    const params = new URLSearchParams({ from, to });
    if (userId) params.set("userId", userId);
    try {
      const res = await fetch(`/api/analytics/sla?${params}`);
      const json = await res.json();
      if (res.ok) {
        setData(json);
      } else {
        setData(null);
      }
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [dateRange, userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>SLA Compliance</CardTitle>
          <CardDescription>
            How well the team respects SLAs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-64 items-center justify-center text-muted-foreground">
            Loading...
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = (data?.breachesPerDay ?? []).map((d) => ({
    date: format(new Date(d.date), "MMM d"),
    count: d.count,
  }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle>SLA Compliance</CardTitle>
          <CardDescription>
            How well the team respects SLAs
            {userId ? " (filtered by user)" : ""}
          </CardDescription>
        </div>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="1y">Last year</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>SLA Met %</CardDescription>
              <CardTitle className="text-2xl text-green-600 dark:text-green-400">
                {data?.slaMetPct ?? 0}%
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>SLA Breached %</CardDescription>
              <CardTitle className="text-2xl text-red-600 dark:text-red-400">
                {data?.slaBreachedPct ?? 0}%
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Leads</CardDescription>
              <CardTitle className="text-2xl">
                {data?.totalLeads ?? 0}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Avg Response Delay</CardDescription>
              <CardTitle className="text-2xl">
                {data?.avgResponseDelaySeconds != null
                  ? `${Math.round(data.avgResponseDelaySeconds)}s`
                  : "-"}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {chartData.length > 0 ? (
          <ChartContainer config={chartConfig} className="h-64 w-full">
            <LineChart data={chartData}>
              <XAxis dataKey="date" />
              <YAxis />
              <ChartTooltip
                content={<ChartTooltipContent />}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="var(--chart-1)"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ChartContainer>
        ) : (
          <div className="flex h-64 items-center justify-center text-muted-foreground">
            No breach data for this period
          </div>
        )}
      </CardContent>
    </Card>
  );
}
