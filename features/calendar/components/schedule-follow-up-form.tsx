"use client";

import { useCallback, useEffect, useState } from "react";
import { format, setHours, setMinutes } from "date-fns";
import { CalendarIcon, Loader2, User } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface Lead {
  id: string;
  name: string;
  phone: string;
  stage: string;
}

interface ScheduleFollowUpFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: Date;
  onSuccess?: () => void;
}

const TIME_SLOTS = [
  "9:00 AM",
  "9:30 AM",
  "10:00 AM",
  "10:30 AM",
  "11:00 AM",
  "11:30 AM",
  "12:00 PM",
  "12:30 PM",
  "1:00 PM",
  "1:30 PM",
  "2:00 PM",
  "2:30 PM",
  "3:00 PM",
  "3:30 PM",
  "4:00 PM",
  "4:30 PM",
  "5:00 PM",
  "5:30 PM",
  "6:00 PM",
];

function parseTimeToDate(timeStr: string, baseDate: Date): Date {
  const [time, period] = timeStr.split(" ");
  const [hoursStr, minutesStr] = time.split(":");
  let hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr || "0", 10);
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  return setMinutes(setHours(new Date(baseDate), hours), minutes);
}

export function ScheduleFollowUpForm({
  open,
  onOpenChange,
  defaultDate,
  onSuccess,
}: ScheduleFollowUpFormProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [leadId, setLeadId] = useState<string>("");
  const [date, setDate] = useState<Date>(defaultDate ?? new Date());
  const [time, setTime] = useState("9:00 AM");
  const [note, setNote] = useState("");

  const fetchLeads = useCallback(async () => {
    setLoadingLeads(true);
    try {
      const res = await fetch("/api/leads?limit=100");
      const json = await res.json();
      if (res.ok && Array.isArray(json.leads)) {
        setLeads(json.leads);
        if (json.leads.length > 0 && !leadId) {
          setLeadId(json.leads[0].id);
        }
      }
    } catch {
      setLeads([]);
    } finally {
      setLoadingLeads(false);
    }
  }, [leadId]);

  useEffect(() => {
    if (open) {
      fetchLeads();
      if (defaultDate) {
        setDate(defaultDate);
      }
    }
  }, [open, defaultDate, fetchLeads]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadId) {
      toast.error("Please select a lead");
      return;
    }

    const scheduledAt = parseTimeToDate(time, date);

    setSubmitting(true);
    try {
      const res = await fetch("/api/follow-ups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          scheduledAt: scheduledAt.toISOString(),
          note: note.trim() || undefined,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error ?? "Failed to schedule follow-up");
        return;
      }

      toast.success("Follow-up scheduled");
      onOpenChange(false);
      setLeadId("");
      setDate(new Date());
      setTime("9:00 AM");
      setNote("");
      onSuccess?.();
    } catch {
      toast.error("Failed to schedule follow-up");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule Follow-up</DialogTitle>
          <DialogDescription>
            Schedule a follow-up call or meeting with a lead
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="lead">Lead</Label>
            <Select
              value={leadId}
              onValueChange={setLeadId}
              disabled={loadingLeads}
            >
              <SelectTrigger id="lead" className="cursor-pointer">
                <User className="mr-2 size-4" />
                <SelectValue placeholder="Select a lead" />
              </SelectTrigger>
              <SelectContent>
                {leads.map((lead) => (
                  <SelectItem
                    key={lead.id}
                    value={lead.id}
                    className="cursor-pointer"
                  >
                    {lead.name} ({lead.phone})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {loadingLeads && (
              <p className="text-xs text-muted-foreground">
                Loading leads...
              </p>
            )}
            {!loadingLeads && leads.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No leads assigned to you. Assign leads from the Leads page.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal cursor-pointer",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 size-4" />
                    {date ? format(date, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => d && setDate(d)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="time">Time</Label>
              <Select value={time} onValueChange={setTime}>
                <SelectTrigger id="time" className="cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_SLOTS.map((slot) => (
                    <SelectItem
                      key={slot}
                      value={slot}
                      className="cursor-pointer"
                    >
                      {slot}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Note (optional)</Label>
            <Textarea
              id="note"
              placeholder="Add a note for this follow-up..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !leadId}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Scheduling...
                </>
              ) : (
                "Schedule"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
