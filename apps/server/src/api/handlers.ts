import type { Context } from "hono";
import { db } from "../db";
import {
    users,
    borrowerProfiles,
    documentSubmissions,
    documents,
    documentExtractions,
    underwritingReports,
    collateralAssets,
    lendingPools,
    loans,
} from "../db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { nanoid } from "nanoid";
import { s3Service } from "../services/s3.service";
import { llmService } from "../services/llm.service";
import { underwritingService } from "../services/underwriting.service";
import { getPoolPerformanceHistory } from "./admin-handlers";
import {
    NotFoundError,
    ValidationError,
    InternalServerError,
} from "../types";
import type {
    CreateSubmissionRequest,
    CreateSubmissionResponse,
    UnderwritingReportResponse,
    ApplyLoanRequest,
    PoolQueryParams,
} from "../types";

/**
 * Create a new borrower submission
 */
export const createSubmission = async (c: Context) => {
    try {
        const body: CreateSubmissionRequest = await c.req.json();
        const walletAddress = c.get("walletAddress"); // Assuming auth middleware sets this

        // Create or get user
        let [user] = await db
            .select()
            .from(users)
            .where(eq(users.walletAddress, walletAddress));

        if (!user) {
            [user] = await db
                .insert(users)
                .values({
                    walletAddress,
                    email: body.email,
                    userType: "borrower",
                })
                .returning();

            if (!user) {
                throw new InternalServerError("Failed to create user");
            }
        }

        // Create borrower profile
        const [borrower] = await db
            .insert(borrowerProfiles)
            .values({
                userId: user.id,
                fullName: body.fullName,
                businessName: body.businessName,
                borrowerType: body.borrowerType,
                metadata: body.metadata,
            })
            .returning();

        if (!borrower) {
            throw new InternalServerError("Failed to create borrower profile");
        }

        // Create submission
        const submissionReference = `SUB-${nanoid(10).toUpperCase()}`;
        const [submission] = await db
            .insert(documentSubmissions)
            .values({
                borrowerId: borrower.id,
                submissionReference,
                status: "pending",
            })
            .returning();

        if (!submission) {
            throw new InternalServerError("Failed to create submission");
        }

        // Generate presigned URLs for common document types
        const documentTypes = [
            "bank_statement",
            "tax_return",
            "pay_stub",
            "id_document",
            "property_deed",
        ];

        const uploadUrls = await Promise.all(
            documentTypes.map(async (docType) => {
                const documentId = nanoid();
                const key = s3Service.generateDocumentKey(
                    submission.id,
                    documentId,
                    `${docType}.pdf`
                );

                const uploadUrl = await s3Service.getUploadUrl({
                    key,
                    expiresIn: 3600,
                    contentType: "application/pdf",
                });

                return {
                    documentType: docType,
                    uploadUrl,
                    expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
                };
            })
        );

        const response: CreateSubmissionResponse = {
            submissionId: submission.id,
            submissionReference: submission.submissionReference,
            uploadUrls,
            status: submission.status,
        };

        return c.json(response, 201);
    } catch (error) {
        console.error("Error creating submission:", error);
        throw new InternalServerError("Failed to create submission");
    }
};

/**
 * Upload a document to S3 and create database record
 */
export const uploadDocument = async (c: Context) => {
    try {
        const { submissionId, documentType } = await c.req.parseBody();
        const file = await c.req.parseBody().then((body) => body.file);

        if (!file || typeof file === "string") {
            throw new ValidationError("File is required");
        }

        // Verify submission exists
        const [submission] = await db
            .select()
            .from(documentSubmissions)
            .where(eq(documentSubmissions.id, submissionId as string));

        if (!submission) {
            throw new NotFoundError("Submission not found");
        }

        // Generate document ID and S3 key
        const documentId = nanoid();
        const fileName = (file as File).name;
        const fileBuffer = Buffer.from(await (file as File).arrayBuffer());
        const fileSize = fileBuffer.length;

        const s3Key = s3Service.generateDocumentKey(
            submissionId as string,
            documentId,
            fileName
        );

        // Upload to S3
        const uploadResult = await s3Service.uploadFile(
            s3Key,
            fileBuffer,
            (file as File).type
        );

        // Create document record
        const [document] = await db
            .insert(documents)
            .values({
                id: documentId,
                submissionId: submissionId as string,
                documentType: documentType as any,
                fileName,
                fileSizeBytes: fileSize,
                mimeType: (file as File).type,
                s3Bucket: uploadResult.bucket,
                s3Key: uploadResult.key,
                s3VersionId: uploadResult.versionId,
                processingStatus: "pending",
            })
            .returning();

        if (!document) {
            throw new InternalServerError("Failed to create document record");
        }

        // Update submission total documents count
        await db
            .update(documentSubmissions)
            .set({
                totalDocuments: submission.totalDocuments + 1,
            })
            .where(eq(documentSubmissions.id, submissionId as string));

        // Process document with LLM (async - don't wait)
        processDocumentAsync(document.id, document.s3Key, document.documentType);

        return c.json({
            documentId: document.id,
            fileName: document.fileName,
            fileSize: document.fileSizeBytes,
            status: document.processingStatus,
            submissionId: document.submissionId,
        });
    } catch (error) {
        console.error("Error uploading document:", error);
        if (error instanceof ValidationError || error instanceof NotFoundError) {
            throw error;
        }
        throw new InternalServerError("Failed to upload document");
    }
};

