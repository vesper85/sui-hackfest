import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  decimal,
  integer,
  jsonb,
  boolean,
  pgEnum,
  bigint,
  serial,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const userTypeEnum = pgEnum("user_type", ["borrower", "lender"]);
export const onboardingStatusEnum = pgEnum("onboarding_status", [
  "pending",
  "completed",
]);
export const kycStatusEnum = pgEnum("kyc_status", [
  "pending",
  "approved",
  "rejected",
]);
export const borrowerTypeEnum = pgEnum("borrower_type", [
  "individual",
  "business",
]);

export const documentTypeEnum = pgEnum("document_type", [
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
]);

export const processingStatusEnum = pgEnum("processing_status", [
  "pending",
  "processing",
  "completed",
  "failed",
]);

export const submissionStatusEnum = pgEnum("submission_status", [
  "pending",
  "processing",
  "completed",
  "failed",
]);

export const reportStatusEnum = pgEnum("report_status", [
  "draft",
  "pending_review",
  "approved",
  "rejected",
]);

export const riskTierEnum = pgEnum("risk_tier", [
  "AAA",
  "AA",
  "A",
  "BBB",
  "BB",
  "B",
  "C",
  "D",
]);

export const assetTypeEnum = pgEnum("asset_type", [
  "real_estate",
  "vehicle",
  "crypto",
  "securities",
  "equipment",
  "inventory",
  "cash",
  "other",
]);

export const verificationStatusEnum = pgEnum("verification_status", [
  "pending",
  "verified",
  "rejected",
]);

export const poolTypeEnum = pgEnum("pool_type", [
  "risk_tiered",
  "asset_backed",
  "specialized",
]);

export const poolStatusEnum = pgEnum("pool_status", [
  "active",
  "paused",
  "closed",
]);

export const loanStatusEnum = pgEnum("loan_status", [
  "pending_approval",
  "approved",
  "funded",
  "active",
  "repaid",
  "defaulted",
  "liquidated",
  "cancelled",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "on_chain",
  "off_chain",
]);

export const llmOperationTypeEnum = pgEnum("llm_operation_type", [
  "document_extraction",
  "risk_scoring",
  "report_generation",
]);

