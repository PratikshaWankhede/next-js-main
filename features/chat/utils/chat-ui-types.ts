export interface ChatUser {
  id: string;
  name: string;
  avatar?: string;
}

export interface ChatMessage {
  id: string;
  content: string;
  timestamp: string;
  senderId: string;
  type: "text" | "image" | "file" | "audio";
  isEdited: boolean;
  reactions: { emoji: string; users: string[]; count: number }[];
  replyTo: string | null;
  attachments?: unknown[];
  attachmentUrl?: string | null;
  attachmentType?: "image" | "video" | "file" | null;
  channel?: "app" | "whatsapp" | "instagram";
  /** Full preview of the message we're replying to (for quoted block display) */
  replyToPreview?: {
    id: string;
    content?: string;
    senderRole?: string;
    attachmentType?: string;
  };
}
