"use client";

import { ContentSection } from "@/components/content-section";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const TYPES = [
  "sla_breach",
  "follow_up_missed",
  "new_inbound",
  "reassigned",
] as const;
const CHANNELS = ["in_app", "email", "whatsapp"] as const;

const TYPE_LABELS: Record<(typeof TYPES)[number], string> = {
  sla_breach: "SLA Breach",
  follow_up_missed: "Follow-up Missed",
  new_inbound: "New Inbound Message",
  reassigned: "Lead Reassigned",
};

type PreferencesMap = Record<string, Record<string, boolean>>;

export default function NotificationsPage() {
  const [preferences, setPreferences] = useState<PreferencesMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);

  const fetchPreferences = useCallback(async () => {
    try {
      const res = await fetch("/api/notification-preferences");
      const json = await res.json();
      if (res.ok) {
        setPreferences(json.preferences ?? {});
      } else {
        setPreferences({});
      }
    } catch {
      setPreferences({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => {
        setIsAdmin(data.role === "admin");
        fetchPreferences();
      })
      .catch(() => {
        setIsAdmin(false);
        setLoading(false);
      });
  }, [fetchPreferences]);

  // Detect push support & current subscription
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      setPushSupported(false);
      return;
    }
    setPushSupported(true);

    navigator.serviceWorker
      .getRegistration()
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => setPushEnabled(!!sub))
      .catch(() => setPushEnabled(false));
  }, []);

  const handleTogglePush = async () => {
    if (!pushSupported) return;

    try {
      if (!pushEnabled) {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          toast.error("Notification permission denied");
          return;
        }

        const reg =
          (await navigator.serviceWorker.getRegistration()) ||
          (await navigator.serviceWorker.register("/sw.js"));

        const rawKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY;
        if (!rawKey) {
          toast.error("Push key is not configured");
          return;
        }
        const convertedKey = Uint8Array.from(
          atob(rawKey.replace(/-/g, "+").replace(/_/g, "/")),
          (c) => c.charCodeAt(0),
        );

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedKey,
        });

        await fetch("/api/push-subscriptions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sub),
        });

        setPushEnabled(true);
        toast.success("Browser push notifications enabled");
      } else {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        if (sub) {
          await fetch(
            `/api/push-subscriptions?endpoint=${encodeURIComponent(
              sub.endpoint,
            )}`,
            { method: "DELETE" },
          );
          await sub.unsubscribe();
        }
        setPushEnabled(false);
        toast.success("Browser push notifications disabled");
      }
    } catch {
      toast.error("Failed to update browser notifications");
    }
  };

  const handleToggle = (type: string, channel: string, value: boolean) => {
    if (!preferences) return;
    setPreferences((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [type]: {
          ...prev[type],
          [channel]: value,
        },
      };
    });
  };

  const handleSave = async () => {
    if (!preferences) return;
    setSaving(true);
    try {
      const res = await fetch("/api/notification-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences }),
      });
      const json = await res.json();
      if (res.ok) {
        setPreferences(json.preferences ?? preferences);
        toast.success("Notification preferences updated");
      } else {
        toast.error(json.error ?? "Failed to save");
      }
    } catch {
      toast.error("Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  if (loading || preferences === null) {
    return (
      <ContentSection
        title="Notifications"
        desc="Configure how you receive CRM notifications."
      >
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </ContentSection>
    );
  }

  return (
    <ContentSection
      title="Notifications"
      desc="Configure how you receive CRM notifications. In-app is always on by default; email and WhatsApp require explicit opt-in."
    >
      <div className="space-y-6 pb-4">
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[500px]">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium">
                  Notification Type
                </th>
                <th className="px-4 py-3 text-center text-sm font-medium">
                  In-App
                </th>
                <th className="px-4 py-3 text-center text-sm font-medium">
                  Email
                </th>
                <th className="px-4 py-3 text-center text-sm font-medium">
                  WhatsApp
                </th>
              </tr>
            </thead>
            <tbody>
              {TYPES.map((type) => (
                <tr key={type} className="border-b last:border-0">
                  <td className="px-4 py-3 text-sm">
                    {TYPE_LABELS[type]}
                  </td>
                  {CHANNELS.map((channel) => {
                    const isSlaInApp =
                      type === "sla_breach" && channel === "in_app";
                    const disabled =
                      isSlaInApp && isAdmin === false;
                    const value =
                      preferences[type]?.[channel] ?? (channel === "in_app");

                    return (
                      <td
                        key={channel}
                        className="px-4 py-3 text-center"
                      >
                        <div className="flex justify-center">
                          <Switch
                            checked={value}
                            onCheckedChange={(v) =>
                              handleToggle(type, channel, v)
                            }
                            disabled={disabled}
                          />
                        </div>
                        {disabled && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Always on
                          </p>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
          <h2 className="text-sm font-semibold">Browser push notifications</h2>
          <p className="text-sm text-muted-foreground">
            Enable push notifications to get alerts even when this tab is in the
            background. Works per-browser and per-device.
          </p>
          <div className="flex items-center justify-between">
            <span className="text-sm">
              Status:{" "}
              <span className="font-medium">
                {!pushSupported
                  ? "Not supported in this browser"
                  : pushEnabled
                    ? "Enabled"
                    : "Disabled"}
              </span>
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTogglePush}
              disabled={!pushSupported}
            >
              {pushEnabled ? "Disable push" : "Enable push"}
            </Button>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          SLA breach in-app notifications are always enabled for admins. Email
          and WhatsApp require you to add your contact details in your profile.
        </p>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save preferences"
          )}
        </Button>
      </div>
    </ContentSection>
  );
}
