"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Loader2, RefreshCw } from "lucide-react";
import { formatLeadDateTime } from "@/helpers/format-lead-datetime";
import { useState } from "react";
import { toast } from "sonner";

interface LeadSummaryCardProps {
  leadId: string;
  aiSummary: string | null;
  aiSummaryUpdatedAt: string | Date | null;
  onRefresh: () => Promise<void>;
  canAccess: boolean;
}

export function LeadSummaryCard({
  leadId,
  aiSummary,
  aiSummaryUpdatedAt,
  onRefresh,
  canAccess,
}: LeadSummaryCardProps) {
  const [open, setOpen] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/ai/lead-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId }),
      });
      const data = await res.json();
      if (res.ok && data.error) {
        toast.error(data.error);
        return;
      }
      if (res.ok && data.summary !== undefined) {
        await onRefresh();
        toast.success("Summary updated");
      } else {
        toast.error("Failed to refresh summary");
      }
    } catch {
      toast.error("Failed to refresh summary");
    } finally {
      setRefreshing(false);
    }
  };

  if (!canAccess) return null;

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="py-3">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <CardTitle className="text-base flex items-center gap-2">
                AI Summary
                <ChevronDown
                  className={`size-4 transition-transform ${open ? "" : "-rotate-90"}`}
                />
              </CardTitle>
            </div>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-3 pt-0">
            {aiSummary ? (
              <>
                <p className="text-sm text-muted-foreground">{aiSummary}</p>
                {aiSummaryUpdatedAt && (
                  <p className="text-xs text-muted-foreground">
                    Last updated: {formatLeadDateTime(aiSummaryUpdatedAt)}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No summary yet. Click Refresh to generate.
              </p>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="cursor-pointer"
            >
              {refreshing ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="size-4 mr-2" />
              )}
              Refresh Summary
            </Button>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