/**
 * Process document asynchronously with LLM
 */
async function processDocumentAsync(
    documentId: string,
    s3Key: string,
    documentType: string
) {
    try {
        // Update status to processing
        await db
            .update(documents)
            .set({ processingStatus: "processing" })
            .where(eq(documents.id, documentId));

        // Download document from S3
        const fileBuffer = await s3Service.getFile(s3Key);
        const documentText = fileBuffer.toString("utf-8"); // Simplified - would need PDF parsing

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
            confidenceScore: result.confidence.toString(),
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

        // Update submission processed count
        const [doc] = await db
            .select()
            .from(documents)
            .where(eq(documents.id, documentId));

        if (doc) {
            const [submission] = await db
                .select()
                .from(documentSubmissions)
                .where(eq(documentSubmissions.id, doc.submissionId));

            if (submission) {
                await db
                    .update(documentSubmissions)
                    .set({
                        processedDocuments: submission.processedDocuments + 1,
                    })
                    .where(eq(documentSubmissions.id, doc.submissionId));
            }
        }
    } catch (error) {
        console.error("Error processing document:", error);
        await db
            .update(documents)
            .set({
                processingStatus: "failed",
                errorMessage: error instanceof Error ? error.message : "Unknown error",
            })
            .where(eq(documents.id, documentId));
    }
}

/**
 * Get submission status
 */
export const getSubmission = async (c: Context) => {
    try {
        const submissionId = c.req.param("submissionId");

        const [submission] = await db
            .select()
            .from(documentSubmissions)
            .where(eq(documentSubmissions.id, submissionId));

        if (!submission) {
            throw new NotFoundError("Submission not found");
        }

        // Get all documents for this submission
        const documentList = await db
            .select()
            .from(documents)
            .where(eq(documents.submissionId, submissionId));

        return c.json({
            submissionId: submission.id,
            submissionReference: submission.submissionReference,
            status: submission.status,
            progress: {
                totalDocuments: submission.totalDocuments,
                processedDocuments: submission.processedDocuments,
                percentage:
                    submission.totalDocuments > 0
                        ? (submission.processedDocuments / submission.totalDocuments) * 100
                        : 0,
            },
            documents: documentList.map((doc) => ({
                documentId: doc.id,
                documentType: doc.documentType,
                fileName: doc.fileName,
                processingStatus: doc.processingStatus,
                errorMessage: doc.errorMessage,
            })),
            createdAt: submission.createdAt,
            completedAt: submission.completedAt,
        });
    } catch (error) {
        console.error("Error getting submission:", error);
        if (error instanceof NotFoundError) {
            throw error;
        }
        throw new InternalServerError("Failed to get submission");
    }
};

/**
 * Finalize submission and trigger processing
 */
export const finalizeSubmission = async (c: Context) => {
    try {
        const { submissionId } = await c.req.json();

        const [submission] = await db
            .update(documentSubmissions)
            .set({
                status: "processing",
                updatedAt: new Date(),
            })
            .where(eq(documentSubmissions.id, submissionId))
            .returning();

        if (!submission) {
            throw new NotFoundError("Submission not found");
        }

        // Check if all documents are processed
        const documentList = await db
            .select()
            .from(documents)
            .where(eq(documents.submissionId, submissionId));

        const allProcessed = documentList.every(
            (doc) => doc.processingStatus === "completed"
        );

        if (!allProcessed) {
            throw new ValidationError(
                "Not all documents have been processed yet. Please wait for document processing to complete."
            );
        }

        // Generate underwriting report asynchronously
        generateUnderwritingReportAsync(submission.id);

        return c.json({
            submissionId: submission.id,
            status: submission.status,
            estimatedCompletionTime: new Date(
                Date.now() + 10 * 60 * 1000
            ).toISOString(), // ~10 min estimate for underwriting
        });
    } catch (error) {
        console.error("Error finalizing submission:", error);
        if (error instanceof NotFoundError || error instanceof ValidationError) {
            throw error;
        }
        throw new InternalServerError("Failed to finalize submission");
    }
};

