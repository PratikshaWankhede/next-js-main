"use client";

import { useCallback, useEffect, useState } from "react";
import { endOfMonth, startOfMonth } from "date-fns";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Calendar } from "@/features/calendar/components/calendar";
import {
  DEFAULT_FILTERS,
  type EventTypeFilter,
} from "@/features/calendar/components/event-type-filters";
import {
  apiEventToCalendarEvent,
  type CalendarEvent,
} from "@/features/calendar/utils/types";
import type { LeadEventType } from "@/features/calendar/utils/types";
import { cn } from "@/lib/utils";
import {
  ArrowUpRight,
  CalendarDays,
  Calendar as CalendarIcon,
  Clock,
  Loader2,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<{
    from: Date;
    to: Date;
  }>(() => {
    const now = new Date();
    return {
      from: startOfMonth(now),
      to: endOfMonth(now),
    };
  });
  const [eventTypeFilters, setEventTypeFilters] =
    useState<EventTypeFilter[]>(DEFAULT_FILTERS);

  const fetchEvents = useCallback(async (from: Date, to: Date) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/calendar/events?from=${from.toISOString()}&to=${to.toISOString()}`
      );
      const json = await res.json();

      if (!res.ok) {
        setEvents([]);
        return;
      }

      const apiEvents = json.events ?? [];
      setEvents(
        apiEvents.map((e: (typeof apiEvents)[0]) => apiEventToCalendarEvent(e))
      );
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents(dateRange.from, dateRange.to);
  }, [dateRange.from, dateRange.to, fetchEvents]);

  const handleMonthChange = useCallback((from: Date, to: Date) => {
    setDateRange((prev) => {
      if (
        prev.from.getTime() === from.getTime() &&
        prev.to.getTime() === to.getTime()
      ) {
        return prev;
      }
      return { from, to };
    });
  }, []);

  const handleEventSuccess = useCallback(() => {
    fetchEvents(dateRange.from, dateRange.to);
  }, [dateRange.from, dateRange.to, fetchEvents]);

  const handleEventTypeToggle = useCallback((type: LeadEventType) => {
    setEventTypeFilters((prev) =>
      prev.map((f) =>
        f.type === type ? { ...f, visible: !f.visible } : f,
      ),
    );
  }, []);

  const visibleTypes = new Set(
    eventTypeFilters.filter((f) => f.visible).map((f) => f.type),
  );
  const filteredEvents = events.filter((e) =>
    visibleTypes.has(e.type as LeadEventType),
  );

  const followUps = events.filter((e) => e.type === "follow-up");
  const newLeads = events.filter((e) => e.type === "new_lead");
  const stageChanges = events.filter((e) => e.type === "stage_change");
  const slaBreached = events.filter((e) => e.type === "sla_breached");

  const performanceMetrics = [
    {
      title: "Total Events",
      current: events.length.toString(),
      previous: "0",
      growth: events.length > 0 ? 100 : 0,
      icon: CalendarDays,
    },
    {
      title: "Follow-ups",
      current: followUps.length.toString(),
      previous: "0",
      growth: followUps.length > 0 ? 100 : 0,
      icon: Users,
    },
    {
      title: "New Leads",
      current: newLeads.length.toString(),
      previous: "0",
      growth: newLeads.length > 0 ? 100 : 0,
      icon: Clock,
    },
    {
      title: "Stage Changes",
      current: stageChanges.length.toString(),
      previous: "0",
      growth: stageChanges.length > 0 ? 100 : 0,
      icon: CalendarIcon,
    },
  ];

  const eventDates = filteredEvents.reduce(
    (acc, e) => {
      const key = e.date.toISOString().slice(0, 10);
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const eventDatesArray = Object.entries(eventDates).map(([date, count]) => ({
    date: new Date(date),
    count,
  }));

  return (
    <>
      <div className="px-4 lg:px-6 py-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
          <p className="text-muted-foreground">
            Track your leads: follow-ups, new leads, stage changes, and SLA
          </p>
        </div>
      </div>

      <div className="@container/main px-4 lg:px-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {performanceMetrics.map((metric, index) => (
            <Card key={index} className="border">
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <metric.icon className="text-muted-foreground size-6" />
                  <Badge
                    variant="outline"
                    className={cn(
                      metric.growth >= 0
                        ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/20 dark:text-green-400"
                        : "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/20 dark:text-red-400",
                    )}
                  >
                    {metric.growth >= 0 ? (
                      <>
                        <TrendingUp className="me-1 size-3" />+{metric.growth}%
                      </>
                    ) : (
                      <>
                        <TrendingDown className="me-1 size-3" />
                        {metric.growth}%
                      </>
                    )}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <p className="text-muted-foreground text-sm font-medium">
                    {metric.title}
                  </p>
                  <div className="text-2xl font-bold">{metric.current}</div>
                  <div className="text-muted-foreground flex items-center gap-2 text-sm">
                    <span>this month</span>
                    <ArrowUpRight className="size-3" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Calendar Card */}
        <Card className="border overflow-hidden">
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
            <CardDescription>
              View and manage your lead-related events
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex min-h-[400px] items-center justify-center">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Calendar
                events={filteredEvents}
                eventDates={eventDatesArray}
                eventTypeFilters={eventTypeFilters}
                onEventTypeToggle={handleEventTypeToggle}
                onMonthChange={handleMonthChange}
                onEventSuccess={handleEventSuccess}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
