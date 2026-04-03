"use client";

import { Paperclip, Send, Smile, X } from "lucide-react";
import { useRef, useState } from "react";
import EmojiPicker, { type Theme } from "emoji-picker-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const ACCEPT_ATTACH =
  "image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,application/pdf";

interface LeadMessageInputProps {
  onSendMessage: (content: string, files?: File[] | null) => void;
  disabled?: boolean;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  /**
   * When true, shows a subtle uploading/sending indicator
   * while a message with attachment is in flight.
   */
  isSending?: boolean;
  replyTo?: {
    author: string;
    preview: string;
  };
  onCancelReply?: () => void;
}

export function LeadMessageInput({
  onSendMessage,
  disabled = false,
  placeholder = "Type a message...",
  value: controlledValue,
  onChange: controlledOnChange,
  isSending = false,
  replyTo,
  onCancelReply,
}: LeadMessageInputProps) {
  const [internalMessage, setInternalMessage] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isControlled = controlledValue !== undefined;
  const message = isControlled ? controlledValue : internalMessage;
  const setMessage = (v: string) => {
    if (isControlled && controlledOnChange) controlledOnChange(v);
    else setInternalMessage(v);
  };

  const canSend = message.trim() || selectedFiles.length > 0;

  const handleSend = () => {
    if (!canSend || disabled) return;
    onSendMessage(message.trim(), selectedFiles.length ? selectedFiles : null);
    if (!isControlled) setInternalMessage("");
    else if (controlledOnChange) controlledOnChange("");
    setSelectedFiles([]);
    textareaRef.current?.focus();
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(e.clipboardData.files ?? []);
    if (!files.length) return;

    const next: File[] = [];
    for (const f of files) {
      if (f.size > 10 * 1024 * 1024) continue;
      if (!ACCEPT_ATTACH.split(",").includes(f.type)) continue;
      next.push(f);
    }

    if (!next.length) return;

    setSelectedFiles((prev) => [...prev, ...next]);
    // For typical screenshot/image paste, there is no meaningful text to keep,
    // so we prevent inserting any stray characters into the textarea.
    e.preventDefault();
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessage(value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  const onEmojiClick = (emojiData: { emoji: string }) => {
    const insert = emojiData.emoji;
    const el = textareaRef.current;
    if (el) {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const next = message.slice(0, start) + insert + message.slice(end);
      setMessage(next);
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + insert.length, start + insert.length);
      }, 0);
    } else {
      setMessage(message + insert);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) {
      e.target.value = "";
      return;
    }

    const next: File[] = [];
    for (const f of files) {
      if (f.size > 10 * 1024 * 1024) continue;
      if (!ACCEPT_ATTACH.split(",").includes(f.type)) continue;
      next.push(f);
    }

    if (next.length) {
      setSelectedFiles((prev) => [...prev, ...next]);
    }
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (disabled) return;
    const files = Array.from(e.dataTransfer.files ?? []);
    if (!files.length) return;

    const next: File[] = [];
    for (const f of files) {
      if (f.size > 10 * 1024 * 1024) continue;
      if (!ACCEPT_ATTACH.split(",").includes(f.type)) continue;
      next.push(f);
    }

    if (next.length) {
      setSelectedFiles((prev) => [...prev, ...next]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  return (
    <div className="border-t p-4" onDrop={handleDrop} onDragOver={handleDragOver}>
      {replyTo && (
        <div className="mb-2 flex items-start gap-2 rounded-lg border bg-muted/60 px-3 py-2 text-xs">
          <div className="flex-1 min-w-0">
            <div className="font-medium text-foreground mb-0.5">
              Replying to {replyTo.author}
            </div>
            <div className="truncate text-muted-foreground">
              {replyTo.preview || "Media message"}
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 cursor-pointer"
            onClick={onCancelReply}
            aria-label="Cancel reply"
          >
            <X className="size-3" />
          </Button>
        </div>
      )}
      {selectedFiles.length > 0 && (
        <div className="mb-2 flex items-center gap-2 overflow-x-auto">
          {selectedFiles.map((file, index) => (
            <div
              key={`${file.name}-${index}-${file.size}`}
              className="flex items-center gap-2 rounded-lg border bg-muted/50 p-2 shrink-0"
            >
              {file.type.startsWith("image/") ? (
                <img
                  src={URL.createObjectURL(file)}
                  alt=""
                  className="h-12 w-12 rounded object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                  {file.type.startsWith("video/")
                    ? "Video"
                    : file.type === "application/pdf"
                      ? "PDF"
                      : "File"}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm max-w-[160px]">
                  {file.name}
                </div>
                {isSending && index === 0 && (
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1 w-full overflow-hidden rounded bg-muted">
                      <div className="h-1 w-1/2 animate-pulse bg-primary" />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Uploading…
                    </span>
                  </div>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 h-8 w-8 cursor-pointer"
                onClick={() =>
                  setSelectedFiles((prev) =>
                    prev.filter((_, i) => i !== index),
                  )
                }
                aria-label="Remove attachment"
              >
                <X className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-end gap-1">
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_ATTACH}
          className="hidden"
          onChange={handleFileChange}
          aria-hidden
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 h-9 w-9 cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          aria-label="Attach file"
        >
          <Paperclip className="size-4" />
        </Button>
        <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 h-9 w-9 cursor-pointer"
              disabled={disabled}
              aria-label="Insert emoji"
            >
              <Smile className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto border p-0" align="start">
            <EmojiPicker
              onEmojiClick={onEmojiClick}
              theme={(typeof window !== "undefined" && document.documentElement.classList.contains("dark") ? "dark" : "light") as Theme}
              width={320}
              height={360}
            />
          </PopoverContent>
        </Popover>
        <div className="flex-1 relative min-w-0">
          <Textarea
            ref={textareaRef}
            placeholder={placeholder}
            value={message}
            onChange={handleChange}
            onPaste={handlePaste}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            className={cn(
              "min-h-[40px] max-h-[120px] resize-none pr-2",
              "cursor-text disabled:cursor-not-allowed",
            )}
            rows={1}
            aria-label="Message input"
          />
        </div>
        <Button
          type="button"
          size="icon"
          onClick={handleSend}
          disabled={disabled || !canSend}
          className="shrink-0 cursor-pointer disabled:cursor-not-allowed h-9 w-9"
          aria-label="Send message"
        >
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}
