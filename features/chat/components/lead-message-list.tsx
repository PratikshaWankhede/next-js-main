"use client";

import { format, isToday, isYesterday } from "date-fns";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import EmojiPicker, { type Theme as EmojiTheme } from "emoji-picker-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { normalizeChatAttachmentUrl } from "@/lib/chat-attachment-url";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy as CopyIcon,
  Download,
  MessageCircle,
  Pin,
  SmilePlus,
  Trash2,
  X,
} from "lucide-react";
import type { ChatMessage, ChatUser } from "../utils/chat-ui-types";

interface LeadMessageListProps {
  messages: ChatMessage[];
  users: ChatUser[];
  currentUserId?: string;
  onReplyMessage?: (message: ChatMessage) => void;
  onReaction?: (messageId: string, emoji: string) => void;
  leadName?: string;
}

function formatMessageTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (isToday(date)) {
    return format(date, "h:mm a");
  }
  if (isYesterday(date)) {
    return `Yesterday ${format(date, "h:mm a")}`;
  }
  return format(date, "MMM d, h:mm a");
}

function formatDateHeader(dateString: string): string {
  const date = new Date(dateString);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "EEEE, MMMM d");
}

function formatWhatsAppLike(text: string): string {
  const escapeHtml = (unsafe: string) =>
    unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  let escaped = escapeHtml(text);

  // Bold: *text*
  escaped = escaped.replace(/\*(.+?)\*/g, "<strong>$1</strong>");

  // Italic: _text_
  escaped = escaped.replace(/_(.+?)_/g, "<em>$1</em>");

  // Strikethrough: ~text~
  escaped = escaped.replace(/~(.+?)~/g, "<s>$1</s>");

  // Line breaks
  escaped = escaped.replace(/\r\n|\r|\n/g, "<br />");

  return escaped;
}

