/** E.164 country codes for phone input */
export const COUNTRY_CODES = [
  { code: "+1", label: "US/CA +1" },
  { code: "+44", label: "UK +44" },
  { code: "+91", label: "India +91" },
  { code: "+86", label: "China +86" },
  { code: "+81", label: "Japan +81" },
  { code: "+49", label: "Germany +49" },
  { code: "+33", label: "France +33" },
  { code: "+61", label: "Australia +61" },
  { code: "+55", label: "Brazil +55" },
  { code: "+234", label: "Nigeria +234" },
  { code: "+27", label: "South Africa +27" },
  { code: "+254", label: "Kenya +254" },
  { code: "+256", label: "Uganda +256" },
  { code: "+31", label: "Netherlands +31" },
  { code: "+34", label: "Spain +34" },
  { code: "+39", label: "Italy +39" },
  { code: "+7", label: "Russia +7" },
  { code: "+82", label: "South Korea +82" },
  { code: "+65", label: "Singapore +65" },
  { code: "+60", label: "Malaysia +60" },
  { code: "+62", label: "Indonesia +62" },
  { code: "+63", label: "Philippines +63" },
  { code: "+66", label: "Thailand +66" },
  { code: "+84", label: "Vietnam +84" },
  { code: "+971", label: "UAE +971" },
  { code: "+966", label: "Saudi Arabia +966" },
  { code: "+20", label: "Egypt +20" },
  { code: "+233", label: "Ghana +233" },
  { code: "+212", label: "Morocco +212" },
  { code: "+237", label: "Cameroon +237" },
  { code: "+255", label: "Tanzania +255" },
  { code: "+250", label: "Rwanda +250" },
  { code: "+213", label: "Algeria +213" },
  { code: "+218", label: "Libya +218" },
  { code: "+964", label: "Iraq +964" },
  { code: "+98", label: "Iran +98" },
  { code: "+92", label: "Pakistan +92" },
  { code: "+880", label: "Bangladesh +880" },
  { code: "+94", label: "Sri Lanka +94" },
  { code: "+353", label: "Ireland +353" },
  { code: "+46", label: "Sweden +46" },
  { code: "+47", label: "Norway +47" },
  { code: "+45", label: "Denmark +45" },
  { code: "+358", label: "Finland +358" },
  { code: "+48", label: "Poland +48" },
  { code: "+420", label: "Czech +420" },
  { code: "+36", label: "Hungary +36" },
  { code: "+30", label: "Greece +30" },
  { code: "+351", label: "Portugal +351" },
  { code: "+90", label: "Turkey +90" },
  { code: "+972", label: "Israel +972" },
  { code: "+52", label: "Mexico +52" },
  { code: "+57", label: "Colombia +57" },
  { code: "+58", label: "Venezuela +58" },
  { code: "+54", label: "Argentina +54" },
  { code: "+56", label: "Chile +56" },
  { code: "+51", label: "Peru +51" },
  { code: "+593", label: "Ecuador +593" },
] as const;

export const LEAD_STAGES = [
  "new",
  "contacted",
  "interested",
  "rnr",
  "follow_up",
  "booking",
  "no_show",
  "done",
  "lost",
] as const;

export type LeadStage = (typeof LEAD_STAGES)[number];

export const LEAD_SOURCES = [
  "whatsapp",
  "instagram",
  "manual",
  "referral",
  "website",
] as const;

export type LeadSource = (typeof LEAD_SOURCES)[number];

export interface Lead {
  id: string;
  name: string;
  phone: string;
  source: LeadSource;
  stage: LeadStage;
  assignedUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeadStageHistory {
  id: string;
  leadId: string;
  fromStage: LeadStage;
  toStage: LeadStage;
  changedByUserId: string;
  changedAt: Date;
}

export interface LeadReassignmentLog {
  id: string;
  leadId: string;
  fromUserId: string;
  toUserId: string;
  reason: string;
  changedByAdminId: string;
  changedAt: Date;
}

export const STAGE_ORDER: LeadStage[] = [
  "new",
  "contacted",
  "interested",
  "rnr",
  "follow_up",
  "booking",
  "no_show",
  "done",
  "lost",
];

export const NEXT_STAGE_MAP: Record<LeadStage, LeadStage[]> = {
  new: ["contacted"],
  contacted: ["interested", "rnr", "lost"],
  interested: ["follow_up", "booking", "done", "lost"],
  rnr: ["follow_up"],
  follow_up: ["booking", "done", "lost"],
  booking: ["done", "lost", "no_show"],
  no_show: ["follow_up", "booking", "lost"],
  done: [],
  lost: [],
};

export function getNextValidStages(currentStage: LeadStage): LeadStage[] {
  return NEXT_STAGE_MAP[currentStage] ?? [];
}

export function isValidStageTransition(
  fromStage: LeadStage,
  toStage: LeadStage,
): boolean {
  return NEXT_STAGE_MAP[fromStage]?.includes(toStage) ?? false;
}
