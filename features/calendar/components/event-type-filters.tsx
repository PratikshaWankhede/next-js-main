"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LeadEventType } from "../utils/types";

export interface EventTypeFilter {
  type: LeadEventType;
  label: string;
  color: string;
  visible: boolean;
}

const DEFAULT_FILTERS: EventTypeFilter[] = [
  { type: "follow-up", label: "Follow-ups", color: "bg-amber-500", visible: true },
  { type: "new_lead", label: "New Leads", color: "bg-blue-500", visible: true },
  {
    type: "stage_change",
    label: "Stage Changes",
    color: "bg-violet-500",
    visible: true,
  },
  {
    type: "sla_breached",
    label: "SLA Breached",
    color: "bg-red-500",
    visible: true,
  },
];

interface EventTypeFiltersProps {
  filters: EventTypeFilter[];
  onToggle: (type: LeadEventType) => void;
}

export function EventTypeFilters({ filters, onToggle }: EventTypeFiltersProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground px-2">
        Event types
      </p>
      <div className="space-y-1">
        {filters.map((filter) => (
          <div
            key={filter.type}
            className="group/calendar-item flex items-center gap-3 p-2 hover:bg-violet-500/5 rounded-md cursor-pointer"
            onClick={() => onToggle(filter.type)}
          >
            <div
              className={cn(
                "flex aspect-square size-4 shrink-0 items-center justify-center rounded-sm border transition-all",
                filter.visible
                  ? cn("border-transparent text-white", filter.color)
                  : "border-border bg-transparent",
              )}
            >
              {filter.visible && <Check className="size-3" />}
            </div>
            <span
              className={cn(
                "flex-1 text-sm",
                !filter.visible && "text-muted-foreground",
              )}
            >
              {filter.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export { DEFAULT_FILTERS };