/**
 * Generate underwriting report asynchronously
 */
async function generateUnderwritingReportAsync(submissionId: string) {
    try {
        console.log(`Generating underwriting report for submission ${submissionId}...`);

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

        console.log(`Underwriting report ${reportId} generated successfully`);
    } catch (error) {
        console.error("Error generating underwriting report:", error);

        // Update submission status to failed
        await db
            .update(documentSubmissions)
            .set({
                status: "failed",
            })
            .where(eq(documentSubmissions.id, submissionId));
    }
}

/**
 * Get underwriting report
 */
export const getUnderwritingReport = async (c: Context) => {
    try {
        const submissionId = c.req.param("submissionId");

        const [report] = await db
            .select()
            .from(underwritingReports)
            .where(eq(underwritingReports.submissionId, submissionId));

        if (!report) {
            throw new NotFoundError("Underwriting report not found");
        }

        // Get collateral assets
        const collateralList = await db
            .select()
            .from(collateralAssets)
            .where(eq(collateralAssets.submissionId, submissionId));

        const response: UnderwritingReportResponse = {
            reportId: report.id,
            submissionId: report.submissionId,
            status: report.status,
            generatedAt: report.generatedAt.toISOString(),

            financialSummary: {
                totalAssets: Number(report.totalAssetsUsd),
                totalLiabilities: Number(report.totalLiabilitiesUsd),
                netWorth: Number(report.netWorthUsd),
                monthlyIncome: Number(report.monthlyIncomeUsd),
                monthlyExpenses: Number(report.monthlyExpensesUsd),
                debtToIncomeRatio: Number(report.debtToIncomeRatio),
            },

            riskAssessment: {
                collateralScore: Number(report.collateralScore),
                probabilityScore: Number(report.probabilityScore),
                combinedRiskScore: Number(report.combinedRiskScore),
                riskTier: report.riskTier!,
            },

            lendingTerms: {
                maxLoanAmount: Number(report.maxLoanAmountUsd),
                recommendedLTV: Number(report.recommendedLtvRatio),
                recommendedInterestRate: Number(report.recommendedInterestRate),
                recommendedLoanTermDays: report.recommendedLoanTermDays!,
                requiredCollateral: Number(report.requiredCollateralUsd),
            },

            collateralAssets: collateralList.map((asset) => ({
                assetType: asset.assetType,
                description: asset.assetDescription,
                estimatedValue: Number(asset.estimatedValueUsd),
                liquidationValue: Number(asset.liquidationValueUsd),
                verificationStatus: asset.verificationStatus,
            })),

            reportPdfUrl: report.reportS3Key
                ? await s3Service.getDownloadUrl({ key: report.reportS3Key })
                : null,

            flags: (report.flags as string[]) || [],
        };

        return c.json(response);
    } catch (error) {
        console.error("Error getting underwriting report:", error);
        if (error instanceof NotFoundError) {
            throw error;
        }
        throw new InternalServerError("Failed to get underwriting report");
    }
};

/**
 * Apply for a loan
 */
export const applyLoan = async (c: Context) => {
    try {
        const body: ApplyLoanRequest = await c.req.json();
        const walletAddress = c.get("walletAddress");

        // Get underwriting report
        const [report] = await db
            .select()
            .from(underwritingReports)
            .where(eq(underwritingReports.id, body.reportId));

        if (!report) {
            throw new NotFoundError("Underwriting report not found");
        }

        if (report.status !== "approved") {
            throw new ValidationError("Underwriting report is not approved");
        }

        // Validate requested amount
        const maxLoanAmount = Number(report.maxLoanAmountUsd);
        if (body.requestedAmount > maxLoanAmount) {
            throw new ValidationError(
                `Requested amount exceeds maximum loan amount of $${maxLoanAmount}`
            );
        }

        // Find appropriate pool based on risk tier
        const [pool] = await db
            .select()
            .from(lendingPools)
            .where(
                and(
                    eq(lendingPools.riskTier, report.riskTier!),
                    eq(lendingPools.poolStatus, "active")
                )
            )
            .limit(1);

        if (!pool) {
            throw new NotFoundError(
                `No active lending pool found for risk tier ${report.riskTier}`
            );
        }

        // Calculate loan terms
        const interestRate = Number(report.recommendedInterestRate);
        const termDays = body.requestedTermDays;
        const originationFee = body.requestedAmount * 0.02; // 2% origination fee

        // Simple interest calculation
        const totalInterest =
            (body.requestedAmount * interestRate * termDays) / (365 * 100);
        const totalRepayment = body.requestedAmount + totalInterest + originationFee;

        // Create loan application
        const [loan] = await db
            .insert(loans)
            .values({
                poolId: pool.id,
                borrowerId: report.borrowerId,
                underwritingReportId: report.id,
                principalUsd: body.requestedAmount.toString(),
                interestRate: interestRate.toString(),
                loanTermDays: termDays,
                ltvRatio: report.recommendedLtvRatio,
                originationFeeUsd: originationFee.toString(),
                totalRepaymentAmountUsd: totalRepayment.toString(),
                outstandingBalanceUsd: totalRepayment.toString(),
                borrowerWalletAddress: walletAddress,
                status: "pending_approval",
            })
            .returning();

        if (!loan) {
            throw new InternalServerError("Failed to create loan application");
        }

        return c.json({
            loanId: loan.id,
            poolId: pool.id,
            poolName: pool.poolName,
            status: loan.status,
            loanTerms: {
                principal: body.requestedAmount,
                interestRate,
                termDays,
                originationFee,
                totalRepayment,
            },
        });
    } catch (error) {
        console.error("Error applying for loan:", error);
        if (
            error instanceof NotFoundError ||
            error instanceof ValidationError
        ) {
            throw error;
        }
        throw new InternalServerError("Failed to apply for loan");
    }
};

