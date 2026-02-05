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

borrower.post(
    "/submit",
    zValidator("json", createSubmissionSchema),
    createSubmission
);

borrower.post("/upload-document", uploadDocument);

borrower.post("/finalize-submission", finalizeSubmission);

borrower.get("/submission/:submissionId", getSubmission);

borrower.get("/report/:submissionId", getUnderwritingReport);

borrower.post("/apply-loan", zValidator("json", applyLoanSchema), applyLoan);

const lender = new Hono();

lender.get("/pools", listPools);

lender.get("/pools/:poolId", getPool);

lender.get("/positions", getLenderPositions);

// ============================================================================
// POOL ROUTES
// ============================================================================

const pools = new Hono();

pools.get("/", listPools);

pools.get("/:poolId", getPool);

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

admin.get("/submissions/pending", getPendingSubmissions);

admin.post("/report/:reportId/approve", approveReport);

admin.post("/report/:reportId/reject", rejectReport);

admin.get("/analytics", getAnalytics);

app.route("/borrower", borrower);
app.route("/lender", lender);
app.route("/pools", pools);
app.route("/admin", admin);

export default app;
