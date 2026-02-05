import { Queue, Worker, type QueueOptions, type WorkerOptions } from "bullmq";
import Redis from "ioredis";
import { config } from "../config/env";

// Redis connection
const connection = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password || undefined,
    maxRetriesPerRequest: null,
});

// Queue options
const queueOptions: QueueOptions = {
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: "exponential",
            delay: 2000,
        },
        removeOnComplete: {
            age: 24 * 3600, // Keep completed jobs for 24 hours
            count: 1000,
        },
        removeOnFail: {
            age: 7 * 24 * 3600, // Keep failed jobs for 7 days
        },
    },
};

// Worker options
export const workerOptions: WorkerOptions = {
    connection,
    concurrency: 5,
};

// Queue names
export const QUEUE_NAMES = {
    DOCUMENT_PROCESSING: "document-processing",
    UNDERWRITING: "underwriting",
    NOTIFICATIONS: "notifications",
} as const;

// Create queues
export const documentProcessingQueue = new Queue(
    QUEUE_NAMES.DOCUMENT_PROCESSING,
    queueOptions
);

export const underwritingQueue = new Queue(
    QUEUE_NAMES.UNDERWRITING,
    queueOptions
);

export const notificationsQueue = new Queue(
    QUEUE_NAMES.NOTIFICATIONS,
    queueOptions
);

// Export connection for workers
export { connection };
