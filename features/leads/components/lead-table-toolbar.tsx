"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X } from "lucide-react";
import { LEAD_SOURCES, LEAD_STAGES } from "../types/lead.types";

interface LeadTableToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  stage: string;
  onStageChange: (value: string) => void;
  source: string;
  onSourceChange: (value: string) => void;
  assignedUserId: string;
  onAssignedUserChange: (value: string) => void;
  createdFrom: string;
  createdTo: string;
  onCreatedFromChange: (value: string) => void;
  onCreatedToChange: (value: string) => void;
  assignedUserOptions: { id: string; name: string }[];
  /** When false, the Add Lead button is hidden (e.g. non-admin users). */
  showAddLead?: boolean;
  onAddLead: () => void;
}

export function LeadTableToolbar({
  search,
  onSearchChange,
  stage,
  onStageChange,
  source,
  onSourceChange,
  assignedUserId,
  onAssignedUserChange,
  createdFrom,
  createdTo,
  onCreatedFromChange,
  onCreatedToChange,
  assignedUserOptions,
  showAddLead = false,
  onAddLead,
}: LeadTableToolbarProps) {
  const [localSearch, setLocalSearch] = useState(search);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

  const isFiltered =
    !!localSearch ||
    !!search ||
    !!stage ||
    !!source ||
    !!assignedUserId ||
    !!createdFrom ||
    !!createdTo;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or phone..."
            value={localSearch}
            onChange={(e) => {
              const value = e.target.value;
              setLocalSearch(value);
              if (searchDebounceRef.current) {
                clearTimeout(searchDebounceRef.current);
              }
              searchDebounceRef.current = setTimeout(() => {
                onSearchChange(value);
                searchDebounceRef.current = null;
              }, 350);
            }}
            className="h-9 w-[200px] pl-8 lg:w-[260px]"
          />
        </div>
        <Select
          value={stage || "all"}
          onValueChange={(v) => onStageChange(v === "all" ? "" : v)}
        >
          <SelectTrigger className="h-9 w-[130px] cursor-pointer">
            <SelectValue placeholder="Stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="cursor-pointer">
              All stages
            </SelectItem>
            {LEAD_STAGES.map((s) => (
              <SelectItem
                key={s}
                value={s}
                className="cursor-pointer capitalize"
              >
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={source || "all"}
          onValueChange={(v) => onSourceChange(v === "all" ? "" : v)}
        >
          <SelectTrigger className="h-9 w-[140px] cursor-pointer">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="cursor-pointer">
              All sources
            </SelectItem>
            {LEAD_SOURCES.map((s) => (
              <SelectItem
                key={s}
                value={s}
                className="cursor-pointer capitalize"
              >
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {assignedUserOptions.length > 0 && (
          <Select
            value={assignedUserId || "all"}
            onValueChange={(v) => onAssignedUserChange(v === "all" ? "" : v)}
          >
            <SelectTrigger className="h-9 w-[170px] cursor-pointer">
              <SelectValue placeholder="Assigned to" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="cursor-pointer">
                All assignees
              </SelectItem>
              {assignedUserOptions.map((u) => (
                <SelectItem key={u.id} value={u.id} className="cursor-pointer">
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Created</span>
          <Input
            type="date"
            value={createdFrom}
            onChange={(e) => onCreatedFromChange(e.target.value)}
            className="h-9 w-[130px]"
          />
          <span>to</span>
          <Input
            type="date"
            value={createdTo}
            onChange={(e) => onCreatedToChange(e.target.value)}
            className="h-9 w-[130px]"
          />
        </div>
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => {
              if (searchDebounceRef.current) {
                clearTimeout(searchDebounceRef.current);
                searchDebounceRef.current = null;
              }
              setLocalSearch("");
              onSearchChange("");
              onStageChange("");
              onSourceChange("");
              onAssignedUserChange("");
              onCreatedFromChange("");
              onCreatedToChange("");
            }}
            className="h-9 px-3"
          >
            Reset
            <X className="ml-1 size-4" />
          </Button>
        )}
      </div>
      {showAddLead && (
        <Button onClick={onAddLead} className="cursor-pointer">
          Add Lead
        </Button>
      )}
    </div>
  );
}
