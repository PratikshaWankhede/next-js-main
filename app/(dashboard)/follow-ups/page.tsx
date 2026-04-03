"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatLeadDateTime } from "@/helpers/format-lead-datetime";
import { Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface FollowUpWithLead {
  id: string;
  leadId: string;
  scheduledAt: string;
  completedAt: string | null;
  status: "pending" | "completed" | "missed";
  note: string | null;
  lead: {
    id: string;
    name: string;
    phone: string;
    stage: string;
  };
}

type Scope = "today" | "overdue" | "upcoming";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500",
  completed: "bg-green-500",
  missed: "bg-red-500",
};

function FollowUpsTable({
  scope,
  onComplete,
}: {
  scope: Scope;
  onComplete: () => void;
}) {
  const [followUps, setFollowUps] = useState<FollowUpWithLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const fetchFollowUps = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/follow-ups?scope=${scope}`);
      const json = await res.json();

      if (!res.ok) {
        setFollowUps([]);
        return;
      }

      setFollowUps(json.followUps ?? []);
    } catch {
      setFollowUps([]);
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    fetchFollowUps();
  }, [fetchFollowUps]);

  const handleComplete = async (id: string) => {
    setCompletingId(id);
    try {
      const res = await fetch(`/api/follow-ups/${id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const json = await res.json();
        toast.error(json.error ?? "Failed to complete follow-up");
        return;
      }

      toast.success("Follow-up completed");
      fetchFollowUps();
      onComplete();
    } catch {
      toast.error("Failed to complete follow-up");
    } finally {
      setCompletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (followUps.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No follow-ups in this category.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Lead</TableHead>
          <TableHead>Phone</TableHead>
          <TableHead>Scheduled</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-[100px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {followUps.map((fu) => (
          <TableRow key={fu.id}>
            <TableCell>
              <Link
                href={`/leads/${fu.leadId}`}
                className="font-medium text-primary hover:underline cursor-pointer"
              >
                {fu.lead.name}
              </Link>
            </TableCell>
            <TableCell className="text-muted-foreground">{fu.lead.phone}</TableCell>
            <TableCell>
              {formatLeadDateTime(fu.scheduledAt)}
            </TableCell>
            <TableCell>
              <Badge
                className={`${STATUS_COLORS[fu.status] ?? "bg-muted"} text-white border-0 capitalize text-xs`}
              >
                {fu.status}
              </Badge>
            </TableCell>
            <TableCell>
              {fu.status === "pending" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleComplete(fu.id)}
                  disabled={completingId === fu.id}
                  className="cursor-pointer"
                >
                  {completingId === fu.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="size-4 mr-1" />
                      Complete
                    </>
                  )}
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function FollowUpsPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleComplete = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="px-4 py-4 lg:px-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Follow-Ups</h1>
        <p className="text-muted-foreground">
          Your daily action list. Complete follow-ups to keep leads engaged.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Follow-Up Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="today" className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-3">
              <TabsTrigger value="today" className="cursor-pointer">
                Today
              </TabsTrigger>
              <TabsTrigger value="overdue" className="cursor-pointer">
                Overdue
              </TabsTrigger>
              <TabsTrigger value="upcoming" className="cursor-pointer">
                Upcoming
              </TabsTrigger>
            </TabsList>
            <TabsContent value="today">
              <FollowUpsTable
                key={`today-${refreshKey}`}
                scope="today"
                onComplete={handleComplete}
              />
            </TabsContent>
            <TabsContent value="overdue">
              <FollowUpsTable
                key={`overdue-${refreshKey}`}
                scope="overdue"
                onComplete={handleComplete}
              />
            </TabsContent>
            <TabsContent value="upcoming">
              <FollowUpsTable
                key={`upcoming-${refreshKey}`}
                scope="upcoming"
                onComplete={handleComplete}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
