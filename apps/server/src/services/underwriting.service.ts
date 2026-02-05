import { db } from "../db";
import {
    borrowerProfiles,
    documentExtractions,
    collateralAssets,
    underwritingReports,
    documentSubmissions
} from "../db/schema";
import { eq } from "drizzle-orm";
import { llmService } from "./llm.service";
import type {
    CollateralAssessment,
    ProbabilityAssessment,
    RiskAssessment
} from "../types";

interface CollateralAsset {
    assetType: string;
    liquidationValue: number;
    verificationStatus: string;
}

class UnderwritingService {
    /**
     * Calculate collateral score based on assets and loan amount
     */
    calculateCollateralScore(
        collateralAssetsList: CollateralAsset[],
        requestedLoanAmount: number
    ): CollateralAssessment {
        if (collateralAssetsList.length === 0) {
            return {
                ltvScore: 0,
                liquidityScore: 0,
                verificationScore: 0,
                overallCollateralScore: 0,
            };
        }

        const totalCollateralValue = collateralAssetsList.reduce(
            (sum, asset) => sum + Number(asset.liquidationValue || 0),
            0
        );

        const ltvRatio = requestedLoanAmount / totalCollateralValue;

        let ltvScore = 0;
        if (ltvRatio <= 0.5) ltvScore = 100;
        else if (ltvRatio <= 0.6) ltvScore = 90;
        else if (ltvRatio <= 0.7) ltvScore = 75;
        else if (ltvRatio <= 0.8) ltvScore = 50;
        else if (ltvRatio <= 0.9) ltvScore = 25;
        else ltvScore = 10;

        const liquidityWeights: Record<string, number> = {
            crypto: 95,
            cash: 100,
            securities: 85,
            real_estate: 60,
            vehicle: 70,
            equipment: 50,
            inventory: 40,
            other: 30,
        };

        const liquidityScore =
            collateralAssetsList.reduce((score, asset) => {
                return score + (liquidityWeights[asset.assetType] || 50);
            }, 0) / collateralAssetsList.length;

        const verifiedCount = collateralAssetsList.filter(
            (a) => a.verificationStatus === "verified"
        ).length;
        const verificationScore = (verifiedCount / collateralAssetsList.length) * 100;

        const overallCollateralScore =
            ltvScore * 0.5 + liquidityScore * 0.3 + verificationScore * 0.2;

        return {
            ltvScore,
            liquidityScore,
            verificationScore,
            overallCollateralScore: Math.round(overallCollateralScore * 100) / 100,
        };
    }

    /**
     * Calculate combined risk score
     */
    calculateCombinedRiskScore(
        collateralScore: number,
        probabilityScore: number
    ): number {
        return collateralScore * 0.4 + probabilityScore * 0.6;
    }

    /**
     * Determine risk tier based on combined score
     */
    determineRiskTier(
        combinedScore: number
    ): "AAA" | "AA" | "A" | "BBB" | "BB" | "B" | "C" | "D" {
        if (combinedScore >= 90) return "AAA";
        if (combinedScore >= 85) return "AA";
        if (combinedScore >= 80) return "A";
        if (combinedScore >= 75) return "BBB";
        if (combinedScore >= 70) return "BB";
        if (combinedScore >= 60) return "B";
        if (combinedScore >= 50) return "C";
        return "D";
    }

    /**
     * Calculate maximum loan amount based on collateral and risk
     */
    calculateMaxLoanAmount(
        totalCollateralValue: number,
        riskTier: string
    ): number {
        const maxLtvByTier: Record<string, number> = {
            AAA: 0.8,
            AA: 0.75,
            A: 0.7,
            BBB: 0.65,
            BB: 0.6,
            B: 0.5,
            C: 0.4,
            D: 0.3,
        };

        const maxLtv = maxLtvByTier[riskTier] || 0.5;
        return totalCollateralValue * maxLtv;
    }

    /**
     * Calculate recommended interest rate based on risk
     */
    calculateInterestRate(riskTier: string): number {
        const baseRates: Record<string, number> = {
            AAA: 5.0,
            AA: 6.5,
            A: 8.0,
            BBB: 10.0,
            BB: 12.0,
            B: 15.0,
            C: 18.0,
            D: 22.0,
        };

        return baseRates[riskTier] || 15.0;
    }

