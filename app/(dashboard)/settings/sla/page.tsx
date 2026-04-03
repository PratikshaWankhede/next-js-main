"use client";

import { ContentSection } from "@/components/content-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/auth-context";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const MIN_MINUTES = 1;
const MAX_MINUTES = 1440;

export default function SlaSettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [firstResponseSlaMinutes, setFirstResponseSlaMinutes] = useState<number>(10);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchSla = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/sla");
      if (!res.ok) return;
      const data = await res.json();
      if (typeof data?.firstResponseSlaMinutes === "number") {
        setFirstResponseSlaMinutes(data.firstResponseSlaMinutes);
      }
    } catch {
      toast.error("Failed to load SLA settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSla();
  }, [fetchSla]);

  if (user !== null && !isAdmin) {
    return (
      <ContentSection title="SLA" desc="First-response SLA timing (admin only).">
        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-8">
          <h2 className="text-xl font-semibold">Access Denied</h2>
          <p className="text-muted-foreground text-center">
            You need admin permissions to change SLA settings.
          </p>
        </div>
      </ContentSection>
    );
  }

  async function handleSave() {
    const value = Math.round(Number(firstResponseSlaMinutes));
    if (!Number.isFinite(value) || value < MIN_MINUTES || value > MAX_MINUTES) {
      toast.error(`Enter a value between ${MIN_MINUTES} and ${MAX_MINUTES} minutes`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/settings/sla", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstResponseSlaMinutes: value }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error ?? "Failed to update SLA");
        return;
      }
      if (typeof json.firstResponseSlaMinutes === "number") {
        setFirstResponseSlaMinutes(json.firstResponseSlaMinutes);
      }
      toast.success("SLA updated. First-response deadline is now " + json.firstResponseSlaMinutes + " minutes.");
    } catch {
      toast.error("Failed to update SLA");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <ContentSection title="SLA" desc="First-response SLA timing (admin only).">
        <div className="animate-pulse space-y-4">
          <div className="h-10 w-32 rounded-md bg-muted" />
          <div className="h-10 w-24 rounded-md bg-muted" />
        </div>
      </ContentSection>
    );
  }

  return (
    <ContentSection
      title="SLA"
      desc="Set how many minutes the team has to send a first response before a lead is marked as SLA breached. Only admins can change this."
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="sla-minutes">
            First response SLA (minutes)
          </label>
          <Input
            id="sla-minutes"
            type="number"
            min={MIN_MINUTES}
            max={MAX_MINUTES}
            value={firstResponseSlaMinutes}
            onChange={(e) => {
              const v = e.target.valueAsNumber;
              if (e.target.value === "" || !Number.isFinite(v)) {
                setFirstResponseSlaMinutes(10);
                return;
              }
              setFirstResponseSlaMinutes(Math.max(MIN_MINUTES, Math.min(MAX_MINUTES, Math.round(v))));
            }}
          />
          <p className="text-muted-foreground text-sm">
            Between {MIN_MINUTES} and {MAX_MINUTES} minutes (e.g. 10 = 10 minutes, 60 = 1 hour).
          </p>
        </div>
        <Button onClick={handleSave} disabled={submitting}>
          {submitting ? "Saving…" : "Save"}
        </Button>
      </div>
    </ContentSection>
  );
}
