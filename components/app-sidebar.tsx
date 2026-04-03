"use client";

import {
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  Sidebar as UISidebar,
} from "@/components/ui/sidebar";
import { sidebarData } from "@/constants/sidebar-data";
import { useAuth } from "@/contexts/auth-context";
import { useSidebarConfig } from "@/contexts/sidebar-context";
import type { NavGroup as NavGroupType, NavItem } from "@/lib/types";
import React, { useMemo } from "react";
import { NavGroup } from "./nav-group";
import { NavUser } from "./nav-user";
import { SidebarLogo } from "./sidebar-logo";

function filterNavGroupsByRole(navGroups: NavGroupType[], isAdmin: boolean): NavGroupType[] {
  if (isAdmin) return navGroups;
  return navGroups
    .map((group) => {
      const visibleItems = group.items.filter(
        (item) => !(item as NavItem & { adminOnly?: boolean }).adminOnly
      );
      const itemsWithFilteredSub = visibleItems.map((item) => {
        if (!item.items) return item;
        const visibleSub = item.items.filter(
          (sub) => !(sub as { adminOnly?: boolean }).adminOnly
        );
        return { ...item, items: visibleSub };
      });
      const finalItems = itemsWithFilteredSub.filter(
        (item) => !item.items || item.items.length > 0
      );
      return { ...group, items: finalItems };
    })
    .filter((group) => group.items.length > 0);
}

export default function AppSidebar({
  ...props
}: React.ComponentProps<typeof UISidebar>) {
  const { user } = useAuth();
  const { config } = useSidebarConfig();
  const isAdmin = user?.role === "admin";
  const navGroups = useMemo(
    () => filterNavGroupsByRole(sidebarData.navGroups, isAdmin),
    [isAdmin]
  );

  return (
    <UISidebar
      variant={config.variant}
      collapsible={config.collapsible}
      side={config.side}
      {...props}
    >
      <SidebarHeader>
        <SidebarLogo />
      </SidebarHeader>
      <SidebarContent>
        {navGroups.map((nav) => (
          <NavGroup key={nav.title} {...nav} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        {user && (
          <NavUser
            user={{
              name: user.name,
              email: user.email,
              avatar: user.avatar || "",
              role: user.role,
            }}
          />
        )}
      </SidebarFooter>
      <SidebarRail />
    </UISidebar>
  );
}
