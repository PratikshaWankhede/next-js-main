export type DashboardSummary = {
  kpis: { activePipelineCount: number };
  todayActions: {
    followUpsToday: number;
    overdueFollowUps: number;
    newLeadsToday: number;
    hotLeads: number;
  };
  conversion: {
    totalLeads: number;
    booked: number;
    done: number;
    conversionRate: number;
  };
  missedOpportunities: { lost: number; noShow: number; total: number };
  leadCountsByStage: { stage: string; count: number }[];
  leadCountsBySource: { source: string; count: number }[];
  hotLeads: { id: string; name: string; score: string }[];
  followUps: { today: number; overdue: number; upcoming: number };
  unreadNotifications: number;
  topAssignees: {
    userId: string;
    name: string;
    totalLeads: number;
    conversionRate: number;
    followUpCompletionRate: number;
  }[];
};

export const emptyDashboardSummary = (): DashboardSummary => ({
  kpis: { activePipelineCount: 0 },
  todayActions: {
    followUpsToday: 0,
    overdueFollowUps: 0,
    newLeadsToday: 0,
    hotLeads: 0,
  },
  conversion: {
    totalLeads: 0,
    booked: 0,
    done: 0,
    conversionRate: 0,
  },
  missedOpportunities: { lost: 0, noShow: 0, total: 0 },
  leadCountsByStage: [],
  leadCountsBySource: [],
  hotLeads: [],
  followUps: { today: 0, overdue: 0, upcoming: 0 },
  unreadNotifications: 0,
  topAssignees: [],
});
