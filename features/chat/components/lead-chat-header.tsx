"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface LeadChatHeaderProps {
  leadName: string;
  channelLabel?: string;
  className?: string;
}

export function LeadChatHeader({
  leadName,
  channelLabel,
  className,
}: LeadChatHeaderProps) {
  const initials = leadName
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

  return (
    <div
      className={cn(
        "flex items-center gap-3 min-w-0 flex-1",
        className
      )}
    >
      <Avatar className="size-10 shrink-0">
        <AvatarFallback className="text-sm">{initials}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <h2 className="font-semibold truncate">{leadName}</h2>
        {channelLabel && (
          <Badge variant="secondary" className="text-xs mt-0.5">
            {channelLabel}
          </Badge>
        )}
      </div>
    </div>
  );
}
