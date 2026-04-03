"use client";

import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { EventTypeFilter } from "./event-type-filters";
import type { CalendarEvent } from "../utils/types";
import type { LeadEventType } from "../utils/types";
import { useCalendar } from "../utils/use-calendar";
import { CalendarMain } from "./calendar-main";
import { CalendarSidebar } from "./calendar-sidebar";
import { ScheduleFollowUpForm } from "./schedule-follow-up-form";

interface CalendarProps {
  events: CalendarEvent[];
  eventDates: Array<{ date: Date; count: number }>;
  eventTypeFilters?: EventTypeFilter[];
  onEventTypeToggle?: (type: LeadEventType) => void;
  onMonthChange?: (from: Date, to: Date) => void;
  onEventSuccess?: () => void;
}

export function Calendar({
  events,
  eventDates,
  eventTypeFilters = [],
  onEventTypeToggle,
  onMonthChange,
  onEventSuccess,
}: CalendarProps) {
  const router = useRouter();
  const calendar = useCalendar(events);

  const handleEventClick = (event: CalendarEvent) => {
    if (event.leadId) {
      router.push(`/leads/${event.leadId}`);
    } else {
      calendar.handleEditEvent(event);
    }
  };

  const handleNewEvent = () => {
    calendar.setEditingEvent(null);
    calendar.setShowEventForm(true);
  };

  return (
    <>
      <div className="border rounded-lg bg-background relative">
        <div className="flex min-h-[800px]">
          {/* Desktop Sidebar - Hidden on mobile/tablet, shown on extra large screens */}
          <div className="hidden xl:block w-80 shrink-0 border-r">
            <CalendarSidebar
              selectedDate={calendar.selectedDate}
              onDateSelect={calendar.handleDateSelect}
              onNewEvent={handleNewEvent}
              events={eventDates}
              eventTypeFilters={eventTypeFilters}
              onEventTypeToggle={onEventTypeToggle}
              className="h-full"
            />
          </div>

          {/* Main Calendar Panel */}
          <div className="flex-1 min-w-0">
            <CalendarMain
              selectedDate={calendar.selectedDate}
              onDateSelect={calendar.handleDateSelect}
              onMenuClick={() => calendar.setShowCalendarSheet(true)}
              events={calendar.events}
              onEventClick={handleEventClick}
              onMonthChange={onMonthChange}
            />
          </div>
        </div>

        {/* Mobile/Tablet Sheet - Positioned relative to calendar container */}
        <Sheet
          open={calendar.showCalendarSheet}
          onOpenChange={calendar.setShowCalendarSheet}
        >
          <SheetContent
            side="left"
            className="w-80 p-0"
            style={{ position: "absolute" }}
          >
            <SheetHeader className="p-4 pb-2">
              <SheetTitle>Calendar</SheetTitle>
              <SheetDescription>
                Browse dates and track your leads
              </SheetDescription>
            </SheetHeader>
            <CalendarSidebar
              selectedDate={calendar.selectedDate}
              onDateSelect={calendar.handleDateSelect}
              onNewEvent={handleNewEvent}
              events={eventDates}
              eventTypeFilters={eventTypeFilters}
              onEventTypeToggle={onEventTypeToggle}
              className="h-full"
            />
          </SheetContent>
        </Sheet>
      </div>

      {/* Schedule Follow-up Form */}
      <ScheduleFollowUpForm
        open={calendar.showEventForm}
        onOpenChange={calendar.setShowEventForm}
        defaultDate={calendar.selectedDate}
        onSuccess={onEventSuccess}
      />
    </>
  );
}
