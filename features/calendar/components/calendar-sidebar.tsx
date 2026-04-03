"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DatePicker } from "./date-picker";
import {
  EventTypeFilters,
  type EventTypeFilter,
} from "./event-type-filters";
import type { LeadEventType } from "../utils/types";

interface CalendarSidebarProps {
  selectedDate?: Date;
  onDateSelect?: (date: Date) => void;
  onNewEvent?: () => void;
  events?: Array<{ date: Date; count: number }>;
  eventTypeFilters?: EventTypeFilter[];
  onEventTypeToggle?: (type: LeadEventType) => void;
  className?: string;
}

export function CalendarSidebar({
  selectedDate,
  onDateSelect,
  onNewEvent,
  events = [],
  eventTypeFilters = [],
  onEventTypeToggle,
  className,
}: CalendarSidebarProps) {
  return (
    <div
      className={`flex flex-col h-full bg-background rounded-lg ${className}`}
    >
      <div className="p-6 border-b">
        <Button
          className="w-full cursor-pointer bg-violet-500 hover:bg-violet-600"
          onClick={onNewEvent}
        >
          <Plus className="size-4" />
          Schedule Follow-up
        </Button>
      </div>

      <DatePicker
        selectedDate={selectedDate}
        onDateSelect={onDateSelect}
        events={events}
      />

      <Separator />

      <div className="flex-1 p-4 overflow-auto">
        <EventTypeFilters
          filters={eventTypeFilters}
          onToggle={onEventTypeToggle ?? (() => {})}
        />
      </div>
    </div>
  );
}
