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
  loanRepayments,
  poolDeposits,
  poolWithdrawals,
} from "../db/schema";
import { eq, and, gte, lte, inArray, desc, sql } from "drizzle-orm";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { nanoid } from "nanoid";
import { getOrCreateUser } from "../services/auth.service";
import { s3Service } from "../services/s3.service";
import { llmService } from "../services/llm.service";
import { underwritingService } from "../services/underwriting.service";
import { getPoolPerformanceHistory } from "./admin-handlers";
import {
  NotFoundError,
  ValidationError,
  InternalServerError,
  UnauthorizedError,
} from "../types";
import type {
  CreateSubmissionRequest,
  CreateSubmissionResponse,
  UnderwritingReportResponse,
  ApplyLoanRequest,
  PoolQueryParams,
  UploadResult,
} from "../types";

/**
 * Create a new borrower submission
 */
export const createSubmission = async (c: Context) => {
  try {
    const body: CreateSubmissionRequest = await c.req.json();
    const walletAddress = c.get("walletAddress"); // Assuming auth middleware sets this
    if (!walletAddress) {
      throw new UnauthorizedError("Missing wallet context");
    }

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

    const [existingBorrower] = await db
      .select()
      .from(borrowerProfiles)
      .where(eq(borrowerProfiles.userId, user.id))
      .orderBy(desc(borrowerProfiles.createdAt))
      .limit(1);

    const borrower =
      existingBorrower ??
      (
        await db
          .insert(borrowerProfiles)
          .values({
            userId: user.id,
            fullName: body.fullName,
            businessName: body.businessName,
            borrowerType: body.borrowerType,
            metadata: body.metadata,
          })
          .returning()
      )[0];

    if (!borrower) {
      throw new InternalServerError("Failed to create borrower profile");
    }

    const [existingSubmission] = await db
      .select()
      .from(documentSubmissions)
      .where(eq(documentSubmissions.borrowerId, borrower.id))
      .orderBy(desc(documentSubmissions.createdAt))
      .limit(1);

    if (existingSubmission) {
      const response: CreateSubmissionResponse = {
        submissionId: existingSubmission.id,
        submissionReference: existingSubmission.submissionReference,
        uploadUrls: [],
        status: existingSubmission.status,
      };

      return c.json(response, 200);
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
          `${docType}.pdf`,
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
      }),
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
    const body = await c.req.parseBody();
    const submissionId = body.submissionId;
    const documentType = body.documentType;
    const file = body.file;

    if (typeof submissionId !== "string") {
      throw new ValidationError("Submission ID is required");
    }

    if (!/^[0-9a-fA-F-]{36}$/.test(submissionId)) {
      throw new ValidationError("Invalid submission ID format");
    }

    if (typeof documentType !== "string") {
      throw new ValidationError("Document type is required");
    }

    if (!file || typeof file === "string") {
      throw new ValidationError("File is required");
    }

    // Verify submission exists
    const [submission] = await db
      .select()
      .from(documentSubmissions)
      .where(eq(documentSubmissions.id, submissionId));

    if (!submission) {
      throw new NotFoundError("Submission not found");
    }

    // Generate document ID and S3 key
    const documentId = randomUUID();
    const fileName = (file as File).name;
    const fileBuffer = Buffer.from(await (file as File).arrayBuffer());
    const fileSize = fileBuffer.length;

    const s3Key = s3Service.generateDocumentKey(
      submissionId,
      documentId,
      fileName,
    );

    let uploadResult: UploadResult;
    try {
      uploadResult = await s3Service.uploadFile(
        s3Key,
        fileBuffer,
        (file as File).type,
      );
    } catch (error) {
      console.error("S3 upload failed, falling back to local storage", error);
      const baseDir =
        process.env.LOCAL_UPLOAD_DIR ?? "/tmp/underwriting-documents";
      const localPath = join(baseDir, s3Key);
      await mkdir(dirname(localPath), { recursive: true });
      await writeFile(localPath, fileBuffer);
      uploadResult = {
        bucket: "local",
        key: s3Key,
        url: `local://${s3Key}`,
      };
    }

    // Create document record
    const [document] = await db
      .insert(documents)
      .values({
        id: documentId,
        submissionId,
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

    // Queue document processing job
    const { documentProcessingQueue } = await import("../queue/config");
    await documentProcessingQueue.add("process-document", {
      documentId: document.id,
      s3Key: document.s3Key,
      documentType: document.documentType,
    });

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
  documentType: string,
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
      documentType,
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

    // Collateral assets are generated during submission finalization.

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
 * Get latest active submission for borrower
 */
export const getActiveSubmission = async (c: Context) => {
  try {
    const walletAddress = c.get("walletAddress");
    if (!walletAddress) {
      throw new UnauthorizedError("Missing wallet context");
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.walletAddress, walletAddress));

    if (!user) {
      throw new NotFoundError("User not found");
    }

    const [borrower] = await db
      .select()
      .from(borrowerProfiles)
      .where(eq(borrowerProfiles.userId, user.id))
      .orderBy(desc(borrowerProfiles.createdAt))
      .limit(1);

    if (!borrower) {
      throw new NotFoundError("Borrower profile not found");
    }

    const [submission] = await db
      .select()
      .from(documentSubmissions)
      .where(eq(documentSubmissions.borrowerId, borrower.id))
      .orderBy(desc(documentSubmissions.createdAt))
      .limit(1);

    if (!submission) {
      throw new NotFoundError("No submission found");
    }

    return c.json({
      submissionId: submission.id,
      submissionReference: submission.submissionReference,
      status: submission.status,
    });
  } catch (error) {
    console.error("Error getting active submission:", error);
    if (error instanceof NotFoundError || error instanceof UnauthorizedError) {
      throw error;
    }
    throw new InternalServerError("Failed to get active submission");
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
      (doc) => doc.processingStatus === "completed",
    );

    if (!allProcessed) {
      throw new ValidationError(
        "Not all documents have been processed yet. Please wait for document processing to complete.",
      );
    }

    // Ensure collateral assets exist before underwriting
    await hydrateCollateralAssets(submissionId);

    // Generate underwriting report asynchronously
    generateUnderwritingReportAsync(submission.id);

    return c.json({
      submissionId: submission.id,
      status: submission.status,
      estimatedCompletionTime: new Date(
        Date.now() + 10 * 60 * 1000,
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

async function hydrateCollateralAssets(submissionId: string) {
  const docs = await db
    .select()
    .from(documents)
    .where(eq(documents.submissionId, submissionId));

  if (docs.length === 0) return;

  const docIds = docs.map((doc) => doc.id);
  const extractions = await db.query.documentExtractions.findMany({
    where: (extractions, { inArray }) =>
      inArray(extractions.documentId, docIds),
  });

  const extractionMap = new Map(
    extractions.map((extraction) => [extraction.documentId, extraction]),
  );

  const [submission] = await db
    .select()
    .from(documentSubmissions)
    .where(eq(documentSubmissions.id, submissionId));

  if (!submission) return;

  const normalizeAssetType = (value?: string | null) => {
    const normalized = value?.toLowerCase().replace(/\s+/g, "_");
    switch (normalized) {
      case "real_estate":
      case "vehicle":
      case "crypto":
      case "securities":
      case "equipment":
      case "inventory":
      case "cash":
        return normalized;
      default:
        return "other";
    }
  };

  const inferAssetType = (docType: string) => {
    switch (docType) {
      case "property_deed":
        return "real_estate";
      case "vehicle_title":
        return "vehicle";
      case "crypto_wallet_statement":
        return "crypto";
      case "investment_statement":
        return "securities";
      default:
        return "other";
    }
  };

  for (const doc of docs) {
    const extraction = extractionMap.get(doc.id);
    if (!extraction) {
      continue;
    }

    const data = (extraction.structuredData as Record<string, any>) || {};
    const collateral = await llmService.extractCollateralFromStructuredData(
      data,
      doc.documentType,
    );
    const assetValue = collateral.result.assetValueUsd ?? 0;
    if (!assetValue || assetValue <= 0) continue;

    const [existingAsset] = await db
      .select({ id: collateralAssets.id })
      .from(collateralAssets)
      .where(
        and(
          eq(collateralAssets.submissionId, submission.id),
          sql`${collateralAssets.metadata} ->> 'documentId' = ${doc.id}`,
        ),
      )
      .limit(1);

    if (existingAsset) continue;

    await db.insert(collateralAssets).values({
      borrowerId: submission.borrowerId,
      submissionId: submission.id,
      assetType:
        normalizeAssetType(collateral.result.assetType) ||
        inferAssetType(doc.documentType),
      assetDescription:
        collateral.result.assetDescription ??
        collateral.result.assetType ??
        `Extracted from ${doc.documentType}`,
      estimatedValueUsd: assetValue.toString(),
      liquidationValueUsd: assetValue.toString(),
      verificationStatus: "pending",
      metadata: {
        documentId: doc.id,
        documentType: doc.documentType,
        source: "llm",
        collateralTokensUsed: collateral.tokensUsed,
        collateralCostUsd: collateral.cost.toString(),
        collateralConfidence: collateral.result.confidence,
        collateralWarnings: collateral.result.warnings,
      },
    });
  }
}

/**
 * Generate underwriting report asynchronously
 */
async function generateUnderwritingReportAsync(submissionId: string) {
  try {
    console.log(
      `Generating underwriting report for submission ${submissionId}...`,
    );

    const reportId =
      await underwritingService.generateUnderwritingReport(submissionId);

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
      .where(eq(underwritingReports.submissionId, submissionId))
      .orderBy(desc(underwritingReports.generatedAt))
      .limit(1);

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
    if (!walletAddress) {
      throw new UnauthorizedError("Missing wallet context");
    }

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
        `Requested amount exceeds maximum loan amount of $${maxLoanAmount}`,
      );
    }

    // Find appropriate pool based on risk tier
    const [pool] = await db
      .select()
      .from(lendingPools)
      .where(
        and(
          eq(lendingPools.riskTier, report.riskTier!),
          inArray(lendingPools.poolStatus, ["active", "paused"]),
        ),
      )
      .limit(1);

    if (!pool) {
      throw new NotFoundError(
        `No lending pool found for risk tier ${report.riskTier}`,
      );
    }

    // Calculate loan terms
    const interestRate = Number(report.recommendedInterestRate);
    const termDays = body.requestedTermDays;
    const originationFee = body.requestedAmount * 0.02; // 2% origination fee

    // Simple interest calculation
    const totalInterest =
      (body.requestedAmount * interestRate * termDays) / (365 * 100);
    const totalRepayment =
      body.requestedAmount + totalInterest + originationFee;
    const maturityDate = new Date(Date.now() + termDays * 24 * 60 * 60 * 1000);
    const repaymentSchedule = [
      {
        dueDate: maturityDate.toISOString(),
        paymentAmount: Number(totalRepayment.toFixed(2)),
        principalAmount: Number(body.requestedAmount.toFixed(2)),
        interestAmount: Number(totalInterest.toFixed(2)),
        status: "due",
      },
    ];

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
        maturityDate,
        metadata: {
          loanType: "bullet",
          repaymentSchedule,
        },
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
    if (error instanceof NotFoundError || error instanceof ValidationError) {
      throw error;
    }
    throw new InternalServerError("Failed to apply for loan");
  }
};

/**
 * Get borrower loans and pool info
 */
export const getBorrowerLoans = async (c: Context) => {
  try {
    const walletAddress = c.get("walletAddress");
    if (!walletAddress) {
      throw new UnauthorizedError("Missing wallet context");
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.walletAddress, walletAddress));

    if (!user) {
      return c.json({ loans: [] });
    }

    const [borrower] = await db
      .select()
      .from(borrowerProfiles)
      .where(eq(borrowerProfiles.userId, user.id));

    if (!borrower) {
      return c.json({ loans: [] });
    }

    const borrowerLoans = await db.query.loans.findMany({
      where: (loan, { eq }) => eq(loan.borrowerId, borrower.id),
      with: {
        pool: true,
        repayments: true,
      },
      orderBy: (loan, { desc }) => [desc(loan.createdAt)],
    });

    return c.json({
      loans: borrowerLoans.map((loan) => ({
        loanId: loan.id,
        status: loan.status,
        principalUsd: Number(loan.principalUsd),
        interestRate: Number(loan.interestRate),
        loanTermDays: loan.loanTermDays,
        totalRepaymentAmountUsd: Number(loan.totalRepaymentAmountUsd),
        outstandingBalanceUsd: Number(loan.outstandingBalanceUsd),
        maturityDate: loan.maturityDate?.toISOString() ?? null,
        pool: loan.pool
          ? {
              poolId: loan.pool.id,
              poolName: loan.pool.poolName,
              poolStatus: loan.pool.poolStatus,
              riskTier: loan.pool.riskTier,
              contractAddress: loan.pool.contractAddress,
              currentApy: Number(loan.pool.currentApy ?? 0),
              availableLiquidityUsd: Number(loan.pool.availableLiquidityUsd),
            }
          : null,
        repaymentSchedule: (loan.metadata as any)?.repaymentSchedule ?? [],
        repayments: loan.repayments.map((repayment) => ({
          repaymentId: repayment.id,
          amountUsd: Number(repayment.paymentAmountUsd),
          principalUsd: Number(repayment.principalAmountUsd),
          interestUsd: Number(repayment.interestAmountUsd),
          paymentDate: repayment.paymentDate.toISOString(),
          dueDate: repayment.dueDate?.toISOString() ?? null,
          txHash: repayment.txHash,
        })),
      })),
    });
  } catch (error) {
    console.error("Error getting borrower loans:", error);
    if (error instanceof UnauthorizedError) {
      throw error;
    }
    throw new InternalServerError("Failed to get borrower loans");
  }
};

/**
 * Withdraw loan funds (mock disbursement)
 */
export const withdrawLoanFunds = async (c: Context) => {
  try {
    const loanId = c.req.param("loanId");
    const [loan] = await db.select().from(loans).where(eq(loans.id, loanId));

    if (!loan) {
      throw new NotFoundError("Loan not found");
    }

    const fundedDate = new Date();
    const maturityDate = new Date(
      fundedDate.getTime() + loan.loanTermDays * 24 * 60 * 60 * 1000,
    );

    const [updatedLoan] = await db
      .update(loans)
      .set({
        status: "active",
        fundedDate,
        approvalDate: fundedDate,
        maturityDate,
      })
      .where(eq(loans.id, loanId))
      .returning();

    if (!updatedLoan) {
      throw new InternalServerError("Failed to update loan");
    }

    await db
      .update(lendingPools)
      .set({
        totalLoansActive: sql`${lendingPools.totalLoansActive} + 1`,
        totalLoansValueUsd: sql`${lendingPools.totalLoansValueUsd} + ${updatedLoan.principalUsd}`,
        availableLiquidityUsd: sql`GREATEST(${lendingPools.availableLiquidityUsd} - ${updatedLoan.principalUsd}, 0)`,
      })
      .where(eq(lendingPools.id, updatedLoan.poolId));

    return c.json({
      loanId: updatedLoan.id,
      status: updatedLoan.status,
      fundedDate: updatedLoan.fundedDate?.toISOString() ?? null,
    });
  } catch (error) {
    console.error("Error withdrawing loan funds:", error);
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new InternalServerError("Failed to withdraw loan funds");
  }
};

/**
 * Record a borrower repayment (bullet repayment)
 */
export const repayLoan = async (c: Context) => {
  try {
    const loanId = c.req.param("loanId");
    const { amount, paymentMethod, txHash } = await c.req.json();

    const [loan] = await db.select().from(loans).where(eq(loans.id, loanId));
    if (!loan) {
      throw new NotFoundError("Loan not found");
    }

    const paymentAmount = Number(amount);
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      throw new ValidationError("Invalid repayment amount");
    }

    const outstanding = Number(loan.outstandingBalanceUsd);
    const newOutstanding = Math.max(outstanding - paymentAmount, 0);
    const principalAmount = Math.min(paymentAmount, Number(loan.principalUsd));
    const interestAmount = Math.max(paymentAmount - principalAmount, 0);

    const schedule = ((loan.metadata as any)?.repaymentSchedule ?? []).map(
      (entry: any) => ({
        ...entry,
        status: newOutstanding === 0 ? "paid" : entry.status,
        paidAt: newOutstanding === 0 ? new Date().toISOString() : entry.paidAt,
      }),
    );

    await db.insert(loanRepayments).values({
      loanId,
      paymentAmountUsd: paymentAmount.toString(),
      principalAmountUsd: principalAmount.toString(),
      interestAmountUsd: interestAmount.toString(),
      paymentMethod: paymentMethod || "off_chain",
      txHash: txHash || `mock-${Date.now()}`,
      dueDate: loan.maturityDate,
    });

    await db
      .update(loans)
      .set({
        outstandingBalanceUsd: newOutstanding.toString(),
        totalPaidUsd: sql`${loans.totalPaidUsd} + ${paymentAmount}`,
        lastPaymentDate: new Date(),
        status: newOutstanding === 0 ? "repaid" : loan.status,
        closedDate: newOutstanding === 0 ? new Date() : loan.closedDate,
        metadata: {
          ...(loan.metadata as any),
          repaymentSchedule: schedule,
        },
      })
      .where(eq(loans.id, loanId));

    if (newOutstanding === 0) {
      await db
        .update(lendingPools)
        .set({
          totalLoansActive: sql`GREATEST(${lendingPools.totalLoansActive} - 1, 0)`,
        })
        .where(eq(lendingPools.id, loan.poolId));
    }

    return c.json({
      loanId,
      outstandingBalanceUsd: newOutstanding,
      status: newOutstanding === 0 ? "repaid" : loan.status,
    });
  } catch (error) {
    console.error("Error recording repayment:", error);
    if (error instanceof NotFoundError || error instanceof ValidationError) {
      throw error;
    }
    throw new InternalServerError("Failed to record repayment");
  }
};

/**
 * Record a pool deposit (mock)
 */
export const depositToPool = async (c: Context) => {
  try {
    const poolId = c.req.param("poolId");
    const { amount, walletAddress } = await c.req.json();
    const depositAmount = Number(amount);

    if (
      !walletAddress ||
      !Number.isFinite(depositAmount) ||
      depositAmount <= 0
    ) {
      throw new ValidationError("Invalid deposit request");
    }

    const user = await getOrCreateUser(walletAddress);
    if (!user) {
      throw new InternalServerError("Failed to resolve lender user");
    }
    const txHash = `mock-${Date.now()}`;

    await db.insert(poolDeposits).values({
      poolId,
      lenderUserId: user.id,
      depositAmountUsd: depositAmount.toString(),
      lpTokensMinted: depositAmount.toString(),
      txHash,
      walletAddress,
    });

    await db
      .update(lendingPools)
      .set({
        totalValueLockedUsd: sql`${lendingPools.totalValueLockedUsd} + ${depositAmount}`,
        availableLiquidityUsd: sql`${lendingPools.availableLiquidityUsd} + ${depositAmount}`,
      })
      .where(eq(lendingPools.id, poolId));

    return c.json({
      transactionData: {
        poolId,
        amount: depositAmount,
        walletAddress,
        type: "deposit",
        txHash,
      },
      expectedLpTokens: depositAmount,
    });
  } catch (error) {
    console.error("Error recording deposit:", error);
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new InternalServerError("Failed to record deposit");
  }
};

/**
 * Record a pool withdrawal (mock)
 */
export const withdrawFromPool = async (c: Context) => {
  try {
    const poolId = c.req.param("poolId");
    const { lpTokens, walletAddress } = await c.req.json();
    const withdrawalAmount = Number(lpTokens);

    if (
      !walletAddress ||
      !Number.isFinite(withdrawalAmount) ||
      withdrawalAmount <= 0
    ) {
      throw new ValidationError("Invalid withdrawal request");
    }

    const user = await getOrCreateUser(walletAddress);
    if (!user) {
      throw new InternalServerError("Failed to resolve lender user");
    }
    const txHash = `mock-${Date.now()}`;

    await db.insert(poolWithdrawals).values({
      poolId,
      lenderUserId: user.id,
      withdrawalAmountUsd: withdrawalAmount.toString(),
      lpTokensBurned: withdrawalAmount.toString(),
      txHash,
      walletAddress,
    });

    await db
      .update(lendingPools)
      .set({
        totalValueLockedUsd: sql`GREATEST(${lendingPools.totalValueLockedUsd} - ${withdrawalAmount}, 0)`,
        availableLiquidityUsd: sql`GREATEST(${lendingPools.availableLiquidityUsd} - ${withdrawalAmount}, 0)`,
      })
      .where(eq(lendingPools.id, poolId));

    return c.json({
      transactionData: {
        poolId,
        lpTokens: withdrawalAmount,
        walletAddress,
        type: "withdraw",
        txHash,
      },
      expectedAmount: withdrawalAmount,
    });
  } catch (error) {
    console.error("Error recording withdrawal:", error);
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new InternalServerError("Failed to record withdrawal");
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
