CREATE TABLE "borrower_nfts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"borrower_id" uuid NOT NULL,
	"submission_id" uuid,
	"nft_name" varchar(255) NOT NULL,
	"nft_description" text,
	"portfolio_id" varchar(100),
	"principal_amount" numeric(20, 2),
	"no_of_loans" integer DEFAULT 1,
	"average_interest_rate" numeric(5, 2),
	"portfolio_term" varchar(50),
	"portfolio_status" varchar(50),
	"maturity_date" timestamp,
	"contract_object_id" varchar(255),
	"mint_tx_hash" varchar(255),
	"owner_address" varchar(255),
	"prob_of_default" numeric(5, 2),
	"loss_given_default" numeric(5, 2),
	"risk_score" integer,
	"exposure_at_default" numeric(20, 2),
	"underwritten" boolean DEFAULT false,
	"mint_status" varchar(50) DEFAULT 'pending' NOT NULL,
	"minted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lending_pools" ADD COLUMN "deployment_tx_hash" varchar(255);--> statement-breakpoint
ALTER TABLE "lending_pools" ADD COLUMN "borrower_id" uuid;--> statement-breakpoint
ALTER TABLE "lending_pools" ADD COLUMN "contract_pool_id" integer;--> statement-breakpoint
ALTER TABLE "lending_pools" ADD COLUMN "junior_ceiling" numeric(20, 2);--> statement-breakpoint
ALTER TABLE "lending_pools" ADD COLUMN "senior_ceiling" numeric(20, 2);--> statement-breakpoint
ALTER TABLE "lending_pools" ADD COLUMN "period_length_seconds" integer;--> statement-breakpoint
ALTER TABLE "lending_pools" ADD COLUMN "period_count" integer;--> statement-breakpoint
ALTER TABLE "lending_pools" ADD COLUMN "grace_period_seconds" integer;--> statement-breakpoint
ALTER TABLE "lending_pools" ADD COLUMN "late_fee_interest_per_second" numeric(30, 10);--> statement-breakpoint
ALTER TABLE "lending_pools" ADD COLUMN "is_bullet_repay" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "lending_pools" ADD COLUMN "performance_fee_bps" integer;--> statement-breakpoint
ALTER TABLE "lending_pools" ADD COLUMN "originator_fee_bps" integer;--> statement-breakpoint
ALTER TABLE "lending_pools" ADD COLUMN "p_start_from" integer;--> statement-breakpoint
ALTER TABLE "lending_pools" ADD COLUMN "p_repay_frequency" integer;--> statement-breakpoint
ALTER TABLE "lending_pools" ADD COLUMN "capital_formation_period" integer;--> statement-breakpoint
ALTER TABLE "lending_pools" ADD COLUMN "senior_interest_rate" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "lending_pools" ADD COLUMN "nft_id" varchar(255);--> statement-breakpoint
ALTER TABLE "lending_pools" ADD COLUMN "loan_id" varchar(255);--> statement-breakpoint
ALTER TABLE "lending_pools" ADD COLUMN "junior_pool_id" varchar(255);--> statement-breakpoint
ALTER TABLE "lending_pools" ADD COLUMN "senior_pool_id" varchar(255);--> statement-breakpoint
ALTER TABLE "lending_pools" ADD COLUMN "operator_id" varchar(255);--> statement-breakpoint
ALTER TABLE "borrower_nfts" ADD CONSTRAINT "borrower_nfts_borrower_id_borrower_profiles_id_fk" FOREIGN KEY ("borrower_id") REFERENCES "public"."borrower_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "borrower_nfts" ADD CONSTRAINT "borrower_nfts_submission_id_document_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."document_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lending_pools" ADD CONSTRAINT "lending_pools_borrower_id_borrower_profiles_id_fk" FOREIGN KEY ("borrower_id") REFERENCES "public"."borrower_profiles"("id") ON DELETE no action ON UPDATE no action;