/**
 * List all lending pools
 */
export const listPools = async (c: Context) => {
    try {
        const query = c.req.query();
        const params: PoolQueryParams = {
            riskTier: query.riskTier as any,
            minApy: query.minApy ? parseFloat(query.minApy) : undefined,
            maxApy: query.maxApy ? parseFloat(query.maxApy) : undefined,
            assetClass: query.assetClass,
        };

        let poolQuery = db
            .select()
            .from(lendingPools)
            .where(eq(lendingPools.poolStatus, "active"));

        // Apply filters (simplified - would need proper query building)
        const pools = await poolQuery;

        return c.json({
            pools: pools.map((pool) => ({
                poolId: pool.id,
                poolName: pool.poolName,
                poolType: pool.poolType,
                riskTier: pool.riskTier,
                contractAddress: pool.contractAddress,

                metrics: {
                    tvl: Number(pool.totalValueLockedUsd),
                    availableLiquidity: Number(pool.availableLiquidityUsd),
                    currentApy: Number(pool.currentApy),
                    historicalApy30d: Number(pool.historicalApy30d),
                    utilizationRate:
                        Number(pool.totalLoansValueUsd) / Number(pool.totalValueLockedUsd),
                    defaultRate:
                        Number(pool.totalDefaultsValueUsd) /
                        Number(pool.totalValueLockedUsd),
                    totalActiveLoans: pool.totalLoansActive,
                },

                parameters: {
                    baseInterestRate: Number(pool.baseInterestRate),
                    protocolFee: Number(pool.protocolFeePercentage),
                    minLoanSize: Number(pool.minLoanSizeUsd),
                    maxLoanSize: Number(pool.maxLoanSizeUsd),
                },
            })),
        });
    } catch (error) {
        console.error("Error listing pools:", error);
        throw new InternalServerError("Failed to list pools");
    }
};

/**
 * Get pool details
 */
export const getPool = async (c: Context) => {
    try {
        const poolId = c.req.param("poolId");

        const [pool] = await db
            .select()
            .from(lendingPools)
            .where(eq(lendingPools.id, poolId));

        if (!pool) {
            throw new NotFoundError("Pool not found");
        }

        // Get recent loans
        const recentLoans = await db
            .select()
            .from(loans)
            .where(eq(loans.poolId, poolId))
            .limit(10);

        return c.json({
            pool: {
                poolId: pool.id,
                poolName: pool.poolName,
                poolType: pool.poolType,
                riskTier: pool.riskTier,
                contractAddress: pool.contractAddress,
                metrics: {
                    tvl: Number(pool.totalValueLockedUsd),
                    availableLiquidity: Number(pool.availableLiquidityUsd),
                    currentApy: Number(pool.currentApy),
                    historicalApy30d: Number(pool.historicalApy30d),
                    utilizationRate:
                        Number(pool.totalLoansValueUsd) / Number(pool.totalValueLockedUsd),
                    defaultRate:
                        Number(pool.totalDefaultsValueUsd) /
                        Number(pool.totalValueLockedUsd),
                    totalActiveLoans: pool.totalLoansActive,
                },
            },
            recentLoans: recentLoans.map((loan) => ({
                loanId: loan.id,
                amount: Number(loan.principalUsd),
                interestRate: Number(loan.interestRate),
                termDays: loan.loanTermDays,
                riskTier: pool.riskTier,
                fundedDate: loan.fundedDate?.toISOString(),
            })),
            performanceHistory: await getPoolPerformanceHistory(pool.id),
        });
    } catch (error) {
        console.error("Error getting pool:", error);
        if (error instanceof NotFoundError) {
            throw error;
        }
        throw new InternalServerError("Failed to get pool");
    }
};
