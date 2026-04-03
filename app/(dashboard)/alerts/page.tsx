"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatLeadDateTime } from "@/helpers/format-lead-datetime";
import { AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface AlertItem {
  id: string;
  type: "sla_breach" | "follow_up_missed";
  leadId: string;
  leadName: string | null;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch("/api/alerts");
      const json = await res.json();

      if (!res.ok) {
        if (res.status === 403) {
          setIsAdmin(false);
          return;
        }
        setAlerts([]);
        return;
      }

      setAlerts(json.alerts ?? []);
    } catch {
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.role === "admin") {
          setIsAdmin(true);
          fetchAlerts();
        } else {
          setIsAdmin(false);
          setLoading(false);
        }
      })
      .catch(() => {
        setIsAdmin(false);
        setLoading(false);
      });
  }, [fetchAlerts]);

  if (isAdmin === false) {
    return (
      <div className="px-4 py-4 lg:px-6">
        <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <AlertCircle className="size-12 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Access Restricted</h2>
          <p className="text-muted-foreground max-w-sm">
            Alerts are only visible to administrators.
          </p>
          <Link
            href="/leads"
            className="text-sm text-primary hover:underline cursor-pointer"
          >
            Back to Leads
          </Link>
        </div>
      </div>
    );
  }

  if (loading || isAdmin === null) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="px-4 py-4 lg:px-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Alerts</h1>
        <p className="text-muted-foreground">
          SLA breaches and missed follow-ups. Admin only.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No alerts yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Lead</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          a.type === "sla_breach"
                            ? "bg-red-500/20 text-red-700 dark:text-red-400"
                            : "bg-amber-500/20 text-amber-700 dark:text-amber-400"
                        }
                      >
                        {a.type === "sla_breach" ? "SLA Breach" : "Follow-up Missed"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/leads/${a.leadId}`}
                        className="font-medium text-primary hover:underline cursor-pointer"
                      >
                        {a.leadName ?? "Unknown"}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {a.message}
                    </TableCell>
                    <TableCell>
                      {formatLeadDateTime(a.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
