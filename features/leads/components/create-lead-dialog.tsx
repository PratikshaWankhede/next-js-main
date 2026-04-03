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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  createLeadSchema,
  type CreateLeadFormValues,
} from "../utils/schema";
import { COUNTRY_CODES, LEAD_SOURCES } from "../types/lead.types";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface CreateLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  isAdmin?: boolean;
}

export function CreateLeadDialog({
  open,
  onOpenChange,
  onSuccess,
  isAdmin = false,
}: CreateLeadDialogProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [countryCode, setCountryCode] = useState("+1");

  const [tattooTypes, setTattooTypes] = useState<{ id: string; name: string }[]>([]);
  const [loadingTattooTypes, setLoadingTattooTypes] = useState(false);

  const form = useForm<CreateLeadFormValues>({
    resolver: zodResolver(createLeadSchema),
    defaultValues: {
      name: "",
      phone: "",
      source: "manual",
      assignedUserId: undefined,
      tattooTypeId: undefined,
    },
  });

  useEffect(() => {
    if (!open) return;
    const tid = setTimeout(() => setLoadingTattooTypes(true), 0);
    fetch("/api/tattoo-types")
      .then((res) => res.json())
      .then((data) => {
        const list = data?.tattooTypes;
        setTattooTypes(Array.isArray(list) ? list : []);
      })
      .catch(() => setTattooTypes([]))
      .finally(() => {
        clearTimeout(tid);
        setLoadingTattooTypes(false);
      });
    return () => clearTimeout(tid);
  }, [open]);

  useEffect(() => {
    if (!open || !isAdmin) return;
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
  }, [open, isAdmin]);

  async function onSubmit(data: CreateLeadFormValues) {
    try {
      const body: Record<string, unknown> = {
        name: data.name,
        phone: data.phone,
        source: data.source,
      };
      if (isAdmin && data.assignedUserId) {
        body.assignedUserId = data.assignedUserId;
      }
      if (data.tattooTypeId) {
        body.tattooTypeId = data.tattooTypeId;
      }

      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error ?? "Failed to create lead");
        return;
      }

      toast.success("Lead created successfully");
      form.reset();
      onOpenChange(false);
      onSuccess();
    } catch {
      toast.error("Failed to create lead");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Lead</DialogTitle>
          <DialogDescription>
            Add a new lead. Name and phone are required.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter lead name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => {
                const raw = field.value;
                const digitsOnly = raw.replace(/\D/g, "");
                const matchedCode = COUNTRY_CODES.slice()
                  .sort((a, b) => b.code.length - a.code.length)
                  .find((c) =>
                    digitsOnly.startsWith(c.code.replace("+", ""))
                  );
                const displayCode = matchedCode?.code ?? countryCode;
                const displayNumber = matchedCode
                  ? digitsOnly.slice(matchedCode.code.replace("+", "").length)
                  : digitsOnly;
                return (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <InputGroup>
                        <InputGroupAddon>
                          <Select
                            value={displayCode}
                            onValueChange={(v) => {
                              setCountryCode(v);
                              const digits = displayNumber.replace(/\D/g, "");
                              field.onChange(
                                digits ? `${v}${digits}` : ""
                              );
                            }}
                          >
                            <SelectTrigger className="h-9 w-[100px] cursor-pointer border-0 bg-transparent shadow-none focus:ring-0">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent align="start">
                              {COUNTRY_CODES.map((c) => (
                                <SelectItem
                                  key={c.code}
                                  value={c.code}
                                  className="cursor-pointer"
                                >
                                  {c.code}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </InputGroupAddon>
                        <InputGroupInput
                          placeholder="234 567 8900"
                          value={displayNumber}
                          onChange={(e) => {
                            const digits = e.target.value.replace(/\D/g, "");
                            const code = raw || digits ? displayCode : countryCode;
                            field.onChange(digits ? `${code}${digits}` : "");
                          }}
                        />
                      </InputGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />
            <FormField
              control={form.control}
              name="source"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Source</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="cursor-pointer">
                        <SelectValue placeholder="Select source" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
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
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="tattooTypeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tattoo Type (optional)</FormLabel>
                  <Select
                    onValueChange={(v) =>
                      field.onChange(v === "__none__" ? undefined : v)
                    }
                    value={field.value ?? "__none__"}
                    disabled={loadingTattooTypes}
                  >
                    <FormControl>
                      <SelectTrigger className="cursor-pointer">
                        <SelectValue placeholder="Select tattoo type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__" className="cursor-pointer">
                        None
                      </SelectItem>
                      {tattooTypes.map((t) => (
                        <SelectItem
                          key={t.id}
                          value={t.id}
                          className="cursor-pointer"
                        >
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {isAdmin && (
              <FormField
                control={form.control}
                name="assignedUserId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assign To (optional)</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? ""}
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
            )}
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
                  "Create Lead"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
