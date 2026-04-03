export type LeadEventType =
  | "follow-up"
  | "new_lead"
  | "stage_change"
  | "sla_breached"
  | "booking";

export interface LeadCalendarEvent {
  id: string;
  type: LeadEventType;
  date: Date;
  title: string;
  leadId: string;
  leadName: string;
  status?: "pending" | "completed" | "missed";
  metadata?: Record<string, unknown>;
  time: string;
  color: string;
  attendees: string[];
  location: string;
  duration: string;
}

export interface CalendarEvent {
  id: number | string;
  title: string;
  date: Date;
  time: string;
  duration: string;
  type:
    | "meeting"
    | "event"
    | "personal"
    | "task"
    | "reminder"
    | LeadEventType;
  attendees: string[];
  location: string;
  color: string;
  description?: string;
  leadId?: string;
  leadName?: string;
  status?: "pending" | "completed" | "missed";
}

export interface Calendar {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  type: "personal" | "work" | "shared";
}

const EVENT_TYPE_COLORS: Record<LeadEventType | string, string> = {
  "follow-up": "bg-amber-500",
  new_lead: "bg-blue-500",
  stage_change: "bg-violet-500",
  sla_breached: "bg-red-500",
  booking: "bg-emerald-500",
  "follow-up-pending": "bg-amber-500",
  "follow-up-completed": "bg-green-500",
  "follow-up-missed": "bg-red-500",
};

export function getLeadEventColor(
  type: LeadEventType,
  status?: "pending" | "completed" | "missed"
): string {
  if (type === "follow-up" && status) {
    return EVENT_TYPE_COLORS[`follow-up-${status}`] ?? "bg-amber-500";
  }
  return EVENT_TYPE_COLORS[type] ?? "bg-gray-500";
}

export function apiEventToCalendarEvent(
  apiEvent: {
    id: string;
    type: LeadEventType;
    date: string;
    title: string;
    leadId: string;
    leadName: string;
    status?: "pending" | "completed" | "missed";
  }
): CalendarEvent {
  const date = new Date(apiEvent.date);
  return {
    id: apiEvent.id,
    title: apiEvent.title,
    date,
    time: date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }),
    duration: apiEvent.type === "follow-up" ? "1 hour" : "",
    type: apiEvent.type,
    attendees: [apiEvent.leadName],
    location: "",
    color: getLeadEventColor(apiEvent.type, apiEvent.status),
    leadId: apiEvent.leadId,
    leadName: apiEvent.leadName,
    status: apiEvent.status,
  };
}
