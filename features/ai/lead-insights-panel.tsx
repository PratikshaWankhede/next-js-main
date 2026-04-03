"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface LeadInsightsPanelProps {
  leadId: string;
  isAdmin: boolean;
}

export function LeadInsightsPanel({ leadId, isAdmin }: LeadInsightsPanelProps) {
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    setInsight(null);
    try {
      const res = await fetch("/api/ai/lead-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId }),
      });
      const data = await res.json();
      if (res.ok && data.error) {
        toast.error(data.error);
        return;
      }
      if (res.ok && data.insight !== undefined) {
        setInsight(data.insight || null);
        if (!data.insight) {
          toast.error("Could not generate insight");
        }
      } else {
        toast.error("Failed to generate insight");
      }
    } catch {
      toast.error("Failed to generate insight");
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4" />
          AI Insights
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          variant="outline"
          size="sm"
          onClick={handleGenerate}
          disabled={loading}
          className="cursor-pointer"
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin mr-2" />
          ) : (
            <Sparkles className="size-4 mr-2" />
          )}
          Generate Insight
        </Button>
        {insight && (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {insight}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
