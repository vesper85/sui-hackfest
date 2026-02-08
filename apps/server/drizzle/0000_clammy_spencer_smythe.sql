CREATE TYPE "public"."api_status" AS ENUM('success', 'error');--> statement-breakpoint
CREATE TYPE "public"."asset_type" AS ENUM('real_estate', 'vehicle', 'crypto', 'securities', 'equipment', 'inventory', 'cash', 'other');--> statement-breakpoint
CREATE TYPE "public"."borrower_type" AS ENUM('individual', 'business');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('bank_statement', 'tax_return', 'pay_stub', 'property_deed', 'vehicle_title', 'business_financials', 'id_document', 'crypto_wallet_statement', 'investment_statement', 'other');--> statement-breakpoint
CREATE TYPE "public"."kyc_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."llm_operation_type" AS ENUM('document_extraction', 'risk_scoring', 'report_generation');--> statement-breakpoint
CREATE TYPE "public"."loan_status" AS ENUM('pending_approval', 'approved', 'funded', 'active', 'repaid', 'defaulted', 'liquidated', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."onboarding_status" AS ENUM('pending', 'completed');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('on_chain', 'off_chain');--> statement-breakpoint
CREATE TYPE "public"."pool_status" AS ENUM('active', 'paused', 'closed');--> statement-breakpoint
CREATE TYPE "public"."pool_type" AS ENUM('risk_tiered', 'asset_backed', 'specialized');--> statement-breakpoint
CREATE TYPE "public"."processing_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('draft', 'pending_review', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."risk_tier" AS ENUM('AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'C', 'D');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."user_type" AS ENUM('borrower', 'lender');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('pending', 'verified', 'rejected');--> statement-breakpoint
CREATE TABLE "borrower_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"business_name" varchar(255),
	"borrower_type" "borrower_type" NOT NULL,
	"credit_score" integer,
	"total_assets_usd" numeric(20, 2),
	"total_liabilities_usd" numeric(20, 2),
	"monthly_income_usd" numeric(20, 2),
	"employment_status" varchar(100),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collateral_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"borrower_id" uuid NOT NULL,
	"submission_id" uuid NOT NULL,
	"asset_type" "asset_type" NOT NULL,
	"asset_description" text NOT NULL,
	"estimated_value_usd" numeric(20, 2) NOT NULL,
	"verification_status" "verification_status" DEFAULT 'pending' NOT NULL,
	"verification_source" varchar(255),
	"liquidation_value_usd" numeric(20, 2),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_extractions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"llm_provider" varchar(50) NOT NULL,
	"llm_model" varchar(100) NOT NULL,
	"extraction_timestamp" timestamp DEFAULT now() NOT NULL,
	"raw_llm_response" jsonb NOT NULL,
	"structured_data" jsonb NOT NULL,
	"confidence_score" numeric(3, 2),
	"tokens_used" integer,
	"extraction_cost_usd" numeric(10, 4)
);
--> statement-breakpoint
CREATE TABLE "document_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"borrower_id" uuid NOT NULL,
	"submission_reference" varchar(100) NOT NULL,
	"status" "submission_status" DEFAULT 'pending' NOT NULL,
	"total_documents" integer DEFAULT 0 NOT NULL,
	"processed_documents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	CONSTRAINT "document_submissions_submission_reference_unique" UNIQUE("submission_reference")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"document_type" "document_type" NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_size_bytes" bigint NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"s3_bucket" varchar(255) NOT NULL,
	"s3_key" varchar(512) NOT NULL,
	"s3_version_id" varchar(255),
	"upload_timestamp" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp,
	"processing_status" "processing_status" DEFAULT 'pending' NOT NULL,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "lending_pools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pool_name" varchar(255) NOT NULL,
	"pool_type" "pool_type" NOT NULL,
	"risk_tier" "risk_tier",
	"asset_class" varchar(100),
	"contract_address" varchar(255),
	"chain_id" varchar(50),
	"total_value_locked_usd" numeric(20, 2) DEFAULT '0' NOT NULL,
	"available_liquidity_usd" numeric(20, 2) DEFAULT '0' NOT NULL,
	"total_loans_active" integer DEFAULT 0 NOT NULL,
	"total_loans_value_usd" numeric(20, 2) DEFAULT '0' NOT NULL,
	"total_defaults_count" integer DEFAULT 0 NOT NULL,
	"total_defaults_value_usd" numeric(20, 2) DEFAULT '0' NOT NULL,
	"current_apy" numeric(5, 2),
	"historical_apy_30d" numeric(5, 2),
	"base_interest_rate" numeric(5, 2) NOT NULL,
	"protocol_fee_percentage" numeric(5, 2) DEFAULT '2.0' NOT NULL,
	"max_loan_size_usd" numeric(20, 2),
	"min_loan_size_usd" numeric(20, 2),
	"target_utilization_rate" numeric(5, 2) DEFAULT '0.8',
	"max_utilization_rate" numeric(5, 2) DEFAULT '0.95',
	"pool_status" "pool_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "llm_api_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_timestamp" timestamp DEFAULT now() NOT NULL,
	"provider" varchar(50) NOT NULL,
	"model" varchar(100) NOT NULL,
	"operation_type" "llm_operation_type" NOT NULL,
	"related_entity_type" varchar(50),
	"related_entity_id" uuid,
	"input_tokens" integer,
	"output_tokens" integer,
	"total_cost_usd" numeric(10, 4),
	"latency_ms" integer,
	"status" "api_status" NOT NULL,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "loan_repayments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" uuid NOT NULL,
	"payment_amount_usd" numeric(20, 2) NOT NULL,
	"principal_amount_usd" numeric(20, 2) NOT NULL,
	"interest_amount_usd" numeric(20, 2) NOT NULL,
	"late_fee_usd" numeric(20, 2) DEFAULT '0' NOT NULL,
	"payment_date" timestamp DEFAULT now() NOT NULL,
	"due_date" timestamp,
	"tx_hash" varchar(255) NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pool_id" uuid NOT NULL,
	"borrower_id" uuid NOT NULL,
	"underwriting_report_id" uuid NOT NULL,
	"principal_usd" numeric(20, 2) NOT NULL,
	"interest_rate" numeric(5, 2) NOT NULL,
	"loan_term_days" integer NOT NULL,
	"ltv_ratio" numeric(5, 2),
	"origination_fee_usd" numeric(20, 2),
	"total_repayment_amount_usd" numeric(20, 2) NOT NULL,
	"outstanding_balance_usd" numeric(20, 2) NOT NULL,
	"accrued_interest_usd" numeric(20, 2) DEFAULT '0' NOT NULL,
	"total_paid_usd" numeric(20, 2) DEFAULT '0' NOT NULL,
	"loan_contract_address" varchar(255),
	"funding_tx_hash" varchar(255),
	"borrower_wallet_address" varchar(255) NOT NULL,
	"application_date" timestamp DEFAULT now() NOT NULL,
	"approval_date" timestamp,
	"funded_date" timestamp,
	"maturity_date" timestamp,
	"last_payment_date" timestamp,
	"closed_date" timestamp,
	"status" "loan_status" DEFAULT 'pending_approval' NOT NULL,
	"default_date" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pool_deposits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pool_id" uuid NOT NULL,
	"lender_user_id" integer NOT NULL,
	"deposit_amount_usd" numeric(20, 2) NOT NULL,
	"lp_tokens_minted" numeric(20, 8) NOT NULL,
	"tx_hash" varchar(255) NOT NULL,
	"deposit_timestamp" timestamp DEFAULT now() NOT NULL,
	"wallet_address" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pool_performance_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pool_id" uuid NOT NULL,
	"snapshot_timestamp" timestamp DEFAULT now() NOT NULL,
	"tvl_usd" numeric(20, 2) NOT NULL,
	"apy" numeric(5, 2),
	"utilization_rate" numeric(5, 2),
	"default_rate" numeric(5, 2),
	"total_active_loans" integer NOT NULL,
	"total_lenders" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pool_withdrawals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pool_id" uuid NOT NULL,
	"lender_user_id" integer NOT NULL,
	"withdrawal_amount_usd" numeric(20, 2) NOT NULL,
	"lp_tokens_burned" numeric(20, 8) NOT NULL,
	"tx_hash" varchar(255) NOT NULL,
	"withdrawal_timestamp" timestamp DEFAULT now() NOT NULL,
	"wallet_address" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "underwriting_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"borrower_id" uuid NOT NULL,
	"report_version" integer DEFAULT 1 NOT NULL,
	"status" "report_status" DEFAULT 'draft' NOT NULL,
	"total_assets_usd" numeric(20, 2),
	"total_liabilities_usd" numeric(20, 2),
	"net_worth_usd" numeric(20, 2),
	"monthly_income_usd" numeric(20, 2),
	"monthly_expenses_usd" numeric(20, 2),
	"debt_to_income_ratio" numeric(5, 2),
	"collateral_score" numeric(5, 2),
	"probability_score" numeric(5, 2),
	"combined_risk_score" numeric(5, 2),
	"risk_tier" "risk_tier",
	"max_loan_amount_usd" numeric(20, 2),
	"recommended_ltv_ratio" numeric(5, 2),
	"recommended_interest_rate" numeric(5, 2),
	"recommended_loan_term_days" integer,
	"required_collateral_usd" numeric(20, 2),
	"report_data" jsonb,
	"flags" jsonb,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"approved_by" integer,
	"approved_at" timestamp,
	"report_s3_key" varchar(512)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet_address" varchar(255) NOT NULL,
	"email" varchar(255),
	"user_type" "user_type" DEFAULT 'borrower' NOT NULL,
	"onboarding_status" "onboarding_status" DEFAULT 'pending' NOT NULL,
	"onboarding_data" jsonb,
	"kyc_status" "kyc_status" DEFAULT 'pending' NOT NULL,
	"kyc_provider_id" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_wallet_address_unique" UNIQUE("wallet_address"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "borrower_profiles" ADD CONSTRAINT "borrower_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collateral_assets" ADD CONSTRAINT "collateral_assets_borrower_id_borrower_profiles_id_fk" FOREIGN KEY ("borrower_id") REFERENCES "public"."borrower_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collateral_assets" ADD CONSTRAINT "collateral_assets_submission_id_document_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."document_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_extractions" ADD CONSTRAINT "document_extractions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_submissions" ADD CONSTRAINT "document_submissions_borrower_id_borrower_profiles_id_fk" FOREIGN KEY ("borrower_id") REFERENCES "public"."borrower_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_submission_id_document_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."document_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_repayments" ADD CONSTRAINT "loan_repayments_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_pool_id_lending_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."lending_pools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_borrower_id_borrower_profiles_id_fk" FOREIGN KEY ("borrower_id") REFERENCES "public"."borrower_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_underwriting_report_id_underwriting_reports_id_fk" FOREIGN KEY ("underwriting_report_id") REFERENCES "public"."underwriting_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_deposits" ADD CONSTRAINT "pool_deposits_pool_id_lending_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."lending_pools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_deposits" ADD CONSTRAINT "pool_deposits_lender_user_id_users_id_fk" FOREIGN KEY ("lender_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_performance_snapshots" ADD CONSTRAINT "pool_performance_snapshots_pool_id_lending_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."lending_pools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_withdrawals" ADD CONSTRAINT "pool_withdrawals_pool_id_lending_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."lending_pools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_withdrawals" ADD CONSTRAINT "pool_withdrawals_lender_user_id_users_id_fk" FOREIGN KEY ("lender_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "underwriting_reports" ADD CONSTRAINT "underwriting_reports_submission_id_document_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."document_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "underwriting_reports" ADD CONSTRAINT "underwriting_reports_borrower_id_borrower_profiles_id_fk" FOREIGN KEY ("borrower_id") REFERENCES "public"."borrower_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "underwriting_reports" ADD CONSTRAINT "underwriting_reports_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;