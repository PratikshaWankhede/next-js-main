import type { SidebarData } from "@/lib/types";
import {
  IconBrowserCheck,
  IconCalendar,
  IconChartBar,
  IconChecklist,
  IconClock,
  IconLayoutDashboard,
  IconNotification,
  IconPalette,
  IconRoute,
  IconSettings,
  IconTable,
  IconUserCog,
  IconUsers,
} from "@tabler/icons-react";
import { KanbanIcon } from "lucide-react";

export const sidebarData: SidebarData = {
  navGroups: [
    {
      title: "Dashboard",
      items: [
        {
          title: "Overview",
          url: "/dashboard",
          icon: IconLayoutDashboard,
        },
        {
          title: "Leads",
          url: "/leads",
          icon: IconUsers,
        },
        {
          title: "Follow-Ups",
          url: "/follow-ups",
          icon: IconChecklist,
        },
        {
          title: "Alerts",
          url: "/alerts",
          icon: IconNotification,
          adminOnly: true,
        },
        {
          title: "Notifications",
          url: "/notifications",
          icon: IconNotification,
        },
        {
          title: "Analytics",
          url: "/analytics",
          icon: IconChartBar,
        },
      ],
    },
    {
      title: "General",
      items: [
        {
          title: "Tasks",
          url: "/tasks",
          icon: IconChecklist,
        },
        {
          title: "Users",
          url: "/users",
          icon: IconUsers,
          adminOnly: true,
        },
        {
          title: "Calendar",
          url: "/calendar",
          icon: IconCalendar,
        },
        {
          title: "Kanban",
          url: "/kanban",
          icon: KanbanIcon,
        },
      ],
    },
    {
      title: "Other",
      items: [
        {
          title: "Settings",
          icon: IconSettings,
          // badge: "Coming Soon",
          items: [
            {
              title: "Profile",
              url: "/settings",
              icon: IconUserCog,
            },
            {
              title: "Appearance",
              url: "/settings/appearance",
              icon: IconPalette,
            },
            {
              title: "Notifications",
              url: "/settings/notifications",
              icon: IconNotification,
            },
            {
              title: "Display",
              url: "/settings/display",
              icon: IconBrowserCheck,
            },
            {
              title: "SLA",
              url: "/settings/sla",
              icon: IconClock,
              adminOnly: true,
            },
            {
              title: "Lead Routing",
              url: "/settings/lead-routing",
              icon: IconRoute,
              adminOnly: true,
            },
            {
              title: "Booking Templates",
              url: "/settings/booking-templates",
              icon: IconTable,
              adminOnly: true,
            },
            {
              title: "Tattoo Types",
              url: "/settings/tattoo-types",
              icon: IconTable,
              adminOnly: true,
            },
          ],
        },
      ],
    },
  ],
};
