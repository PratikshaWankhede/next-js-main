import { z } from "zod";

/** E.164: + followed by 7–15 digits */
const e164Regex = /^\+[1-9]\d{6,14}$/;

export const createLeadSchema = z.object({
  name: z.string().min(1, "Name is required").trim(),
  phone: z
    .string()
    .min(1, "Phone is required")
    .transform((v) => v.replace(/\s/g, ""))
    .refine((v) => e164Regex.test(v), {
      message: "Enter a valid phone number with country code (e.g. +1 234 567 8900)",
    }),
  source: z.enum(["whatsapp", "instagram", "manual", "referral", "website"]),
  assignedUserId: z.string().optional(),
  tattooTypeId: z.string().optional(),
});

export type CreateLeadFormValues = z.infer<typeof createLeadSchema>;
