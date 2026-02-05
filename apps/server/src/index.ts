import { Hono } from "hono";
import "dotenv/config";
import { config } from "./config/env";
import {
    errorHandler,
    requestLogger,
    corsMiddleware,
} from "./middleware";
import routes from "./api/routes";
import {
    checkDatabaseHealth,
    checkS3Health,
    checkLLMHealth,
} from "./lib/health";

const app = new Hono();

app.use("*", requestLogger);
app.use("*", corsMiddleware);
app.use("*", errorHandler);

app.get("/", (c) => {
    return c.json({
        service: "SUI UW",
        version: "1.0.0",
        status: "healthy",
        timestamp: new Date().toISOString(),
    });
});

app.get("/health", async (c) => {
    const [database, s3, llm] = await Promise.all([
        checkDatabaseHealth(),
        checkS3Health(),
        checkLLMHealth(),
    ]);

    const health = {
        status: "ok",
        database,
        s3,
        llm,
        timestamp: new Date().toISOString(),
    };

    const allHealthy =
        database === "connected" && s3 === "connected" && llm === "connected";

    return c.json(health, allHealthy ? 200 : 503);
});

app.route("/api", routes);

app.notFound((c) => {
    return c.json(
        {
            success: false,
            error: {
                code: "NOT_FOUND",
                message: "Route not found",
            },
        },
        404
    );
});

console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🏦  AI-Powered Underwriting System                     ║
║                                                           ║
║   Environment: ${config.app.env.padEnd(42)}║
║   Port:        ${config.app.port.toString().padEnd(42)}║
║   Database:    Connected                                  ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

console.log(`Server starting on http://localhost:${config.app.port}`);
console.log(`API available at http://localhost:${config.app.port}/api`);
console.log(`Health check: http://localhost:${config.app.port}/health\n`);

const shouldStartWorkers = process.env.START_WORKERS !== "false";

if (shouldStartWorkers) {
    console.log("📦 Starting background workers...");
    import("./queue/worker").then(({ startWorkers }) => {
        startWorkers();
    }).catch((err) => {
        console.error("❌ Failed to start workers:", err);
        console.log("💡 You can run workers separately with: bun run worker");
    });
} else {
    console.log("⚠️  Workers not started. Run separately with: bun run worker\n");
}

export default {
    port: config.app.port,
    fetch: app.fetch,
};