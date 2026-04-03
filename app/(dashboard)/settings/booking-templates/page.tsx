"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface BookingTemplatesResponse {
  bookingConfirmationBody: string;
  bookingReminderBody: string;
  bookingReviewBody: string;
}

interface TemplateEditorProps {
  id: string;
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
}

function TemplateEditor({
  id,
  label,
  description,
  value,
  onChange,
}: TemplateEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);

  // Keep editor DOM in sync when value changes from outside
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || "";
    }
  }, [value]);

  const applyCommand = (command: string, commandValue?: string) => {
    const el = editorRef.current;
    if (!el) return;

    el.focus();
    if (typeof document !== "undefined" && "execCommand" in document) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (document as any).execCommand(command, false, commandValue);
    }

    const html = el.innerHTML;
    onChange(html);
  };

  const handleLink = () => {
    const url = typeof window !== "undefined"
      ? window.prompt("Enter URL (https://...)")
      : null;
    if (!url) return;
    applyCommand("createLink", url);
  };

  const handleUndo = () => applyCommand("undo");
  const handleRedo = () => applyCommand("redo");

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Label htmlFor={id}>{label}</Label>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          <span className="mr-1 font-medium">Formatting:</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 cursor-pointer"
            onClick={() => applyCommand("bold")}
            aria-label="Bold"
          >
            <span className="font-bold">B</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 cursor-pointer"
            onClick={() => applyCommand("italic")}
            aria-label="Italic"
          >
            <span className="italic">I</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 cursor-pointer"
            onClick={() => applyCommand("underline")}
            aria-label="Underline"
          >
            <span className="underline">U</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 cursor-pointer"
            onClick={() => applyCommand("strikeThrough")}
            aria-label="Strikethrough"
          >
            <span className="line-through">S</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 cursor-pointer"
            onClick={handleUndo}
            aria-label="Undo"
          >
            <span className="text-xs">↺</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 cursor-pointer"
            onClick={handleRedo}
            aria-label="Redo"
          >
            <span className="text-xs">↻</span>
          </Button>
        </div>
      </div>
      <div
        id={id}
        ref={editorRef}
        contentEditable
        className="min-h-[140px] rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        onInput={(e) => {
          const html = (e.currentTarget as HTMLDivElement).innerHTML;
          onChange(html);
        }}
      />
    </div>
  );
}

export default function BookingTemplatesPage() {
  const [templates, setTemplates] = useState<BookingTemplatesResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<
    "confirmation" | "reminder" | "review"
  >("confirmation");

  useEffect(() => {
    let cancelled = false;
    const fetchTemplates = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/settings/booking-templates");
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error ?? "Failed to load booking templates");
          if (!cancelled) setTemplates(null);
          return;
        }
        if (!cancelled) {
          setTemplates({
            bookingConfirmationBody: data.bookingConfirmationBody,
            bookingReminderBody: data.bookingReminderBody,
            bookingReviewBody: data.bookingReviewBody,
          });
        }
      } catch {
        if (!cancelled) {
          setTemplates(null);
          toast.error("Failed to load booking templates");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchTemplates();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleChange = (
    key: keyof BookingTemplatesResponse,
    value: string,
  ) => {
    setTemplates((prev) =>
      prev
        ? { ...prev, [key]: value }
        : {
            bookingConfirmationBody: "",
            bookingReminderBody: "",
            bookingReviewBody: "",
            [key]: value,
          },
    );
  };

  const handleSave = async () => {
    if (!templates) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings/booking-templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(templates),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to save templates");
        return;
      }
      toast.success("Booking templates updated");
      setTemplates({
        bookingConfirmationBody: data.bookingConfirmationBody,
        bookingReminderBody: data.bookingReminderBody,
        bookingReviewBody: data.bookingReviewBody,
      });
    } catch {
      toast.error("Failed to save templates");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!templates) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Unable to load booking templates. Please try again later.
        </p>
      </div>
    );
  }

  let currentLabel: string;
  let currentDescription: string;
  let currentValue: string;

  switch (selectedTemplate) {
    case "confirmation":
      currentLabel = "Booking confirmation template";
      currentDescription =
        "Sent immediately after a booking is created. Placeholders: {{client_name}}, {{appointment_date}}, {{appointment_time}}, {{advance_amount}}, {{artist_name}}, {{lead_source}}";
      currentValue = templates.bookingConfirmationBody;
      break;
    case "reminder":
      currentLabel = "Booking reminder template";
      currentDescription =
        "Used for day-before and same-day reminders. Placeholders: {{client_name}}, {{appointment_date}}, {{appointment_time}}, {{advance_amount}}, {{artist_name}}, {{lead_source}}";
      currentValue = templates.bookingReminderBody;
      break;
    case "review":
      currentLabel = "Post-appointment review template";
      currentDescription =
        "Sent immediately when the lead is marked as Done. Placeholders: {{client_name}}, {{appointment_date}}, {{appointment_time}}, {{artist_name}}";
      currentValue = templates.bookingReviewBody;
      break;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Booking Message Templates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={selectedTemplate === "confirmation" ? "default" : "outline"}
              size="sm"
              className="cursor-pointer"
              onClick={() => setSelectedTemplate("confirmation")}
            >
              Booking confirmation
            </Button>
            <Button
              type="button"
              variant={selectedTemplate === "reminder" ? "default" : "outline"}
              size="sm"
              className="cursor-pointer"
              onClick={() => setSelectedTemplate("reminder")}
            >
              Booking reminders
            </Button>
            <Button
              type="button"
              variant={selectedTemplate === "review" ? "default" : "outline"}
              size="sm"
              className="cursor-pointer"
              onClick={() => setSelectedTemplate("review")}
            >
              Review request
            </Button>
          </div>

          <TemplateEditor
            id={`booking-${selectedTemplate}`}
            label={currentLabel}
            description={currentDescription}
            value={currentValue}
            onChange={(val) => {
              if (selectedTemplate === "confirmation") {
                handleChange("bookingConfirmationBody", val);
              } else if (selectedTemplate === "reminder") {
                handleChange("bookingReminderBody", val);
              } else {
                handleChange("bookingReviewBody", val);
              }
            }}
          />

          <div className="flex justify-end">
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save templates"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

