#!/usr/bin/env node
import "dotenv/config";
import { documentProcessingWorker } from "./workers/document-processing.worker";
import { underwritingWorker } from "./workers/underwriting.worker";

let workersStarted = false;

/**
 * Start all workers
 */
export async function startWorkers() {
    if (workersStarted) {
        console.log("⚠️  Workers already started");
        return;
    }

    console.log("🚀 Starting BullMQ workers...");

    // Workers are already instantiated when imported
    console.log("  ✓ Document Processing Worker started");
    console.log("  ✓ Underwriting Worker started");

    workersStarted = true;
    console.log("📊 Workers are now processing jobs\n");
}

/**
 * Stop all workers gracefully
 */
export async function stopWorkers() {
    if (!workersStarted) {
        return;
    }

    console.log("\n🛑 Shutting down workers...");

    try {
        await documentProcessingWorker.close();
        await underwritingWorker.close();
        console.log("  ✓ Workers shut down gracefully");
    } catch (error) {
        console.error("  ✗ Error shutting down workers:", error);
    }

    workersStarted = false;
}

// When run directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
    startWorkers();

    // Graceful shutdown
    const shutdown = async () => {
        await stopWorkers();
        process.exit(0);
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
}
