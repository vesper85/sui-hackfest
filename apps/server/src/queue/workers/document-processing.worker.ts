import { Worker, Job } from "bullmq";
import { workerOptions, QUEUE_NAMES } from "../config";
import { db } from "../../db";
import { documents, documentExtractions } from "../../db/schema";
import { eq } from "drizzle-orm";
import { s3Service } from "../../services/s3.service";
import { llmService } from "../../services/llm.service";
import pdf from "pdf-parse";

interface DocumentProcessingJobData {
    documentId: string;
    s3Key: string;
    documentType: string;
}

/**
 * Worker for processing documents with LLM extraction
 */
export const documentProcessingWorker = new Worker<DocumentProcessingJobData>(
    QUEUE_NAMES.DOCUMENT_PROCESSING,
    async (job: Job<DocumentProcessingJobData>) => {
        const { documentId, s3Key, documentType } = job.data;

        console.log(`[Job ${job.id}] Processing document ${documentId}`);

        try {
            // Update status to processing
            await db
                .update(documents)
                .set({ processingStatus: "processing" })
                .where(eq(documents.id, documentId));

            // Download document from S3
            const fileBuffer = await s3Service.getFile(s3Key);

            // Extract text from PDF
            let documentText: string;
            try {
                const pdfData = await pdf(fileBuffer);
                documentText = pdfData.text;
                console.log(`[Job ${job.id}] Extracted ${pdfData.numpages} pages`);
            } catch (pdfError) {
                // Fallback to UTF-8 text if PDF parsing fails
                console.warn(`[Job ${job.id}] PDF parse failed, using raw text`);
                documentText = fileBuffer.toString("utf-8");
            }

            // Extract data using LLM
            const { result, tokensUsed, cost } = await llmService.extractDocumentData(
                documentText,
                documentType
            );

            // Store extraction in database
            await db.insert(documentExtractions).values({
                documentId,
                llmProvider: "openai",
                llmModel: "gpt-4o",
                rawLlmResponse: result as any,
                structuredData: result as any,
                confidenceScore: result.confidence?.toString() || "0",
                tokensUsed,
                extractionCostUsd: cost.toString(),
            });

            // Update document status
            await db
                .update(documents)
                .set({
                    processingStatus: "completed",
                    processedAt: new Date(),
                })
                .where(eq(documents.id, documentId));

            console.log(`[Job ${job.id}] Document processed successfully`);

            return {
                success: true,
                documentId,
                tokensUsed,
                cost,
            };
        } catch (error) {
            console.error(`[Job ${job.id}] Error processing document:`, error);

            await db
                .update(documents)
                .set({
                    processingStatus: "failed",
                    errorMessage: error instanceof Error ? error.message : "Unknown error",
                })
                .where(eq(documents.id, documentId));

            throw error; // Will trigger retry
        }
    },
    workerOptions
);

// Event listeners
documentProcessingWorker.on("completed", (job) => {
    console.log(`✅ Job ${job.id} completed`);
});

documentProcessingWorker.on("failed", (job, err) => {
    console.error(`❌ Job ${job?.id} failed:`, err.message);
});

documentProcessingWorker.on("error", (err) => {
    console.error("Worker error:", err);
});
