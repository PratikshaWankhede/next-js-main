"use client";

import { useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { format } from "date-fns";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { getLeadDisplayName } from "@/lib/lead-display-name";
import { CreateLeadDialog } from "./create-lead-dialog";
import { LeadTableToolbar } from "./lead-table-toolbar";
import type { LeadStage } from "../types/lead.types";

export interface LeadRow {
  id: string;
  name: string;
  customName?: string | null;
  phone: string;
  whatsappPhone?: string | null;
  instagramUserId?: string | null;
  instagramUsername?: string | null;
  source: string;
  stage: LeadStage;
  assignedUserId: string | null;
  assignedUserName: string | null;
  createdAt: string;
  updatedAt: string;
}

interface LeadTableProps {
  leads: LeadRow[];
  total: number;
  page: number;
  limit: number;
  search: string;
  stage: string;
  source: string;
  assignedUserId: string;
  createdFrom: string;
  createdTo: string;
  sortBy: "name" | "phone" | "source" | "stage" | "createdAt";
  sortDir: "asc" | "desc";
  onSearchChange: (value: string) => void;
  onStageChange: (value: string) => void;
  onSourceChange: (value: string) => void;
  onAssignedUserChange: (value: string) => void;
  onCreatedFromChange: (value: string) => void;
  onCreatedToChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onSortChange: (column: "name" | "phone" | "source" | "stage" | "createdAt") => void;
  onLimitChange: (limit: number) => void;
  onRefresh: () => void;
  isAdmin?: boolean;
  /** True while leads are being fetched (table stays mounted so filters keep focus). */
  loading?: boolean;
}

const STAGE_COLORS: Record<LeadStage, string> = {
  new: "bg-slate-500",
  contacted: "bg-blue-500",
  interested: "bg-amber-500",
  rnr: "bg-fuchsia-500",
  follow_up: "bg-violet-500",
  booking: "bg-emerald-600",
  no_show: "bg-orange-500",
  done: "bg-green-500",
  lost: "bg-red-500",
};

export function LeadTable({
  leads,
  total,
  page,
  limit,
  search,
  stage,
  source,
  assignedUserId,
  createdFrom,
  createdTo,
  sortBy,
  sortDir,
  onSearchChange,
  onStageChange,
  onSourceChange,
  onAssignedUserChange,
  onCreatedFromChange,
  onCreatedToChange,
  onPageChange,
  onSortChange,
  onLimitChange,
  onRefresh,
  isAdmin = false,
  loading = false,
}: LeadTableProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);

  const renderSortIcon = (columnKey: "name" | "phone" | "source" | "stage" | "createdAt") => {
    if (sortBy !== columnKey) {
      return <ArrowUpDown className="ml-1 h-3.5 w-3.5 text-muted-foreground" />;
    }
    return sortDir === "asc" ? (
      <ArrowUp className="ml-1 h-3.5 w-3.5" />
    ) : (
      <ArrowDown className="ml-1 h-3.5 w-3.5" />
    );
  };

  const sortableHeader = (label: string, columnKey: "name" | "phone" | "source" | "stage" | "createdAt") => (
    <button
      type="button"
      onClick={() => onSortChange(columnKey)}
      className="inline-flex items-center text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground"
    >
      <span>{label}</span>
      {renderSortIcon(columnKey)}
    </button>
  );

  const columns: ColumnDef<LeadRow>[] = [
    {
      accessorKey: "name",
      header: () => sortableHeader("Name", "name"),
      cell: ({ row }) => {
        const r = row.original;
        const displayName = getLeadDisplayName({
          name: r.name,
          customName: r.customName ?? null,
          phone: r.phone,
          source: r.source,
          whatsappPhone: r.whatsappPhone ?? null,
          instagramUserId: r.instagramUserId ?? null,
          instagramUsername: r.instagramUsername ?? null,
        });
        return <span className="font-medium">{displayName}</span>;
      },
    },
    {
      accessorKey: "phone",
      header: () => sortableHeader("Phone", "phone"),
    },
    {
      accessorKey: "source",
      header: () => sortableHeader("Source", "source"),
      cell: ({ row }) => (
        <span className="capitalize">{row.original.source ?? "-"}</span>
      ),
    },
    {
      accessorKey: "stage",
      header: () => sortableHeader("Stage", "stage"),
      cell: ({ row }) => {
        const s = row.original.stage;
        return (
          <Badge
            variant="secondary"
            className={`${STAGE_COLORS[s] ?? "bg-muted"} text-white border-0 capitalize`}
          >
            {s}
          </Badge>
        );
      },
    },
    {
      accessorKey: "assignedUserName",
      header: "Assigned To",
      cell: ({ row }) => row.original.assignedUserName ?? "-",
    },
    {
      accessorKey: "createdAt",
      header: () => sortableHeader("Created At", "createdAt"),
      cell: ({ row }) =>
        format(new Date(row.original.createdAt), "MMM d, yyyy h:mm a"),
    },
  ];

  const assignedUserOptions = Array.from(
    new Map(
      leads
        .filter(
          (l) => l.assignedUserId && l.assignedUserName,
        )
        .map((l) => [l.assignedUserId as string, l.assignedUserName as string]),
    ).entries(),
  ).map(([id, name]) => ({ id, name }));

  const table = useReactTable({
    data: leads,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="space-y-4">
      <LeadTableToolbar
        search={search}
        onSearchChange={onSearchChange}
        stage={stage}
        onStageChange={onStageChange}
        source={source}
        onSourceChange={onSourceChange}
        assignedUserId={assignedUserId}
        onAssignedUserChange={onAssignedUserChange}
        createdFrom={createdFrom}
        createdTo={createdTo}
        onCreatedFromChange={onCreatedFromChange}
        onCreatedToChange={onCreatedToChange}
        assignedUserOptions={assignedUserOptions}
        showAddLead={isAdmin}
        onAddLead={() => setDialogOpen(true)}
      />
      <div className="relative rounded-md border">
        {loading && leads.length > 0 && (
          <div
            className="pointer-events-none absolute inset-0 z-10 rounded-md bg-background/40"
            aria-hidden
          />
        )}
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} colSpan={header.colSpan}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/leads/${row.original.id}`)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {loading ? "Loading leads…" : "No leads found."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-col gap-2 px-4 pt-2 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-muted-foreground text-sm">
          {total} lead{total !== 1 ? "s" : ""} total
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Rows per page</span>
            <Select
              value={String(limit)}
              onValueChange={(value) => onLimitChange(Number(value))}
            >
              <SelectTrigger className="h-8 w-[88px] cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[5, 10, 15, 20].map((size) => (
                  <SelectItem
                    key={size}
                    value={String(size)}
                    className="cursor-pointer"
                  >
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="cursor-pointer disabled:cursor-not-allowed"
            >
              Previous
            </Button>
            <span className="text-sm">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="cursor-pointer disabled:cursor-not-allowed"
            >
              Next
            </Button>
          </div>
        </div>
      </div>
      {isAdmin && (
        <CreateLeadDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSuccess={onRefresh}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}
