"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getNextValidStages,
  type LeadStage,
} from "@/features/leads/types/lead.types";
import {
  getLeadDisplayName,
  needsInstagramProfileEnrichment,
} from "@/lib/lead-display-name";
import { cn } from "@/lib/utils";
import { LeadScoreBadge } from "@/features/ai/lead-score-badge";
import { LeadSummaryCard } from "@/features/ai/lead-summary-card";
import { LeadChatPanel } from "@/features/chat/lead-chat-panel";
import { LeadFollowUps } from "@/features/follow-ups/components/lead-follow-ups";
import { ReassignLeadDialog } from "@/features/leads/components/reassign-lead-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatLeadDateTime } from "@/helpers/format-lead-datetime";
import { formatBookingAppointmentDisplay } from "@/lib/booking-datetime";
import { format, set } from "date-fns";
import {
  ArrowLeft,
  Check,
  CalendarIcon,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  Instagram,
  Loader2,
  MessageCircle,
  Pencil,
  Phone,
  RefreshCw,
  Tag,
  Timer,
  UserPlus,
  X,
} from "lucide-react";
import { useSlaSetting } from "@/hooks/use-sla-setting";
import Link from "next/link";
import { useSetCurrentLeadId } from "@/contexts/current-lead-id-context";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const REVENUE_TAGS: { value: RevenueTag; label: string }[] = [
  { value: "S", label: "S (30k+)" },
  { value: "A", label: "A (10k-30k)" },
  { value: "B", label: "B (1k-10k)" },
  { value: "C", label: "C (Consultation)" },
];
const REVIEW_OPTIONS: { value: ReviewStatus; label: string }[] = [
  { value: "not_started", label: "Not started" },
  { value: "review_sent", label: "Review sent" },
  { value: "review_submitted", label: "Review submitted" },
  { value: "reminder_1", label: "Reminder 1" },
  { value: "reminder_2", label: "Reminder 2" },
  { value: "closed", label: "Closed" },
];

const BOOKING_HOURS = Array.from({ length: 12 }, (_, index) =>
  String(index + 1).padStart(2, "0"),
);
const BOOKING_MINUTES = Array.from({ length: 60 }, (_, index) =>
  String(index).padStart(2, "0"),
);

function parseBookingDateTimeParts(value: string) {
  if (!value) {
    return {
      date: undefined as Date | undefined,
      hour12: "12",
      minute: "00",
      meridiem: "AM" as "AM" | "PM",
    };
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return {
      date: undefined as Date | undefined,
      hour12: "12",
      minute: "00",
      meridiem: "AM" as "AM" | "PM",
    };
  }

  const hours24 = parsed.getHours();
  const hour12Num = hours24 % 12 || 12;

  return {
    date: parsed,
    hour12: String(hour12Num).padStart(2, "0"),
    minute: String(parsed.getMinutes()).padStart(2, "0"),
    meridiem: hours24 >= 12 ? ("PM" as const) : ("AM" as const),
  };
}

function buildBookingDateTime(
  date: Date | undefined,
  hour12: string,
  minute: string,
  meridiem: "AM" | "PM",
) {
  if (!date) return "";

  const parsedHour = Number(hour12);
  const parsedMinute = Number(minute);
  if (
    Number.isNaN(parsedHour) ||
    Number.isNaN(parsedMinute) ||
    parsedHour < 1 ||
    parsedHour > 12 ||
    parsedMinute < 0 ||
    parsedMinute > 59
  ) {
    return "";
  }

  const hours24 = meridiem === "PM" ? (parsedHour % 12) + 12 : parsedHour % 12;
  return format(
    set(date, {
      hours: hours24,
      minutes: parsedMinute,
      seconds: 0,
      milliseconds: 0,
    }),
    "yyyy-MM-dd'T'HH:mm",
  );
}

type RevenueTag = "S" | "A" | "B" | "C";
type ReviewStatus =
  | "not_started"
  | "review_sent"
  | "review_submitted"
  | "reminder_1"
  | "reminder_2"
  | "closed";

interface LeadDetail {
  id: string;
  name: string;
  customName?: string | null;
  phone: string;
  source: string;
  stage: LeadStage;
  assignedUserId: string | null;
  createdAt: string;
  updatedAt: string;
  firstResponseAt?: string | null;
  slaStatus?: "pending" | "met" | "breached";
  slaBreachedAt?: string | null;
  aiSummary?: string | null;
  aiSummaryUpdatedAt?: string | Date | null;
  aiScore?: "hot" | "warm" | "cold" | null;
  aiScoreReason?: string | null;
  aiScoreUpdatedAt?: string | Date | null;
  stageHistory: Array<{
    id: string;
    fromStage: LeadStage;
    toStage: LeadStage;
    changedByUserId: string;
    changedAt: string;
  }>;
  assignedUser: { id: string; name: string; email: string } | null;
  whatsappPhone?: string | null;
  instagramUserId?: string | null;
  instagramUsername?: string | null;
  estimatedAmount?: number | null;
  revenueTag?: RevenueTag | null;
  isNoShow?: boolean;
  noShowCount?: number;
  noShowAt?: string | null;
  recoveryCycle?: number;
  doneAt?: string | null;
  timeline?: Array<{
    id: string;
    type: string;
    payload: Record<string, unknown>;
    createdAt: string;
    userId?: string | null;
    actor?: {
      id: string;
      name: string;
      email: string;
      role: string;
    } | null;
  }>;
  comments?: Array<{
    id: string;
    content: string;
    createdAt: string;
    updatedAt: string;
    createdByUserId: string;
    createdByRole: string;
    author: {
      id: string;
      name: string;
      email: string;
      role: string;
    };
  }>;
  reviewStatus?: ReviewStatus | null;
  referralGenerated?: boolean;
  referralLeadId?: string | null;
  parentLeadId?: string | null;
  roleOwner?: string | null;
  appointmentDate?: string | null;
  advanceAmount?: number | null;
  artistName?: string | null;
  bookingChannel?: "whatsapp" | "instagram" | "manual" | null;
  bookingReminderDayBeforeSentAt?: string | null;
  bookingReminderSameDaySentAt?: string | null;
  bookingReviewSentAt?: string | null;
  bookingConfirmationSentAt?: string | null;
  noShowFollowUpUntil?: string | null;
}

