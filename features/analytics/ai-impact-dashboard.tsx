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

interface AiScoreData {
  score: string;
  leadsCount: number;
  conversionRate: number;
  avgTimeToDoneSeconds: number | null;
}

interface AiImpactData {
  byScore: AiScoreData[];
  leadsWithAiUsage: number;
  totalLeads: number;
  aiUsagePct: number;
}

const SCORE_COLORS: Record<string, string> = {
  hot: "var(--chart-1)",
  warm: "var(--chart-2)",
  cold: "var(--chart-3)",
};

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
  leadsCount: { label: "Leads", color: "var(--chart-1)" },
  conversionRate: { label: "Conversion %", color: "var(--chart-2)" },
};

export function AiImpactDashboard() {
  const [dateRange, setDateRange] = useState("30d");
  const [data, setData] = useState<AiImpactData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { from, to } = getDateRange(dateRange);
    try {
      const res = await fetch(
        `/api/analytics/ai-impact?from=${from}&to=${to}`
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
          <CardTitle>AI Effectiveness</CardTitle>
          <CardDescription>
            Does AI actually help?
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

  const chartData = (data?.byScore ?? []).map((s) => ({
    name: s.score.charAt(0).toUpperCase() + s.score.slice(1),
    leadsCount: s.leadsCount,
    conversionRate: s.conversionRate,
    fill: SCORE_COLORS[s.score] ?? "var(--muted-foreground)",
  }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle>AI Effectiveness</CardTitle>
          <CardDescription>
            Does AI actually help? Conversion by AI score (hot/warm/cold)
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
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Leads with AI Score</CardDescription>
              <CardTitle className="text-2xl">
                {data?.leadsWithAiUsage ?? 0} / {data?.totalLeads ?? 0}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {data?.aiUsagePct ?? 0}% of leads have AI scoring
              </p>
            </CardContent>
          </Card>
        </div>

        {chartData.length > 0 ? (
          <ChartContainer config={chartConfig} className="h-64 w-full">
            <BarChart data={chartData}>
              <XAxis dataKey="name" />
              <YAxis />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="leadsCount" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="flex h-64 items-center justify-center text-muted-foreground">
            No AI score data for this period
          </div>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>AI Score</TableHead>
              <TableHead>Leads</TableHead>
              <TableHead>Conversion %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.byScore ?? []).map((s) => (
              <TableRow key={s.score}>
                <TableCell className="font-medium capitalize">
                  {s.score}
                </TableCell>
                <TableCell>{s.leadsCount}</TableCell>
                <TableCell>{s.conversionRate}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
