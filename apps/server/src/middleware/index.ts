import type { Context, Next } from "hono";
import { AppError } from "../types";

/**
 * Global error handler middleware
 */
export const errorHandler = async (c: Context, next: Next) => {
  try {
    await next();
  } catch (error) {
    console.error("Error:", error);

    if (error instanceof AppError) {
      return c.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        },
        error.statusCode as any,
      );
    }

    // Unknown error
    return c.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "An unexpected error occurred",
        },
      },
      500,
    );
  }
};

/**
 * Request logger middleware
 */
export const requestLogger = async (c: Context, next: Next) => {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;

  await next();

  const duration = Date.now() - start;
  const status = c.res.status;

  console.log(`[${method}] ${path} - ${status} (${duration}ms)`);
};

// CORS handled in app setup using hono/cors

/**
 * Auth middleware (simplified - TODO: implement proper JWT verification)
 */
export const authMiddleware = async (c: Context, next: Next) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json(
      {
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Missing or invalid authorization header",
        },
      },
      401,
    );
  }

  const token = authHeader.substring(7);

  try {
    const { verifyToken } = await import("../services/auth.service");
    const { walletAddress } = await verifyToken(token);

    // Set wallet context
    c.set("walletAddress", walletAddress);

    // Get user from database
    const { db } = await import("../db");
    const { users } = await import("../db/schema");
    const { eq } = await import("drizzle-orm");

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.walletAddress, walletAddress));

    if (user) {
      c.set("userId", user.id);
      c.set("userType", user.userType);
    }

    await next();
  } catch (error) {
    return c.json(
      {
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid or expired token",
        },
      },
      401,
    );
  }
};
