import type { Context } from "hono";
import { db } from "../db";
import {
  documentSubmissions,
  underwritingReports,
  loans,
  lendingPools,
  poolPerformanceSnapshots,
  users,
  documents,
  documentExtractions,
  collateralAssets,
} from "../db/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { NotFoundError, InternalServerError } from "../types";

export const getSubmissions = async (c: Context) => {
  try {
    const submissions = await db.query.documentSubmissions.findMany({
      with: {
        borrower: {
          with: {
            user: true,
          },
        },
        underwritingReports: true,
      },
      orderBy: (submissions, { desc }) => [desc(submissions.createdAt)],
      limit: 100,
    });

    return c.json({
      submissions: submissions.map((sub) => {
        const latestReport = sub.underwritingReports.sort(
          (a, b) =>
            new Date(b.generatedAt).getTime() -
            new Date(a.generatedAt).getTime(),
        )[0];

        return {
          submissionId: sub.id,
          submissionReference: sub.submissionReference,
          status: sub.status,
          submittedAt: sub.createdAt,
          borrowerName: sub.borrower.fullName,
          borrowerEmail: sub.borrower.user.email,
          borrowerType: sub.borrower.borrowerType,
          documentCount: sub.totalDocuments,
          processedDocuments: sub.processedDocuments,
          report: latestReport
            ? {
                reportId: latestReport.id,
                status: latestReport.status,
                riskTier: latestReport.riskTier,
                combinedRiskScore: Number(latestReport.combinedRiskScore || 0),
                maxLoanAmountUsd: Number(latestReport.maxLoanAmountUsd || 0),
              }
            : null,
        };
      }),
    });
  } catch (error) {
    console.error("Error getting submissions:", error);
    throw new InternalServerError("Failed to get submissions");
  }
};

export const getSubmissionDetails = async (c: Context) => {
  try {
    const submissionId = c.req.param("submissionId");
    const [submission] = await db
      .select()
      .from(documentSubmissions)
      .where(eq(documentSubmissions.id, submissionId));

    if (!submission) {
      throw new NotFoundError("Submission not found");
    }

    const [borrower] = await db.query.borrowerProfiles.findMany({
      where: (borrowers, { eq }) => eq(borrowers.id, submission.borrowerId),
      with: {
        user: true,
      },
      limit: 1,
    });

    const docs = await db
      .select()
      .from(documents)
      .where(eq(documents.submissionId, submissionId));

    const docIds = docs.map((doc) => doc.id);
    const extractions = docIds.length
      ? await db.query.documentExtractions.findMany({
          where: (extractions, { inArray }) =>
            inArray(extractions.documentId, docIds),
        })
      : [];

    const extractionMap = new Map(
      extractions.map((extraction) => [extraction.documentId, extraction]),
    );

    const collateral = await db
      .select()
      .from(collateralAssets)
      .where(eq(collateralAssets.submissionId, submissionId));

    const reports = await db
      .select()
      .from(underwritingReports)
      .where(eq(underwritingReports.submissionId, submissionId))
      .orderBy(desc(underwritingReports.generatedAt));

    const poolIds = reports
      .map((report) => (report.reportData as any)?.poolId as string | undefined)
      .filter((poolId): poolId is string => Boolean(poolId));

    const pools = poolIds.length
      ? await db.query.lendingPools.findMany({
          where: (pools, { inArray }) => inArray(pools.id, poolIds),
        })
      : [];

    const poolMap = new Map(pools.map((pool) => [pool.id, pool]));

    return c.json({
      submission: {
        submissionId: submission.id,
        submissionReference: submission.submissionReference,
        status: submission.status,
        submittedAt: submission.createdAt,
        borrower: borrower
          ? {
              id: borrower.id,
              fullName: borrower.fullName,
              email: borrower.user.email,
              borrowerType: borrower.borrowerType,
              businessName: borrower.businessName,
            }
          : null,
        documents: docs.map((doc) => {
          const extraction = extractionMap.get(doc.id);
          return {
            documentId: doc.id,
            documentType: doc.documentType,
            fileName: doc.fileName,
            fileSizeBytes: doc.fileSizeBytes,
            mimeType: doc.mimeType,
            processingStatus: doc.processingStatus,
            errorMessage: doc.errorMessage,
            extraction: extraction
              ? {
                  structuredData: extraction.structuredData,
                  confidenceScore: extraction.confidenceScore,
                  tokensUsed: extraction.tokensUsed,
                  extractionCostUsd: extraction.extractionCostUsd,
                }
              : null,
          };
        }),
        collateralAssets: collateral.map((asset) => ({
          assetType: asset.assetType,
          description: asset.assetDescription,
          estimatedValueUsd: asset.estimatedValueUsd,
          liquidationValueUsd: asset.liquidationValueUsd,
          verificationStatus: asset.verificationStatus,
        })),
        reports: reports.map((report) => {
          const poolId = (report.reportData as any)?.poolId as
            | string
            | undefined;
          const pool = poolId ? poolMap.get(poolId) : undefined;
          return {
            reportId: report.id,
            status: report.status,
            generatedAt: report.generatedAt,
            riskTier: report.riskTier,
            combinedRiskScore: report.combinedRiskScore,
            maxLoanAmountUsd: report.maxLoanAmountUsd,
            recommendedInterestRate: report.recommendedInterestRate,
            recommendedLoanTermDays: report.recommendedLoanTermDays,
            reportData: report.reportData,
            flags: report.flags,
            pool: pool
              ? {
                  poolId: pool.id,
                  poolName: pool.poolName,
                  poolStatus: pool.poolStatus,
                  contractAddress: pool.contractAddress,
                  chainId: pool.chainId,
                }
              : null,
          };
        }),
      },
    });
  } catch (error) {
    console.error("Error getting submission details:", error);
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new InternalServerError("Failed to get submission details");
  }
};

