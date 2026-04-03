"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LeadChatHeader } from "@/features/chat/components/lead-chat-header";
import { LeadMessageInput } from "@/features/chat/components/lead-message-input";
import { LeadMessageList } from "@/features/chat/components/lead-message-list";
import type { ChatMessage as UIChatMessage, ChatUser } from "@/features/chat/utils/chat-ui-types";
import { Loader2 } from "lucide-react";
import { startTransition, useCallback, useEffect, useOptimistic, useState } from "react";
import { toast } from "sonner";

type MessageChannel = "app" | "whatsapp" | "instagram";

interface ApiReaction {
  emoji: string;
  userId: string;
}

interface ApiMessage {
  id: string;
  content: string;
  createdAt: string;
  senderRole: "admin" | "sales" | "client";
  channel: MessageChannel;
  direction?: "inbound" | "outbound" | null;
  attachmentUrl?: string | null;
  attachmentType?: "image" | "video" | "file" | null;
  externalMessageId?: string | null;
  reactions?: ApiReaction[];
  replyTo?: {
    id: string;
    content?: string;
    senderRole?: string;
    attachmentType?: string;
  };
}

interface LeadChatPanelProps {
  leadId: string;
  leadName: string;
  canReply: boolean;
  whatsappPhone?: string | null;
  instagramUserId?: string | null;
  onLeadUpdated?: () => void | Promise<void>;
}

const CHANNEL_LABELS: Record<MessageChannel, string> = {
  app: "App",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
};

function mapReactions(apiReactions?: ApiReaction[]): UIChatMessage["reactions"] {
  if (!apiReactions?.length) return [];
  const byEmoji = new Map<string, string[]>();
  for (const r of apiReactions) {
    const users = byEmoji.get(r.emoji) ?? [];
    if (!users.includes(r.userId)) users.push(r.userId);
    byEmoji.set(r.emoji, users);
  }
  return Array.from(byEmoji.entries()).map(([emoji, users]) => ({
    emoji,
    users,
    count: users.length,
  }));
}

function mapApiToUiMessage(m: ApiMessage): UIChatMessage {
  return {
    id: m.id,
    content: m.content,
    timestamp: m.createdAt,
    senderId: m.senderRole === "client" ? "client" : "staff",
    type: (m.attachmentType as UIChatMessage["type"]) ?? "text",
    isEdited: false,
    reactions: mapReactions(m.reactions),
    replyTo: m.replyTo?.id ?? null,
    attachmentUrl: m.attachmentUrl ?? null,
    attachmentType: m.attachmentType ?? null,
    channel: m.channel,
    replyToPreview: m.replyTo,
  };
}

