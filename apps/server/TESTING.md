# Testing Guide

## Prerequisites

1. **Install Dependencies**
   ```bash
   bun install
   ```

2. **Set Up Database**
   ```bash
   # Make sure PostgreSQL is running
   # Update DATABASE_URL in .env
   
   # Generate migrations
   bun run db:generate
   
   # Run migrations
   bun run db:migrate
   ```

3. **Configure Services**
   Update `.env` with actual credentials:
   - `OPENAI_API_KEY` - Your OpenAI API key
   - `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` - AWS credentials
   - `S3_BUCKET_NAME` - Your S3 bucket name
   - `JWT_SECRET` - Generate a secure random string (min 32 chars)

## Start the Server

```bash
bun run dev
```

Server will start on `http://localhost:3000`

## Test Endpoints

### 1. Health Check
```bash
curl http://localhost:3000/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "database": "connected",
  "s3": "connected",
  "llm": "connected",
  "timestamp": "2026-02-06T..."
}
```

### 2. Create Borrower Submission

```bash
curl -X POST http://localhost:3000/api/borrower/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token" \
  -d '{
    "borrowerType": "individual",
    "fullName": "John Doe",
    "email": "john@example.com"
  }'
```

**Expected Response:**
```json
{
  "submissionId": "uuid",
  "submissionReference": "SUB-XXXXXXXXXX",
  "uploadUrls": [
    {
      "documentType": "bank_statement",
      "uploadUrl": "https://...",
      "expiresAt": "..."
    }
  ],
  "status": "pending"
}
```

### 3. Upload Document

```bash
# Use the presigned URL from step 2 to upload a document
curl -X PUT "<presigned-url>" \
  -H "Content-Type: application/pdf" \
  --data-binary "@path/to/document.pdf"

# Then record the upload in the database
curl -X POST http://localhost:3000/api/borrower/upload-document \
  -H "Content-Type: multipart/form-data" \
  -H "Authorization: Bearer test-token" \
  -F "submissionId=<uuid-from-step-2>" \
  -F "documentType=bank_statement" \
  -F "file=@path/to/document.pdf"
```

### 4. Check Submission Status

```bash
curl http://localhost:3000/api/borrower/submission/<submissionId> \
  -H "Authorization: Bearer test-token"
```

### 5. Finalize Submission (Trigger Underwriting)

```bash
curl -X POST http://localhost:3000/api/borrower/finalize-submission \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token" \
  -d '{
    "submissionId": "<uuid>"
  }'
```

This will:
- Validate all documents are processed
- Trigger async underwriting report generation
- Use LLM for risk assessment
- Calculate risk scores
- Generate lending terms

### 6. Get Underwriting Report

```bash
curl http://localhost:3000/api/borrower/report/<submissionId> \
  -H "Authorization: Bearer test-token"
```

**Expected Response:**
```json
{
  "reportId": "uuid",
  "status": "approved",
  "financialSummary": {
    "totalAssets": 100000,
    "totalLiabilities": 20000,
    "netWorth": 80000,
    "monthlyIncome": 8000,
    "monthlyExpenses": 3000,
    "debtToIncomeRatio": 0.375
  },
  "riskAssessment": {
    "collateralScore": 85,
    "probabilityScore": 78,
    "combinedRiskScore": 80.8,
    "riskTier": "A"
  },
  "lendingTerms": {
    "maxLoanAmount": 70000,
    "recommendedLTV": 0.7,
    "recommendedInterestRate": 8.0,
    "recommendedLoanTermDays": 365,
    "requiredCollateral": 100000
  }
}
```

### 7. Apply for Loan

```bash
curl -X POST http://localhost:3000/api/borrower/apply-loan \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token" \
  -d '{
    "reportId": "<uuid>",
    "requestedAmount": 50000,
    "requestedTermDays": 365,
    "collateralAssetIds": ["<uuid>"],
    "walletAddress": "0x..."
  }'
```

### 8. List Lending Pools

```bash
# All pools
curl http://localhost:3000/api/pools

# Filtered
curl "http://localhost:3000/api/pools?riskTier=A&minApy=5&maxApy=15"
```

### 9. Get Pool Details

```bash
curl http://localhost:3000/api/pools/<poolId>
```

### 10. Get Lender Positions

```bash
curl http://localhost:3000/api/lender/positions \
  -H "Authorization: Bearer test-token"
```

### 11. Admin: Get Pending Submissions

```bash
curl http://localhost:3000/api/admin/submissions/pending \
  -H "Authorization: Bearer admin-token"
```

### 12. Admin: Approve Report

```bash
curl -X POST http://localhost:3000/api/admin/report/<reportId>/approve \
  -H "Authorization: Bearer admin-token"
```

### 13. Admin: Analytics

```bash
curl http://localhost:3000/api/admin/analytics \
  -H "Authorization: Bearer admin-token"
```

## Testing Workflow

### Complete Borrower Flow

1. **Create submission** → Get submission ID
2. **Upload 2-3 documents** → Wait for LLM processing
3. **Check submission status** → Ensure all docs processed
4. **Finalize submission** → Triggers underwriting
5. **Get underwriting report** → See risk assessment
6. **Apply for loan** → Get loan details

### Expected Processing Times

- **Document upload**: < 1 second
- **LLM extraction**: 3-10 seconds per document
- **Underwriting report**: 10-30 seconds
- **Total flow**: ~1-2 minutes for 3 documents

## Database Inspection

View tables in Drizzle Studio:
```bash
bun run db:studio
```

Opens at `https://local.drizzle.studio`

## Common Issues

### 1. Database Connection Failed
```bash
# Check PostgreSQL is running
pg_isready

# Verify DATABASE_URL format
postgresql://user:password@localhost:5432/database
```

### 2. S3 Connection Failed
- Verify AWS credentials in `.env`
- Check S3 bucket exists and is accessible
- Ensure region is correct

### 3. LLM API Failed
- Verify `OPENAI_API_KEY` is valid
- Check OpenAI account has credits
- Review error messages in server logs

### 4. Auth Middleware Blocking Requests
- Current implementation uses placeholder auth
- Any `Bearer` token will work for now
- Real JWT verification is marked as TODO

## Monitoring

Watch server logs for:
- `[Processing document...]` - Document extraction in progress
- `[Generating underwriting report...]` - Underwriting triggered
- `[Underwriting report generated]` - Report complete
- Error messages with stack traces

## Performance Metrics

Track these in `llm_api_logs` table:
- Total tokens used
- Total cost (USD)
- Average latency
- Success/failure rates

## Next Steps After Testing

1. **Implement BullMQ** - Replace async functions with job queue
2. **Add PDF Parsing** - Actual PDF text extraction
3. **JWT Auth** - Sui wallet signature verification
4. **Smart Contracts** - Deploy Sui Move contracts
5. **Frontend** - Build borrower/lender portals
6. **Monitoring** - Add proper logging and alerting

## Success Criteria

✅ All endpoints return 200/201 responses
✅ Documents are processed and extracted
✅ Underwriting reports are generated with correct risk scores
✅ Loans are created and matched to pools
✅ No TypeScript errors
✅ Database schema matches specification
✅ LLM integration is working
✅ S3 upload/download is working

---

**Happy Testing! 🚀**
