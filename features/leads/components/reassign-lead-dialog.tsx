"use client";

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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const reassignSchema = z.object({
  toUserId: z.string().min(1, "Please select a user"),
  reason: z.string().min(1, "Reason is required").trim(),
});

type ReassignFormValues = z.infer<typeof reassignSchema>;

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface ReassignLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  onSuccess: () => void;
}

export function ReassignLeadDialog({
  open,
  onOpenChange,
  leadId,
  onSuccess,
}: ReassignLeadDialogProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const form = useForm<ReassignFormValues>({
    resolver: zodResolver(reassignSchema),
    defaultValues: {
      toUserId: "",
      reason: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    const tid = setTimeout(() => setLoadingUsers(true), 0);
    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => {
        const list = data?.users;
        setUsers(Array.isArray(list) ? list : []);
      })
      .catch(() => setUsers([]))
      .finally(() => {
        clearTimeout(tid);
        setLoadingUsers(false);
      });
    return () => clearTimeout(tid);
  }, [open]);

  async function onSubmit(data: ReassignFormValues) {
    try {
      const res = await fetch(`/api/leads/${leadId}/reassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toUserId: data.toUserId,
          reason: data.reason,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error ?? "Failed to reassign lead");
        return;
      }

      toast.success("Lead reassigned successfully");
      form.reset();
      onOpenChange(false);
      onSuccess();
    } catch {
      toast.error("Failed to reassign lead");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Reassign Lead</DialogTitle>
          <DialogDescription>
            Assign this lead to another user. Reason is required for audit.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="toUserId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assign To</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={loadingUsers}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full cursor-pointer">
                        <SelectValue placeholder="Select user" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent
                      align="start"
                      sideOffset={4}
                      className="z-100 w-(--radix-select-trigger-width)"
                    >
                      {users.map((u) => (
                        <SelectItem
                          key={u.id}
                          value={u.id}
                          className="cursor-pointer"
                        >
                          {u.name} ({u.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter reason for reassignment..."
                      className="min-h-[100px] resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
                className="cursor-pointer"
              >
                {form.formState.isSubmitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Reassign"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
