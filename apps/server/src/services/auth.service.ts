import { SignJWT, jwtVerify } from "jose";
import { verifyPersonalMessageSignature } from "@mysten/sui/verify";
import { config } from "../config/env";
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";

const JWT_SECRET = new TextEncoder().encode(config.jwt.secret);

/**
 * Generate JWT token for a wallet address
 */
export async function generateToken(walletAddress: string): Promise<string> {
  const token = await new SignJWT({
    walletAddress,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d") // 7 days
    .sign(JWT_SECRET);

  return token;
}

/**
 * Verify JWT token and return decoded payload
 */
export async function verifyToken(token: string): Promise<{
  walletAddress: string;
}> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as { walletAddress: string };
  } catch (error) {
    throw new Error("Invalid or expired token");
  }
}

/**
 * Verify Sui wallet signature
 * This validates that the user owns the wallet they claim to own
 */
export async function verifySuiSignature(params: {
  walletAddress: string;
  message: string;
  signature: string;
}): Promise<boolean> {
  try {
    const messageBytes = new TextEncoder().encode(params.message);
    await verifyPersonalMessageSignature(messageBytes, params.signature, {
      address: params.walletAddress,
    });
    return true;
  } catch (error) {
    console.warn("Sui signature verification failed", error);
    return false;
  }
}

/**
 * Get or create user from wallet address
 */
export async function getOrCreateUser(walletAddress: string) {
  // Check if user exists
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.walletAddress, walletAddress));

  if (existingUser) {
    return existingUser;
  }

  // Create new user
  const [newUser] = await db
    .insert(users)
    .values({
      walletAddress,
      userType: "borrower", // Default to borrower, can be changed later
      kycStatus: "pending",
    })
    .returning();

  return newUser;
}
