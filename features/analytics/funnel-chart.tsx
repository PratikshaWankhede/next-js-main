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
import { Bar, BarChart, XAxis, YAxis } from "recharts";
import { useCallback, useEffect, useState } from "react";

interface FunnelData {
  stages: { stage: string; count: number }[];
  conversionRates: Record<string, number>;
}

const STAGE_COLORS: Record<string, string> = {
  new: "var(--chart-1)",
  contacted: "var(--chart-2)",
  interested: "var(--chart-3)",
  done: "var(--chart-4)",
  lost: "var(--chart-5)",
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
  count: { label: "Leads", color: "var(--chart-1)" },
  new: { label: "New", color: STAGE_COLORS.new },
  contacted: { label: "Contacted", color: STAGE_COLORS.contacted },
  interested: { label: "Interested", color: STAGE_COLORS.interested },
  done: { label: "Done", color: STAGE_COLORS.done },
  lost: { label: "Lost", color: STAGE_COLORS.lost },
};

export function FunnelChart() {
  const [dateRange, setDateRange] = useState("30d");
  const [data, setData] = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchFunnel = useCallback(async () => {
    setLoading(true);
    const { from, to } = getDateRange(dateRange);
    try {
      const res = await fetch(
        `/api/analytics/funnel?from=${from}&to=${to}`
      );
      const json = await res.json();
      if (res.ok) {
        setData(json);
      } else {
        setData({ stages: [], conversionRates: {} });
      }
    } catch {
      setData({ stages: [], conversionRates: {} });
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchFunnel();
  }, [fetchFunnel]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Conversion Funnel</CardTitle>
          <CardDescription>
            Lead movement across stages
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

  const chartData = (data?.stages ?? []).map((s) => ({
    name: s.stage.charAt(0).toUpperCase() + s.stage.slice(1),
    count: s.count,
    stage: s.stage,
  }));

  const maxCount = Math.max(...chartData.map((d) => d.count), 1);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle>Conversion Funnel</CardTitle>
          <CardDescription>
            Lead movement across stages (New → Contacted → Interested → Done/Lost)
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
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-muted-foreground">
            No data for this period
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-64 w-full">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ left: 60, right: 20 }}
            >
              <XAxis type="number" domain={[0, maxCount]} />
              <YAxis
                type="category"
                dataKey="name"
                width={55}
                tick={{ fontSize: 12 }}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name, item) => {
                      const stage = (item?.payload as { stage?: string })
                        ?.stage;
                      const rate =
                        stage && data?.conversionRates
                          ? data.conversionRates[stage]
                          : null;
                      const drop =
                        rate !== null && rate !== undefined
                          ? ` (${100 - rate}% drop from previous)`
                          : "";
                      return [`${value} leads${drop}`, name];
                    }}
                  />
                }
              />
              <Bar
                dataKey="count"
                fill="var(--chart-1)"
                radius={[0, 4, 4, 0]}
                fillOpacity={0.8}
              />
            </BarChart>
          </ChartContainer>
        )}
        {data?.conversionRates &&
          Object.keys(data.conversionRates).length > 0 && (
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              {Object.entries(data.conversionRates).map(([stage, rate]) => (
                <span key={stage} className="text-muted-foreground">
                  <span className="font-medium capitalize">{stage}</span>{" "}
                  conversion: {rate}%
                </span>
              ))}
            </div>
          )}
      </CardContent>
    </Card>
  );
}
