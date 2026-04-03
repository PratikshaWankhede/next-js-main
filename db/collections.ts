export const USER = "user";
export const SESSION = "session";
export const ACCOUNT = "account";
export const VERIFICATION = "verification";
export const LEADS = "leads";
export const LEAD_STAGE_HISTORY = "lead_stage_history";
export const LEAD_REASSIGNMENT_LOGS = "lead_reassignment_logs";
export const LEAD_COMMENTS = "lead_comments";
export const FOLLOW_UPS = "follow_ups";
export const CHAT_CONVERSATIONS = "chat_conversations";
export const CHAT_MESSAGES = "chat_messages";
export const NOTIFICATIONS = "notifications";
export const NOTIFICATION_PREFERENCES = "notification_preferences";
export const NOTIFICATION_DELIVERIES = "notification_deliveries";
export const ALERTS = "alerts";
export const SLA_LOGS = "sla_logs";
export const TATTOO_TYPES = "tattoo_types";
export const INSTAGRAM_WEBHOOK_LOGS = "instagram_webhook_logs";
export const WHATSAPP_WEBHOOK_LOGS = "whatsapp_webhook_logs";
export const CHAT_UPLOADS = "chat_uploads";
export const APP_SETTINGS = "app_settings";
export const LEAD_ROUTING_RULES = "lead_routing_rules";
export const WHATSAPP_NUMBERS = "whatsapp_numbers";
export const LEAD_TIMELINE = "lead_timeline";

export type LeadStage =
  | "new"
  | "contacted"
  | "interested"
  | "rnr"
  | "follow_up"
  | "booking"
  | "no_show"
  | "done"
  | "lost";
export type LeadSource =
  | "whatsapp"
  | "instagram"
  | "manual"
  | "referral"
  | "website";
export type SlaStatus = "pending" | "met" | "breached";
export type AiScore = "hot" | "warm" | "cold";
export type FollowUpStatus = "pending" | "completed" | "missed";
export type SenderRole = "admin" | "sales" | "client";
export type MessageChannel = "app" | "whatsapp" | "instagram";
export type MessageDirection = "inbound" | "outbound";
export type NotificationType =
  | "sla_breach"
  | "follow_up_missed"
  | "new_inbound"
  | "reassigned";
export type NotificationChannel = "in_app" | "email" | "whatsapp";
export type DeliveryStatus = "pending" | "sent" | "failed";
export type AlertType = "sla_breach" | "follow_up_missed";
export type SlaLogType = "first_response" | "follow_up_missed";
export type RevenueTag = "S" | "A" | "B" | "C";
export type ReviewStatus =
  | "not_started"
  | "review_sent"
  | "review_submitted"
  | "reminder_1"
  | "reminder_2"
  | "closed";
export type RoleOwner = "sales" | "follow_up_candidate";
export type BookingChannel = "whatsapp" | "instagram" | "manual";

