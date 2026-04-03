import type { RevenueTag } from "@/db/collections";

/**
 * Derives revenue tag from estimated amount (S: >30k, A: 10k-30k, B: 1k-10k, C: else).
 */
export function deriveRevenueTag(
  amount: number | null | undefined,
): RevenueTag {
  if (amount == null || Number.isNaN(amount)) return "C";
  const n = Number(amount);
  if (n > 30000) return "S";
  if (n >= 10000) return "A";
  if (n >= 1000) return "B";
  return "C";
}
