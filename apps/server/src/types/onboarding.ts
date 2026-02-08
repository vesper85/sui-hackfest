import { z } from "zod";

export const onboardingSchema = z.object({
  role: z.enum(["investor", "borrower"]),
  borrowerType: z.enum(["individual", "business"]).optional(),
  assets: z.array(z.string().min(1)).optional(),
  requestedAmountUsd: z.number().positive().optional(),
  tenureMonths: z.number().int().positive().optional(),
  purpose: z.string().min(1).optional(),
});

export type OnboardingRequest = z.infer<typeof onboardingSchema>;
