"use client";

import { LeadTable, type LeadRow } from "@/features/leads/components/lead-table";
import { useEffect, useState } from "react";

export default function LeadsPage() {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("");
  const [source, setSource] = useState("");
  const [assignedUserId, setAssignedUserId] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "phone" | "source" | "stage" | "createdAt">("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (search) params.set("search", search);
      if (stage) params.set("stage", stage);
      if (source) params.set("source", source);
      if (assignedUserId) params.set("assignedUserId", assignedUserId);
      if (createdFrom) params.set("createdFrom", createdFrom);
      if (createdTo) params.set("createdTo", createdTo);
      if (sortBy) params.set("sortBy", sortBy);
      if (sortDir) params.set("sortDir", sortDir);

      const res = await fetch(`/api/leads?${params.toString()}`);
      const json = await res.json();

      if (!res.ok) {
        setLeads([]);
        setTotal(0);
        return;
      }

      setLeads(json.leads ?? []);
      setTotal(json.total ?? 0);
    } catch {
      setLeads([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [page, limit, search, stage, source, assignedUserId, createdFrom, createdTo, sortBy, sortDir]);

  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => {
        setIsAdmin(data.role === "admin");
      })
      .catch(() => setIsAdmin(false));
  }, []);

  return (
    <>
      <div className="px-4 py-4 lg:px-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
          <p className="text-muted-foreground">
            Manage your leads and track their progress through the sales pipeline.
          </p>
        </div>
      </div>

      <div className="@container/main px-4 lg:px-6 space-y-6">
        <LeadTable
          leads={leads}
          total={total}
          page={page}
          limit={limit}
          search={search}
          stage={stage}
          source={source}
          assignedUserId={assignedUserId}
          createdFrom={createdFrom}
          createdTo={createdTo}
          sortBy={sortBy}
          sortDir={sortDir}
          loading={loading}
          onSearchChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          onStageChange={(v) => {
            setStage(v);
            setPage(1);
          }}
          onSourceChange={(v) => {
            setSource(v);
            setPage(1);
          }}
          onAssignedUserChange={(v) => {
            setAssignedUserId(v);
            setPage(1);
          }}
          onCreatedFromChange={(v) => {
            setCreatedFrom(v);
            setPage(1);
          }}
          onCreatedToChange={(v) => {
            setCreatedTo(v);
            setPage(1);
          }}
          onPageChange={setPage}
          onSortChange={(column) => {
            setPage(1);
            setSortBy(column);
            setSortDir((prev) =>
              sortBy === column ? (prev === "asc" ? "desc" : "asc") : "asc",
            );
          }}
          onLimitChange={(value) => {
            setLimit(value);
            setPage(1);
          }}
          onRefresh={fetchLeads}
          isAdmin={isAdmin}
        />
      </div>
    </>
  );
}
