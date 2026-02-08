import type { Context } from "hono";
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { InternalServerError, ValidationError } from "../types";
import type { OnboardingRequest } from "../types/onboarding";

function resolveUserType(_: string, next: "borrower" | "lender") {
  return next;
}

export const getMe = async (c: Context) => {
  const walletAddress = c.get("walletAddress");
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.walletAddress, walletAddress));

  return c.json({
    user: user
      ? {
          id: user.id,
          walletAddress: user.walletAddress,
          userType: user.userType,
          onboardingStatus: user.onboardingStatus,
          onboardingData: user.onboardingData,
          kycStatus: user.kycStatus,
        }
      : null,
  });
};

export const updateOnboarding = async (c: Context) => {
  const body: OnboardingRequest = await c.req.json();
  const walletAddress = c.get("walletAddress");

  if (body.role === "borrower") {
    if (!body.borrowerType) {
      throw new ValidationError("Borrower type is required");
    }
    if (!body.assets || body.assets.length === 0) {
      throw new ValidationError("Asset types are required");
    }
    if (!body.requestedAmountUsd) {
      throw new ValidationError("Requested amount is required");
    }
    if (!body.tenureMonths) {
      throw new ValidationError("Tenure is required");
    }
    if (!body.purpose) {
      throw new ValidationError("Loan purpose is required");
    }
  }

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.walletAddress, walletAddress));

  if (!existing) {
    throw new ValidationError("User not found");
  }

  const nextUserType =
    body.role === "investor"
      ? resolveUserType(existing.userType, "lender")
      : resolveUserType(existing.userType, "borrower");

  const onboardingData =
    body.role === "borrower"
      ? {
          borrowerType: body.borrowerType,
          assets: body.assets ?? [],
          requestedAmountUsd: body.requestedAmountUsd ?? null,
          tenureMonths: body.tenureMonths ?? null,
          purpose: body.purpose ?? null,
        }
      : null;

  const [updated] = await db
    .update(users)
    .set({
      userType: nextUserType,
      onboardingStatus: "completed",
      onboardingData,
      updatedAt: new Date(),
    })
    .where(eq(users.walletAddress, walletAddress))
    .returning();

  if (!updated) {
    throw new InternalServerError("Failed to update onboarding");
  }

  return c.json({
    user: {
      id: updated.id,
      walletAddress: updated.walletAddress,
      userType: updated.userType,
      onboardingStatus: updated.onboardingStatus,
      onboardingData: updated.onboardingData,
    },
  });
};
