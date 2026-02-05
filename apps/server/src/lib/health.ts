import { db } from "../db";
import { users } from "../db/schema";
import { s3Service } from "../services/s3.service";
import { config } from "../config/env";
import OpenAI from "openai";

/**
 * Check database connection health
 */
export async function checkDatabaseHealth(): Promise<string> {
    try {
        // Simple query to check connection
        await db.select().from(users).limit(1);
        return "connected";
    } catch (error) {
        console.error("Database health check failed:", error);
        return "disconnected";
    }
}

/**
 * Check S3 connection health
 */
export async function checkS3Health(): Promise<string> {
    try {
        // Try to generate a presigned URL (doesn't actually hit S3)
        await s3Service.getUploadUrl({
            key: "health-check-test",
            expiresIn: 60,
        });
        return "connected";
    } catch (error) {
        console.error("S3 health check failed:", error);
        return "disconnected";
    }
}

/**
 * Check LLM API health
 */
export async function checkLLMHealth(): Promise<string> {
    try {
        const openai = new OpenAI({
            apiKey: config.openai.apiKey,
        });

        // Simple completion to test API key
        await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: "test" }],
            max_tokens: 5,
        });

        return "connected";
    } catch (error) {
        console.error("LLM health check failed:", error);
        return "disconnected";
    }
}
