import { z } from "zod";

export const userRoles = ["admin", "sales", "follow_up_candidate"] as const;
export type UserRole = (typeof userRoles)[number];

export const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  image: z.string().nullable().optional(),
  role: z.enum(userRoles),
  createdAt: z.coerce.date(),
});

export const createUserFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(userRoles),
});

export const editUserFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  role: z.enum(userRoles),
  password: z
    .string()
    .optional()
    .refine((val) => !val || val.length >= 8, "Password must be at least 8 characters"),
});

export type User = z.infer<typeof userSchema>;
export type CreateUserFormValues = z.infer<typeof createUserFormSchema>;
export type EditUserFormValues = z.infer<typeof editUserFormSchema>;
