import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  createSubmission,
  uploadDocument,
  getSubmission,
  getActiveSubmission,
  finalizeSubmission,
  getUnderwritingReport,
  applyLoan,
  getBorrowerLoans,
  withdrawLoanFunds,
  repayLoan,
  listPools,
  getPool,
  depositToPool,
  withdrawFromPool,
} from "./handlers";
import { requestNonce, verifyWallet } from "./auth-handlers";
import {
  getPendingSubmissions,
  getSubmissions,
  getSubmissionDetails,
  approveReport,
  rejectReport,
  createPoolForReport,
  deployPool,
  getAnalytics,
  getLenderPositions,
} from "./admin-handlers";
import {
  getBorrowerNfts,
  requestMintApproval,
  mintBorrowerNft,
  deployPoolOnChain,
  registerMintedNft,
} from "./contract-handlers";
import {
  createSubmissionSchema,
  applyLoanSchema,
  mintNftSchema,
  deployPoolSchema,
  registerNftSchema,
} from "../types";
import { authNonceSchema, authVerifySchema } from "../types/auth";
import { onboardingSchema } from "../types/onboarding";
import { authMiddleware } from "../middleware";
import { getMe, updateOnboarding } from "./account-handlers";

const app = new Hono();
const borrower = new Hono();

const auth = new Hono();
const account = new Hono();

auth.post("/nonce", zValidator("json", authNonceSchema), requestNonce);
auth.post("/verify", zValidator("json", authVerifySchema), verifyWallet);

account.use("*", authMiddleware);
account.get("/me", getMe);
account.post(
  "/onboarding",
  zValidator("json", onboardingSchema),
  updateOnboarding,
);

borrower.use("*", authMiddleware);

borrower.post(
  "/submit",
  zValidator("json", createSubmissionSchema),
  createSubmission,
);

borrower.post("/upload-document", uploadDocument);

borrower.post("/finalize-submission", finalizeSubmission);

borrower.get("/submission/active", getActiveSubmission);

borrower.get("/submission/:submissionId", getSubmission);

borrower.get("/report/:submissionId", getUnderwritingReport);

borrower.post("/apply-loan", zValidator("json", applyLoanSchema), applyLoan);

borrower.get("/loans", getBorrowerLoans);

borrower.post("/loan/:loanId/withdraw", withdrawLoanFunds);

borrower.post("/loan/:loanId/repay", repayLoan);

// NFT Routes
borrower.get("/nfts", getBorrowerNfts);

borrower.post("/nfts/request-approval", requestMintApproval);

borrower.post("/nfts/mint", zValidator("json", mintNftSchema), mintBorrowerNft);

// Register NFT minted on-chain (from frontend)
borrower.post(
  "/nfts/register",
  zValidator("json", registerNftSchema),
  registerMintedNft,
);

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
  return depositToPool(c);
});

pools.post("/:poolId/withdraw", async (c) => {
  return withdrawFromPool(c);
});

const admin = new Hono();

admin.get("/submissions/pending", getPendingSubmissions);

admin.get("/submissions", getSubmissions);

admin.get("/submission/:submissionId", getSubmissionDetails);

admin.post("/report/:reportId/approve", approveReport);

admin.post("/report/:reportId/reject", rejectReport);

admin.post("/report/:reportId/create-pool", createPoolForReport);

admin.post("/pool/:poolId/deploy", deployPool);

admin.post(
  "/pool/deploy-onchain",
  zValidator("json", deployPoolSchema),
  deployPoolOnChain,
);

admin.get("/analytics", getAnalytics);

app.route("/borrower", borrower);
app.route("/lender", lender);
app.route("/pools", pools);
app.route("/admin", admin);
app.route("/auth", auth);
app.route("/account", account);

export default app;
