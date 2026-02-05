# AI-Powered Underwriting System - Technical Specification

**Version:** 1.0  
**Date:** 2026-02-06  
**Status:** Draft

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [API Specification](#api-specification)
5. [LLM-Based Analysis Pipeline](#llm-based-analysis-pipeline)
6. [Smart Contract Design](#smart-contract-design)
7. [Security & Compliance](#security--compliance)
8. [Implementation Phases](#implementation-phases)

---

## 1. System Overview

### 1.1 Purpose
An AI-powered decentralized lending platform that:
- Allows borrowers to submit financial data for automated underwriting
- Uses LLMs to extract and analyze financial information
- Calculates lending capacity based on collateral value and default probability
- Creates liquidity pools where lenders can earn APY by funding loans

### 1.2 Key Features
- **Automated Document Processing**: LLM-based extraction from financial documents
- **Risk-Based Scoring**: Combined collateral analysis and probability scoring
- **Dynamic Pool Creation**: Algorithmic pool generation based on risk tiers
- **Real-time APY Calculation**: Interest distribution based on loan performance
- **On-chain Loan Management**: Smart contracts for trustless lending

### 1.3 Tech Stack
- **Backend**: Node.js/TypeScript (Hono framework)
- **Database**: PostgreSQL with Drizzle ORM
- **Storage**: S3-compatible object storage
- **LLM**: OpenAI GPT-4, Anthropic Claude, or local models
- **Blockchain**: Sui (Move language)
- **Document Processing**: PDF.js, Tesseract OCR
- **Queue**: BullMQ for async processing

---

## 2. Architecture

### 2.1 System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend Layer                          │
│  ┌──────────────────┐              ┌──────────────────┐        │
│  │  Borrower Portal │              │  Lender Portal   │        │
│  │  - Upload Docs   │              │  - Browse Pools  │        │
│  │  - View Reports  │              │  - Deposit Funds │        │
│  └──────────────────┘              └──────────────────┘        │
└────────────────────────┬────────────────────┬──────────────────┘
                         │                    │
                         ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                         API Gateway                              │
│                    (Hono REST + WebSocket)                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Document   │  │  Underwriting│  │  Pool & Loan │
│   Service    │  │   Service    │  │   Service    │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  S3 Storage  │  │ LLM Pipeline │  │ Sui Contracts│
│  - Raw Docs  │  │ - Extraction │  │ - Pools      │
│  - Reports   │  │ - Scoring    │  │ - Loans      │
└──────────────┘  └──────────────┘  └──────────────┘
       │                 │                 │
       └────────┬────────┴────────┬────────┘
                ▼                 ▼
        ┌──────────────┐  ┌──────────────┐
        │  PostgreSQL  │  │   BullMQ     │
        │   Database   │  │  Job Queue   │
        └──────────────┘  └──────────────┘
```

### 2.2 Data Flow

**Borrower Submission Flow:**
```
1. Borrower uploads documents → S3 bucket
2. Document metadata saved → PostgreSQL
3. Processing job queued → BullMQ
4. Worker extracts documents → LLM API
5. Structured data extracted → Database
6. Risk scoring triggered → LLM + Algorithm
7. Underwriting report generated → S3 + Database
8. Pool matching algorithm runs → Assigns to pool
9. Borrower notified → Frontend update
```

**Loan Funding Flow:**
```
1. Lender selects pool → Frontend
2. Deposit transaction → Sui smart contract
3. Pool LP tokens minted → Lender wallet
4. TVL updated → Smart contract event
5. Backend syncs state → Database
6. Available liquidity calculated → Pool service
7. Eligible loans funded → Smart contract
8. Borrower receives funds → Wallet
```

---

## 3. Database Schema

### 3.1 Core Tables

```typescript
// users table
- id: uuid (PK)
- wallet_address: string (unique, indexed)
- email: string (nullable, unique)
- user_type: enum ('borrower', 'lender', 'both')
- kyc_status: enum ('pending', 'approved', 'rejected')
- kyc_provider_id: string (nullable)
- created_at: timestamp
- updated_at: timestamp

// borrower_profiles table
- id: uuid (PK)
- user_id: uuid (FK → users.id)
- full_name: string
- business_name: string (nullable)
- borrower_type: enum ('individual', 'business')
- credit_score: integer (nullable)
- total_assets_usd: decimal (nullable)
- total_liabilities_usd: decimal (nullable)
- monthly_income_usd: decimal (nullable)
- employment_status: string (nullable)
- metadata: jsonb
- created_at: timestamp
- updated_at: timestamp

// document_submissions table
- id: uuid (PK)
- borrower_id: uuid (FK → borrower_profiles.id)
- submission_reference: string (unique, indexed)
- status: enum ('pending', 'processing', 'completed', 'failed')
- total_documents: integer
- processed_documents: integer
- created_at: timestamp
- updated_at: timestamp
- completed_at: timestamp (nullable)

// documents table
- id: uuid (PK)
- submission_id: uuid (FK → document_submissions.id)
- document_type: enum ('bank_statement', 'tax_return', 'pay_stub', 
                       'property_deed', 'vehicle_title', 'business_financials',
                       'id_document', 'other')
- file_name: string
- file_size_bytes: bigint
- mime_type: string
- s3_bucket: string
- s3_key: string
- s3_version_id: string (nullable)
- upload_timestamp: timestamp
- processed_at: timestamp (nullable)
- processing_status: enum ('pending', 'processing', 'completed', 'failed')
- error_message: text (nullable)

// document_extractions table
- id: uuid (PK)
- document_id: uuid (FK → documents.id)
- llm_provider: string (e.g., 'openai-gpt4', 'anthropic-claude')
- llm_model: string
- extraction_timestamp: timestamp
- raw_llm_response: jsonb
- structured_data: jsonb
- confidence_score: decimal (0-1)
- tokens_used: integer
- extraction_cost_usd: decimal (nullable)

// underwriting_reports table
- id: uuid (PK)
- submission_id: uuid (FK → document_submissions.id)
- borrower_id: uuid (FK → borrower_profiles.id)
- report_version: integer (default 1)
- status: enum ('draft', 'pending_review', 'approved', 'rejected')

// Financial Metrics
- total_assets_usd: decimal
- total_liabilities_usd: decimal
- net_worth_usd: decimal
- monthly_income_usd: decimal
- monthly_expenses_usd: decimal
- debt_to_income_ratio: decimal

// Risk Scoring
- collateral_score: decimal (0-100)
- probability_score: decimal (0-100)
- combined_risk_score: decimal (0-100)
- risk_tier: enum ('AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'C', 'D')

// Lending Terms
- max_loan_amount_usd: decimal
- recommended_ltv_ratio: decimal
- recommended_interest_rate: decimal
- recommended_loan_term_days: integer
- required_collateral_usd: decimal

// Metadata
- report_data: jsonb (full LLM analysis)
- flags: jsonb (warnings, edge cases)
- generated_at: timestamp
- approved_by: uuid (FK → users.id, nullable)
- approved_at: timestamp (nullable)
- report_s3_key: string (nullable, PDF report)

// collateral_assets table
- id: uuid (PK)
- borrower_id: uuid (FK → borrower_profiles.id)
- submission_id: uuid (FK → document_submissions.id)
- asset_type: enum ('real_estate', 'vehicle', 'crypto', 'securities', 
                     'equipment', 'inventory', 'other')
- asset_description: string
- estimated_value_usd: decimal
- verification_status: enum ('pending', 'verified', 'rejected')
- verification_source: string (nullable)
- liquidation_value_usd: decimal (conservative estimate)
- metadata: jsonb (specific details per asset type)
- created_at: timestamp
- updated_at: timestamp

// lending_pools table
- id: uuid (PK)
- pool_name: string
- pool_type: enum ('risk_tiered', 'asset_backed', 'specialized')
- risk_tier: enum ('AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'C', 'D') (nullable)
- asset_class: string (nullable, for asset-backed pools)

// On-chain Data
- contract_address: string (Sui object ID)
- chain_id: string (e.g., 'sui-mainnet')

// Pool Metrics
- total_value_locked_usd: decimal
- available_liquidity_usd: decimal
- total_loans_active: integer
- total_loans_value_usd: decimal
- total_defaults_count: integer
- total_defaults_value_usd: decimal

// Returns
- current_apy: decimal
- historical_apy_30d: decimal (nullable)
- base_interest_rate: decimal
- protocol_fee_percentage: decimal

// Risk Parameters
- max_loan_size_usd: decimal (nullable)
- min_loan_size_usd: decimal (nullable)
- target_utilization_rate: decimal (0-1)
- max_utilization_rate: decimal (0-1)

// Status
- pool_status: enum ('active', 'paused', 'closed')
- created_at: timestamp
- updated_at: timestamp

// loans table
- id: uuid (PK)
- pool_id: uuid (FK → lending_pools.id)
- borrower_id: uuid (FK → borrower_profiles.id)
- underwriting_report_id: uuid (FK → underwriting_reports.id)

// Loan Terms
- principal_usd: decimal
- interest_rate: decimal
- loan_term_days: integer
- ltv_ratio: decimal
- origination_fee_usd: decimal

// Amounts
- total_repayment_amount_usd: decimal
- outstanding_balance_usd: decimal
- accrued_interest_usd: decimal
- total_paid_usd: decimal

// On-chain
- loan_contract_address: string (Sui object ID)
- funding_tx_hash: string (nullable)
- borrower_wallet_address: string

// Dates
- application_date: timestamp
- approval_date: timestamp (nullable)
- funded_date: timestamp (nullable)
- maturity_date: timestamp (nullable)
- last_payment_date: timestamp (nullable)
- closed_date: timestamp (nullable)

// Status
- status: enum ('pending_approval', 'approved', 'funded', 'active', 
                'repaid', 'defaulted', 'liquidated', 'cancelled')
- default_date: timestamp (nullable)

// Metadata
- metadata: jsonb
- created_at: timestamp
- updated_at: timestamp

// loan_repayments table
- id: uuid (PK)
- loan_id: uuid (FK → loans.id)
- payment_amount_usd: decimal
- principal_amount_usd: decimal
- interest_amount_usd: decimal
- late_fee_usd: decimal (default 0)
- payment_date: timestamp
- due_date: timestamp (nullable)
- tx_hash: string
- payment_method: enum ('on_chain', 'off_chain')
- created_at: timestamp

// pool_deposits table
- id: uuid (PK)
- pool_id: uuid (FK → lending_pools.id)
- lender_user_id: uuid (FK → users.id)
- deposit_amount_usd: decimal
- lp_tokens_minted: decimal
- tx_hash: string
- deposit_timestamp: timestamp
- wallet_address: string

// pool_withdrawals table
- id: uuid (PK)
- pool_id: uuid (FK → lending_pools.id)
- lender_user_id: uuid (FK → users.id)
- withdrawal_amount_usd: decimal
- lp_tokens_burned: decimal
- tx_hash: string
- withdrawal_timestamp: timestamp
- wallet_address: string

// pool_performance_snapshots table
- id: uuid (PK)
- pool_id: uuid (FK → lending_pools.id)
- snapshot_timestamp: timestamp
- tvl_usd: decimal
- apy: decimal
- utilization_rate: decimal
- default_rate: decimal
- total_active_loans: integer
- total_lenders: integer
- created_at: timestamp

// llm_api_logs table (for monitoring and cost tracking)
- id: uuid (PK)
- request_timestamp: timestamp
- provider: string
- model: string
- operation_type: enum ('document_extraction', 'risk_scoring', 'report_generation')
- related_entity_type: string (e.g., 'document', 'submission')
- related_entity_id: uuid
- input_tokens: integer
- output_tokens: integer
- total_cost_usd: decimal
- latency_ms: integer
- status: enum ('success', 'error')
- error_message: text (nullable)
```

### 3.2 Indexes

```sql
-- Performance indexes
CREATE INDEX idx_users_wallet ON users(wallet_address);
CREATE INDEX idx_documents_submission ON documents(submission_id);
CREATE INDEX idx_documents_status ON documents(processing_status);
CREATE INDEX idx_submissions_status ON document_submissions(status);
CREATE INDEX idx_loans_borrower ON loans(borrower_id);
CREATE INDEX idx_loans_pool ON loans(pool_id);
CREATE INDEX idx_loans_status ON loans(status);
CREATE INDEX idx_extractions_document ON document_extractions(document_id);
CREATE INDEX idx_collateral_borrower ON collateral_assets(borrower_id);
CREATE INDEX idx_repayments_loan ON loan_repayments(loan_id);
CREATE INDEX idx_deposits_pool_lender ON pool_deposits(pool_id, lender_user_id);
```

---

## 4. API Specification

### 4.1 Authentication
All endpoints require JWT authentication via Sui wallet signature.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

### 4.2 Borrower Endpoints

#### POST `/api/borrower/submit`
Create a new document submission.

**Request:**
```json
{
  "borrowerType": "individual" | "business",
  "fullName": "string",
  "businessName": "string | null",
  "email": "string",
  "metadata": {}
}
```

**Response:**
```json
{
  "submissionId": "uuid",
  "submissionReference": "string",
  "uploadUrls": [
    {
      "documentType": "bank_statement",
      "uploadUrl": "https://s3.../presigned-url",
      "expiresAt": "timestamp"
    }
  ],
  "status": "pending"
}
```

#### POST `/api/borrower/upload-document`
Upload a document to a submission.

**Request (multipart/form-data):**
```
submissionId: uuid
documentType: enum
file: binary
```

**Response:**
```json
{
  "documentId": "uuid",
  "fileName": "string",
  "fileSize": number,
  "status": "pending",
  "submissionId": "uuid"
}
```

#### POST `/api/borrower/finalize-submission`
Finalize submission and trigger processing.

**Request:**
```json
{
  "submissionId": "uuid"
}
```

**Response:**
```json
{
  "submissionId": "uuid",
  "status": "processing",
  "estimatedCompletionTime": "timestamp"
}
```

#### GET `/api/borrower/submission/:submissionId`
Get submission status and progress.

**Response:**
```json
{
  "submissionId": "uuid",
  "status": "processing" | "completed" | "failed",
  "progress": {
    "totalDocuments": number,
    "processedDocuments": number,
    "percentage": number
  },
  "documents": [
    {
      "documentId": "uuid",
      "documentType": "string",
      "fileName": "string",
      "processingStatus": "string",
      "errorMessage": "string | null"
    }
  ]
}
```

#### GET `/api/borrower/report/:submissionId`
Get underwriting report.

**Response:**
```json
{
  "reportId": "uuid",
  "submissionId": "uuid",
  "status": "approved" | "rejected" | "pending_review",
  "generatedAt": "timestamp",
  
  "financialSummary": {
    "totalAssets": number,
    "totalLiabilities": number,
    "netWorth": number,
    "monthlyIncome": number,
    "monthlyExpenses": number,
    "debtToIncomeRatio": number
  },
  
  "riskAssessment": {
    "collateralScore": number,
    "probabilityScore": number,
    "combinedRiskScore": number,
    "riskTier": "AAA" | "AA" | "A" | "BBB" | "BB" | "B" | "C" | "D"
  },
  
  "lendingTerms": {
    "maxLoanAmount": number,
    "recommendedLTV": number,
    "recommendedInterestRate": number,
    "recommendedLoanTermDays": number,
    "requiredCollateral": number
  },
  
  "collateralAssets": [
    {
      "assetType": "string",
      "description": "string",
      "estimatedValue": number,
      "liquidationValue": number,
      "verificationStatus": "string"
    }
  ],
  
  "reportPdfUrl": "string | null",
  "flags": []
}
```

#### POST `/api/borrower/apply-loan`
Apply for a loan based on underwriting report.

**Request:**
```json
{
  "reportId": "uuid",
  "requestedAmount": number,
  "requestedTermDays": number,
  "collateralAssetIds": ["uuid"],
  "walletAddress": "string"
}
```

**Response:**
```json
{
  "loanId": "uuid",
  "poolId": "uuid",
  "poolName": "string",
  "status": "pending_approval",
  "loanTerms": {
    "principal": number,
    "interestRate": number,
    "termDays": number,
    "originationFee": number,
    "totalRepayment": number
  }
}
```

### 4.3 Lender Endpoints

#### GET `/api/pools`
List all available lending pools.

**Query Parameters:**
- `riskTier`: string (optional)
- `minApy`: number (optional)
- `maxApy`: number (optional)
- `assetClass`: string (optional)

**Response:**
```json
{
  "pools": [
    {
      "poolId": "uuid",
      "poolName": "string",
      "poolType": "string",
      "riskTier": "string",
      "contractAddress": "string",
      
      "metrics": {
        "tvl": number,
        "availableLiquidity": number,
        "currentApy": number,
        "historicalApy30d": number,
        "utilizationRate": number,
        "defaultRate": number,
        "totalActiveLoans": number
      },
      
      "parameters": {
        "baseInterestRate": number,
        "protocolFee": number,
        "minLoanSize": number,
        "maxLoanSize": number
      }
    }
  ]
}
```

#### GET `/api/pools/:poolId`
Get detailed pool information.

**Response:**
```json
{
  "pool": {
    // ... same as above
  },
  "recentLoans": [
    {
      "loanId": "uuid",
      "amount": number,
      "interestRate": number,
      "termDays": number,
      "riskTier": "string",
      "fundedDate": "timestamp"
    }
  ],
  "performanceHistory": [
    {
      "date": "timestamp",
      "apy": number,
      "tvl": number,
      "utilizationRate": number
    }
  ]
}
```

#### POST `/api/pools/:poolId/deposit`
Get deposit transaction data (to be signed by user).

**Request:**
```json
{
  "amount": number,
  "walletAddress": "string"
}
```

**Response:**
```json
{
  "transactionData": {
    "contractAddress": "string",
    "function": "string",
    "args": [],
    "gasEstimate": number
  },
  "expectedLpTokens": number
}
```

#### POST `/api/pools/:poolId/withdraw`
Get withdrawal transaction data.

**Request:**
```json
{
  "lpTokens": number,
  "walletAddress": "string"
}
```

**Response:**
```json
{
  "transactionData": {
    // Sui transaction data
  },
  "expectedAmount": number,
  "availableLiquidity": number
}
```

#### GET `/api/lender/positions`
Get lender's positions across all pools.

**Response:**
```json
{
  "positions": [
    {
      "poolId": "uuid",
      "poolName": "string",
      "depositedAmount": number,
      "lpTokensOwned": number,
      "currentValue": number,
      "earnedInterest": number,
      "apy": number,
      "depositDate": "timestamp"
    }
  ],
  "totalValue": number,
  "totalEarnings": number
}
```

### 4.4 Admin Endpoints

#### GET `/api/admin/submissions/pending`
List submissions pending review.

#### POST `/api/admin/report/:reportId/approve`
Approve an underwriting report.

#### POST `/api/admin/report/:reportId/reject`
Reject an underwriting report.

#### GET `/api/admin/analytics`
System-wide analytics.

---

## 5. LLM-Based Analysis Pipeline

### 5.1 Document Extraction

**Objective:** Extract structured financial data from unstructured documents.

**Process:**

1. **Document Pre-processing**
   - Convert PDF to text/images
   - OCR for scanned documents
   - Clean and normalize text

2. **LLM Extraction Prompt**

```typescript
const EXTRACTION_PROMPT = `
You are a financial document analyzer. Extract structured data from the following document.

Document Type: {documentType}
Document Text:
{documentText}

Extract the following information in JSON format:
{
  "documentType": "string",
  "documentDate": "ISO date string or null",
  "accountHolder": "string or null",
  "financialInstitution": "string or null",
  
  // For bank statements
  "transactions": [
    {
      "date": "ISO date",
      "description": "string",
      "amount": number,
      "balance": number
    }
  ],
  "accountBalance": number,
  "averageMonthlyIncome": number,
  "averageMonthlyExpenses": number,
  
  // For asset documents
  "assetType": "string",
  "assetValue": number,
  "assetOwner": "string",
  "assetDescription": "string",
  
  // For business financials
  "revenue": number,
  "expenses": number,
  "netIncome": number,
  "assets": number,
  "liabilities": number,
  
  // Confidence and metadata
  "confidence": number (0-1),
  "warnings": ["string"],
  "needsHumanReview": boolean
}

Important:
- Return ONLY valid JSON
- Use null for missing values
- Be conservative with estimates
- Flag ambiguous data in warnings
`;
```

3. **Validation & Storage**
   - Validate JSON structure
   - Store in `document_extractions` table
   - Log LLM usage and costs

**Implementation:**

```typescript
interface DocumentExtractionService {
  async extractDocument(
    documentId: string,
    documentType: DocumentType,
    documentContent: Buffer
  ): Promise<ExtractionResult>;
}

interface ExtractionResult {
  structuredData: FinancialData;
  confidence: number;
  warnings: string[];
  needsHumanReview: boolean;
  tokensUsed: number;
  cost: number;
}
```

### 5.2 Risk Scoring Algorithm

**Scoring Formula:**
```
Combined Risk Score = (Collateral Score × 0.4) + (Probability Score × 0.6)
```

#### 5.2.1 Collateral Score (0-100)

**Factors:**
- Total collateral value vs loan amount
- Collateral liquidity (how easily it can be sold)
- Collateral volatility/stability
- Verification status

**Algorithm:**

```typescript
function calculateCollateralScore(
  collateralAssets: CollateralAsset[],
  requestedLoanAmount: number
): number {
  const totalCollateralValue = collateralAssets.reduce(
    (sum, asset) => sum + asset.liquidationValue, 0
  );
  
  const ltvRatio = requestedLoanAmount / totalCollateralValue;
  
  // LTV Score (lower is better)
  let ltvScore = 0;
  if (ltvRatio <= 0.5) ltvScore = 100;
  else if (ltvRatio <= 0.6) ltvScore = 90;
  else if (ltvRatio <= 0.7) ltvScore = 75;
  else if (ltvRatio <= 0.8) ltvScore = 50;
  else if (ltvRatio <= 0.9) ltvScore = 25;
  else ltvScore = 10;
  
  // Liquidity Score
  const liquidityScore = collateralAssets.reduce((score, asset) => {
    const weights = {
      'crypto': 95,
      'securities': 85,
      'real_estate': 60,
      'vehicle': 70,
      'equipment': 50,
      'inventory': 40
    };
    return score + (weights[asset.assetType] || 50);
  }, 0) / collateralAssets.length;
  
  // Verification Score
  const verificationScore = collateralAssets.filter(
    a => a.verificationStatus === 'verified'
  ).length / collateralAssets.length * 100;
  
  // Weighted average
  return (
    ltvScore * 0.5 +
    liquidityScore * 0.3 +
    verificationScore * 0.2
  );
}
```

#### 5.2.2 Probability Score (0-100)

**Factors:**
- Debt-to-income ratio
- Cash flow stability
- Credit history (if available)
- Employment/business stability
- LLM-based qualitative assessment

**LLM Probability Assessment Prompt:**

```typescript
const PROBABILITY_PROMPT = `
You are a credit risk analyst. Analyze the borrower's financial profile and assess their probability of default.

Borrower Profile:
${JSON.stringify(borrowerData, null, 2)}

Financial Data Extracted:
${JSON.stringify(extractedData, null, 2)}

Analyze the following factors:
1. Income Stability: Is income consistent and verifiable?
2. Expense Management: Are expenses reasonable relative to income?
3. Debt Burden: Is existing debt manageable?
4. Asset Quality: Are assets real and properly valued?
5. Red Flags: Any signs of fraud, financial distress, or inconsistencies?

Provide a risk assessment in JSON format:
{
  "incomeStabilityScore": number (0-100),
  "expenseRatioScore": number (0-100),
  "debtManagementScore": number (0-100),
  "assetQualityScore": number (0-100),
  "overallProbabilityScore": number (0-100),
  
  "defaultProbability": number (0-1),
  "confidenceLevel": "high" | "medium" | "low",
  
  "strengths": ["string"],
  "weaknesses": ["string"],
  "redFlags": ["string"],
  
  "recommendation": {
    "decision": "approve" | "reject" | "review",
    "maxLoanAmount": number,
    "reasoning": "string"
  }
}

Scoring Guide:
- 90-100: Excellent (very low default risk)
- 75-89: Good (low default risk)
- 60-74: Fair (moderate default risk)
- 40-59: Poor (high default risk)
- 0-39: Very Poor (very high default risk)
`;
```

**Implementation:**

```typescript
async function calculateProbabilityScore(
  borrowerProfile: BorrowerProfile,
  extractedData: FinancialData[]
): Promise<ProbabilityAssessment> {
  // Quantitative metrics
  const debtToIncomeRatio = calculateDebtToIncomeRatio(borrowerProfile);
  const cashFlowStability = calculateCashFlowStability(extractedData);
  
  // LLM qualitative assessment
  const llmAssessment = await callLLM({
    prompt: PROBABILITY_PROMPT,
    data: { borrowerProfile, extractedData }
  });
  
  // Combine quantitative and qualitative
  return {
    probabilityScore: llmAssessment.overallProbabilityScore,
    defaultProbability: llmAssessment.defaultProbability,
    assessment: llmAssessment
  };
}
```

### 5.3 Underwriting Report Generation

**Final Report Structure:**

```typescript
interface UnderwritingReport {
  // Executive Summary
  decision: 'approve' | 'reject' | 'review';
  riskTier: RiskTier;
  maxLoanAmount: number;
  recommendedTerms: LoanTerms;
  
  // Detailed Analysis
  financialSummary: FinancialSummary;
  collateralAnalysis: CollateralAnalysis;
  riskAssessment: RiskAssessment;
  
  // Scores
  collateralScore: number;
  probabilityScore: number;
  combinedRiskScore: number;
  
  // Supporting Data
  extractedDocuments: DocumentSummary[];
  llmAnalysis: LLMAnalysis;
  flags: string[];
  
  // Metadata
  generatedAt: Date;
  version: number;
}
```

**Report Generation Process:**

1. Aggregate all extracted data
2. Calculate collateral score
3. Calculate probability score
4. Combine scores with weighted formula
5. Determine risk tier based on combined score:
   - 90-100: AAA
   - 85-89: AA
   - 80-84: A
   - 75-79: BBB
   - 70-74: BB
   - 60-69: B
   - 50-59: C
   - <50: D (likely rejection)
6. Generate lending recommendations
7. Create human-readable PDF report
8. Store in database and S3

---

## 6. Smart Contract Design (Sui/Move)

### 6.1 Core Contracts

#### 6.1.1 LendingPool Object

```move
struct LendingPool has key {
  id: UID,
  pool_name: String,
  pool_type: String,
  risk_tier: String,
  
  // Balances
  total_deposits: Balance<USDC>,
  available_liquidity: Balance<USDC>,
  
  // LP Token
  lp_token_supply: Supply<PoolLPToken>,
  
  // Parameters
  base_interest_rate: u64, // basis points
  protocol_fee: u64, // basis points
  max_utilization_rate: u64,
  
  // Metrics
  total_loans_count: u64,
  total_defaults_count: u64,
  total_interest_earned: u64,
  
  // Admin
  admin: address,
  paused: bool
}

struct PoolLPToken has key, store {
  id: UID,
  pool_id: ID,
  amount: u64
}
```

#### 6.1.2 Loan Object

```move
struct Loan has key {
  id: UID,
  pool_id: ID,
  borrower: address,
  
  // Terms
  principal: u64,
  interest_rate: u64,
  term_days: u64,
  origination_fee: u64,
  
  // Amounts
  outstanding_balance: u64,
  total_paid: u64,
  
  // Dates (timestamps)
  funded_at: u64,
  maturity_at: u64,
  last_payment_at: Option<u64>,
  
  // Status
  status: u8, // 0: Active, 1: Repaid, 2: Defaulted
  
  // Collateral (if on-chain)
  collateral_locked: bool
}
```

#### 6.1.3 Key Functions

```move
// Deposit funds to pool
public entry fun deposit(
  pool: &mut LendingPool,
  payment: Coin<USDC>,
  ctx: &mut TxContext
): PoolLPToken

// Withdraw funds from pool
public entry fun withdraw(
  pool: &mut LendingPool,
  lp_token: PoolLPToken,
  ctx: &mut TxContext
): Coin<USDC>

// Fund a loan (admin/automated)
public entry fun fund_loan(
  pool: &mut LendingPool,
  loan: &mut Loan,
  borrower: address,
  amount: u64,
  ctx: &mut TxContext
)

// Make loan repayment
public entry fun repay_loan(
  pool: &mut LendingPool,
  loan: &mut Loan,
  payment: Coin<USDC>,
  ctx: &mut TxContext
)

// Calculate current APY
public fun calculate_apy(pool: &LendingPool): u64

// Check pool health
public fun check_pool_health(pool: &LendingPool): PoolHealth
```

### 6.2 Interest Accrual

Interest accrues per block/second:

```move
fun calculate_accrued_interest(
  principal: u64,
  interest_rate: u64, // annual rate in basis points
  seconds_elapsed: u64
): u64 {
  // Simple interest: P * r * t / (365 * 86400)
  let annual_interest = (principal * interest_rate) / 10000;
  (annual_interest * seconds_elapsed) / (365 * 86400)
}
```

### 6.3 Liquidation Logic

```move
public entry fun liquidate_loan(
  pool: &mut LendingPool,
  loan: &mut Loan,
  liquidator: address,
  ctx: &mut TxContext
) {
  // Check if loan is defaulted
  assert!(is_defaulted(loan), E_NOT_DEFAULTED);
  
  // Transfer collateral to liquidator (if on-chain)
  // Or trigger off-chain liquidation process
  
  // Update pool metrics
  pool.total_defaults_count = pool.total_defaults_count + 1;
  
  // Mark loan as liquidated
  loan.status = STATUS_DEFAULTED;
}
```

---

## 7. Security & Compliance

### 7.1 Security Measures

**Data Security:**
- S3 bucket encryption (AES-256)
- Database encryption at rest
- TLS 1.3 for all API communications
- JWT with short expiration (15 min) + refresh tokens
- Rate limiting on all endpoints
- Input validation and sanitization
- SQL injection prevention (parameterized queries)

**Smart Contract Security:**
- Formal verification where possible
- Multi-sig for admin functions
- Pausable contracts
- Reentrancy guards
- Integer overflow protection

**LLM Security:**
- Prompt injection prevention
- Output validation
- Cost limits per request
- PII redaction in logs

### 7.2 Compliance

**KYC/AML:**
- Integration with KYC providers (Persona, Onfido, Sumsub)
- Document verification
- Sanctions screening
- Transaction monitoring

**Data Privacy:**
- GDPR compliance (data deletion, portability)
- User consent for data processing
- Anonymization for analytics
- Data retention policies

**Regulatory:**
- Disclaimer: Not financial advice
- Terms of service and privacy policy
- Risk disclosures for lenders
- Borrower agreements

---

## 8. Implementation Phases

###  Phase 1: Foundation (Weeks 1-2)
**Goal:** Set up infrastructure and core database

- [x] Database schema design
- [ ] Drizzle ORM setup with migrations
- [ ] S3 bucket configuration
- [ ] Basic API structure (Hono routes)
- [ ] Authentication system (Sui wallet)
- [ ] BullMQ job queue setup

**Deliverables:**
- Working database with all tables
- API boilerplate with auth
- Document upload endpoint
- Basic admin dashboard

### Phase 2: Document Processing (Weeks 3-4)
**Goal:** Implement LLM-based extraction pipeline

- [ ] Document upload and storage
- [ ] OCR integration (Tesseract)
- [ ] LLM extraction service
- [ ] Extraction job workers
- [ ] Data validation and storage
- [ ] Progress tracking

**Deliverables:**
- End-to-end document processing
- Extracted data viewable in database
- Error handling and retry logic

### Phase 3: Risk Scoring (Weeks 5-6)
**Goal:** Build underwriting intelligence

- [ ] Collateral scoring algorithm
- [ ] LLM probability assessment
- [ ] Combined risk scoring
- [ ] Risk tier assignment
- [ ] Lending terms calculation
- [ ] Report generation (JSON + PDF)

**Deliverables:**
- Complete underwriting reports
- Automated loan recommendations
- Admin review interface

### Phase 4: Smart Contracts (Weeks 7-8)
**Goal:** Deploy lending protocol on Sui

- [ ] LendingPool contract
- [ ] Loan contract
- [ ] LP token implementation
- [ ] Interest calculation
- [ ] Repayment logic
- [ ] Contract testing (Move unit tests)

**Deliverables:**
- Deployed contracts on Sui testnet
- Contract interaction from backend
- Transaction monitoring

### Phase 5: Pool & Loan Management (Weeks 9-10)
**Goal:** Connect underwriting to funding

- [ ] Pool creation logic
- [ ] Loan funding automation
- [ ] Borrower loan application flow
- [ ] Lender deposit/withdrawal
- [ ] Position tracking
- [ ] Interest distribution

**Deliverables:**
- Full borrower → loan flow
- Full lender → earnings flow
- Real-time APY calculations

### Phase 6: Frontend (Weeks 11-12)
**Goal:** User interfaces

- [ ] Borrower portal (upload, view reports, apply)
- [ ] Lender portal (browse pools, deposit, withdraw)
- [ ] Admin dashboard (review, approve, analytics)
- [ ] Real-time notifications
- [ ] Transaction history

**Deliverables:**
- Production-ready web app
- Mobile-responsive design
- WebSocket updates

### Phase 7: Testing & Launch (Weeks 13-14)
**Goal:** Production readiness

- [ ] End-to-end testing
- [ ] Security audit
- [ ] Load testing
- [ ] Bug fixes
- [ ] Documentation
- [ ] Mainnet deployment

**Deliverables:**
- Production deployment
- User documentation
- API documentation
- Monitoring and alerting

---

## 9. Cost Estimates

### LLM Costs (per borrower submission)
- Document extraction: ~$1-3 per document (5-10 docs avg)
- Risk assessment: ~$0.50-1 per analysis
- Report generation: ~$0.25-0.50
- **Total per borrower:** ~$8-15

### Infrastructure (monthly, estimate)
- Database (PostgreSQL): $50-200
- S3 storage: $20-100
- Compute (API servers): $100-500
- Queue/workers: $50-200
- **Total monthly:** ~$220-1000 (depending on scale)

---

## 10. Monitoring & Observability

### Metrics to Track
- **System Health:** API response times, error rates, queue depth
- **LLM Performance:** Extraction accuracy, cost per operation
- **Financial Metrics:** TVL, active loans, default rate, APY
- **User Metrics:** Submissions per day, approval rate, time to funding

### Tools
- Application: Datadog, New Relic, or self-hosted Grafana
- Error tracking: Sentry
- Logging: Winston + CloudWatch/Loki
- Smart contract: Sui explorer + custom indexers

---

## 11. Open Questions & Decisions Needed

1. **LLM Provider:** OpenAI GPT-4, Anthropic Claude, or self-hosted?
2. **KYC Integration:** Which provider? (Persona recommended)
3. **Collateral Verification:** Manual review or automated APIs?
4. **Default Handling:** Insurance fund? First-loss capital? Lender assumes all risk?
5. **Loan Origination:** Automated or requires admin approval?
6. **Interest Model:** Fixed rate or variable based on utilization?
7. **Pool Management:** Algorithmic or human-managed pools?
8. **Regulatory Strategy:** Which jurisdictions to target/avoid?

---

## Appendix A: Technology Choices Rationale

**TypeScript/Node.js:**
- Existing codebase compatibility
- Rich ecosystem for API development
- Good LLM SDK support

**PostgreSQL + Drizzle:**
- JSONB for flexible data structures
- Strong ACID guarantees
- Type-safe queries

**Sui Blockchain:**
- High throughput for financial transactions
- Object-centric model for loan/pool management
- Lower gas fees than Ethereum

**BullMQ:**
- Reliable job processing
- Retry logic and error handling
- Good monitoring tools

---

## Next Steps

1. Review and approve this spec
2. Set up development environment
3. Begin Phase 1: Database & API foundation
4. Weekly progress reviews

**Document Version:** 1.0  
**Last Updated:** 2026-02-06  
**Status:** Pending Review
