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
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { useMemo } from "react";
import { Cell, Pie, PieChart } from "recharts";

export type DashboardPieDatum = {
  name: string;
  value: number;
  fill: string;
};

type PieInnerProps = {
  data: DashboardPieDatum[];
  emptyMessage?: string;
  compact?: boolean;
};

/**
 * Legend + full pie (no hole). Single slice uses 360° with no padding/stroke gap.
 */
export function DashboardPieVisualization({
  data,
  emptyMessage = "No data for this period",
  compact = false,
}: PieInnerProps) {
  const { resolvedTheme } = useTheme();
  const sliceStroke = useMemo(() => {
    if (resolvedTheme === "dark") return "hsl(240 10% 3.9%)";
    return "hsl(0 0% 100%)";
  }, [resolvedTheme]);

  const chartConfig = useMemo(() => {
    return Object.fromEntries(
      data.map((d, i) => [`slice_${i}`, { label: d.name, color: d.fill }]),
    );
  }, [data]);

  const hasData = data.some((d) => d.value > 0);
  const outer = compact ? 80 : 108;
  /** Full pie — no donut hole */
  const innerRadius = 0;
  const filtered = data.filter((d) => d.value > 0);
  const singleSlice = filtered.length <= 1;
  /** One category must fill the whole disk; paddingAngle otherwise leaves a “broken ring” */
  const paddingAngle = singleSlice ? 0 : 2;
  const strokeWidth = singleSlice ? 0 : 2;
  const cornerRadius = singleSlice ? 0 : 2;

  if (!hasData) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">{emptyMessage}</p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 px-1 text-sm">
        {filtered.map((d) => (
          <div key={d.name} className="flex items-center gap-2 text-foreground">
            <span
              className="size-3 shrink-0 rounded-sm border border-foreground/25 shadow-sm"
              style={{ backgroundColor: d.fill }}
              aria-hidden
            />
            <span className="text-muted-foreground">
              {d.name}{" "}
              <span className="font-medium text-foreground">({d.value})</span>
            </span>
          </div>
        ))}
      </div>
      <ChartContainer
        config={chartConfig}
        className={cn(
          "mx-auto aspect-auto w-full max-w-[280px]",
          compact ? "h-[200px]" : "h-[250px]",
        )}
      >
        <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <ChartTooltip content={<ChartTooltipContent />} />
          <Pie
            data={filtered}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outer}
            paddingAngle={paddingAngle}
            stroke={singleSlice ? "transparent" : sliceStroke}
            strokeWidth={strokeWidth}
            cornerRadius={cornerRadius}
          >
            {filtered.map((entry, i) => (
              <Cell key={`${entry.name}-${i}`} fill={entry.fill} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
    </div>
  );
}

type DashboardPieCardProps = PieInnerProps & {
  title: string;
  description?: string;
  className?: string;
};

export function DashboardPieCard({
  title,
  description,
  data,
  emptyMessage,
  compact,
  className,
}: DashboardPieCardProps) {
  return (
    <Card
      className={cn(
        "border bg-card shadow-md transition-shadow hover:shadow-lg",
        className,
      )}
    >
      <CardHeader className="space-y-1 pb-2 text-center">
        <CardTitle className="text-base font-bold tracking-tight">{title}</CardTitle>
        {description ? (
          <CardDescription className="text-center text-xs">{description}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="pt-0">
        <DashboardPieVisualization
          data={data}
          emptyMessage={emptyMessage}
          compact={compact}
        />
      </CardContent>
    </Card>
  );
}
