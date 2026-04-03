"use client";

import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface ReplySuggestionsProps {
  leadId: string;
  channel: "app" | "whatsapp" | "instagram";
  messages: Array<{ content: string; senderRole?: string; channel?: string }>;
  onInsertSuggestion: (text: string) => void;
}

export function ReplySuggestions({
  leadId,
  channel,
  messages,
  onInsertSuggestion,
}: ReplySuggestionsProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    setSuggestions([]);
    try {
      const res = await fetch("/api/ai/reply-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, channel }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.suggestions)) {
        setSuggestions(data.suggestions);
      }
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [leadId, channel]);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions, messages.length]);

  if (loading && suggestions.length === 0) {
    return (
      <div className="px-4 py-2 border-t flex items-center gap-2">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          Generating suggestions...
        </span>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="px-4 py-2 border-t">
      <p className="text-xs text-muted-foreground mb-2">Suggested replies</p>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((s, i) => (
          <Button
            key={i}
            variant="outline"
            size="sm"
            className="text-xs h-auto py-1.5 px-2 cursor-pointer"
            onClick={() => onInsertSuggestion(s)}
          >
            {s.length > 60 ? `${s.slice(0, 60)}...` : s}
          </Button>
        ))}
      </div>
    </div>
  );
}
