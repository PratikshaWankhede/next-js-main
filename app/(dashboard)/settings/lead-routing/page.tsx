"use client";

import { ContentSection } from "@/components/content-section";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import { formatLeadDateTime } from "@/helpers/format-lead-datetime";
import { Loader2, Plus, Trash2, ArrowUpDown } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type SourceType = "whatsapp" | "instagram";

interface RoutingRule {
  id: string;
  source: SourceType;
  whatsappPhoneNumberId: string | null;
  instagramScope: string | null;
  assignedUserId: string;
  user: { id: string; name: string; email: string } | null;
  createdAt: string;
  updatedAt: string;
}

interface UserOption {
  id: string;
  name: string;
  email: string;
}

interface WhatsappNumberOption {
  phoneNumberId: string;
  displayPhoneNumber: string;
}

export default function LeadRoutingSettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingWhatsappNumbers, setLoadingWhatsappNumbers] = useState(true);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [whatsappNumbers, setWhatsappNumbers] = useState<WhatsappNumberOption[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [newSource, setNewSource] = useState<SourceType>("whatsapp");
  const [newWhatsappPhoneNumberId, setNewWhatsappPhoneNumberId] =
    useState<string>("");
  const [newAssignedUserId, setNewAssignedUserId] = useState<string>("");

  const fetchRules = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const res = await fetch("/api/settings/lead-routing");
      if (!res.ok) {
        toast.error("Failed to load routing rules");
        setRules([]);
        return;
      }
      const json = (await res.json().catch(() => null)) as
        | { rules?: RoutingRule[] }
        | null;
      setRules(Array.isArray(json?.rules) ? json!.rules : []);
    } catch {
      toast.error("Failed to load routing rules");
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  const fetchUsers = useCallback(async () => {
    if (!isAdmin) return;
    setLoadingUsers(true);
    try {
      const res = await fetch("/api/users?role=sales&limit=100");
      if (!res.ok) {
        setUsers([]);
        return;
      }
      const json = (await res.json().catch(() => null)) as
        | { users?: UserOption[] }
        | null;
      setUsers(Array.isArray(json?.users) ? json!.users : []);
    } catch {
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  }, [isAdmin]);

  const fetchWhatsappNumbers = useCallback(async () => {
    if (!isAdmin) return;
    setLoadingWhatsappNumbers(true);
    try {
      const res = await fetch("/api/settings/lead-routing/whatsapp-numbers");
      if (!res.ok) {
        setWhatsappNumbers([]);
        return;
      }
      const json = (await res.json().catch(() => null)) as
        | { numbers?: WhatsappNumberOption[] }
        | null;
      setWhatsappNumbers(Array.isArray(json?.numbers) ? json!.numbers : []);
    } catch {
      setWhatsappNumbers([]);
    } finally {
      setLoadingWhatsappNumbers(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchRules();
    fetchUsers();
    fetchWhatsappNumbers();
  }, [fetchRules, fetchUsers, fetchWhatsappNumbers]);

  const whatsappRules = useMemo(
    () => rules.filter((r) => r.source === "whatsapp"),
    [rules],
  );
  const instagramRules = useMemo(
    () => rules.filter((r) => r.source === "instagram"),
    [rules],
  );

  const [sourceFilter, setSourceFilter] = useState<"all" | SourceType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"createdAt" | "source" | "user">(
    "createdAt",
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const pageSize = 5;

  const filteredAndSortedRules = useMemo(() => {
    let data = [...rules];

    if (sourceFilter !== "all") {
      data = data.filter((r) => r.source === sourceFilter);
    }

    const q = searchQuery.trim().toLowerCase();
    if (q.length > 0) {
      data = data.filter((r) => {
        const userName = r.user?.name?.toLowerCase() ?? "";
        const userEmail = r.user?.email?.toLowerCase() ?? "";
        const scope =
          r.source === "whatsapp"
            ? r.whatsappPhoneNumberId ?? "all"
            : "default instagram";
        return (
          userName.includes(q) ||
          userEmail.includes(q) ||
          scope.toLowerCase().includes(q)
        );
      });
    }

    data.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "createdAt") {
        cmp =
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortBy === "source") {
        cmp = a.source.localeCompare(b.source);
      } else if (sortBy === "user") {
        const aName = a.user?.name ?? "";
        const bName = b.user?.name ?? "";
        cmp = aName.localeCompare(bName);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return data;
  }, [rules, sourceFilter, searchQuery, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedRules.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRules = useMemo(
    () =>
      filteredAndSortedRules.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize,
      ),
    [filteredAndSortedRules, currentPage],
  );

  function toggleSort(column: "createdAt" | "source" | "user") {
    if (sortBy === column) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDir(column === "createdAt" ? "desc" : "asc");
    }
  }

  async function handleAdd() {
    if (!newAssignedUserId) {
      toast.error("Please select a user");
      return;
    }
    if (newSource === "whatsapp" && newWhatsappPhoneNumberId.trim().length === 0) {
      const hasGeneric = whatsappRules.some(
        (r) => !r.whatsappPhoneNumberId || r.whatsappPhoneNumberId === "",
      );
      if (hasGeneric) {
        toast.error("A generic WhatsApp rule already exists");
        return;
      }
    }

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        source: newSource,
        assignedUserId: newAssignedUserId,
      };
      if (newSource === "whatsapp") {
        body.whatsappPhoneNumberId = newWhatsappPhoneNumberId.trim() || null;
      }

      const res = await fetch("/api/settings/lead-routing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error ?? "Failed to create routing rule");
        return;
      }
      toast.success("Routing rule created");
      setAddOpen(false);
      setNewWhatsappPhoneNumberId("");
      setNewAssignedUserId("");
      setNewSource("whatsapp");
      fetchRules();
    } catch {
      toast.error("Failed to create routing rule");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/settings/lead-routing?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error ?? "Failed to delete rule");
        return;
      }
      toast.success("Routing rule deleted");
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch {
      toast.error("Failed to delete rule");
    } finally {
      setDeletingId(null);
    }
  }

  if (user !== null && !isAdmin) {
    return (
      <ContentSection
        title="Lead Routing"
        desc="Control which users receive leads from WhatsApp and Instagram."
      >
        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-8">
          <h2 className="text-xl font-semibold">Access Denied</h2>
          <p className="text-muted-foreground text-center">
            You need admin permissions to manage lead routing.
          </p>
        </div>
      </ContentSection>
    );
  }

  if (loading) {
    return (
      <ContentSection
        title="Lead Routing"
        desc="Control which users receive leads from WhatsApp and Instagram."
        fullWidth
      >
        <div className="animate-pulse space-y-4">
          <div className="h-10 w-40 rounded-md bg-muted" />
          <div className="h-10 w-full rounded-md bg-muted" />
          <div className="h-10 w-full rounded-md bg-muted" />
        </div>
      </ContentSection>
    );
  }

  return (
    <ContentSection
      title="Lead Routing"
      desc="Route inbound WhatsApp and Instagram leads to specific users. Rules are applied before round-robin assignment."
      fullWidth
    >
      <div className="space-y-6 pb-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-semibold">Routing Rules</h2>
            <p className="text-muted-foreground text-sm">
              Filter by source, search by user or scope, and sort by column. Rules are applied before round-robin.
            </p>
          </div>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1.5 size-4" />
            Add Rule
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Source
            </label>
            <Select
              value={sourceFilter}
              onValueChange={(v) => {
                setSourceFilter(v as "all" | SourceType);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Search
            </label>
            <Input
              className="h-8 w-[220px]"
              placeholder="User or scope..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="ml-auto text-xs text-muted-foreground">
            {filteredAndSortedRules.length} rule
            {filteredAndSortedRules.length === 1 ? "" : "s"} total
          </div>
        </div>

        {filteredAndSortedRules.length === 0 ? (
          <div className="border border-dashed rounded-lg p-6 text-center text-sm text-muted-foreground">
            No routing rules match your filters. New inbound leads will be assigned using round-robin.
          </div>
        ) : (
          <div className="space-y-2">
            <div className="overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>
                      <button
                        type="button"
                        className="flex items-center gap-1"
                        onClick={() => toggleSort("source")}
                      >
                        Source
                        <ArrowUpDown className="size-3.5" />
                      </button>
                    </TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>
                      <button
                        type="button"
                        className="flex items-center gap-1"
                        onClick={() => toggleSort("user")}
                      >
                        User
                        <ArrowUpDown className="size-3.5" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        type="button"
                        className="flex items-center gap-1"
                        onClick={() => toggleSort("createdAt")}
                      >
                        Created
                        <ArrowUpDown className="size-3.5" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedRules.map((rule) => {
                    const userLabel = rule.user
                      ? `${rule.user.name} (${rule.user.email})`
                      : rule.assignedUserId;
                    const scopeLabel =
                      rule.source === "whatsapp"
                        ? rule.whatsappPhoneNumberId
                          ? `phone_number_id = ${rule.whatsappPhoneNumberId}`
                          : "All WhatsApp numbers"
                        : "Default Instagram account";
                    return (
                      <TableRow key={rule.id}>
                        <TableCell className="capitalize">
                          {rule.source}
                        </TableCell>
                        <TableCell className="whitespace-normal wrap-break-word">
                          {scopeLabel}
                        </TableCell>
                        <TableCell className="whitespace-normal wrap-break-word">
                          {userLabel}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {rule.createdAt
                            ? formatLeadDateTime(rule.createdAt)
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 text-destructive"
                            onClick={() => handleDelete(rule.id)}
                            disabled={deletingId === rule.id}
                          >
                            {deletingId === rule.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Trash2 className="size-4" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2"
                  disabled={currentPage >= totalPages}
                  onClick={() =>
                    setPage((p) => Math.min(totalPages, p + 1))
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Routing Rule</DialogTitle>
            <DialogDescription>
              Choose the source and the user who should receive new leads from that source.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Source</label>
              <Select
                value={newSource}
                onValueChange={(v) => {
                  setNewSource(v as SourceType);
                  setNewWhatsappPhoneNumberId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newSource === "whatsapp" && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">WhatsApp number</label>
                {whatsappNumbers.length > 0 ? (
                  <>
                    <Select
                      value={newWhatsappPhoneNumberId || "ALL"}
                      onValueChange={(v) => {
                        if (v === "ALL") {
                          setNewWhatsappPhoneNumberId("");
                        } else {
                          setNewWhatsappPhoneNumberId(v);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            loadingWhatsappNumbers
                              ? "Loading WhatsApp numbers..."
                              : "Select WhatsApp number"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">
                          All WhatsApp numbers
                        </SelectItem>
                        {whatsappNumbers.map((n) => (
                          <SelectItem
                            key={n.phoneNumberId}
                            value={n.phoneNumberId}
                          >
                            <span className={cn("flex flex-col text-left")}>
                              <span>{n.displayPhoneNumber}</span>
                              <span className="text-xs text-muted-foreground">
                                phone_number_id: {n.phoneNumberId}
                              </span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Select one of your WhatsApp business numbers, or choose
                      &quot;All WhatsApp numbers&quot; to apply the rule to all.
                    </p>
                  </>
                ) : (
                  <>
                    <Input
                      value={newWhatsappPhoneNumberId}
                      onChange={(e) => setNewWhatsappPhoneNumberId(e.target.value)}
                      placeholder="Optional – leave blank for all WhatsApp numbers"
                    />
                    <p className="text-xs text-muted-foreground">
                      Once webhooks start coming in, known WhatsApp numbers will
                      appear here as a dropdown. For now you can paste a
                      phone_number_id manually from the webhook payload.
                    </p>
                  </>
                )}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Assign to user</label>
              <Select
                value={newAssignedUserId}
                onValueChange={(v) => setNewAssignedUserId(v)}
                disabled={loadingUsers}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingUsers ? "Loading users..." : "Select user"} />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      <span className={cn("flex flex-col text-left")}>
                        <span>{u.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {u.email}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                  {users.length === 0 && !loadingUsers && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      No sales users found.
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAddOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleAdd} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save rule"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ContentSection>
  );
}

