import type { Context } from "hono";
import { db } from "../db";
import {
    documentSubmissions,
    underwritingReports,
    loans,
    lendingPools,
    poolPerformanceSnapshots,
    users,
} from "../db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { NotFoundError, InternalServerError } from "../types";

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

        const [report] = await db
            .update(underwritingReports)
            .set({
                status: "approved",
                approvedBy: userId,
                approvedAt: new Date(),
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
            })
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
