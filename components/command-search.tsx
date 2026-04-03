"use client";

import {
  IconBarrierBlock,
  IconBrowserCheck,
  IconCalendar,
  IconChecklist,
  IconCoin,
  IconColumns,
  IconError404,
  IconLock,
  IconLockAccess,
  IconNotification,
  IconPalette,
  IconServerOff,
  IconTable,
  IconUserCog,
  IconUserOff,
  IconUsers,
} from "@tabler/icons-react";
import { KanbanIcon, Search } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useAuth } from "@/contexts/auth-context";

interface SearchItem {
  title: string;
  url: string;
  group: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

interface CommandSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const searchItems: SearchItem[] = [
  { title: "Tasks", url: "/tasks", group: "Apps", icon: IconChecklist },
  { title: "Alerts", url: "/alerts", group: "Apps", icon: IconNotification, adminOnly: true },
  { title: "Users", url: "/users", group: "Apps", icon: IconUsers, adminOnly: true },
  { title: "Calendar", url: "/calendar", group: "Apps", icon: IconCalendar },
  { title: "Kanban", url: "/kanban", group: "Apps", icon: KanbanIcon },
  {
    title: "Sign In 1",
    url: "/sign-in-1",
    group: "Auth Pages",
    icon: IconLockAccess,
  },
  {
    title: "Sign In 2",
    url: "/sign-in-2",
    group: "Auth Pages",
    icon: IconLockAccess,
  },
  {
    title: "Sign Up 1",
    url: "/sign-up-1",
    group: "Auth Pages",
    icon: IconLockAccess,
  },
  {
    title: "Sign Up 2",
    url: "/sign-up-2",
    group: "Auth Pages",
    icon: IconLockAccess,
  },
  {
    title: "Reset Password 1",
    url: "/reset-password-1",
    group: "Auth Pages",
    icon: IconLockAccess,
  },
  {
    title: "Reset Password 2",
    url: "/reset-password-2",
    group: "Auth Pages",
    icon: IconLockAccess,
  },
  {
    title: "Unauthorized",
    url: "/unauthorized",
    group: "Errors",
    icon: IconLock,
  },
  { title: "Forbidden", url: "/forbidden", group: "Errors", icon: IconUserOff },
  {
    title: "Not Found",
    url: "/not-found",
    group: "Errors",
    icon: IconError404,
  },
  {
    title: "Internal Server Error",
    url: "/internal-server-error",
    group: "Errors",
    icon: IconServerOff,
  },
  {
    title: "Maintenance",
    url: "/maintenance-error",
    group: "Errors",
    icon: IconBarrierBlock,
  },
  {
    title: "Profile",
    url: "/settings",
    group: "Settings",
    icon: IconUserCog,
  },
  {
    title: "Appearance",
    url: "/settings/appearance",
    group: "Settings",
    icon: IconPalette,
  },
  {
    title: "Notifications",
    url: "/settings/notifications",
    group: "Settings",
    icon: IconNotification,
  },
  {
    title: "Display",
    url: "/settings/display",
    group: "Settings",
    icon: IconBrowserCheck,
  },
  {
    title: "Tattoo Types",
    url: "/settings/tattoo-types",
    group: "Settings",
    icon: IconTable,
    adminOnly: true,
  },
  {
    title: "Column Pricing",
    url: "/pricing/column",
    group: "Pages",
    icon: IconColumns,
  },
  {
    title: "Table Pricing",
    url: "/pricing/table",
    group: "Pages",
    icon: IconTable,
  },
  {
    title: "Single Pricing",
    url: "/pricing/single",
    group: "Pages",
    icon: IconCoin,
  },
];

export function CommandSearch({ open, onOpenChange }: CommandSearchProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const groupedItems = React.useMemo(() => {
    const items = isAdmin ? searchItems : searchItems.filter((item) => !item.adminOnly);
    return items.reduce(
      (acc, item) => {
        if (!acc[item.group]) {
          acc[item.group] = [];
        }
        acc[item.group].push(item);
        return acc;
      },
      {} as Record<string, SearchItem[]>,
    );
  }, [isAdmin]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search pages..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {Object.entries(groupedItems).map(([group, items]) => (
          <CommandGroup key={group} heading={group}>
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem key={item.url} asChild>
                  <Link href={item.url} onClick={() => onOpenChange(false)}>
                    <Icon className="mr-2 size-4 text-muted-foreground" />
                    {item.title}
                  </Link>
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}

export function SearchTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-md text-sm font-medium border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-8 px-3 relative justify-start text-muted-foreground sm:pr-12 md:w-36 lg:w-56"
    >
      <Search className="size-4" />
      <span className="hidden lg:inline-flex">Search...</span>
      <span className="inline-flex lg:hidden">Search...</span>
      <kbd className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium sm:flex">
        <span className="text-xs">⌘</span>K
      </kbd>
    </button>
  );
}
