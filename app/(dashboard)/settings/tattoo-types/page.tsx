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
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/auth-context";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface TattooType {
  id: string;
  name: string;
}

export default function TattooTypesSettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [tattooTypes, setTattooTypes] = useState<TattooType[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchTypes = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const res = await fetch("/api/tattoo-types");
      if (res.status === 403) {
        setTattooTypes([]);
        return;
      }
      const data = await res.json();
      setTattooTypes(Array.isArray(data?.tattooTypes) ? data.tattooTypes : []);
    } catch {
      setTattooTypes([]);
      toast.error("Failed to load tattoo types");
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchTypes();
  }, [fetchTypes]);

  if (user !== null && !isAdmin) {
    return (
      <ContentSection title="Tattoo Types" desc="Manage tattoo type options.">
        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-8">
          <h2 className="text-xl font-semibold">Access Denied</h2>
          <p className="text-muted-foreground text-center">
            You need admin permissions to manage tattoo types.
          </p>
        </div>
      </ContentSection>
    );
  }

  async function handleAdd() {
    const name = newName.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/tattoo-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to create tattoo type");
        return;
      }
      toast.success("Tattoo type added");
      setNewName("");
      setAddOpen(false);
      fetchTypes();
    } catch {
      toast.error("Failed to create tattoo type");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/tattoo-types/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to delete");
        return;
      }
      toast.success("Tattoo type deleted");
      fetchTypes();
    } catch {
      toast.error("Failed to delete tattoo type");
    }
  }

  return (
    <ContentSection
      title="Tattoo Types"
      desc="Manage tattoo type options used when creating leads. Admin only."
    >
      <div className="space-y-4">
        {isAdmin && (
          <Button
            onClick={() => setAddOpen(true)}
            className="cursor-pointer"
            size="sm"
          >
            <Plus className="size-4" />
            Add Tattoo Type
          </Button>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading...
          </div>
        ) : tattooTypes.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No tattoo types yet.
            {isAdmin && " Click Add to create one."}
          </p>
        ) : (
          <ul className="space-y-2">
            {tattooTypes.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <span>{t.name}</span>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 cursor-pointer text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => handleDelete(t.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Add Tattoo Type</DialogTitle>
            <DialogDescription>
              Create a new tattoo type option for leads.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                placeholder="e.g. Full Sleeve"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddOpen(false)}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAdd}
              disabled={submitting || !newName.trim()}
              className="cursor-pointer"
            >
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Add"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ContentSection>
  );
}
