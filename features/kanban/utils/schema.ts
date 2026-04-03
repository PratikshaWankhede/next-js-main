import {
  type LeadStage,
  isValidStageTransition,
  NEXT_STAGE_MAP,
  STAGE_ORDER,
} from "@/features/leads/types/lead.types";
import { z } from "zod";

export const priorityEnum = z.enum(["low", "medium", "high"]);
export const columnStatusEnum = z.enum(["todo", "in_progress", "done"]);

export const kanbanTaskSchema = z.object({
  id: z.string(),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  assignee: z
    .object({
      name: z.string(),
      avatar: z.string().optional(),
    })
    .optional(),
  priority: priorityEnum,
  status: columnStatusEnum,
});

export const kanbanColumnSchema = z.object({
  id: columnStatusEnum,
  title: z.string(),
  tasks: z.array(kanbanTaskSchema),
});

export type Priority = z.infer<typeof priorityEnum>;
export type ColumnStatus = z.infer<typeof columnStatusEnum>;
export type KanbanTask = z.infer<typeof kanbanTaskSchema>;
export type KanbanColumn = z.infer<typeof kanbanColumnSchema>;

export const taskFormSchema = kanbanTaskSchema.omit({ id: true, status: true });
export type TaskFormData = z.infer<typeof taskFormSchema>;

export const statusConfig: Record<
  ColumnStatus,
  { label: string; color: string }
> = {
  todo: { label: "Todo", color: "bg-slate-500" },
  in_progress: { label: "Progress", color: "bg-blue-500" },
  done: { label: "Done", color: "bg-green-500" },
};

export type { LeadStage };
export { isValidStageTransition, NEXT_STAGE_MAP, STAGE_ORDER };

export type KanbanColumnConfig = { id: LeadStage; title: string };

export const KANBAN_COLUMNS: KanbanColumnConfig[] = STAGE_ORDER.map((s) => ({
  id: s,
  title: s.charAt(0).toUpperCase() + s.slice(1),
}));

export const STAGE_COLORS: Record<LeadStage, string> = {
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
