import { z } from "zod";

export const createSubmissionSchema = z.object({
    borrowerType: z.enum(["individual", "business"]),
    fullName: z.string().min(1),
    businessName: z.string().optional(),
    email: z.string().email(),
    metadata: z.record(z.any()).optional(),
});

export type CreateSubmissionRequest = z.infer<typeof createSubmissionSchema>;

export interface CreateSubmissionResponse {
    submissionId: string;
    submissionReference: string;
    uploadUrls: {
        documentType: string;
        uploadUrl: string;
        expiresAt: string;
    }[];
    status: string;
}

export const uploadDocumentSchema = z.object({
    submissionId: z.string().uuid(),
    documentType: z.enum([
        "bank_statement",
        "tax_return",
        "pay_stub",
        "property_deed",
        "vehicle_title",
        "business_financials",
        "id_document",
        "crypto_wallet_statement",
        "investment_statement",
        "other",
    ]),
});

export type UploadDocumentRequest = z.infer<typeof uploadDocumentSchema>;

export interface FinancialSummary {
    totalAssets: number;
    totalLiabilities: number;
    netWorth: number;
    monthlyIncome: number;
    monthlyExpenses: number;
    debtToIncomeRatio: number;
}

export interface RiskAssessment {
    collateralScore: number;
    probabilityScore: number;
    combinedRiskScore: number;
    riskTier: "AAA" | "AA" | "A" | "BBB" | "BB" | "B" | "C" | "D";
}

export interface LendingTerms {
    maxLoanAmount: number;
    recommendedLTV: number;
    recommendedInterestRate: number;
    recommendedLoanTermDays: number;
    requiredCollateral: number;
}

export interface CollateralAsset {
    assetType: string;
    description: string;
    estimatedValue: number;
    liquidationValue: number;
    verificationStatus: string;
}

export interface UnderwritingReportResponse {
    reportId: string;
    submissionId: string;
    status: string;
    generatedAt: string;
    financialSummary: FinancialSummary;
    riskAssessment: RiskAssessment;
    lendingTerms: LendingTerms;
    collateralAssets: CollateralAsset[];
    reportPdfUrl: string | null;
    flags: string[];
}

export const applyLoanSchema = z.object({
    reportId: z.string().uuid(),
    requestedAmount: z.number().positive(),
    requestedTermDays: z.number().int().positive(),
    collateralAssetIds: z.array(z.string().uuid()),
    walletAddress: z.string(),
});

export type ApplyLoanRequest = z.infer<typeof applyLoanSchema>;

export const poolQuerySchema = z.object({
    riskTier: z.enum(["AAA", "AA", "A", "BBB", "BB", "B", "C", "D"]).optional(),
    minApy: z.number().optional(),
    maxApy: z.number().optional(),
    assetClass: z.string().optional(),
});

export type PoolQueryParams = z.infer<typeof poolQuerySchema>;


export interface DocumentExtractionResult {
    documentType: string;
    documentDate: string | null;
    accountHolder: string | null;
    financialInstitution: string | null;

    transactions?: Array<{
        date: string;
        description: string;
        amount: number;
        balance: number;
    }>;
    accountBalance?: number;
    averageMonthlyIncome?: number;
    averageMonthlyExpenses?: number;

    assetType?: string;
    assetValue?: number;
    assetOwner?: string;
    assetDescription?: string;

    revenue?: number;
    expenses?: number;
    netIncome?: number;
    assets?: number;
    liabilities?: number;

    confidence: number;
    warnings: string[];
    needsHumanReview: boolean;
}

export interface ProbabilityAssessment {
    incomeStabilityScore: number;
    expenseRatioScore: number;
    debtManagementScore: number;
    assetQualityScore: number;
    overallProbabilityScore: number;

    defaultProbability: number;
    confidenceLevel: "high" | "medium" | "low";

    strengths: string[];
    weaknesses: string[];
    redFlags: string[];

    recommendation: {
        decision: "approve" | "reject" | "review";
        maxLoanAmount: number;
        reasoning: string;
    };
}

export interface CollateralAssessment {
    ltvScore: number;
    liquidityScore: number;
    verificationScore: number;
    overallCollateralScore: number;
}

export interface S3PresignedUrlParams {
    key: string;
    expiresIn?: number;
    contentType?: string;
}

export interface UploadResult {
    bucket: string;
    key: string;
    versionId?: string;
    url: string;
}

export interface ProcessingJob {
    id: string;
    type: "document_extraction" | "risk_scoring" | "report_generation";
    data: Record<string, any>;
    progress?: number;
    status: "pending" | "processing" | "completed" | "failed";
    error?: string;
}

export class AppError extends Error {
    constructor(
        public statusCode: number,
        public override message: string,
        public code?: string
    ) {
        super(message);
        this.name = "AppError";
    }
}

export class ValidationError extends AppError {
    constructor(message: string) {
        super(400, message, "VALIDATION_ERROR");
    }
}

export class NotFoundError extends AppError {
    constructor(message: string) {
        super(404, message, "NOT_FOUND");
    }
}

export class UnauthorizedError extends AppError {
    constructor(message: string) {
        super(401, message, "UNAUTHORIZED");
    }
}

export class ForbiddenError extends AppError {
    constructor(message: string) {
        super(403, message, "FORBIDDEN");
    }
}

export class ConflictError extends AppError {
    constructor(message: string) {
        super(409, message, "CONFLICT");
    }
}

export class InternalServerError extends AppError {
    constructor(message: string) {
        super(500, message, "INTERNAL_SERVER_ERROR");
    }
}
