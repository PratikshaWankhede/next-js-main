"use client";

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface SalesUser {
  userId: string;
  name: string | null;
  leadsAssigned: number;
  conversionRate: number;
  avgResponseTime: number | null;
  slaBreaches: number;
  followUpMissRate: number;
  revenueAdvance: number;
}

function getConversionColor(rate: number): string {
  if (rate >= 50) return "text-green-600 dark:text-green-400";
  if (rate >= 25) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function getSlaColor(breaches: number): string {
  if (breaches === 0) return "text-green-600 dark:text-green-400";
  if (breaches <= 2) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function getFollowUpColor(rate: number): string {
  if (rate <= 10) return "text-green-600 dark:text-green-400";
  if (rate <= 25) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

interface SalesPerformanceTableProps {
  onUserSelect?: (userId: string | null) => void;
}

export function SalesPerformanceTable({
  onUserSelect,
}: SalesPerformanceTableProps) {
  const [data, setData] = useState<SalesUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "conversionRate", desc: true },
  ]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/analytics/sales-performance");
      const json = await res.json();
      if (res.ok) {
        setData(json.users ?? []);
      } else {
        setData([]);
      }
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const columns: ColumnDef<SalesUser>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3 h-8 cursor-pointer"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Name
          {column.getIsSorted() === "desc" ? (
            <ArrowDown className="ml-2 size-4" />
          ) : column.getIsSorted() === "asc" ? (
            <ArrowUp className="ml-2 size-4" />
          ) : (
            <ChevronsUpDown className="ml-2 size-4" />
          )}
        </Button>
      ),
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.name ?? "Unknown"}
        </span>
      ),
    },
    {
      accessorKey: "leadsAssigned",
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3 h-8 cursor-pointer"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Leads Assigned
          {column.getIsSorted() === "desc" ? (
            <ArrowDown className="ml-2 size-4" />
          ) : column.getIsSorted() === "asc" ? (
            <ArrowUp className="ml-2 size-4" />
          ) : (
            <ChevronsUpDown className="ml-2 size-4" />
          )}
        </Button>
      ),
    },
    {
      accessorKey: "conversionRate",
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3 h-8 cursor-pointer"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Conversion %
          {column.getIsSorted() === "desc" ? (
            <ArrowDown className="ml-2 size-4" />
          ) : column.getIsSorted() === "asc" ? (
            <ArrowUp className="ml-2 size-4" />
          ) : (
            <ChevronsUpDown className="ml-2 size-4" />
          )}
        </Button>
      ),
      cell: ({ row }) => (
        <span
          className={cn(
            "font-medium",
            getConversionColor(row.original.conversionRate)
          )}
        >
          {row.original.conversionRate}%
        </span>
      ),
    },
    {
      accessorKey: "avgResponseTime",
      header: "Avg Response (s)",
      cell: ({ row }) => {
        const v = row.original.avgResponseTime;
        return v != null ? `${Math.round(v)}s` : "-";
      },
    },
    {
      accessorKey: "slaBreaches",
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3 h-8 cursor-pointer"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          SLA Breaches
          {column.getIsSorted() === "desc" ? (
            <ArrowDown className="ml-2 size-4" />
          ) : column.getIsSorted() === "asc" ? (
            <ArrowUp className="ml-2 size-4" />
          ) : (
            <ChevronsUpDown className="ml-2 size-4" />
          )}
        </Button>
      ),
      cell: ({ row }) => (
        <span
          className={cn(
            "font-medium",
            getSlaColor(row.original.slaBreaches)
          )}
        >
          {row.original.slaBreaches}
        </span>
      ),
    },
    {
      accessorKey: "followUpMissRate",
      header: "Follow-up Miss %",
      cell: ({ row }) => (
        <span
          className={cn(
            "font-medium",
            getFollowUpColor(row.original.followUpMissRate)
          )}
        >
          {row.original.followUpMissRate}%
        </span>
      ),
    },
    {
      accessorKey: "revenueAdvance",
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3 h-8 cursor-pointer"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Revenue (advance)
          {column.getIsSorted() === "desc" ? (
            <ArrowDown className="ml-2 size-4" />
          ) : column.getIsSorted() === "asc" ? (
            <ArrowUp className="ml-2 size-4" />
          ) : (
            <ChevronsUpDown className="ml-2 size-4" />
          )}
        </Button>
      ),
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.revenueAdvance.toLocaleString("en-IN", {
            maximumFractionDigits: 0,
          })}
        </span>
      ),
    },
  ];

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sales Performance</CardTitle>
          <CardDescription>
            Performance per sales executive
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-32 items-center justify-center text-muted-foreground">
            Loading...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sales Performance</CardTitle>
        <CardDescription>
          Performance per sales executive. Click a row to filter other analytics
          by user.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-muted-foreground">
            No data yet
          </div>
        ) : (
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
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
              {table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() =>
                    onUserSelect?.(row.original.userId)
                  }
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
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