export const apiStatusEnum = pgEnum("api_status", ["success", "error"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  walletAddress: varchar("wallet_address", { length: 255 }).unique().notNull(),
  email: varchar("email", { length: 255 }).unique(),
  userType: userTypeEnum("user_type").notNull().default("borrower"),
  onboardingStatus: onboardingStatusEnum("onboarding_status")
    .notNull()
    .default("pending"),
  onboardingData: jsonb("onboarding_data"),
  kycStatus: kycStatusEnum("kyc_status").notNull().default("pending"),
  kycProviderId: varchar("kyc_provider_id", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const borrowerProfiles = pgTable("borrower_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  businessName: varchar("business_name", { length: 255 }),
  borrowerType: borrowerTypeEnum("borrower_type").notNull(),
  creditScore: integer("credit_score"),
  totalAssetsUsd: decimal("total_assets_usd", { precision: 20, scale: 2 }),
  totalLiabilitiesUsd: decimal("total_liabilities_usd", {
    precision: 20,
    scale: 2,
  }),
  monthlyIncomeUsd: decimal("monthly_income_usd", { precision: 20, scale: 2 }),
  employmentStatus: varchar("employment_status", { length: 100 }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const documentSubmissions = pgTable("document_submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  borrowerId: uuid("borrower_id")
    .references(() => borrowerProfiles.id)
    .notNull(),
  submissionReference: varchar("submission_reference", { length: 100 })
    .unique()
    .notNull(),
  status: submissionStatusEnum("status").notNull().default("pending"),
  totalDocuments: integer("total_documents").default(0).notNull(),
  processedDocuments: integer("processed_documents").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  submissionId: uuid("submission_id")
    .references(() => documentSubmissions.id)
    .notNull(),
  documentType: documentTypeEnum("document_type").notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileSizeBytes: bigint("file_size_bytes", { mode: "number" }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  s3Bucket: varchar("s3_bucket", { length: 255 }).notNull(),
  s3Key: varchar("s3_key", { length: 512 }).notNull(),
  s3VersionId: varchar("s3_version_id", { length: 255 }),
  uploadTimestamp: timestamp("upload_timestamp").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
  processingStatus: processingStatusEnum("processing_status")
    .notNull()
    .default("pending"),
  errorMessage: text("error_message"),
});

export const documentExtractions = pgTable("document_extractions", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id")
    .references(() => documents.id)
    .notNull(),
  llmProvider: varchar("llm_provider", { length: 50 }).notNull(),
  llmModel: varchar("llm_model", { length: 100 }).notNull(),
  extractionTimestamp: timestamp("extraction_timestamp").defaultNow().notNull(),
  rawLlmResponse: jsonb("raw_llm_response").notNull(),
  structuredData: jsonb("structured_data").notNull(),
  confidenceScore: decimal("confidence_score", { precision: 3, scale: 2 }),
  tokensUsed: integer("tokens_used"),
  extractionCostUsd: decimal("extraction_cost_usd", {
    precision: 10,
    scale: 4,
  }),
});

export const underwritingReports = pgTable("underwriting_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  submissionId: uuid("submission_id")
    .references(() => documentSubmissions.id)
    .notNull(),
  borrowerId: uuid("borrower_id")
    .references(() => borrowerProfiles.id)
    .notNull(),
  reportVersion: integer("report_version").default(1).notNull(),
  status: reportStatusEnum("status").notNull().default("draft"),

  // Financial Metrics
  totalAssetsUsd: decimal("total_assets_usd", { precision: 20, scale: 2 }),
  totalLiabilitiesUsd: decimal("total_liabilities_usd", {
    precision: 20,
    scale: 2,
  }),
  netWorthUsd: decimal("net_worth_usd", { precision: 20, scale: 2 }),
  monthlyIncomeUsd: decimal("monthly_income_usd", { precision: 20, scale: 2 }),
  monthlyExpensesUsd: decimal("monthly_expenses_usd", {
    precision: 20,
    scale: 2,
  }),
  debtToIncomeRatio: decimal("debt_to_income_ratio", {
    precision: 5,
    scale: 2,
  }),

  // Risk Scoring
  collateralScore: decimal("collateral_score", { precision: 5, scale: 2 }),
  probabilityScore: decimal("probability_score", { precision: 5, scale: 2 }),
  combinedRiskScore: decimal("combined_risk_score", { precision: 5, scale: 2 }),
  riskTier: riskTierEnum("risk_tier"),

  // Lending Terms
  maxLoanAmountUsd: decimal("max_loan_amount_usd", { precision: 20, scale: 2 }),
  recommendedLtvRatio: decimal("recommended_ltv_ratio", {
    precision: 5,
    scale: 2,
  }),
  recommendedInterestRate: decimal("recommended_interest_rate", {
    precision: 5,
    scale: 2,
  }),
  recommendedLoanTermDays: integer("recommended_loan_term_days"),
  requiredCollateralUsd: decimal("required_collateral_usd", {
    precision: 20,
    scale: 2,
  }),

  // Metadata
  reportData: jsonb("report_data"),
  flags: jsonb("flags"),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
  approvedBy: integer("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  reportS3Key: varchar("report_s3_key", { length: 512 }),
});

export const collateralAssets = pgTable("collateral_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  borrowerId: uuid("borrower_id")
    .references(() => borrowerProfiles.id)
    .notNull(),
  submissionId: uuid("submission_id")
    .references(() => documentSubmissions.id)
    .notNull(),
  assetType: assetTypeEnum("asset_type").notNull(),
  assetDescription: text("asset_description").notNull(),
  estimatedValueUsd: decimal("estimated_value_usd", {
    precision: 20,
    scale: 2,
  }).notNull(),
  verificationStatus: verificationStatusEnum("verification_status")
    .notNull()
    .default("pending"),
  verificationSource: varchar("verification_source", { length: 255 }),
  liquidationValueUsd: decimal("liquidation_value_usd", {
    precision: 20,
    scale: 2,
  }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const lendingPools = pgTable("lending_pools", {
  id: uuid("id").primaryKey().defaultRandom(),
  poolName: varchar("pool_name", { length: 255 }).notNull(),
  poolType: poolTypeEnum("pool_type").notNull(),
  riskTier: riskTierEnum("risk_tier"),
  assetClass: varchar("asset_class", { length: 100 }),

  // On-chain Data
  contractAddress: varchar("contract_address", { length: 255 }),
  chainId: varchar("chain_id", { length: 50 }),

  // Pool Metrics
  totalValueLockedUsd: decimal("total_value_locked_usd", {
    precision: 20,
    scale: 2,
  })
    .default("0")
    .notNull(),
  availableLiquidityUsd: decimal("available_liquidity_usd", {
    precision: 20,
    scale: 2,
  })
    .default("0")
    .notNull(),
  totalLoansActive: integer("total_loans_active").default(0).notNull(),
  totalLoansValueUsd: decimal("total_loans_value_usd", {
    precision: 20,
    scale: 2,
  })
    .default("0")
    .notNull(),
  totalDefaultsCount: integer("total_defaults_count").default(0).notNull(),
  totalDefaultsValueUsd: decimal("total_defaults_value_usd", {
    precision: 20,
    scale: 2,
  })
    .default("0")
    .notNull(),

  // Returns
  currentApy: decimal("current_apy", { precision: 5, scale: 2 }),
  historicalApy30d: decimal("historical_apy_30d", { precision: 5, scale: 2 }),
  baseInterestRate: decimal("base_interest_rate", {
    precision: 5,
    scale: 2,
  }).notNull(),
  protocolFeePercentage: decimal("protocol_fee_percentage", {
    precision: 5,
    scale: 2,
  })
    .default("2.0")
    .notNull(),

  // Risk Parameters
  maxLoanSizeUsd: decimal("max_loan_size_usd", { precision: 20, scale: 2 }),
  minLoanSizeUsd: decimal("min_loan_size_usd", { precision: 20, scale: 2 }),
  targetUtilizationRate: decimal("target_utilization_rate", {
    precision: 5,
    scale: 2,
  }).default("0.8"),
  maxUtilizationRate: decimal("max_utilization_rate", {
    precision: 5,
    scale: 2,
  }).default("0.95"),

  // Status
  poolStatus: poolStatusEnum("pool_status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const loans = pgTable("loans", {
  id: uuid("id").primaryKey().defaultRandom(),
  poolId: uuid("pool_id")
    .references(() => lendingPools.id)
    .notNull(),
  borrowerId: uuid("borrower_id")
    .references(() => borrowerProfiles.id)
    .notNull(),
  underwritingReportId: uuid("underwriting_report_id")
    .references(() => underwritingReports.id)
    .notNull(),

  // Loan Terms
  principalUsd: decimal("principal_usd", { precision: 20, scale: 2 }).notNull(),
  interestRate: decimal("interest_rate", { precision: 5, scale: 2 }).notNull(),
  loanTermDays: integer("loan_term_days").notNull(),
  ltvRatio: decimal("ltv_ratio", { precision: 5, scale: 2 }),
  originationFeeUsd: decimal("origination_fee_usd", {
    precision: 20,
    scale: 2,
  }),

  // Amounts
  totalRepaymentAmountUsd: decimal("total_repayment_amount_usd", {
    precision: 20,
    scale: 2,
  }).notNull(),
  outstandingBalanceUsd: decimal("outstanding_balance_usd", {
    precision: 20,
    scale: 2,
  }).notNull(),
  accruedInterestUsd: decimal("accrued_interest_usd", {
    precision: 20,
    scale: 2,
  })
    .default("0")
    .notNull(),
  totalPaidUsd: decimal("total_paid_usd", { precision: 20, scale: 2 })
    .default("0")
    .notNull(),

  // On-chain
  loanContractAddress: varchar("loan_contract_address", { length: 255 }),
  fundingTxHash: varchar("funding_tx_hash", { length: 255 }),
  borrowerWalletAddress: varchar("borrower_wallet_address", {
    length: 255,
  }).notNull(),

  // Dates
  applicationDate: timestamp("application_date").defaultNow().notNull(),
  approvalDate: timestamp("approval_date"),
  fundedDate: timestamp("funded_date"),
  maturityDate: timestamp("maturity_date"),
  lastPaymentDate: timestamp("last_payment_date"),
  closedDate: timestamp("closed_date"),

  // Status
  status: loanStatusEnum("status").notNull().default("pending_approval"),
  defaultDate: timestamp("default_date"),

  // Metadata
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const loanRepayments = pgTable("loan_repayments", {
  id: uuid("id").primaryKey().defaultRandom(),
  loanId: uuid("loan_id")
    .references(() => loans.id)
    .notNull(),
  paymentAmountUsd: decimal("payment_amount_usd", {
    precision: 20,
    scale: 2,
  }).notNull(),
  principalAmountUsd: decimal("principal_amount_usd", {
    precision: 20,
    scale: 2,
  }).notNull(),
  interestAmountUsd: decimal("interest_amount_usd", {
    precision: 20,
    scale: 2,
  }).notNull(),
  lateFeeUsd: decimal("late_fee_usd", { precision: 20, scale: 2 })
    .default("0")
    .notNull(),
  paymentDate: timestamp("payment_date").defaultNow().notNull(),
  dueDate: timestamp("due_date"),
  txHash: varchar("tx_hash", { length: 255 }).notNull(),
  paymentMethod: paymentMethodEnum("payment_method").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const poolDeposits = pgTable("pool_deposits", {
  id: uuid("id").primaryKey().defaultRandom(),
  poolId: uuid("pool_id")
    .references(() => lendingPools.id)
    .notNull(),
  lenderUserId: integer("lender_user_id")
    .references(() => users.id)
    .notNull(),
  depositAmountUsd: decimal("deposit_amount_usd", {
    precision: 20,
    scale: 2,
  }).notNull(),
  lpTokensMinted: decimal("lp_tokens_minted", {
    precision: 20,
    scale: 8,
  }).notNull(),
  txHash: varchar("tx_hash", { length: 255 }).notNull(),
  depositTimestamp: timestamp("deposit_timestamp").defaultNow().notNull(),
  walletAddress: varchar("wallet_address", { length: 255 }).notNull(),
});

export const poolWithdrawals = pgTable("pool_withdrawals", {
  id: uuid("id").primaryKey().defaultRandom(),
  poolId: uuid("pool_id")
    .references(() => lendingPools.id)
    .notNull(),
  lenderUserId: integer("lender_user_id")
    .references(() => users.id)
    .notNull(),
  withdrawalAmountUsd: decimal("withdrawal_amount_usd", {
    precision: 20,
    scale: 2,
  }).notNull(),
  lpTokensBurned: decimal("lp_tokens_burned", {
    precision: 20,
    scale: 8,
  }).notNull(),
  txHash: varchar("tx_hash", { length: 255 }).notNull(),
  withdrawalTimestamp: timestamp("withdrawal_timestamp").defaultNow().notNull(),
  walletAddress: varchar("wallet_address", { length: 255 }).notNull(),
});

export const poolPerformanceSnapshots = pgTable("pool_performance_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  poolId: uuid("pool_id")
    .references(() => lendingPools.id)
    .notNull(),
  snapshotTimestamp: timestamp("snapshot_timestamp").defaultNow().notNull(),
  tvlUsd: decimal("tvl_usd", { precision: 20, scale: 2 }).notNull(),
  apy: decimal("apy", { precision: 5, scale: 2 }),
  utilizationRate: decimal("utilization_rate", { precision: 5, scale: 2 }),
  defaultRate: decimal("default_rate", { precision: 5, scale: 2 }),
  totalActiveLoans: integer("total_active_loans").notNull(),
  totalLenders: integer("total_lenders").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const llmApiLogs = pgTable("llm_api_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  requestTimestamp: timestamp("request_timestamp").defaultNow().notNull(),
  provider: varchar("provider", { length: 50 }).notNull(),
  model: varchar("model", { length: 100 }).notNull(),
  operationType: llmOperationTypeEnum("operation_type").notNull(),
  relatedEntityType: varchar("related_entity_type", { length: 50 }),
  relatedEntityId: uuid("related_entity_id"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  totalCostUsd: decimal("total_cost_usd", { precision: 10, scale: 4 }),
  latencyMs: integer("latency_ms"),
  status: apiStatusEnum("status").notNull(),
  errorMessage: text("error_message"),
});

export const usersRelations = relations(users, ({ one, many }) => ({
  borrowerProfile: one(borrowerProfiles, {
    fields: [users.id],
    references: [borrowerProfiles.userId],
  }),
  poolDeposits: many(poolDeposits),
  poolWithdrawals: many(poolWithdrawals),
}));

export const borrowerProfilesRelations = relations(
  borrowerProfiles,
  ({ one, many }) => ({
    user: one(users, {
      fields: [borrowerProfiles.userId],
      references: [users.id],
    }),
    submissions: many(documentSubmissions),
    collateralAssets: many(collateralAssets),
    underwritingReports: many(underwritingReports),
    loans: many(loans),
  }),
);

export const documentSubmissionsRelations = relations(
  documentSubmissions,
  ({ one, many }) => ({
    borrower: one(borrowerProfiles, {
      fields: [documentSubmissions.borrowerId],
      references: [borrowerProfiles.id],
    }),
    documents: many(documents),
    underwritingReports: many(underwritingReports),
    collateralAssets: many(collateralAssets),
  }),
);

export const documentsRelations = relations(documents, ({ one, many }) => ({
  submission: one(documentSubmissions, {
    fields: [documents.submissionId],
    references: [documentSubmissions.id],
  }),
  extractions: many(documentExtractions),
}));

export const documentExtractionsRelations = relations(
  documentExtractions,
  ({ one }) => ({
    document: one(documents, {
      fields: [documentExtractions.documentId],
      references: [documents.id],
    }),
  }),
);

export const underwritingReportsRelations = relations(
  underwritingReports,
  ({ one, many }) => ({
    submission: one(documentSubmissions, {
      fields: [underwritingReports.submissionId],
      references: [documentSubmissions.id],
    }),
    borrower: one(borrowerProfiles, {
      fields: [underwritingReports.borrowerId],
      references: [borrowerProfiles.id],
    }),
    approver: one(users, {
      fields: [underwritingReports.approvedBy],
      references: [users.id],
    }),
    loans: many(loans),
  }),
);

export const lendingPoolsRelations = relations(lendingPools, ({ many }) => ({
  loans: many(loans),
  deposits: many(poolDeposits),
  withdrawals: many(poolWithdrawals),
  performanceSnapshots: many(poolPerformanceSnapshots),
}));

export const loansRelations = relations(loans, ({ one, many }) => ({
  pool: one(lendingPools, {
    fields: [loans.poolId],
    references: [lendingPools.id],
  }),
  borrower: one(borrowerProfiles, {
    fields: [loans.borrowerId],
    references: [borrowerProfiles.id],
  }),
  underwritingReport: one(underwritingReports, {
    fields: [loans.underwritingReportId],
    references: [underwritingReports.id],
  }),
  repayments: many(loanRepayments),
}));

export const loanRepaymentsRelations = relations(loanRepayments, ({ one }) => ({
  loan: one(loans, {
    fields: [loanRepayments.loanId],
    references: [loans.id],
  }),
}));