/**
 * Get pending submissions for admin review
 */
export const getPendingSubmissions = async (c: Context) => {
  try {
    const submissions = await db.query.documentSubmissions.findMany({
      where: (submissions, { eq }) => eq(submissions.status, "completed"),
      with: {
        borrower: {
          with: {
            user: true,
          },
        },
        underwritingReports: {
          where: (reports, { eq }) => eq(reports.status, "pending_review"),
        },
      },
      orderBy: (submissions, { desc }) => [desc(submissions.createdAt)],
      limit: 50,
    });

    return c.json({
      submissions: submissions.map((sub) => ({
        submissionId: sub.id,
        submissionReference: sub.submissionReference,
        borrowerName: sub.borrower.fullName,
        borrowerEmail: sub.borrower.user.email,
        submittedAt: sub.createdAt,
        reportCount: sub.underwritingReports.length,
      })),
    });
  } catch (error) {
    console.error("Error getting pending submissions:", error);
    throw new InternalServerError("Failed to get pending submissions");
  }
};

/**
 * Approve underwriting report
 */
export const approveReport = async (c: Context) => {
  try {
    const reportId = c.req.param("reportId");
    const userId = c.get("userId");

    const updatePayload: {
      status: "approved";
      approvedBy?: number | null;
      approvedAt: Date;
    } = {
      status: "approved",
      approvedAt: new Date(),
    };

    if (typeof userId === "number") {
      updatePayload.approvedBy = userId;
    }

    const [report] = await db
      .update(underwritingReports)
      .set(updatePayload)
      .where(eq(underwritingReports.id, reportId))
      .returning();

    if (!report) {
      throw new NotFoundError("Report not found");
    }

    return c.json({
      success: true,
      reportId: report.id,
      status: report.status,
    });
  } catch (error) {
    console.error("Error approving report:", error);
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new InternalServerError("Failed to approve report");
  }
};

/**
 * Reject underwriting report
 */
export const rejectReport = async (c: Context) => {
  try {
    const reportId = c.req.param("reportId");
    const { reason } = await c.req.json();

    const [report] = await db
      .update(underwritingReports)
      .set({
        status: "rejected",
        flags: sql`array_append(flags, ${reason || "Rejected by admin"})`,
      })
      .where(eq(underwritingReports.id, reportId))
      .returning();

    if (!report) {
      throw new NotFoundError("Report not found");
    }

    return c.json({
      success: true,
      reportId: report.id,
      status: report.status,
    });
  } catch (error) {
    console.error("Error rejecting report:", error);
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new InternalServerError("Failed to reject report");
  }
};

/**
 * Create a lending pool for an approved report
 */
export const createPoolForReport = async (c: Context) => {
  try {
    const reportId = c.req.param("reportId");

    const [report] = await db
      .select()
      .from(underwritingReports)
      .where(eq(underwritingReports.id, reportId));

    if (!report) {
      throw new NotFoundError("Report not found");
    }

    if (report.status !== "approved") {
      throw new InternalServerError(
        "Report must be approved before pool creation",
      );
    }

    const reportData = (report.reportData as Record<string, any>) || {};
    const existingPoolId = reportData.poolId as string | undefined;

    if (existingPoolId) {
      const [existingPool] = await db
        .select()
        .from(lendingPools)
        .where(eq(lendingPools.id, existingPoolId));

      if (existingPool) {
        return c.json({
          poolId: existingPool.id,
          poolName: existingPool.poolName,
          poolStatus: existingPool.poolStatus,
        });
      }
    }

    const [pool] = await db
      .insert(lendingPools)
      .values({
        poolName: `Risk ${report.riskTier ?? "N/A"} Pool`,
        poolType: "risk_tiered",
        riskTier: report.riskTier,
        baseInterestRate: report.recommendedInterestRate ?? "10.0",
        maxLoanSizeUsd: report.maxLoanAmountUsd,
        minLoanSizeUsd: "0",
        poolStatus: "paused",
      })
      .returning();

    if (!pool) {
      throw new InternalServerError("Failed to create pool");
    }

    await db
      .update(underwritingReports)
      .set({
        reportData: {
          ...reportData,
          poolId: pool.id,
        },
      })
      .where(eq(underwritingReports.id, report.id));

    return c.json({
      poolId: pool.id,
      poolName: pool.poolName,
      poolStatus: pool.poolStatus,
    });
  } catch (error) {
    console.error("Error creating pool:", error);
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new InternalServerError("Failed to create pool");
  }
};