const STAGE_COLORS: Record<LeadStage, string> = {
  new: "bg-slate-500",
  contacted: "bg-blue-500",
  interested: "bg-amber-500",
  rnr: "bg-fuchsia-500",
  follow_up: "bg-violet-500",
  booking: "bg-emerald-600",
  no_show: "bg-orange-500",
  done: "bg-green-500",
  lost: "bg-red-500",
};

function SlaTimer({
  createdAt,
  slaMinutes,
}: {
  createdAt: string;
  slaMinutes: number;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [createdAt, slaMinutes]);

  const deadline = new Date(createdAt).getTime() + slaMinutes * 60 * 1000;
  const diffMs = deadline - now;
  const totalMins = Math.floor(Math.abs(diffMs) / 60000);
  const days = Math.floor(totalMins / (60 * 24));
  const hours = Math.floor((totalMins % (60 * 24)) / 60);
  const mins = totalMins % 60;
  const timeParts = [
    days > 0 ? `${days}d` : null,
    hours > 0 || days > 0 ? `${hours}h` : null,
    `${mins}m`,
  ].filter(Boolean);
  const label =
    diffMs < 0
      ? `-${timeParts.join(" ")} overdue`
      : `${timeParts.join(" ")} left`;

  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
      <Timer className="size-4 shrink-0" />
      <span className="tabular-nums">{label}</span>
    </p>
  );
}

function stageLabel(s: LeadStage): string {
  if (s === "follow_up") return "Follow up";
  if (s === "no_show") return "No-show";
  if (s === "rnr") return "RNR";
  if (s === "lost") return "Lost / not interested";
  return s.replace("_", " ");
}

function timelineEventLabel(type: string): string {
  const labels: Record<string, string> = {
    lead_created: "Lead created",
    stage_changed: "Stage changed",
    booking_created: "Booking created",
    booking_updated: "Booking updated",
    comment_added: "Comment added",
    comment_edited: "Comment edited",
    no_show: "No-show",
    reschedule: "Reschedule",
    referred_to_fc: "Referred to Follow-up",
    reassigned_to_sales: "Reassigned to Sales",
    exited_crm: "Exited CRM",
  };
  return labels[type] ?? type.replace(/_/g, " ");
}

function timelineEventMeta(event: NonNullable<LeadDetail["timeline"]>[number]) {
  const actorName = event.actor?.name ?? "System";
  const actorRole = event.actor?.role
    ? event.actor.role.replace(/_/g, " ")
    : null;

  if (event.type === "comment_added" || event.type === "comment_edited") {
    return actorRole ? `${actorName} · ${actorRole}` : actorName;
  }

  return actorRole ? `${actorName} · ${actorRole}` : actorName;
}

