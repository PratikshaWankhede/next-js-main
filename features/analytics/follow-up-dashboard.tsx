"use client";

import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCallback, useEffect, useState } from "react";
import { Bar, BarChart, Cell, XAxis, YAxis } from "recharts";
import Link from "next/link";

interface FollowUpData {
  totalFollowUps: number;
  completed: number;
  missed: number;
  completionRate: number;
  missRate: number;
  avgFollowUpsPerLead: number;
  leadsLostAfterMisses: number;
  failedLeads: { id: string; name: string; stage: string }[];
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
  completed: { label: "Completed", color: "var(--chart-1)" },
  missed: { label: "Missed", color: "var(--chart-2)" },
};

export function FollowUpDashboard() {
  const [dateRange, setDateRange] = useState("30d");
  const [data, setData] = useState<FollowUpData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { from, to } = getDateRange(dateRange);
    try {
      const res = await fetch(
        `/api/analytics/follow-ups?from=${from}&to=${to}`
      );
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
  }, [dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Follow-Up Effectiveness</CardTitle>
          <CardDescription>
            Are follow-ups actually working?
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

  const barData = [
    { name: "Completed", value: data?.completed ?? 0, fill: "var(--chart-1)" },
    { name: "Missed", value: data?.missed ?? 0, fill: "var(--chart-2)" },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle>Follow-Up Effectiveness</CardTitle>
          <CardDescription>
            Are follow-ups actually working?
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
              <CardDescription>Total Follow-Ups</CardDescription>
              <CardTitle className="text-2xl">
                {data?.totalFollowUps ?? 0}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Completion Rate</CardDescription>
              <CardTitle className="text-2xl text-green-600 dark:text-green-400">
                {data?.completionRate ?? 0}%
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Miss Rate</CardDescription>
              <CardTitle className="text-2xl text-red-600 dark:text-red-400">
                {data?.missRate ?? 0}%
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Avg per Lead</CardDescription>
              <CardTitle className="text-2xl">
                {data?.avgFollowUpsPerLead ?? 0}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <ChartContainer config={chartConfig} className="h-64 w-full">
            <BarChart data={barData} layout="vertical" margin={{ left: 80 }}>
              <XAxis type="number" />
              <YAxis type="category" dataKey="name" width={70} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {barData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">
                Leads Lost After 5+ Misses
              </CardTitle>
              <CardDescription>
                Leads that had 5+ missed follow-ups and ended in lost stage
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {data?.leadsLostAfterMisses ?? 0}
              </p>
            </CardContent>
          </Card>
        </div>

        {data?.failedLeads && data.failedLeads.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-medium">Failed Leads (Drill-down)</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead className="w-20">Link</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.failedLeads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">{lead.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{lead.stage}</Badge>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/leads/${lead.id}`}
                        className="text-sm text-primary hover:underline"
                      >
                        View
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
