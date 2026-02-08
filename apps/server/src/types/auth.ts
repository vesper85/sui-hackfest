import { z } from "zod";

export const authNonceSchema = z.object({
  walletAddress: z.string().min(1),
});

export type AuthNonceRequest = z.infer<typeof authNonceSchema>;

export const authVerifySchema = z.object({
  walletAddress: z.string().min(1),
  nonce: z.string().min(1),
  message: z.string().min(1),
  signature: z.string().min(1),
});

export type AuthVerifyRequest = z.infer<typeof authVerifySchema>;
