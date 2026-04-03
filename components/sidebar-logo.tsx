"use client";

import Image from "next/image";
import Link from "next/link";
import { useSidebar } from "@/components/ui/sidebar";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

const LOGO_URL =
  "https://rjtattoostudio.com/wp-content/uploads/2025/04/Black-and-Orange-Typography-T-shirtj-e1742288670418-300x103-1.webp";

export function SidebarLogo() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          asChild
          className="group/logo relative overflow-hidden data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
        >
          <Link href="/dashboard" className="flex items-center gap-2">
            <div
              className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black ${
                isCollapsed ? "size-8" : "h-9 w-24"
              }`}
            >
              <Image
                src={LOGO_URL}
                alt="RJ Tattoo Studio"
                width={isCollapsed ? 32 : 96}
                height={isCollapsed ? 32 : 33}
                className="object-contain"
              />
            </div>
            {!isCollapsed && (
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">RJ Tattoo</span>
                <span className="truncate text-xs text-muted-foreground">
                  CRM Dashboard
                </span>
              </div>
            )}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