export function LeadChatPanel({
  leadId,
  leadName,
  canReply,
  whatsappPhone,
  instagramUserId,
  onLeadUpdated,
}: LeadChatPanelProps) {
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [optimisticMessages, addOptimisticMessage] = useOptimistic(
    messages,
    (state: ApiMessage[], optimisticMessage: ApiMessage) => [
      ...state,
      optimisticMessage,
    ],
  );
  const [loading, setLoading] = useState(true);
  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<UIChatMessage | null>(null);
  const [channel, setChannel] = useState<MessageChannel>(() =>
    whatsappPhone && !instagramUserId
      ? "whatsapp"
      : instagramUserId && !whatsappPhone
        ? "instagram"
        : "app"
  );

  const channels: MessageChannel[] = ["app"];
  if (whatsappPhone) channels.push("whatsapp");
  if (instagramUserId) channels.push("instagram");

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/chats/${leadId}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.messages)) {
        setMessages(
          data.messages.map((m: ApiMessage) => ({
            id: m.id,
            content: m.content,
            createdAt: m.createdAt,
            senderRole: m.senderRole,
            channel: m.channel,
            direction: m.direction,
            attachmentUrl: m.attachmentUrl ?? null,
            attachmentType: m.attachmentType ?? null,
            externalMessageId: m.externalMessageId ?? null,
            reactions: m.reactions ?? [],
            replyTo: m.replyTo ?? undefined,
          }))
        );
      } else if (res.status === 403 || res.status === 404) {
        setMessages([]);
      }
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        fetchMessages();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  const handleReaction = async (messageId: string, emoji: string) => {
    const msg = messages.find((m) => m.id === messageId);
    if (!msg) return;

    const canSyncReaction =
      !!msg.externalMessageId &&
      (msg.channel === "whatsapp" || msg.channel === "instagram");

    const applyReaction = (reactions: ApiReaction[]) =>
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, reactions } : m,
        ),
      );

    const existing = msg.reactions ?? [];
    const staffId = "staff";
    const others = existing.filter((r) => r.userId !== staffId);
    const optimistic =
      emoji ? [...others, { emoji, userId: staffId }] : others;
    applyReaction(optimistic);

    if (!canSyncReaction) return;

    try {
      const res = await fetch(`/api/chats/${leadId}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, emoji }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed to send reaction");
        applyReaction(existing);
      } else if (data.reactions) {
        applyReaction(data.reactions);
      }
    } catch {
      toast.error("Failed to send reaction");
      applyReaction(existing);
    }
  };

  const handleSend = async (content: string, files?: File[] | null) => {
    const trimmed = content.trim();
    const hasFiles = !!files && files.length > 0;
    if ((!trimmed && !hasFiles) || !canReply || sending) return;

    const sendChannel =
      replyTo?.channel && replyTo.channel !== "app"
        ? replyTo.channel
        : channel;

    setSending(true);
    try {
      if (hasFiles) {
        const created: ApiMessage[] = [];

        for (const [index, file] of (files ?? []).entries()) {
          const optimisticId = `optimistic-${Date.now()}-${index}`;
          const optimisticMessage: ApiMessage = {
            id: optimisticId,
            content: index === 0 ? trimmed : "",
            createdAt: new Date().toISOString(),
            senderRole: "sales",
            channel: sendChannel,
            direction: sendChannel === "app" ? null : "outbound",
            attachmentUrl: URL.createObjectURL(file),
            attachmentType: file.type.startsWith("image/")
              ? "image"
              : file.type.startsWith("video/")
                ? "video"
                : "file",
            replyTo: replyTo
              ? {
                  id: replyTo.id,
                  content: replyTo.content,
                  senderRole: replyTo.senderId === "client" ? "client" : "sales",
                  attachmentType: replyTo.attachmentType ?? undefined,
                }
              : undefined,
          };
          startTransition(() => addOptimisticMessage(optimisticMessage));

          const formData = new FormData();
          formData.set("content", index === 0 ? trimmed : "");
          formData.set("channel", sendChannel);
          formData.set("file", file);
          if (replyTo?.id) formData.set("replyToMessageId", replyTo.id);

          const res = await fetch(`/api/chats/${leadId}/send`, {
            method: "POST",
            body: formData,
          });
          const data = await res.json();

          if (!res.ok) {
            toast.error(data.error ?? "Failed to send message");
            return;
          }

          created.push({
            id: data.id,
            content: data.content ?? "",
            createdAt: data.createdAt,
            senderRole: data.senderRole,
            channel: data.channel,
            direction: data.direction ?? "outbound",
            attachmentUrl: data.attachmentUrl ?? null,
            attachmentType: data.attachmentType ?? null,
            replyTo: data.replyTo ?? undefined,
          });
        }

        if (created.length) {
          setMessages((prev) => [...prev, ...created]);
          void onLeadUpdated?.();
        }
      } else {
        const optimisticMessage: ApiMessage = {
          id: `optimistic-${Date.now()}`,
          content: trimmed,
          createdAt: new Date().toISOString(),
          senderRole: "sales",
          channel: sendChannel,
          direction: sendChannel === "app" ? null : "outbound",
          replyTo: replyTo
            ? {
                id: replyTo.id,
                content: replyTo.content,
                senderRole: replyTo.senderId === "client" ? "client" : "sales",
                attachmentType: replyTo.attachmentType ?? undefined,
              }
            : undefined,
        };
        startTransition(() => addOptimisticMessage(optimisticMessage));

        const res = await fetch(`/api/chats/${leadId}/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: trimmed,
            channel: sendChannel,
            ...(replyTo?.id && { replyToMessageId: replyTo.id }),
          }),
        });
        const data = await res.json();

        if (!res.ok) {
          toast.error(data.error ?? "Failed to send message");
          return;
        }

        setMessages((prev) => [
          ...prev,
          {
            id: data.id,
            content: data.content ?? "",
            createdAt: data.createdAt,
            senderRole: data.senderRole,
            channel: data.channel,
            direction: data.direction ?? "outbound",
            attachmentUrl: data.attachmentUrl ?? null,
            attachmentType: data.attachmentType ?? null,
            replyTo: data.replyTo ?? undefined,
          },
        ]);
        void onLeadUpdated?.();
      }
      setInputValue("");
      setReplyTo(null);
    } catch {
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const uiMessages: UIChatMessage[] = optimisticMessages.map(mapApiToUiMessage);
  const users: ChatUser[] = [
    { id: "client", name: leadName },
    { id: "staff", name: "You" },
  ];

  return (
    <Card className="flex h-full min-h-[320px] flex-col">
      <CardContent className="flex min-h-0 flex-1 flex-col gap-0 p-0">
        <div className="shrink-0 border-b px-4 py-3">
          <LeadChatHeader
            leadName={leadName}
            channelLabel={CHANNEL_LABELS[channel]}
          />
        </div>

        <div className="flex-1 min-h-0 flex flex-col" style={{ minHeight: 200 }}>
          {loading ? (
            <div className="flex items-center justify-center flex-1 py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <p className="flex-1 flex items-center justify-center py-8 text-center text-sm text-muted-foreground">
              No messages yet. Start the conversation below.
            </p>
          ) : (
            <LeadMessageList
              messages={uiMessages}
              users={users}
              currentUserId="staff"
              leadName={leadName}
              onReplyMessage={(msg) => setReplyTo(msg)}
              onReaction={handleReaction}
            />
          )}
        </div>

        {channels.length > 1 && (
          <div className="flex flex-wrap gap-1 px-4 py-2 border-t">
            {channels.map((ch) => (
              <Button
                key={ch}
                type="button"
                variant={channel === ch ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-xs cursor-pointer"
                onClick={() => setChannel(ch)}
              >
                {CHANNEL_LABELS[ch]}
              </Button>
            ))}
          </div>
        )}

        {canReply && (
          <LeadMessageInput
            onSendMessage={handleSend}
            disabled={sending}
            isSending={sending}
            value={inputValue}
            onChange={setInputValue}
            replyTo={
              replyTo
                ? {
                    author:
                      replyTo.senderId === "client" ? leadName : "You",
                    preview:
                      replyTo.content ||
                      (replyTo.attachmentType ? "Media message" : ""),
                  }
                : undefined
            }
            onCancelReply={() => setReplyTo(null)}
          />
        )}
      </CardContent>
    </Card>
  );
}
