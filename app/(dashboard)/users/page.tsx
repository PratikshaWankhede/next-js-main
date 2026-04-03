"use client";

import { DataTable } from "@/features/users/components/user-data-table";
import { UserStateCards } from "@/features/users/components/user-state-cards";
import type { User } from "@/features/users/utils/schema";
import { useEffect, useState } from "react";

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/users");
      if (res.status === 403) {
        setIsAdmin(false);
        setUsers([]);
        return;
      }
      if (!res.ok) {
        setError("Failed to load users");
        setUsers([]);
        return;
      }
      const json = await res.json();
      const userList = (json.users ?? []).map((u: Record<string, unknown>) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        image: u.image ?? null,
        role: u.role ?? "sales",
        createdAt: u.createdAt,
      }));
      setUsers(userList);
      setIsAdmin(true);
    } catch {
      setError("Failed to load users");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  if (isAdmin === false) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <h2 className="text-xl font-semibold">Access Denied</h2>
        <p className="text-muted-foreground text-center">
          You need admin permissions to manage users.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="px-4 py-4 lg:px-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground">
            Manage users and permissions
          </p>
        </div>
      </div>

      <div className="@container/main px-4 lg:px-6 space-y-6">
        <UserStateCards users={users} />

        {loading ? (
          <div className="rounded-md border p-8 text-center text-muted-foreground">
            Loading users...
          </div>
        ) : error ? (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : (
          <DataTable users={users} onSuccess={fetchUsers} />
        )}
      </div>
    </>
  );
}
