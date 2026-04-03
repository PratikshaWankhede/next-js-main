import { Card, CardContent } from "@/components/ui/card";
import type { User } from "../utils/schema";
import { Shield, Users } from "lucide-react";

interface UserStateCardsProps {
  users: User[];
}

export function UserStateCards({ users }: UserStateCardsProps) {
  const totalUsers = users.length;
  const adminCount = users.filter((u) => u.role === "admin").length;
  const salesCount = users.filter((u) => u.role === "sales").length;
  const followUpCount = users.filter(
    (u) => u.role === "follow_up_candidate",
  ).length;

  const metrics = [
    {
      title: "Total Users",
      value: totalUsers,
      icon: Users,
    },
    {
      title: "Admins",
      value: adminCount,
      icon: Shield,
    },
    {
      title: "Sales",
      value: salesCount,
      icon: Users,
    },
    {
      title: "Follow Up Candidates",
      value: followUpCount,
      icon: Users,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {metrics.map((metric, index) => (
        <Card key={index} className="border">
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center justify-between">
              <metric.icon className="text-muted-foreground size-6" />
            </div>
            <div className="space-y-2">
              <p className="text-muted-foreground text-sm font-medium">
                {metric.title}
              </p>
              <div className="text-2xl font-bold">{metric.value}</div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