export default function LeadDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const setCurrentLeadId = useSetCurrentLeadId();
  const slaMinutes = useSlaSetting();

  useEffect(() => {
    setCurrentLeadId(id);
    return () => setCurrentLeadId(null);
  }, [id, setCurrentLeadId]);

  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState<string>("sales");
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [reassignOpen, setReassignOpen] = useState(false);
  const [stageUpdating, setStageUpdating] = useState(false);
  const [scoreRefreshing, setScoreRefreshing] = useState(false);
  const [patching, setPatching] = useState(false);
  const [noShowLoading, setNoShowLoading] = useState(false);
  const [referralOpen, setReferralOpen] = useState(false);
  const [referralDialogMode, setReferralDialogMode] = useState<
    "referral" | "from_review"
  >("referral");
  const [referralName, setReferralName] = useState("");
  const [referralPhone, setReferralPhone] = useState("");
  const [referralSubmitting, setReferralSubmitting] = useState(false);
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingDateTime, setBookingDateTime] = useState("");
  const [bookingAdvance, setBookingAdvance] = useState<string>("");
  const [bookingArtist, setBookingArtist] = useState<string>("");
  const [bookingStageOnSave, setBookingStageOnSave] = useState(false);
  const [followUpDialogOpen, setFollowUpDialogOpen] = useState(false);
  const [followUpDateTime, setFollowUpDateTime] = useState("");
  const [followUpSubmitting, setFollowUpSubmitting] = useState(false);
  const [followUpTargetStage, setFollowUpTargetStage] = useState<LeadStage>("follow_up");
  const [commentDraft, setCommentDraft] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentDraft, setEditingCommentDraft] = useState("");
  const [isEditingCustomName, setIsEditingCustomName] = useState(false);
  const [customNameDraft, setCustomNameDraft] = useState("");

  const fetchLead = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
    }
    try {
      const res = await fetch(`/api/leads/${id}`);
      const json = await res.json();

      if (!res.ok) {
        if (res.status === 404) {
          toast.error("Lead not found");
        } else if (res.status === 403) {
          toast.error("You do not have access to this lead");
        }
        setLead(null);
        return;
      }

      setLead(json);
    } catch {
      setLead(null);
      toast.error("Failed to load lead");
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }, [id]);

  useEffect(() => {
    fetchLead();
  }, [fetchLead]);

  const leadDisplayName = useMemo(
    () => (lead ? getLeadDisplayName(lead) : ""),
    [lead],
  );
  const originalLeadName = useMemo(() => (lead?.name ?? "").trim(), [lead?.name]);

  /** One Instagram profile enrichment POST per lead per page load (avoids spamming Graph when token is wrong). */
  const instagramProfileEnrichAttemptedForId = useRef<string | null>(null);

  useEffect(() => {
    instagramProfileEnrichAttemptedForId.current = null;
  }, [id]);

  useEffect(() => {
    if (!lead || !needsInstagramProfileEnrichment(lead)) return;
    if (instagramProfileEnrichAttemptedForId.current === id) return;
    instagramProfileEnrichAttemptedForId.current = id;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/leads/${id}/instagram-profile`, {
          method: "POST",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          ok?: boolean;
          lead?: {
            id: string;
            name: string;
            instagramUsername: string | null;
          };
        };
        if (data.ok && data.lead) {
          setLead((prev) => (prev ? { ...prev, ...data.lead } : null));
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lead, id]);

  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => {
        setIsAdmin(data.role === "admin");
        setUserRole(data.role ?? "sales");
        setCurrentUserId(data.user?.id ?? "");
      })
      .catch(() => setIsAdmin(false));
  }, []);

  const handleStageChange = async (
    toStage: LeadStage,
    extra?: { followUpStartAt?: string },
  ): Promise<boolean> => {
    if (!lead || toStage === lead.stage) return false;

    setStageUpdating(true);
    try {
      const body: Record<string, unknown> = { toStage };
      if (extra?.followUpStartAt) body.followUpStartAt = extra.followUpStartAt;

      const res = await fetch(`/api/leads/${id}/stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error ?? "Failed to update stage");
        return false;
      }

      toast.success("Stage updated");
      setLead((prev) =>
        prev
          ? { ...prev, stage: (json.stage as LeadStage | undefined) ?? toStage }
          : null,
      );
      fetchLead();
      return true;
    } catch {
      toast.error("Failed to update stage");
      return false;
    } finally {
      setStageUpdating(false);
    }
  };

  const handleStageSelect = (v: string) => {
    const toStage = v as LeadStage;
    if (toStage === "follow_up" || toStage === "rnr") {
      setFollowUpTargetStage(toStage);
      setFollowUpDateTime("");
      setFollowUpDialogOpen(true);
      return;
    }
    if (toStage === "booking") {
      setBookingStageOnSave(true);
      handleOpenBookingDialog();
      return;
    }
    handleStageChange(toStage);
  };

  const handleConfirmFollowUp = async () => {
    const selected = followUpDateTime.trim();
    if (!selected) {
      toast.error("Please pick the follow-up date and time");
      return;
    }

    const parsed = new Date(selected);
    if (Number.isNaN(parsed.getTime())) {
      toast.error("Please pick a valid follow-up date and time");
      return;
    }

    setFollowUpSubmitting(true);
    try {
      const ok = await handleStageChange(followUpTargetStage, {
        followUpStartAt: parsed.toISOString(),
      });
      if (ok) {
        setFollowUpDialogOpen(false);
        setFollowUpDateTime("");
        setFollowUpTargetStage("follow_up");
      }
    } finally {
      setFollowUpSubmitting(false);
    }
  };

  const handleReassignSuccess = () => {
    setReassignOpen(false);
    fetchLead();
  };

  const startEditingCustomName = useCallback(() => {
    if (!lead) return;
    setCustomNameDraft(lead.customName?.trim() ?? "");
    setIsEditingCustomName(true);
  }, [lead]);

  const cancelEditingCustomName = useCallback(() => {
    setCustomNameDraft(lead?.customName?.trim() ?? "");
    setIsEditingCustomName(false);
  }, [lead]);

  const handlePatch = useCallback(
    async (updates: Record<string, unknown>) => {
      if (!lead) return;
      setPatching(true);
      try {
        const res = await fetch(`/api/leads/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        const data = await res.json();
        if (res.ok) {
          setLead((prev) => (prev ? { ...prev, ...data } : null));
        } else {
          toast.error(data.error ?? "Failed to update");
        }
      } catch {
        toast.error("Failed to update");
      } finally {
        setPatching(false);
      }
    },
    [id, lead]
  );

  const handleSaveCustomName = useCallback(async () => {
    const nextValue = customNameDraft.trim();
    const currentValue = lead?.customName?.trim() ?? "";

    if (nextValue === currentValue) {
      setIsEditingCustomName(false);
      return;
    }

    await handlePatch({ customName: nextValue || null });
    setIsEditingCustomName(false);
  }, [customNameDraft, handlePatch, lead?.customName]);

  const handleCreateComment = async () => {
    const content = commentDraft.trim();
    if (!lead || !content) return;

    setCommentSubmitting(true);
    try {
      const res = await fetch(`/api/leads/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (res.ok) {
        setCommentDraft("");
        await fetchLead();
        toast.success("Comment added");
      } else {
        toast.error(data.error ?? "Failed to add comment");
      }
    } catch {
      toast.error("Failed to add comment");
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleUpdateComment = async () => {
    const content = editingCommentDraft.trim();
    if (!lead || !editingCommentId || !content) return;

    setCommentSubmitting(true);
    try {
      const res = await fetch(
        `/api/leads/${id}/comments/${editingCommentId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        },
      );
      const data = await res.json();
      if (res.ok) {
        setEditingCommentId(null);
        setEditingCommentDraft("");
        await fetchLead();
        toast.success("Comment updated");
      } else {
        toast.error(data.error ?? "Failed to update comment");
      }
    } catch {
      toast.error("Failed to update comment");
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleCreateReferral = async () => {
    const name = referralName.trim();
    const phone = referralPhone.trim();
    if (!name || !phone) {
      toast.error("Name and phone are required");
      return;
    }
    setReferralSubmitting(true);
    try {
      const res = await fetch("/api/leads/referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentLeadId: id, name, phone }),
      });
      const data = await res.json();
      if (res.ok) {
        setReferralOpen(false);
        setReferralName("");
        setReferralPhone("");
        setLead((prev) =>
          prev
            ? {
                ...prev,
                referralGenerated: true,
                referralLeadId: data.id,
              }
            : null
        );
        toast.success("Referral lead created");
      } else {
        toast.error(data.error ?? "Failed to create referral");
      }
    } catch {
      toast.error("Failed to create referral");
    } finally {
      setReferralSubmitting(false);
    }
  };

  const handleOpenBookingDialog = () => {
    if (!lead) return;
    if (lead.appointmentDate) {
      const d = new Date(lead.appointmentDate);
      const isoLocal = new Date(
        d.getTime() - d.getTimezoneOffset() * 60000,
      )
        .toISOString()
        .slice(0, 16);
      setBookingDateTime(isoLocal);
    } else {
      setBookingDateTime("");
    }
    setBookingAdvance(
      lead.advanceAmount != null && !Number.isNaN(lead.advanceAmount)
        ? String(lead.advanceAmount)
        : "",
    );
    setBookingArtist(lead.artistName ?? "");
    setBookingDialogOpen(true);
  };

  const handleSubmitBooking: React.FormEventHandler<HTMLFormElement> = async (
    e,
  ) => {
    e.preventDefault();
    if (!lead) return;
    if (!bookingDateTime) {
      toast.error("Appointment date & time is required");
      return;
    }
    const date = new Date(bookingDateTime);
    if (Number.isNaN(date.getTime())) {
      toast.error("Please provide a valid date and time");
      return;
    }
    const advanceNum =
      bookingAdvance.trim() === "" ? 0 : Number(bookingAdvance.trim());
    if (Number.isNaN(advanceNum) || advanceNum < 0) {
      toast.error("Advance amount must be a non-negative number");
      return;
    }

    setBookingSubmitting(true);
    try {
      const currentLeadStage = lead.stage;
      const res = await fetch(`/api/leads/${id}/booking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentDate: date.toISOString(),
          advanceAmount: advanceNum,
          artistName: bookingArtist.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to save booking");
        return;
      }
      if (bookingStageOnSave && currentLeadStage !== "booking") {
        const stageChanged = await handleStageChange("booking");
        if (!stageChanged) return;
      }
      setLead((prev) => (prev ? { ...prev, ...data } : data));
      toast.success("Booking saved");
      setBookingStageOnSave(false);
      setBookingDialogOpen(false);
    } catch {
      toast.error("Failed to save booking");
    } finally {
      setBookingSubmitting(false);
    }
  };

  const handleRefreshScore = async () => {
    setScoreRefreshing(true);
    try {
      const res = await fetch("/api/ai/lead-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: id }),
      });
      const data = await res.json();
      if (res.ok && data.score) {
        setLead((prev) =>
          prev
            ? {
                ...prev,
                aiScore: data.score,
                aiScoreReason: data.reason ?? null,
              }
            : null
        );
        toast.success("Score updated");
      } else {
        toast.error("Failed to refresh score");
      }
    } catch {
      toast.error("Failed to refresh score");
    } finally {
      setScoreRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="px-4 py-4 lg:px-6">
        <Link
          href="/leads"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to leads
        </Link>
        <div className="mt-8 text-center text-muted-foreground">
          Lead not found or you do not have access.
        </div>
      </div>
    );
  }

  const nextStages = getNextValidStages(lead.stage);
  const canEditBooking =
    lead.stage === "booking" ||
    lead.stage === "no_show" ||
    lead.stage === "done" ||
    Boolean(lead.appointmentDate);
  const followUpPicker = parseBookingDateTimeParts(followUpDateTime);
  const bookingPicker = parseBookingDateTimeParts(bookingDateTime);

  const rawPhone = (lead.phone ?? "").trim();
  const numericPhone = rawPhone.replace(/[^\d+]/g, "");
  const hasDialablePhone = numericPhone.replace(/\D/g, "").length >= 6;
  const callPhone = hasDialablePhone ? numericPhone : null;
  const whatsappTarget =
    (lead.whatsappPhone ?? "").trim() ||
    (lead.source === "whatsapp" && hasDialablePhone ? numericPhone : "");
  const hasWhatsapp = Boolean(whatsappTarget);
  const primaryContactLabel =
    lead.source === "instagram" ? "Instagram ID" : "Phone";
  const contactValueForCopy =
    lead.source === "instagram" && (lead.instagramUserId ?? "").trim()
      ? (lead.instagramUserId as string)
      : rawPhone;

  return (
    <div className="flex h-full min-h-[500px] px-4 py-4 lg:px-6 gap-6 flex-col lg:flex-row">
      {/* Left: lead overview, booking & metadata */}
      <div className="w-full lg:basis-2/5 lg:max-w-[40%] min-w-0 space-y-6 pr-0 lg:pr-2">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/leads"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to leads
          </Link>
        </div>

        <div className="min-w-0 space-y-6 max-w-2xl">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Lead overview
                  </p>
                  {isEditingCustomName ? (
                    <div className="space-y-2">
                      <div className="flex max-w-md items-center gap-2">
                        <Input
                          value={customNameDraft}
                          onChange={(e) => setCustomNameDraft(e.target.value)}
                          placeholder="Set internal lead name"
                          className="h-9"
                          maxLength={120}
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-9 shrink-0"
                          onClick={handleSaveCustomName}
                          disabled={patching}
                        >
                          {patching ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Check className="size-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-9 shrink-0"
                          onClick={cancelEditingCustomName}
                          disabled={patching}
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Internal name only. Leave blank to use the original lead name.
                      </p>
                    </div>
                  ) : (
                    <>
                      <CardTitle className="flex items-center gap-2 text-xl">
                        <span className="truncate">{leadDisplayName}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0"
                          onClick={startEditingCustomName}
                        >
                          <Pencil className="size-4" />
                        </Button>
                      </CardTitle>
                      {lead.customName?.trim() &&
                        originalLeadName &&
                        originalLeadName !== leadDisplayName && (
                          <p className="text-xs text-muted-foreground">
                            Original name: {originalLeadName}
                          </p>
                        )}
                    </>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Created {formatLeadDateTime(lead.createdAt)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="flex items-center gap-1.5">
                    {lead.aiScore && (
                      <LeadScoreBadge
                        score={lead.aiScore}
                        reason={lead.aiScoreReason ?? null}
                      />
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 cursor-pointer"
                      onClick={handleRefreshScore}
                      disabled={scoreRefreshing}
                    >
                      {scoreRefreshing ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="size-3.5" />
                      )}
                      <span className="sr-only">Refresh AI score</span>
                    </Button>
                  </div>
                  <Badge
                    className={cn(
                      "border-0 px-3 py-1 text-xs font-medium capitalize",
                      STAGE_COLORS[lead.stage],
                      "text-white",
                    )}
                  >
                    {stageLabel(lead.stage)}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Quick actions */}
              <div className="rounded-lg border bg-muted/40 px-3 py-2.5">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Quick actions
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {callPhone && (
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="cursor-pointer"
                    >
                      <a href={`tel:${callPhone}`}>
                        <Phone className="mr-2 size-4" />
                        Call
                      </a>
                    </Button>
                  )}
                  {hasWhatsapp && (
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="cursor-pointer"
                    >
                      <a
                        href={`https://wa.me/${encodeURIComponent(
                          whatsappTarget,
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <MessageCircle className="mr-2 size-4" />
                        WhatsApp
                      </a>
                    </Button>
                  )}
                  {lead.instagramUserId && (
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="cursor-pointer"
                    >
                      <a
                        href={
                          lead.instagramUsername?.trim()
                            ? `https://instagram.com/${lead.instagramUsername.replace(/^@/, "")}`
                            : "https://www.instagram.com/"
                        }
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Instagram className="mr-2 size-4" />
                        Instagram
                      </a>
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="cursor-pointer"
                    onClick={() => {
                      if (navigator?.clipboard?.writeText && contactValueForCopy) {
                        navigator.clipboard.writeText(contactValueForCopy).then(
                          () => toast.success("Contact copied"),
                          () => toast.error("Failed to copy"),
                        );
                      } else {
                        toast.error("Copy not supported in this browser");
                      }
                    }}
                  >
                    Copy {primaryContactLabel.toLowerCase()}
                  </Button>
                </div>
              </div>

              {/* Contact & source */}
              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Contact
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Phone className="size-3.5" />
                      {primaryContactLabel}
                    </p>
                    <p className="font-medium break-all">
                      {contactValueForCopy || rawPhone || "—"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Tag className="size-3.5" />
                      Source
                    </p>
                    <p className="font-medium capitalize">{lead.source}</p>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <UserPlus className="size-3.5" />
                      Assigned to
                    </p>
                    <p className="font-medium">
                      {lead.assignedUser
                        ? lead.assignedUser.name
                        : "Unassigned"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Deal value */}
              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Deal value
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <CircleDollarSign className="size-4 text-muted-foreground" />
                    <Input
                      type="number"
                      min={0}
                      step={1000}
                      value={lead.estimatedAmount ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        const num = v === "" ? null : Number(v);
                        if (v === "" || !Number.isNaN(num)) {
                          setLead((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  estimatedAmount: num ?? undefined,
                                }
                              : null,
                          );
                        }
                      }}
                      onBlur={(e) => {
                        const v = e.target.value;
                        if (v === "") {
                          handlePatch({ estimatedAmount: null });
                        } else {
                          const num = Number(v);
                          if (!Number.isNaN(num)) {
                            handlePatch({ estimatedAmount: num });
                          }
                        }
                      }}
                      disabled={patching}
                      className="w-32"
                    />
                  </div>
                  <Select
                    value={lead.revenueTag ?? ""}
                    onValueChange={(v) => {
                      const tag = v ? (v as RevenueTag) : null;
                      setLead((prev) =>
                        prev ? { ...prev, revenueTag: tag ?? undefined } : null,
                      );
                      handlePatch({ revenueTag: tag });
                    }}
                    disabled={patching}
                  >
                    <SelectTrigger className="w-[160px] cursor-pointer">
                      <SelectValue placeholder="Revenue tag" />
                    </SelectTrigger>
                    <SelectContent>
                      {REVENUE_TAGS.map((t) => (
                        <SelectItem
                          key={t.value}
                          value={t.value}
                          className="cursor-pointer"
                        >
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Status & review */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {lead.firstResponseAt && (
                    <div>
                      <p className="text-xs text-muted-foreground">
                        First response
                      </p>
                      <p className="text-sm font-medium">
                        {formatLeadDateTime(lead.firstResponseAt)}
                      </p>
                    </div>
                  )}
                  {lead.slaStatus && (
                    <div>
                      <p className="mb-1 text-xs text-muted-foreground">
                        SLA status
                      </p>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge
                            className={cn(
                              "capitalize border-0 px-3 py-1 text-xs",
                              lead.slaStatus === "met" &&
                                "bg-green-500 text-white",
                              lead.slaStatus === "pending" &&
                                "bg-yellow-500 text-white",
                              lead.slaStatus === "breached" &&
                                "bg-red-500 text-white",
                            )}
                          >
                            {lead.slaStatus}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          {lead.slaStatus === "met" &&
                            `First response within ${slaMinutes} min`}
                          {lead.slaStatus === "pending" &&
                            `Awaiting first response (${slaMinutes} min SLA)`}
                          {lead.slaStatus === "breached" &&
                            `First response breached (${slaMinutes} min SLA)`}
                        </TooltipContent>
                      </Tooltip>
                      {lead.slaStatus === "pending" && (
                        <SlaTimer
                          createdAt={lead.createdAt}
                          slaMinutes={slaMinutes}
                        />
                      )}
                    </div>
                  )}
                </div>

                {lead.isNoShow && lead.noShowAt && (
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Marked as no-show
                    </p>
                    <p className="text-sm font-medium">
                      {formatLeadDateTime(lead.noShowAt)}
                    </p>
                    {(userRole === "sales" || isAdmin) &&
                      lead.stage === "no_show" && (
                        <div className="mt-2 space-y-1">
                          <Label
                            htmlFor="no-show-follow-up-until"
                            className="text-xs text-muted-foreground"
                          >
                            Keep with current user until
                          </Label>
                          <Input
                            id="no-show-follow-up-until"
                            type="date"
                            value={
                              lead.noShowFollowUpUntil
                                ? new Date(
                                    lead.noShowFollowUpUntil,
                                  )
                                    .toISOString()
                                    .slice(0, 10)
                                : ""
                            }
                            onChange={(e) => {
                              const val = e.target.value || null;
                              setLead((prev) =>
                                prev
                                  ? { ...prev, noShowFollowUpUntil: val }
                                  : null,
                              );
                              handlePatch({
                                noShowFollowUpUntil: val
                                  ? `${val}T00:00:00.000Z`
                                  : null,
                              });
                            }}
                            className="max-w-[200px] cursor-pointer"
                          />
                        </div>
                      )}
                  </div>
                )}

                {lead.stage === "done" && (
                  <>
                    {lead.doneAt && (
                      <div>
                        <p className="text-xs text-muted-foreground">Done at</p>
                        <p className="text-sm font-medium">
                          {formatLeadDateTime(lead.doneAt)}
                        </p>
                      </div>
                    )}
                    {(userRole === "feedback" || userRole === "admin") && (
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">
                          Review status
                        </Label>
                        <Select
                          value={lead.reviewStatus ?? "not_started"}
                          onValueChange={(v) => {
                            const status = v as ReviewStatus;
                            setLead((prev) =>
                              prev
                                ? { ...prev, reviewStatus: status }
                                : null,
                            );
                            handlePatch({ reviewStatus: status });
                          }}
                          disabled={patching}
                        >
                          <SelectTrigger className="w-full max-w-[220px] cursor-pointer">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {REVIEW_OPTIONS.map((o) => (
                              <SelectItem
                                key={o.value}
                                value={o.value}
                                className="cursor-pointer"
                              >
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {((userRole === "feedback" || userRole === "admin") &&
                      !lead.referralGenerated && (
                        <Dialog
                          open={referralOpen}
                          onOpenChange={setReferralOpen}
                        >
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="cursor-pointer"
                              onClick={() => {
                                setReferralDialogMode("referral");
                                setReferralOpen(true);
                              }}
                            >
                              Create referral
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="cursor-pointer"
                              onClick={() => {
                                setReferralDialogMode("from_review");
                                setReferralOpen(true);
                              }}
                            >
                              Create lead from review
                            </Button>
                          </div>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>
                                {referralDialogMode === "from_review"
                                  ? "Create lead from review (client gave number)"
                                  : "Create referral lead"}
                              </DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                              <div className="grid gap-2">
                                <Label htmlFor="ref-name">Name</Label>
                                <Input
                                  id="ref-name"
                                  value={referralName}
                                  onChange={(e) =>
                                    setReferralName(e.target.value)
                                  }
                                  placeholder="Full name"
                                />
                              </div>
                              <div className="grid gap-2">
                                <Label htmlFor="ref-phone">
                                  Phone (E.164)
                                </Label>
                                <Input
                                  id="ref-phone"
                                  value={referralPhone}
                                  onChange={(e) =>
                                    setReferralPhone(e.target.value)
                                  }
                                  placeholder="+1234567890"
                                />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button
                                variant="outline"
                                onClick={() => setReferralOpen(false)}
                                className="cursor-pointer"
                              >
                                Cancel
                              </Button>
                              <Button
                                onClick={handleCreateReferral}
                                disabled={referralSubmitting}
                                className="cursor-pointer"
                              >
                                {referralSubmitting && (
                                  <Loader2 className="mr-2 size-4 animate-spin" />
                                )}
                                Create
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      ))}
                    {lead.referralGenerated && lead.referralLeadId && (
                      <p className="text-sm text-muted-foreground">
                        Referral created{" "}
                        <Link
                          href={`/leads/${lead.referralLeadId}`}
                          className="text-primary underline"
                        >
                          View referral lead
                        </Link>
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Stage change & admin tools */}
              <div className="space-y-3 border-t pt-4">
                {nextStages.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Change stage
                    </p>
                    <Select
                      value=""
                      onValueChange={handleStageSelect}
                      disabled={stageUpdating}
                    >
                      <SelectTrigger className="w-[220px] cursor-pointer">
                        <SelectValue placeholder="Select next stage" />
                      </SelectTrigger>
                      <SelectContent>
                        {nextStages.map((s) => (
                          <SelectItem
                            key={s}
                            value={s}
                            className="cursor-pointer capitalize"
                          >
                            {s === "follow_up" ? "Follow up" : s.replace("_", " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {isAdmin && (
                  <Button
                    variant="outline"
                    onClick={() => setReassignOpen(true)}
                    className="cursor-pointer"
                  >
                    <UserPlus className="mr-2 size-4" />
                    Reassign lead
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {(lead.stage === "interested" ||
            lead.stage === "booking" ||
            lead.stage === "no_show" ||
            lead.stage === "done") && (
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">Booking</CardTitle>
                    <CardDescription>
                      Appointment details, booking channel, and message history.
                    </CardDescription>
                  </div>
                  {canEditBooking && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="cursor-pointer shrink-0"
                      onClick={handleOpenBookingDialog}
                    >
                      {lead.appointmentDate ? "Edit booking" : "Create booking"}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {lead.appointmentDate ? (
                  <div className="space-y-2 text-sm">
                    <p className="flex items-center gap-1.5 font-medium">
                      <CalendarDays className="size-4 text-muted-foreground" />
                      {formatBookingAppointmentDisplay(lead.appointmentDate)}
                    </p>
                    <p className="text-muted-foreground">
                      Advance:{" "}
                      {lead.advanceAmount != null
                        ? `₹${lead.advanceAmount}`
                        : "Not set"}
                    </p>
                    {lead.artistName && (
                      <p className="text-muted-foreground">
                        Artist: {lead.artistName}
                      </p>
                    )}
                    {lead.bookingChannel && (
                      <p className="text-muted-foreground">
                        Channel: {lead.bookingChannel}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No booking created yet.
                  </p>
                )}

                {(lead.bookingConfirmationSentAt ||
                  lead.bookingReminderDayBeforeSentAt ||
                  lead.bookingReminderSameDaySentAt ||
                  lead.bookingReviewSentAt) && (
                  <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    <p className="mb-1 font-semibold tracking-wide">
                      Messages
                    </p>
                    {lead.bookingConfirmationSentAt && (
                      <p>
                        Confirmation sent{" "}
                        {formatLeadDateTime(lead.bookingConfirmationSentAt)}
                      </p>
                    )}
                    {lead.bookingReminderDayBeforeSentAt && (
                      <p>
                        Day-before reminder sent{" "}
                        {formatLeadDateTime(lead.bookingReminderDayBeforeSentAt)}
                      </p>
                    )}
                    {lead.bookingReminderSameDaySentAt && (
                      <p>
                        Same-day reminder sent{" "}
                        {formatLeadDateTime(lead.bookingReminderSameDaySentAt)}
                      </p>
                    )}
                    {lead.bookingReviewSentAt && (
                      <p>
                        Review request sent{" "}
                        {formatLeadDateTime(lead.bookingReviewSentAt)}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <LeadFollowUps leadId={id} />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lead comments</CardTitle>
            <CardDescription>
              All staff roles can add comments. Only the original author can edit
              their own comment.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Textarea
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
                placeholder="Add a comment for this lead…"
                rows={4}
                maxLength={8000}
                className="min-h-[100px] resize-y"
                disabled={commentSubmitting}
              />
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground text-xs">
                  {commentDraft.length}/8000
                </span>
                <Button
                  type="button"
                  onClick={() => void handleCreateComment()}
                  disabled={commentSubmitting || commentDraft.trim().length === 0}
                  className="cursor-pointer"
                >
                  {commentSubmitting && !editingCommentId ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Add comment"
                  )}
                </Button>
              </div>
            </div>

            {!lead.comments || lead.comments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No comments yet.
              </p>
            ) : (
              <div className="space-y-3">
                {lead.comments.map((comment) => {
                  const isAuthor = comment.createdByUserId === currentUserId;
                  const isEditing = editingCommentId === comment.id;
                  const updated =
                    new Date(comment.updatedAt).getTime() >
                    new Date(comment.createdAt).getTime();

                  return (
                    <div
                      key={comment.id}
                      className="rounded-lg border p-3 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">
                            {comment.author.name}
                          </p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {comment.author.role.replace(/_/g, " ")} ·{" "}
                            {format(new Date(comment.createdAt), "MMM d, h:mm a")}
                            {updated
                              ? ` · edited ${format(new Date(comment.updatedAt), "MMM d, h:mm a")}`
                              : ""}
                          </p>
                        </div>
                        {isAuthor && !isEditing && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="cursor-pointer"
                            onClick={() => {
                              setEditingCommentId(comment.id);
                              setEditingCommentDraft(comment.content);
                            }}
                          >
                            Edit
                          </Button>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="space-y-3">
                          <Textarea
                            value={editingCommentDraft}
                            onChange={(e) =>
                              setEditingCommentDraft(e.target.value)
                            }
                            rows={4}
                            maxLength={8000}
                            className="min-h-[100px] resize-y"
                            disabled={commentSubmitting}
                          />
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground text-xs">
                              {editingCommentDraft.length}/8000
                            </span>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                className="cursor-pointer"
                                onClick={() => {
                                  setEditingCommentId(null);
                                  setEditingCommentDraft("");
                                }}
                                disabled={commentSubmitting}
                              >
                                Cancel
                              </Button>
                              <Button
                                type="button"
                                className="cursor-pointer"
                                onClick={() => void handleUpdateComment()}
                                disabled={
                                  commentSubmitting ||
                                  editingCommentDraft.trim().length === 0
                                }
                              >
                                {commentSubmitting ? (
                                  <>
                                    <Loader2 className="mr-2 size-4 animate-spin" />
                                    Saving…
                                  </>
                                ) : (
                                  "Save"
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">
                          {comment.content}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Stage History</CardTitle>
          </CardHeader>
          <CardContent>
            {lead.stageHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No stage changes yet.
              </p>
            ) : (
              <ul className="space-y-3">
                {lead.stageHistory.map((h) => (
                  <li
                    key={h.id}
                    className="flex items-center justify-between text-sm border-b pb-2 last:border-0"
                  >
                    <span className="capitalize">
                      {stageLabel(h.fromStage)} → {stageLabel(h.toStage)}
                    </span>
                    <span className="text-muted-foreground">
                      {format(new Date(h.changedAt), "MMM d, h:mm a")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {lead.timeline && lead.timeline.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Activity timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {lead.timeline.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-start justify-between gap-4 text-sm border-b pb-2 last:border-0"
                  >
                    <div className="space-y-1">
                      <span className="font-medium">
                        {timelineEventLabel(e.type)}
                      </span>
                      <p className="text-xs text-muted-foreground">
                        {timelineEventMeta(e)}
                      </p>
                      {typeof e.payload?.preview === "string" &&
                        e.payload.preview.trim() && (
                          <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                            {String(e.payload.preview)}
                          </p>
                        )}
                    </div>
                    <span className="text-muted-foreground shrink-0">
                      {format(new Date(e.createdAt), "MMM d, h:mm a")}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <LeadSummaryCard
          leadId={id}
          aiSummary={lead.aiSummary ?? null}
          aiSummaryUpdatedAt={lead.aiSummaryUpdatedAt ?? null}
          onRefresh={fetchLead}
          canAccess
        />

        <ReassignLeadDialog
          open={reassignOpen}
          onOpenChange={setReassignOpen}
          leadId={id}
          onSuccess={handleReassignSuccess}
        />

        <Dialog open={followUpDialogOpen} onOpenChange={setFollowUpDialogOpen}>
          <DialogContent className="sm:max-w-[560px]">
            <DialogHeader>
              <DialogTitle>
                {followUpTargetStage === "rnr" ? "RNR follow-up date" : "Follow-up date"}
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Select the base follow-up date and time. We&apos;ll create follow-ups
              at +6 hours, +1 day, +3 days, and +5 days from this selected time.
              {followUpTargetStage === "rnr"
                ? " The lead will be marked as RNR and then moved into Follow up."
                : ""}
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="follow-up-datetime">
                Follow-up start date & time
              </Label>
              <div className="grid gap-3 rounded-xl border bg-muted/20 p-3 md:grid-cols-[minmax(0,1fr)_220px]">
                <div className="min-w-0 space-y-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Date
                  </span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="follow-up-datetime"
                        type="button"
                        variant="outline"
                        className={cn(
                          "h-11 w-full justify-start text-left font-normal",
                          !followUpPicker.date && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 size-4" />
                        {followUpPicker.date
                          ? format(followUpPicker.date, "EEEE, MMM d, yyyy")
                          : "Select follow-up date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={followUpPicker.date}
                        onSelect={(selectedDate) => {
                          setFollowUpDateTime(
                            buildBookingDateTime(
                              selectedDate,
                              followUpPicker.hour12,
                              followUpPicker.minute,
                              followUpPicker.meridiem,
                            ),
                          );
                        }}
                        initialFocus
                        className="[&_button]:cursor-pointer"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="min-w-0 rounded-xl bg-background p-3 shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <Clock3 className="size-3.5" />
                    Time
                  </div>
                  <div className="mt-3 rounded-xl bg-primary px-3 py-4 text-center text-primary-foreground">
                    <div className="text-3xl font-semibold tabular-nums">
                      {followUpPicker.hour12}:{followUpPicker.minute}
                    </div>
                    <div className="mt-1 text-xs font-medium tracking-[0.2em] text-primary-foreground/80">
                      {followUpPicker.meridiem}
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <Select
                      value={followUpPicker.hour12}
                      disabled={!followUpPicker.date}
                      onValueChange={(value) =>
                        setFollowUpDateTime(
                          buildBookingDateTime(
                            followUpPicker.date,
                            value,
                            followUpPicker.minute,
                            followUpPicker.meridiem,
                          ),
                        )
                      }
                    >
                      <SelectTrigger className="cursor-pointer">
                        <SelectValue placeholder="HH" />
                      </SelectTrigger>
                      <SelectContent>
                        {BOOKING_HOURS.map((hour) => (
                          <SelectItem
                            key={hour}
                            value={hour}
                            className="cursor-pointer"
                          >
                            {hour}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={followUpPicker.minute}
                      disabled={!followUpPicker.date}
                      onValueChange={(value) =>
                        setFollowUpDateTime(
                          buildBookingDateTime(
                            followUpPicker.date,
                            followUpPicker.hour12,
                            value,
                            followUpPicker.meridiem,
                          ),
                        )
                      }
                    >
                      <SelectTrigger className="cursor-pointer">
                        <SelectValue placeholder="MM" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {BOOKING_MINUTES.map((minute) => (
                          <SelectItem
                            key={minute}
                            value={minute}
                            className="cursor-pointer"
                          >
                            {minute}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={followUpPicker.meridiem}
                      disabled={!followUpPicker.date}
                      onValueChange={(value) =>
                        setFollowUpDateTime(
                          buildBookingDateTime(
                            followUpPicker.date,
                            followUpPicker.hour12,
                            followUpPicker.minute,
                            value as "AM" | "PM",
                          ),
                        )
                      }
                    >
                      <SelectTrigger className="cursor-pointer">
                        <SelectValue placeholder="AM/PM" />
                      </SelectTrigger>
                      <SelectContent>
                        {(["AM", "PM"] as const).map((meridiem) => (
                          <SelectItem
                            key={meridiem}
                            value={meridiem}
                            className="cursor-pointer"
                          >
                            {meridiem}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setFollowUpDialogOpen(false)}
                className="cursor-pointer"
                disabled={followUpSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmFollowUp}
                disabled={followUpSubmitting}
                className="cursor-pointer"
              >
                {followUpSubmitting && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}
                Confirm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={bookingDialogOpen}
          onOpenChange={(open) => {
            setBookingDialogOpen(open);
            if (!open) setBookingStageOnSave(false);
          }}
        >
          <DialogContent className="sm:max-w-[560px]">
            <DialogHeader>
              <DialogTitle>
                {lead.appointmentDate ? "Edit booking" : "Create booking"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmitBooking} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="booking-datetime">Appointment date & time</Label>
                <div className="grid gap-3 rounded-xl border bg-muted/20 p-3 md:grid-cols-[minmax(0,1fr)_220px]">
                  <div className="min-w-0 space-y-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Date
                    </span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          id="booking-datetime"
                          type="button"
                          variant="outline"
                          className={cn(
                            "h-11 w-full justify-start text-left font-normal",
                            !bookingPicker.date && "text-muted-foreground",
                          )}
                        >
                          <CalendarIcon className="mr-2 size-4" />
                          {bookingPicker.date
                            ? format(bookingPicker.date, "EEEE, MMM d, yyyy")
                            : "Select appointment date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={bookingPicker.date}
                          onSelect={(selectedDate) => {
                            setBookingDateTime(
                              buildBookingDateTime(
                                selectedDate,
                                bookingPicker.hour12,
                                bookingPicker.minute,
                                bookingPicker.meridiem,
                              ),
                            );
                          }}
                          initialFocus
                          className="[&_button]:cursor-pointer"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="min-w-0 rounded-xl bg-background p-3 shadow-sm">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <Clock3 className="size-3.5" />
                      Time
                    </div>
                    <div className="mt-3 rounded-xl bg-primary px-3 py-4 text-center text-primary-foreground">
                      <div className="text-3xl font-semibold tabular-nums">
                        {bookingPicker.hour12}:{bookingPicker.minute}
                      </div>
                      <div className="mt-1 text-xs font-medium tracking-[0.2em] text-primary-foreground/80">
                        {bookingPicker.meridiem}
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <Select
                        value={bookingPicker.hour12}
                        disabled={!bookingPicker.date}
                        onValueChange={(value) =>
                          setBookingDateTime(
                            buildBookingDateTime(
                              bookingPicker.date,
                              value,
                              bookingPicker.minute,
                              bookingPicker.meridiem,
                            ),
                          )
                        }
                      >
                        <SelectTrigger className="cursor-pointer">
                          <SelectValue placeholder="HH" />
                        </SelectTrigger>
                        <SelectContent>
                          {BOOKING_HOURS.map((hour) => (
                            <SelectItem
                              key={hour}
                              value={hour}
                              className="cursor-pointer"
                            >
                              {hour}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={bookingPicker.minute}
                        disabled={!bookingPicker.date}
                        onValueChange={(value) =>
                          setBookingDateTime(
                            buildBookingDateTime(
                              bookingPicker.date,
                              bookingPicker.hour12,
                              value,
                              bookingPicker.meridiem,
                            ),
                          )
                        }
                      >
                        <SelectTrigger className="cursor-pointer">
                          <SelectValue placeholder="MM" />
                        </SelectTrigger>
                        <SelectContent className="max-h-72">
                          {BOOKING_MINUTES.map((minute) => (
                            <SelectItem
                              key={minute}
                              value={minute}
                              className="cursor-pointer"
                            >
                              {minute}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={bookingPicker.meridiem}
                        disabled={!bookingPicker.date}
                        onValueChange={(value) =>
                          setBookingDateTime(
                            buildBookingDateTime(
                              bookingPicker.date,
                              bookingPicker.hour12,
                              bookingPicker.minute,
                              value as "AM" | "PM",
                            ),
                          )
                        }
                      >
                        <SelectTrigger className="cursor-pointer">
                          <SelectValue placeholder="AM/PM" />
                        </SelectTrigger>
                        <SelectContent>
                          {(["AM", "PM"] as const).map((meridiem) => (
                            <SelectItem
                              key={meridiem}
                              value={meridiem}
                              className="cursor-pointer"
                            >
                              {meridiem}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="booking-advance">Advance amount (optional)</Label>
                <Input
                  id="booking-advance"
                  type="number"
                  min={0}
                  step={500}
                  value={bookingAdvance}
                  onChange={(e) => setBookingAdvance(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="booking-artist">Artist (optional)</Label>
                <Input
                  id="booking-artist"
                  type="text"
                  value={bookingArtist}
                  onChange={(e) => setBookingArtist(e.target.value)}
                  className="w-full"
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setBookingDialogOpen(false)}
                  className="cursor-pointer"
                  disabled={bookingSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={bookingSubmitting}
                  className="cursor-pointer"
                >
                  {bookingSubmitting ? (
                    <Loader2 className="size-4 animate-spin mr-2" />
                  ) : null}
                  Save booking
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Right side: chat panel (60–70% on large screens), uses full viewport height & stays in view */}
      <div className="w-full lg:basis-3/5 lg:max-w-[60%] shrink-0 lg:sticky lg:top-4 lg:self-start">
        <div className="h-[calc(100vh-6rem)]">
          <LeadChatPanel
            leadId={id}
            leadName={leadDisplayName}
            canReply={true}
            whatsappPhone={
              lead.whatsappPhone ??
              (lead.source === "whatsapp" ? (lead.phone as string) : null)
            }
            instagramUserId={lead.instagramUserId ?? null}
            onLeadUpdated={() => fetchLead({ silent: true })}
          />
        </div>
      </div>
    </div>
  );
}
