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
import { formatLeadDateTime } from "@/helpers/format-lead-datetime";
import { Bell, Loader2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type NotificationType =
  | "sla_breach"
  | "follow_up_missed"
  | "new_inbound"
  | "reassigned";

interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  leadId: string | null;
  isRead: boolean;
  createdAt: string;
}

const TYPE_LABELS: Record<NotificationType, string> = {
  sla_breach: "SLA Breach",
  follow_up_missed: "Follow-up Missed",
  new_inbound: "New Message",
  reassigned: "Reassigned",
};

const TYPE_BADGE_CLASS: Record<NotificationType, string> = {
  sla_breach: "bg-red-500/20 text-red-700 dark:text-red-400",
  follow_up_missed: "bg-amber-500/20 text-amber-700 dark:text-amber-400",
  new_inbound: "bg-blue-500/20 text-blue-700 dark:text-blue-400",
  reassigned: "bg-purple-500/20 text-purple-700 dark:text-purple-400",
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=100");
      const json = await res.json();
      setNotifications(json.notifications ?? []);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "POST" });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch {
      // ignore
    }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter((n) => !n.isRead);
    await Promise.all(
      unread.map((n) => fetch(`/api/notifications/${n.id}/read`, { method: "POST" }))
    );
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="px-4 py-4 lg:px-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
        <p className="text-muted-foreground">
          Your in-app notifications for SLA breaches, follow-ups, messages, and reassignments.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>All Notifications</CardTitle>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllAsRead}>
              Mark all as read
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
              <Bell className="size-12 text-muted-foreground" />
              <p className="text-muted-foreground">No notifications yet.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Lead</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notifications.map((n) => (
                  <TableRow key={n.id} className={!n.isRead ? "bg-muted/30" : ""}>
                    <TableCell>
                      {n.isRead ? (
                        <span className="text-muted-foreground text-xs">Read</span>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Unread
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={TYPE_BADGE_CLASS[n.type]}
                      >
                        {TYPE_LABELS[n.type]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{n.title}</span>
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {n.body}
                      </p>
                    </TableCell>
                    <TableCell>
                      {n.leadId ? (
                        <Link
                          href={`/leads/${n.leadId}`}
                          className="font-medium text-primary hover:underline"
                        >
                          View lead
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatLeadDateTime(n.createdAt)}
                    </TableCell>
                    <TableCell>
                      {!n.isRead && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => markAsRead(n.id)}
                        >
                          Mark read
                        </Button>
                      )}
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
