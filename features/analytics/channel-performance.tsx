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
import { Cell, Pie, PieChart } from "recharts";

interface ChannelData {
  source: string;
  leadsCreated: number;
  conversionRate: number;
  avgResponseTimeSeconds: number | null;
  slaBreachRate: number;
}

const CHANNEL_COLORS: Record<string, string> = {
  whatsapp: "var(--chart-1)",
  instagram: "var(--chart-2)",
  manual: "var(--chart-3)",
  referral: "var(--chart-4)",
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

const chartConfig: Record<string, { label: string; color: string }> = {
  whatsapp: { label: "WhatsApp", color: CHANNEL_COLORS.whatsapp },
  instagram: { label: "Instagram", color: CHANNEL_COLORS.instagram },
  manual: { label: "Manual", color: CHANNEL_COLORS.manual },
  referral: { label: "Referral", color: CHANNEL_COLORS.referral },
};

export function ChannelPerformance() {
  const [dateRange, setDateRange] = useState("30d");
  const [data, setData] = useState<ChannelData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { from, to } = getDateRange(dateRange);
    try {
      const res = await fetch(
        `/api/analytics/channels?from=${from}&to=${to}`
      );
      const json = await res.json();
      if (res.ok) {
        setData(json.channels ?? []);
      } else {
        setData([]);
      }
    } catch {
      setData([]);
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
          <CardTitle>Channel Performance</CardTitle>
          <CardDescription>
            Which channel converts best?
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

  const pieData = data
    .filter((c) => c.leadsCreated > 0)
    .map((c) => ({
      name: c.source.charAt(0).toUpperCase() + c.source.slice(1),
      value: c.leadsCreated,
      fill: CHANNEL_COLORS[c.source] ?? "var(--muted-foreground)",
    }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle>Channel Performance</CardTitle>
          <CardDescription>
            Which channel converts best? (WhatsApp, Instagram, Manual, Referral)
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
        <div className="grid gap-6 md:grid-cols-2">
          {pieData.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-64 w-full">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          ) : (
            <div className="flex h-64 items-center justify-center text-muted-foreground">
              No lead data for this period
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Channel</TableHead>
                <TableHead>Leads</TableHead>
                <TableHead>Conversion %</TableHead>
                <TableHead>Avg Response</TableHead>
                <TableHead>SLA Breach %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((ch) => (
                <TableRow key={ch.source}>
                  <TableCell className="font-medium capitalize">
                    {ch.source}
                  </TableCell>
                  <TableCell>{ch.leadsCreated}</TableCell>
                  <TableCell>{ch.conversionRate}%</TableCell>
                  <TableCell>
                    {ch.avgResponseTimeSeconds != null
                      ? `${Math.round(ch.avgResponseTimeSeconds)}s`
                      : "-"}
                  </TableCell>
                  <TableCell>{ch.slaBreachRate}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
