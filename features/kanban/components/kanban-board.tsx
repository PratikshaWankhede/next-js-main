"use client";

import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import {
  isValidStageTransition,
  KANBAN_COLUMNS,
  type LeadStage,
} from "../utils/schema";
import type { LeadStage as LeadStageType } from "@/features/leads/types/lead.types";
import { useSlaSetting } from "@/hooks/use-sla-setting";
import { KanbanCard } from "./kanban-card";
import { KanbanColumn } from "./kanban-column";

export interface LeadWithAssignee {
  id: string;
  name: string;
  phone: string;
  source: string;
  stage: LeadStageType;
  assignedUserId: string | null;
  assignedUserName: string | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  slaStatus?: "pending" | "met" | "breached";
  firstResponseAt?: string | Date | null;
  aiScore?: "hot" | "warm" | "cold" | null;
  aiScoreReason?: string | null;
}

export type LeadsByStage = Record<LeadStage, LeadWithAssignee[]>;

function canDragLead(
  lead: LeadWithAssignee,
  currentUserRole: "admin" | "sales" | "follow_up_candidate",
  currentUserId: string | null
): boolean {
  if (currentUserRole === "admin") return true;
  if (!currentUserId) return false;
  return lead.assignedUserId === currentUserId;
}

interface KanbanBoardProps {
  initialLeadsByStage: LeadsByStage;
  currentUserRole: "admin" | "sales" | "follow_up_candidate";
  currentUserId: string | null;
  fetchError?: boolean;
}

export function KanbanBoard({
  initialLeadsByStage,
  currentUserRole,
  currentUserId,
  fetchError = false,
}: KanbanBoardProps) {
  const firstResponseSlaMinutes = useSlaSetting();
  const [leadsByStage, setLeadsByStage] =
    useState<LeadsByStage>(initialLeadsByStage);
  const [activeLead, setActiveLead] = useState<LeadWithAssignee | null>(null);
  const stateBeforeDragRef = useRef<LeadsByStage | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const getLeadsForStage = useCallback(
    (stage: LeadStage) => leadsByStage[stage] ?? [],
    [leadsByStage]
  );

  const findLead = useCallback(
    (id: string): LeadWithAssignee | undefined => {
      for (const stage of KANBAN_COLUMNS) {
        const lead = leadsByStage[stage.id]?.find((l) => l.id === id);
        if (lead) return lead;
      }
      return undefined;
    },
    [leadsByStage]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const lead = findLead(active.id as string);
    if (lead) {
      setActiveLead(lead);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeLeadData = findLead(activeId);
    if (!activeLeadData) return;

    const overData = over.data.current;

    if (overData?.type === "column") {
      const destinationStage = overData.status as LeadStage;
      const sourceStage = activeLeadData.stage;

      if (sourceStage === destinationStage) return;
      if (!isValidStageTransition(sourceStage, destinationStage)) return;
      if (!canDragLead(activeLeadData, currentUserRole, currentUserId)) return;

      if (!stateBeforeDragRef.current) {
        stateBeforeDragRef.current = JSON.parse(
          JSON.stringify(leadsByStage)
        ) as LeadsByStage;
      }

      setLeadsByStage((prev) => {
        const next = { ...prev };
        next[sourceStage] = (next[sourceStage] ?? []).filter(
          (l) => l.id !== activeId
        );
        next[destinationStage] = [
          ...(next[destinationStage] ?? []),
          { ...activeLeadData, stage: destinationStage },
        ];
        return next;
      });
      return;
    }

    const overLead = findLead(overId);
    if (!overLead) return;

    const destinationStage = overLead.stage;
    const sourceStage = activeLeadData.stage;

    if (sourceStage === destinationStage) return;
    if (!isValidStageTransition(sourceStage, destinationStage)) return;
    if (!canDragLead(activeLeadData, currentUserRole, currentUserId)) return;

    if (!stateBeforeDragRef.current) {
      stateBeforeDragRef.current = JSON.parse(
        JSON.stringify(leadsByStage)
      ) as LeadsByStage;
    }

    setLeadsByStage((prev) => {
      const next = { ...prev };
      next[sourceStage] = (next[sourceStage] ?? []).filter(
        (l) => l.id !== activeId
      );
      next[destinationStage] = [
        ...(next[destinationStage] ?? []),
        { ...activeLeadData, stage: destinationStage },
      ];
      return next;
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveLead(null);

    if (!over) {
      stateBeforeDragRef.current = null;
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeLeadData = findLead(activeId);
    if (!activeLeadData) {
      stateBeforeDragRef.current = null;
      return;
    }

    const overData = over.data.current;
    let destinationStage: LeadStage;

    if (overData?.type === "column") {
      destinationStage = overData.status as LeadStage;
    } else {
      const overLead = findLead(overId);
      if (!overLead) {
        stateBeforeDragRef.current = null;
        return;
      }
      destinationStage = overLead.stage;
    }

    const sourceStage = activeLeadData.stage;

    if (sourceStage === destinationStage) {
      stateBeforeDragRef.current = null;
      return;
    }

    if (!isValidStageTransition(sourceStage, destinationStage)) {
      stateBeforeDragRef.current = null;
      toast.error("Invalid move - cannot skip stages");
      return;
    }

    if (!canDragLead(activeLeadData, currentUserRole, currentUserId)) {
      stateBeforeDragRef.current = null;
      toast.error("You cannot move this lead");
      return;
    }

    const previousState = stateBeforeDragRef.current;
    stateBeforeDragRef.current = null;

    try {
      const res = await fetch(`/api/leads/${activeId}/stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toStage: destinationStage }),
      });

      const json = await res.json();

      if (!res.ok) {
        if (previousState) setLeadsByStage(previousState);
        toast.error(json.error ?? "Failed to update stage");
        return;
      }

      toast.success("Stage updated");
    } catch {
      if (previousState) setLeadsByStage(previousState);
      toast.error("Failed to update stage");
    }
  };

  return (
    <>
      {fetchError && (
        <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load leads. Please refresh the page.
        </div>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex h-full gap-4 overflow-x-auto pb-4">
          {KANBAN_COLUMNS.map((column) => (
            <KanbanColumn
              key={column.id}
              id={column.id}
              title={column.title}
              leads={getLeadsForStage(column.id)}
              currentUserRole={currentUserRole}
              currentUserId={currentUserId}
              firstResponseSlaMinutes={firstResponseSlaMinutes}
            />
          ))}
        </div>

        <DragOverlay>
          {activeLead && (
            <KanbanCard
              lead={activeLead}
              assignedUserName={activeLead.assignedUserName}
              isDraggable={canDragLead(
                activeLead,
                currentUserRole,
                currentUserId
              )}
              firstResponseSlaMinutes={firstResponseSlaMinutes}
            />
          )}
        </DragOverlay>
      </DndContext>
    </>
  );
}