export interface UserDoc {
  id: string;
  name: string;
  email: string;
  emailVerified?: boolean;
  image?: string | null;
  role: string;
  whatsappPhone?: string | null;
  banned?: boolean;
  banReason?: string | null;
  banExpires?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeadDoc {
  id: string;
  name: string;
  customName?: string | null;
  phone: string;
  source: LeadSource;
  stage: LeadStage;
  assignedUserId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  firstResponseAt?: Date | null;
  slaBreachedAt?: Date | null;
  slaStatus: SlaStatus;
  whatsappPhone?: string | null;
  instagramUserId?: string | null;
  instagramUsername?: string | null;
  aiSummary?: string | null;
  aiSummaryUpdatedAt?: Date | null;
  aiScore?: AiScore | null;
  aiScoreReason?: string | null;
  aiScoreUpdatedAt?: Date | null;
  tattooTypeId?: string | null;
  estimatedAmount?: number | null;
  revenueTag?: RevenueTag | null;
  isNoShow?: boolean;
  noShowCount?: number;
  noShowAt?: Date | null;
  lostCount?: number;
  lostAt?: Date | null;
  lostReason?: string | null;
  exitedFromCrmAt?: Date | null;
  recoveryCycle?: number;
  noShowFollowUpCycle?: number;
  noShowReentryAt?: Date | null;
  noShowFollowUpUntil?: Date | null;
  reentryAt?: Date | null;
  previousAssignedUserId?: string | null;
  doneAt?: Date | null;
  reviewStatus?: ReviewStatus | null;
  referralGenerated?: boolean;
  referralLeadId?: string | null;
  parentLeadId?: string | null;
  roleOwner?: RoleOwner | null;
  appointmentDate?: Date | null;
  advanceAmount?: number | null;
  artistName?: string | null;
  bookingChannel?: BookingChannel | null;
  bookingReminderDayBeforeSentAt?: Date | null;
  bookingReminderSameDaySentAt?: Date | null;
  bookingReviewSentAt?: Date | null;
  bookingConfirmationSentAt?: Date | null;
}

export interface LeadCommentDoc {
  id: string;
  leadId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string;
  createdByRole: string;
}

export interface LeadStageHistoryDoc {
  id: string;
  leadId: string;
  fromStage: LeadStage;
  toStage: LeadStage;
  changedByUserId: string;
  changedAt: Date;
}

export interface LeadReassignmentLogDoc {
  id: string;
  leadId: string;
  fromUserId: string;
  toUserId: string;
  reason: string;
  changedByAdminId: string;
  changedAt: Date;
}

export type LeadTimelineEventType =
  | "lead_created"
  | "stage_changed"
  | "booking_created"
  | "booking_updated"
  | "comment_added"
  | "comment_edited"
  | "no_show"
  | "reschedule"
  | "referred_to_fc"
  | "reassigned_to_sales"
  | "exited_crm";

export interface LeadTimelineDoc {
  id: string;
  leadId: string;
  type: LeadTimelineEventType;
  payload: Record<string, unknown>;
  createdAt: Date;
  userId?: string | null;
}

export interface FollowUpDoc {
  id: string;
  leadId: string;
  assignedUserId: string;
  scheduledAt: Date;
  completedAt?: Date | null;
  status: FollowUpStatus;
  note?: string | null;
  createdAt: Date;
}

export interface ChatConversationDoc {
  id: string;
  leadId: string;
  createdAt: Date;
}

export type ChatAttachmentType = "image" | "video" | "file";

export interface ChatReactionEntry {
  emoji: string;
  userId: string; // "client" for lead, or staff user id
}

export interface ChatMessageDoc {
  id: string;
  conversationId: string;
  senderId?: string | null;
  senderRole: SenderRole;
  content: string;
  createdAt: Date;
  channel: MessageChannel;
  direction?: MessageDirection | null;
  externalMessageId?: string | null;
  attachmentUrl?: string | null;
  attachmentType?: ChatAttachmentType | null;
  /** Reactions from staff (CRM) or client (WhatsApp). Persisted for display after refresh. */
  reactions?: ChatReactionEntry[];
  /** ID of the message this one replies to (for quoted/reply display) */
  replyToMessageId?: string | null;
}

export interface ChatUploadDoc {
  id: string;
  contentType: string;
  /**
   * Legacy inline binary data. New uploads should prefer S3 metadata fields
   * and leave this null to avoid storing large blobs in the database.
   */
  data?: Buffer | null;
  filename?: string | null;
  createdAt: Date;
  /**
   * Optional WhatsApp media ID returned by the Meta
   * `/media` endpoint when this upload is also stored
   * in WhatsApp Cloud API. Used to re-send media by ID
   * without re-uploading the binary.
   */
  whatsappMediaId?: string | null;
  /**
   * S3 storage metadata for chat uploads. When present, the
   * file is stored in S3 rather than inline in the database.
   */
  s3Bucket?: string | null;
  s3Key?: string | null;
  size?: number | null;
}

export interface NotificationDoc {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  message: string;
  leadId?: string | null;
  isRead: boolean;
  createdAt: Date;
}

export interface NotificationPreferenceDoc {
  userId: string;
  channel: NotificationChannel;
  type: NotificationType;
  enabled: boolean;
}

export interface NotificationDeliveryDoc {
  id: string;
  notificationId: string;
  channel: NotificationChannel;
  status: DeliveryStatus;
  error?: string | null;
  attemptedAt: Date;
}

export interface AlertDoc {
  id: string;
  type: AlertType;
  leadId: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
}

export interface SlaLogDoc {
  id: string;
  leadId: string;
  followUpId?: string | null;
  type: SlaLogType;
  breachedAt: Date;
  resolvedAt?: Date | null;
  createdAt: Date;
}

export interface TattooTypeDoc {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InstagramWebhookLogDoc {
  id: string;
  receivedAt: Date;
  payload: unknown;
}

export interface WhatsAppWebhookLogDoc {
  id: string;
  receivedAt: Date;
  payload: unknown;
}

export interface SlaSettingsDoc {
  id: "sla";
  firstResponseSlaMinutes: number;
  updatedAt: Date;
}

export interface BookingTemplatesDoc {
  id: "booking_templates";
  bookingConfirmationBody: string;
  bookingReminderBody: string;
  bookingReviewBody: string;
  updatedAt: Date;
  updatedByUserId: string;
}

export interface LeadRoutingRuleDoc {
  id: string;
  source: "whatsapp" | "instagram";
  /**
   * For WhatsApp: the business phone_number_id this rule applies to.
   * If omitted, the rule applies to all WhatsApp traffic that does not
   * match a more specific phone_number_id rule.
   */
  whatsappPhoneNumberId?: string | null;
  /**
   * Reserved for future Instagram multi-account routing.
   * For now we only support a single \"default\" scope.
   */
  instagramScope?: "default" | null;
  assignedUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WhatsAppBusinessNumberDoc {
  id: string;
  phoneNumberId: string;
  displayPhoneNumber: string;
  createdAt: Date;
  updatedAt: Date;
}