export function LeadMessageList({
  messages,
  users,
  currentUserId = "staff",
  onReplyMessage,
  onReaction,
  leadName = "Client",
}: LeadMessageListProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [pinnedById, setPinnedById] = useState<Record<string, boolean>>({});
  const [hiddenById, setHiddenById] = useState<Record<string, boolean>>({});
  const [attachmentLoadErrorById, setAttachmentLoadErrorById] = useState<
    Record<string, boolean>
  >({});
  const [reactionPickerForId, setReactionPickerForId] = useState<string | null>(
    null,
  );
  const [emojiPickerForId, setEmojiPickerForId] = useState<string | null>(null);
  const [hasInitialScroll, setHasInitialScroll] = useState(false);
  const messageRefsMap = useRef<Map<string, HTMLElement>>(new Map());
  const lastMessageIdRef = useRef<string | null>(null);

  const getScrollViewport = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return null;
    return container.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]');
  }, []);

  const scrollToMessage = (messageId: string) => {
    const el = messageRefsMap.current.get(messageId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-primary", "ring-offset-2", "rounded-xl");
      setTimeout(
        () =>
          el.classList.remove(
            "ring-2",
            "ring-primary",
            "ring-offset-2",
            "rounded-xl",
          ),
        2000,
      );
    }
  };

  // On first load (after messages arrive), scroll the chat viewport to show the latest message.
  // We only do this once so later new messages don't force-scroll while the user is reading.
  useEffect(() => {
    if (hasInitialScroll) return;
    if (!messages || messages.length === 0) return;
    const viewport = getScrollViewport();
    if (!viewport) return;
    viewport.scrollTop = viewport.scrollHeight;
    lastMessageIdRef.current = messages[messages.length - 1]?.id ?? null;
    setHasInitialScroll(true);
  }, [messages, hasInitialScroll, getScrollViewport]);

  useEffect(() => {
    if (!hasInitialScroll || messages.length === 0) return;

    const latestMessageId = messages[messages.length - 1]?.id ?? null;
    if (!latestMessageId || latestMessageId === lastMessageIdRef.current) return;

    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    lastMessageIdRef.current = latestMessageId;
  }, [messages, hasInitialScroll]);

  const visibleMessages = useMemo(
    () => messages.filter((m) => !hiddenById[m.id]),
    [messages, hiddenById],
  );

  const imageMessages = useMemo(
    () =>
      visibleMessages
        .filter((m) => {
          if (!m.attachmentUrl) return false;
          const url =
            normalizeChatAttachmentUrl(m.attachmentUrl) ?? m.attachmentUrl;
          return (
            m.attachmentType === "image" ||
            /\.(jpe?g|png|gif|webp)$/i.test(url)
          );
        })
        .map((m) => ({
          id: m.id,
          url: normalizeChatAttachmentUrl(m.attachmentUrl) ?? (m.attachmentUrl as string),
          timestamp: m.timestamp,
        })),
    [visibleMessages],
  );

  const handleOpenViewer = (messageId: string) => {
    if (!imageMessages.length) return;
    const idx = imageMessages.findIndex((m) => m.id === messageId);
    setViewerIndex(idx === -1 ? 0 : idx);
    setViewerOpen(true);
  };

  const showPrevImage = () => {
    if (imageMessages.length <= 1) return;
    setViewerIndex((prev) =>
      prev === 0 ? imageMessages.length - 1 : prev - 1,
    );
  };

  const showNextImage = () => {
    if (imageMessages.length <= 1) return;
    setViewerIndex((prev) =>
      prev === imageMessages.length - 1 ? 0 : prev + 1,
    );
  };

  const getUserById = (userId: string): ChatUser | undefined =>
    users.find((u) => u.id === userId);

  const messageGroups = (() => {
    const groups: { date: string; messages: ChatMessage[] }[] = [];
    visibleMessages.forEach((msg) => {
      const date = format(new Date(msg.timestamp), "yyyy-MM-dd");
      const last = groups[groups.length - 1];
      if (last && last.date === date) {
        last.messages.push(msg);
      } else {
        groups.push({ date, messages: [msg] });
      }
    });
    return groups;
  })();

  const shouldShowAvatar = (msg: ChatMessage, index: number): boolean => {
    if (msg.senderId === currentUserId) return false;
    if (index === 0) return true;
    return visibleMessages[index - 1].senderId !== msg.senderId;
  };

  const shouldShowName = (msg: ChatMessage, index: number): boolean => {
    if (msg.senderId === currentUserId) return false;
    if (index === 0) return true;
    return visibleMessages[index - 1].senderId !== msg.senderId;
  };

  const isConsecutive = (index: number): boolean => {
    if (index === 0) return false;
    const prev = visibleMessages[index - 1];
    const curr = visibleMessages[index];
    const diff =
      new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime();
    return prev.senderId === curr.senderId && diff < 5 * 60 * 1000;
  };

  let messageIndex = 0;

  return (
    <>
      <div ref={scrollContainerRef} className="flex-1 h-full">
        <ScrollArea className="h-full w-full">
          <div className="space-y-4 py-4 px-4">
          {messageGroups.map((group) => (
            <div key={group.date}>
              <div className="flex justify-center py-4">
                <span className="text-xs font-medium text-muted-foreground bg-muted/50 px-4 py-1.5 rounded-full">
                  {formatDateHeader(group.date)}
                </span>
              </div>
              <div className="space-y-3">
                {group.messages.map((msg) => {
                  const idx = messageIndex++;
                  const user = getUserById(msg.senderId);
                  const isOwn = msg.senderId === currentUserId;
                  const showAvatar = shouldShowAvatar(msg, idx);
                  const showName = shouldShowName(msg, idx);
                  const consecutive = isConsecutive(idx);
                  const initials = user
                    ? user.name
                        .trim()
                        .split(/\s+/)
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase() || "?"
                    : "?";

                  return (
                    <div
                      key={msg.id}
                      ref={(el) => {
                        if (el) messageRefsMap.current.set(msg.id, el);
                      }}
                      data-message-id={msg.id}
                      className={cn(
                        "flex gap-3 group",
                        isOwn && "flex-row-reverse"
                      )}
                    >
                      {!isOwn && (
                        <div className="w-8 shrink-0">
                          {showAvatar && (
                            <Avatar className="size-8">
                              <AvatarFallback className="text-xs">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                          )}
                        </div>
                      )}
                      <div
                        className={cn(
                          "min-w-0 max-w-[70%]",
                          isOwn
                            ? "flex flex-1 flex-col items-end"
                            : "w-fit"
                        )}
                      >
                        {showName && user && !isOwn && (
                          <div className="text-sm font-medium text-foreground mb-1">
                            {user.name}
                          </div>
                        )}
                        <div
                          className={cn(
                            "relative rounded-2xl px-4 py-2.5 text-sm shadow-sm break-words",
                            isOwn
                              ? "bg-primary text-primary-foreground rounded-br-md"
                              : "bg-muted rounded-bl-md",
                            consecutive && "mt-1"
                          )}
                        >
                          {reactionPickerForId === msg.id && (
                            <div
                              className={cn(
                                "pointer-events-auto absolute -top-12 left-1/2 -translate-x-1/2",
                                "flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-lg shadow-lg",
                              )}
                            >
                              {["👍", "❤️", "😂", "😮", "😢", "🙏"].map(
                                (emoji) => {
                                  const staffReaction = msg.reactions?.find(
                                    (r) =>
                                      r.users.some((u) => u !== "client"),
                                  );
                                  const currentEmoji = staffReaction?.emoji;
                                  const newEmoji =
                                    currentEmoji === emoji ? "" : emoji;
                                  return (
                                    <button
                                      key={emoji}
                                      type="button"
                                      className="leading-none transition-transform hover:scale-110"
                                      onClick={() => {
                                        setReactionPickerForId(null);
                                        setEmojiPickerForId(null);
                                        onReaction?.(msg.id, newEmoji);
                                      }}
                                    >
                                      {emoji}
                                    </button>
                                  );
                                },
                              )}
                              <button
                                type="button"
                                className="ml-1 text-xs font-semibold leading-none text-muted-foreground"
                                onClick={() =>
                                  setEmojiPickerForId((current) =>
                                    current === msg.id ? null : msg.id,
                                  )
                                }
                                aria-label="More reactions"
                              >
                                +
                              </button>
                            </div>
                          )}
                          {emojiPickerForId === msg.id && (
                            <div className="pointer-events-auto absolute -bottom-2 right-0 z-20 translate-y-full">
                              <EmojiPicker
                                onEmojiClick={(emojiData) => {
                                  const emoji = emojiData.emoji;
                                  const staffReaction = msg.reactions?.find(
                                    (r) =>
                                      r.users.some((u) => u !== "client"),
                                  );
                                  const currentEmoji = staffReaction?.emoji;
                                  const newEmoji =
                                    currentEmoji === emoji ? "" : emoji;
                                  setEmojiPickerForId(null);
                                  setReactionPickerForId(null);
                                  onReaction?.(msg.id, newEmoji);
                                }}
                                theme={
                                  (typeof window !== "undefined" &&
                                  document.documentElement.classList.contains(
                                    "dark",
                                  )
                                    ? "dark"
                                    : "light") as EmojiTheme
                                }
                                width={280}
                                height={360}
                              />
                            </div>
                          )}
                          <button
                            type="button"
                            className={cn(
                              "pointer-events-auto inline-flex h-8 w-8 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm transition-opacity border",
                              "opacity-0 group-hover:opacity-100",
                              "absolute top-1/2 -translate-y-1/2",
                              isOwn ? "-left-9" : "-right-7",
                            )}
                            aria-label="Add reaction"
                            onClick={() => {
                              setReactionPickerForId((current) =>
                                current === msg.id ? null : msg.id,
                              );
                              setEmojiPickerForId(null);
                            }}
                          >
                            <SmilePlus className="size-4" />
                          </button>
                          <div className="pointer-events-none absolute right-1 top-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className={cn(
                                    "pointer-events-auto inline-flex h-5 w-5 items-center justify-center rounded-full bg-background/70 text-foreground shadow-sm",
                                    !isOwn && "rtl:rotate-180",
                                  )}
                                  aria-label="Message options"
                                >
                                  <ChevronDown className="size-3" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className="min-w-[180px]"
                              >
                                <DropdownMenuItem
                                  onClick={() => {
                                    // Let parent handle reply UI (e.g. show reply preview in input)
                                    if (typeof window !== "undefined") {
                                      window.setTimeout(() => {
                                        const el = document.querySelector(
                                          "[aria-label='Message input']",
                                        ) as HTMLTextAreaElement | null;
                                        el?.focus();
                                      }, 0);
                                    }
                                    onReplyMessage?.(msg);
                                  }}
                                >
                                  <MessageCircle className="mr-2 size-4" />
                                  <span>Reply</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={async () => {
                                    const textContent =
                                      (msg.content && msg.content.trim()) || "";
                                    const attachmentUrl =
                                      normalizeChatAttachmentUrl(
                                        msg.attachmentUrl,
                                      ) ??
                                      msg.attachmentUrl ??
                                      "";

                                    const isImageAttachment =
                                      !!attachmentUrl &&
                                      (msg.attachmentType === "image" ||
                                        /\.(jpe?g|png|gif|webp)$/i.test(
                                          attachmentUrl,
                                        ));

                                    // Try to copy image data (for pasting into apps like WhatsApp Web)
                                      if (
                                      isImageAttachment &&
                                      typeof window !== "undefined" &&
                                      typeof navigator !== "undefined" &&
                                      navigator.clipboard &&
                                      "write" in navigator.clipboard &&
                                      "ClipboardItem" in window
                                    ) {
                                      try {
                                        const response = await fetch(attachmentUrl);
                                        const blob = await response.blob();
                                        const clipboardWindow = window as typeof window & {
                                          ClipboardItem?: typeof ClipboardItem;
                                        };
                                        const ClipboardItemClass =
                                          clipboardWindow.ClipboardItem ?? ClipboardItem;

                                        await navigator.clipboard.write([
                                          new ClipboardItemClass({
                                            [blob.type]: blob,
                                          }),
                                        ]);
                                        // If this succeeds, we’re done.
                                        return;
                                      } catch {
                                        // Fall through to text/URL copy below.
                                      }
                                    }

                                    // Fallback: copy text content or attachment URL
                                    const valueToCopy = textContent || attachmentUrl;
                                    if (!valueToCopy) return;

                                    if (
                                      typeof navigator !== "undefined" &&
                                      navigator.clipboard?.writeText
                                    ) {
                                      navigator.clipboard
                                        .writeText(valueToCopy)
                                        .catch(() => {});
                                    }
                                  }}
                                >
                                  <CopyIcon className="mr-2 size-4" />
                                  <span>Copy</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setReactionPickerForId(msg.id);
                                    setEmojiPickerForId(null);
                                  }}
                                >
                                  <SmilePlus className="mr-2 size-4" />
                                  <span>React</span>
                                </DropdownMenuItem>
                                {msg.attachmentUrl && (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      if (!msg.attachmentUrl) return;
                                      if (typeof window === "undefined") return;

                                      const raw =
                                        normalizeChatAttachmentUrl(
                                          msg.attachmentUrl,
                                        ) ?? msg.attachmentUrl;
                                      const link = document.createElement("a");
                                      const url =
                                        raw.indexOf("?") === -1
                                          ? `${raw}?download=1`
                                          : `${raw}&download=1`;
                                      link.href = url;
                                      // best-effort filename from URL path
                                      try {
                                        const urlObj = new URL(url);
                                        const path = urlObj.pathname.split("/");
                                        const last = path[path.length - 1] || "download";
                                        link.download = last;
                                      } catch {
                                        link.download = "download";
                                      }
                                      link.target = "_self";
                                      document.body.appendChild(link);
                                      link.click();
                                      document.body.removeChild(link);
                                    }}
                                  >
                                    <Download className="mr-2 size-4" />
                                    <span>Download</span>
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onClick={() =>
                                    setPinnedById((prev) => ({
                                      ...prev,
                                      [msg.id]: !prev[msg.id],
                                    }))
                                  }
                                >
                                  <Pin className="mr-2 size-4" />
                                  <span>{pinnedById[msg.id] ? "Unpin" : "Pin"}</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() =>
                                    setHiddenById((prev) => ({ ...prev, [msg.id]: true }))
                                  }
                                >
                                  <Trash2 className="mr-2 size-4" />
                                  <span>Delete</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          {msg.replyToPreview && (
                            <button
                              type="button"
                              onClick={() => scrollToMessage(msg.replyToPreview!.id)}
                              className={cn(
                                "mb-2 flex w-full flex-col items-stretch gap-0.5 rounded-lg border-l-4 border-primary/60 bg-black/10 pl-3 pr-2 py-2 text-left transition-colors hover:bg-black/15",
                                isOwn && "border-primary/40 bg-white/20 hover:bg-white/25",
                              )}
                            >
                              <span
                                className={cn(
                                  "text-xs font-semibold",
                                  isOwn
                                    ? "text-primary-foreground/90"
                                    : "text-foreground",
                                )}
                              >
                                {msg.replyToPreview.senderRole === "client"
                                  ? leadName
                                  : "You"}
                              </span>
                              <span
                                className={cn(
                                  "truncate text-xs",
                                  isOwn
                                    ? "text-primary-foreground/80"
                                    : "text-muted-foreground",
                                )}
                              >
                                {msg.replyToPreview.attachmentType === "image"
                                  ? "Photo"
                                  : msg.replyToPreview.attachmentType === "video"
                                    ? "Video"
                                    : msg.replyToPreview.attachmentType === "file"
                                      ? "Document"
                                      : msg.replyToPreview.content || "Media"}
                              </span>
                            </button>
                          )}
                          {msg.content ? (
                            <p
                              dangerouslySetInnerHTML={{
                                __html: formatWhatsAppLike(msg.content),
                              }}
                            />
                          ) : null}
                          {msg.attachmentUrl && (
                            <div className="mt-2">
                              {(() => {
                                const url =
                                  normalizeChatAttachmentUrl(msg.attachmentUrl) ??
                                  msg.attachmentUrl ??
                                  "";
                                const isImageAttachment =
                                  msg.attachmentType === "image" ||
                                  /\.(jpe?g|png|gif|webp)$/i.test(url);
                                const isVideoAttachment =
                                  msg.attachmentType === "video" ||
                                  /\.(mp4|mov|quicktime)$/i.test(url);

                                if (isImageAttachment) {
                                  if (attachmentLoadErrorById[msg.id]) {
                                    return (
                                      <p
                                        className={cn(
                                          "text-xs",
                                          isOwn
                                            ? "text-primary-foreground/90"
                                            : "text-muted-foreground",
                                        )}
                                      >
                                        Image could not be loaded.{" "}
                                        <a
                                          href={url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="underline"
                                        >
                                          Open link
                                        </a>
                                      </p>
                                    );
                                  }
                                  return (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenViewer(msg.id)}
                                      className="block rounded-lg overflow-hidden max-w-full focus:outline-none"
                                    >
                                      <img
                                        src={url}
                                        alt="Attachment"
                                        className="max-h-48 w-auto object-contain rounded-lg"
                                        onError={() =>
                                          setAttachmentLoadErrorById((prev) => ({
                                            ...prev,
                                            [msg.id]: true,
                                          }))
                                        }
                                      />
                                    </button>
                                  );
                                }

                                if (isVideoAttachment) {
                                  return (
                                    <video
                                      src={url}
                                      controls
                                      className="max-h-48 rounded-lg"
                                      preload="metadata"
                                    />
                                  );
                                }

                                return (
                                  <a
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={cn(
                                      "text-xs underline",
                                      isOwn
                                        ? "text-primary-foreground/90"
                                        : "text-foreground"
                                    )}
                                  >
                                    View attachment
                                  </a>
                                );
                              })()}
                            </div>
                          )}
                          <div
                            className={cn(
                              "flex items-center gap-1 mt-1 text-xs",
                              isOwn
                                ? "text-primary-foreground/70 justify-end"
                                : "text-muted-foreground"
                            )}
                          >
                            {msg.reactions && msg.reactions.length > 0 && (
                              <span
                                className={cn(
                                  "absolute -bottom-4 flex h-7 min-w-7 items-center justify-center rounded-full bg-background text-lg leading-none shadow-md border px-1.5",
                                  isOwn ? "right-6" : "left-6",
                                )}
                              >
                                {msg.reactions.map((r) => r.emoji).join(" ")}
                              </span>
                            )}
                            {pinnedById[msg.id] && (
                              <Pin className="mr-1 size-3" />
                            )}
                            <span>{formatMessageTime(msg.timestamp)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
      </div>
      {viewerOpen && imageMessages.length > 0 && (
        <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
          <DialogContent
            showCloseButton={false}
            className="max-w-[90vw] max-h-[90vh] bg-background p-3 sm:p-4"
          >
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>{formatMessageTime(imageMessages[viewerIndex].timestamp)}</span>
              <div className="flex items-center gap-1 sm:gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 sm:h-8 sm:w-8"
                  onClick={() => {
                    const url = imageMessages[viewerIndex].url;
                    if (!url || typeof window === "undefined") return;
                    const link = document.createElement("a");
                    const finalUrl =
                      url.indexOf("?") === -1 ? `${url}?download=1` : `${url}&download=1`;
                    link.href = finalUrl;
                    try {
                      const urlObj = new URL(finalUrl);
                      const path = urlObj.pathname.split("/");
                      const last = path[path.length - 1] || "image";
                      link.download = last;
                    } catch {
                      link.download = "image";
                    }
                    link.target = "_self";
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  aria-label="Download image"
                >
                  <Download className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 sm:h-8 sm:w-8"
                  onClick={() => setViewerOpen(false)}
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2">
              {imageMessages.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={showPrevImage}
                >
                  <ChevronLeft className="size-5" />
                </Button>
              )}
              <div className="flex-1 flex items-center justify-center">
                <img
                  src={imageMessages[viewerIndex].url}
                  alt="Attachment"
                  className="max-h-[70vh] max-w-full object-contain rounded-lg"
                />
              </div>
              {imageMessages.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={showNextImage}
                >
                  <ChevronRight className="size-5" />
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