/**
 * Deploy a pool on-chain (mock)
 */
export const deployPool = async (c: Context) => {
  try {
    const poolId = c.req.param("poolId");
    const { contractAddress, chainId } = await c.req.json();

    const [pool] = await db
      .update(lendingPools)
      .set({
        contractAddress: contractAddress || `mock-${poolId}`,
        chainId: chainId || "sui-testnet",
        poolStatus: "active",
      })
      .where(eq(lendingPools.id, poolId))
      .returning();

    if (!pool) {
      throw new NotFoundError("Pool not found");
    }

    return c.json({
      poolId: pool.id,
      poolStatus: pool.poolStatus,
      contractAddress: pool.contractAddress,
      chainId: pool.chainId,
    });
  } catch (error) {
    console.error("Error deploying pool:", error);
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new InternalServerError("Failed to deploy pool");
  }
};

/**
 * Get system analytics
 */
export const getAnalytics = async (c: Context) => {
  try {
    const [submissionCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(documentSubmissions);

    const [loanCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(loans);

    const [poolStats] = await db
      .select({
        totalTvl: sql<number>`sum(${lendingPools.totalValueLockedUsd})`,
        avgUtilization: sql<number>`avg(${lendingPools.totalLoansValueUsd}::numeric / nullif(${lendingPools.totalValueLockedUsd}::numeric, 0))`,
      })
      .from(lendingPools);

    const completedSubmissions = await db
      .select({
        createdAt: documentSubmissions.createdAt,
        completedAt: documentSubmissions.completedAt,
      })
      .from(documentSubmissions)
      .where(eq(documentSubmissions.status, "completed"))
      .limit(100);

    const avgProcessingTime =
      completedSubmissions.length > 0
        ? completedSubmissions.reduce((sum, sub) => {
            if (!sub.completedAt) return sum;
            const diff =
              new Date(sub.completedAt).getTime() -
              new Date(sub.createdAt).getTime();
            return sum + diff;
          }, 0) / completedSubmissions.length
        : 0;

    return c.json({
      totalSubmissions: Number(submissionCount?.count || 0),
      totalLoans: Number(loanCount?.count || 0),
      totalTvl: Number(poolStats?.totalTvl || 0),
      avgUtilizationRate: Number(poolStats?.avgUtilization || 0),
      avgProcessingTimeMs: Math.round(avgProcessingTime),
      avgProcessingTimeMinutes: Math.round(avgProcessingTime / 60000),
    });
  } catch (error) {
    console.error("Error getting analytics:", error);
    throw new InternalServerError("Failed to get analytics");
  }
};

/**
 * Get lender positions across all pools
 */
export const getLenderPositions = async (c: Context) => {
  try {
    const walletAddress = c.get("walletAddress");

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.walletAddress, walletAddress));

    if (!user) {
      return c.json({
        positions: [],
        totalValue: 0,
        totalEarnings: 0,
      });
    }

    const deposits = await db.query.poolDeposits.findMany({
      where: (deposits, { eq }) => eq(deposits.lenderUserId, user.id),
    });

    const positions = await Promise.all(
      deposits.map(async (deposit) => {
        const [pool] = await db
          .select()
          .from(lendingPools)
          .where(eq(lendingPools.id, deposit.poolId));

        return {
          poolId: deposit.poolId,
          poolName: pool?.poolName || "Unknown",
          depositedAmount: Number(deposit.depositAmountUsd),
          lpTokensOwned: Number(deposit.lpTokensMinted),
          currentValue: Number(deposit.depositAmountUsd),
          earnedInterest: 0, // TODO: Calculate from pool performance
          apy: pool ? Number(pool.currentApy) : 0,
          depositDate: deposit.depositTimestamp.toISOString(),
        };
      }),
    );

    return c.json({
      positions,
      totalValue: positions.reduce((sum, p) => sum + p.currentValue, 0),
      totalEarnings: positions.reduce((sum, p) => sum + p.earnedInterest, 0),
    });
  } catch (error) {
    console.error("Error getting lender positions:", error);
    throw new InternalServerError("Failed to get lender positions");
  }
};

/**
 * Get pool performance snapshots
 */
export const getPoolPerformanceHistory = async (poolId: string) => {
  try {
    const snapshots = await db
      .select()
      .from(poolPerformanceSnapshots)
      .where(eq(poolPerformanceSnapshots.poolId, poolId))
      .orderBy(desc(poolPerformanceSnapshots.snapshotTimestamp))
      .limit(30);

    return snapshots.map((snapshot) => ({
      date: snapshot.snapshotTimestamp.toISOString(),
      apy: Number(snapshot.apy),
      tvl: Number(snapshot.tvlUsd),
      utilizationRate: Number(snapshot.utilizationRate),
      defaultRate: Number(snapshot.defaultRate),
    }));
  } catch (error) {
    console.error("Error getting pool performance history:", error);
    return [];
  }
};
