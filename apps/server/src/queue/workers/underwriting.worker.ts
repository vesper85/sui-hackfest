import { Worker, Job } from "bullmq";
import { workerOptions, QUEUE_NAMES } from "../config";
import { underwritingService } from "../../services/underwriting.service";
import { db } from "../../db";
import { documentSubmissions } from "../../db/schema";
import { eq } from "drizzle-orm";

interface UnderwritingJobData {
    submissionId: string;
}

/**
 * Worker for generating underwriting reports
 */
export const underwritingWorker = new Worker<UnderwritingJobData>(
    QUEUE_NAMES.UNDERWRITING,
    async (job: Job<UnderwritingJobData>) => {
        const { submissionId } = job.data;

        console.log(`[Job ${job.id}] Generating underwriting report for ${submissionId}`);

        try {
            const reportId = await underwritingService.generateUnderwritingReport(
                submissionId
            );

            // Update submission status to completed
            await db
                .update(documentSubmissions)
                .set({
                    status: "completed",
                    completedAt: new Date(),
                })
                .where(eq(documentSubmissions.id, submissionId));

            console.log(`[Job ${job.id}] Underwriting report ${reportId} generated`);

            return {
                success: true,
                submissionId,
                reportId,
            };
        } catch (error) {
            console.error(`[Job ${job.id}] Error generating report:`, error);

            // Update submission status to failed
            await db
                .update(documentSubmissions)
                .set({
                    status: "failed",
                })
                .where(eq(documentSubmissions.id, submissionId));

            throw error; // Will trigger retry
        }
    },
    workerOptions
);

// Event listeners
underwritingWorker.on("completed", (job) => {
    console.log(`✅ Underwriting job ${job.id} completed`);
});

underwritingWorker.on("failed", (job, err) => {
    console.error(`❌ Underwriting job ${job?.id} failed:`, err.message);
});