    /**
     * Generate complete underwriting report
     */
    async generateUnderwritingReport(submissionId: string): Promise<string> {
        const [submission] = await db
            .select()
            .from(documentSubmissions)
            .where(eq(documentSubmissions.id, submissionId));

        if (!submission) {
            throw new Error("Submission not found");
        }

        const [borrower] = await db
            .select()
            .from(borrowerProfiles)
            .where(eq(borrowerProfiles.id, submission.borrowerId));

        if (!borrower) {
            throw new Error("Borrower profile not found");
        }

        const allDocuments = await db.query.documents.findMany({
            where: (documents, { eq }) => eq(documents.submissionId, submissionId),
        });

        const documentIds = allDocuments.map(d => d.id);
        const extractions = await db.query.documentExtractions.findMany({
            where: (documentExtractions, { inArray }) =>
                inArray(documentExtractions.documentId, documentIds),
        });

        const extractedData = extractions.map((e) => e.structuredData);

        const collateralList = await db
            .select()
            .from(collateralAssets)
            .where(eq(collateralAssets.submissionId, submissionId));

        const financialMetrics = this.aggregateFinancialMetrics(extractedData);

        // Calculate collateral score
        const totalCollateralValue = collateralList.reduce(
            (sum, asset) => sum + Number(asset.liquidationValueUsd || 0),
            0
        );

        const estimatedLoanRequest = financialMetrics.monthlyIncome * 12 * 0.3; // Estimate 30% of annual income
        const collateralAssessment = this.calculateCollateralScore(
            collateralList as any,
            estimatedLoanRequest
        );

        const { result: probabilityAssessment, tokensUsed, cost } =
            await llmService.assessDefaultProbability(borrower, extractedData);

        const combinedRiskScore = this.calculateCombinedRiskScore(
            collateralAssessment.overallCollateralScore,
            probabilityAssessment.overallProbabilityScore
        );

        const riskTier = this.determineRiskTier(combinedRiskScore);
        const maxLoanAmount = this.calculateMaxLoanAmount(
            totalCollateralValue,
            riskTier
        );
        const recommendedInterestRate = this.calculateInterestRate(riskTier);
        const recommendedLtv = Math.min(
            maxLoanAmount / totalCollateralValue,
            0.8
        );

        const [report] = await db
            .insert(underwritingReports)
            .values({
                submissionId,
                borrowerId: borrower.id,
                status: "pending_review",

                totalAssetsUsd: financialMetrics.totalAssets.toString(),
                totalLiabilitiesUsd: financialMetrics.totalLiabilities.toString(),
                netWorthUsd: (
                    financialMetrics.totalAssets - financialMetrics.totalLiabilities
                ).toString(),
                monthlyIncomeUsd: financialMetrics.monthlyIncome.toString(),
                monthlyExpensesUsd: financialMetrics.monthlyExpenses.toString(),
                debtToIncomeRatio: financialMetrics.debtToIncomeRatio.toString(),

                collateralScore: collateralAssessment.overallCollateralScore.toString(),
                probabilityScore: probabilityAssessment.overallProbabilityScore.toString(),
                combinedRiskScore: combinedRiskScore.toString(),
                riskTier,

                maxLoanAmountUsd: maxLoanAmount.toString(),
                recommendedLtvRatio: recommendedLtv.toString(),
                recommendedInterestRate: recommendedInterestRate.toString(),
                recommendedLoanTermDays: 365,
                requiredCollateralUsd: totalCollateralValue.toString(),

                reportData: {
                    financialMetrics,
                    collateralAssessment,
                    probabilityAssessment,
                },
                flags: probabilityAssessment.redFlags,
            })
            .returning();

        if (!report) {
            throw new Error("Failed to create underwriting report");
        }

        return report.id;
    }

    /**
     * Aggregate financial metrics from extracted data
     */
    private aggregateFinancialMetrics(extractedData: any[]): {
        totalAssets: number;
        totalLiabilities: number;
        monthlyIncome: number;
        monthlyExpenses: number;
        debtToIncomeRatio: number;
    } {
        let totalAssets = 0;
        let totalLiabilities = 0;
        let monthlyIncome = 0;
        let monthlyExpenses = 0;

        for (const data of extractedData) {
            if (data.assetValue) totalAssets += Number(data.assetValue);
            if (data.assets) totalAssets += Number(data.assets);
            if (data.liabilities) totalLiabilities += Number(data.liabilities);
            if (data.averageMonthlyIncome)
                monthlyIncome += Number(data.averageMonthlyIncome);
            if (data.averageMonthlyExpenses)
                monthlyExpenses += Number(data.averageMonthlyExpenses);
        }

        const debtToIncomeRatio =
            monthlyIncome > 0 ? (monthlyExpenses + totalLiabilities / 12) / monthlyIncome : 0;

        return {
            totalAssets,
            totalLiabilities,
            monthlyIncome,
            monthlyExpenses,
            debtToIncomeRatio,
        };
    }
}

export const underwritingService = new UnderwritingService();
