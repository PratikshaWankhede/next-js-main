"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type AiScore = "hot" | "warm" | "cold";

const SCORE_COLORS: Record<AiScore, string> = {
  hot: "bg-red-500/20 text-red-700 dark:text-red-400",
  warm: "bg-amber-500/20 text-amber-700 dark:text-amber-400",
  cold: "bg-blue-500/20 text-blue-700 dark:text-blue-400",
};

const SCORE_LABELS: Record<AiScore, string> = {
  hot: "Hot",
  warm: "Warm",
  cold: "Cold",
};

interface LeadScoreBadgeProps {
  score: AiScore | null;
  reason: string | null;
  className?: string;
}

export function LeadScoreBadge({
  score,
  reason,
  className,
}: LeadScoreBadgeProps) {
  if (!score) return null;

  const colorClass = SCORE_COLORS[score];
  const label = SCORE_LABELS[score];

  const badge = (
    <Badge
      variant="secondary"
      className={cn(
        "text-[10px] border-0 shrink-0 capitalize",
        colorClass,
        className
      )}
    >
      {label}
    </Badge>
  );

  if (reason) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>
          <p className="max-w-[250px]">{reason}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return badge;
}
