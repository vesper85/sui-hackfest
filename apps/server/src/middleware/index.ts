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
                error.statusCode as any
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
            500
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

/**
 * CORS middleware
 */
export const corsMiddleware = async (c: Context, next: Next) => {
    // Allow all origins in development
    c.header("Access-Control-Allow-Origin", "*");
    c.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
    );
    c.header(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization"
    );

    if (c.req.method === "OPTIONS") {
        return new Response(null, { status: 204 });
    }

    await next();
};

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
            401
        );
    }

    const token = authHeader.substring(7);

    c.set("walletAddress", "0x1234567890abcdef");
    c.set("userId", "user-id");

    await next();
};
