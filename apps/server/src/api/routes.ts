import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
    createSubmission,
    uploadDocument,
    getSubmission,
    finalizeSubmission,
    getUnderwritingReport,
    applyLoan,
    listPools,
    getPool,
} from "./handlers";
import {
    getPendingSubmissions,
    approveReport,
    rejectReport,
    getAnalytics,
    getLenderPositions,
} from "./admin-handlers";
import {
    createSubmissionSchema,
    applyLoanSchema,
} from "../types";

const app = new Hono();
const borrower = new Hono();

// Create new submission
borrower.post(
    "/submit",
    zValidator("json", createSubmissionSchema),
    createSubmission
);

// Upload document
borrower.post("/upload-document", uploadDocument);

// Finalize submission and trigger processing
borrower.post("/finalize-submission", finalizeSubmission);

// Get submission status
borrower.get("/submission/:submissionId", getSubmission);

// Get underwriting report
borrower.get("/report/:submissionId", getUnderwritingReport);

// Apply for loan
borrower.post("/apply-loan", zValidator("json", applyLoanSchema), applyLoan);

const lender = new Hono();

// List all pools
lender.get("/pools", listPools);

// Get pool details
lender.get("/pools/:poolId", getPool);

// Get lender positions
lender.get("/positions", getLenderPositions);

// ============================================================================
// POOL ROUTES
// ============================================================================

const pools = new Hono();

// List pools
pools.get("/", listPools);

// Get pool details
pools.get("/:poolId", getPool);

// Deposit to pool (returns transaction data)
pools.post("/:poolId/deposit", async (c) => {
    const { amount, walletAddress } = await c.req.json();

    // NOTE: This returns unsigned transaction data for the frontend to sign
    // Actual implementation would generate Sui Move transaction
    return c.json({
        transactionData: {
            poolId: c.req.param("poolId"),
            amount,
            walletAddress,
            type: "deposit",
        },
        expectedLpTokens: amount, // Simplified 1:1 ratio
    });
});

// Withdraw from pool (returns transaction data)
pools.post("/:poolId/withdraw", async (c) => {
    const { lpTokens, walletAddress } = await c.req.json();

    // NOTE: This returns unsigned transaction data
    return c.json({
        transactionData: {
            poolId: c.req.param("poolId"),
            lpTokens,
            walletAddress,
            type: "withdraw",
        },
        expectedAmount: lpTokens, // Simplified 1:1 ratio
        availableLiquidity: 1000000, // Would query from pool
    });
});

const admin = new Hono();

// List pending submissions
admin.get("/submissions/pending", getPendingSubmissions);

// Approve report
admin.post("/report/:reportId/approve", approveReport);

// Reject report
admin.post("/report/:reportId/reject", rejectReport);

// Analytics
admin.get("/analytics", getAnalytics);

app.route("/borrower", borrower);
app.route("/lender", lender);
app.route("/pools", pools);
app.route("/admin", admin);

export default app;
