import type { Context } from "hono";
import { db } from "../db";
import {
  borrowerProfiles,
  documentSubmissions,
  underwritingReports,
  borrowerNfts,
  lendingPools,
  users,
} from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import {
  NotFoundError,
  ValidationError,
  InternalServerError,
  UnauthorizedError,
} from "../types";
import type {
  MintNftRequest,
  DeployPoolRequest,
  RegisterNftRequest,
} from "../types";

// Contract configuration - should come from env
const CONTRACT_PACKAGE_ID =
  process.env.CONTRACT_PACKAGE_ID ||
  "0xc99f9bad7408019819650e30c953f9c1a7d82fa9cbc14827e06e76d1019d9174";
const CONFIG_OBJECT_ID = process.env.CONFIG_OBJECT_ID || "";
const APPROVED_MINTERS_OBJECT_ID = process.env.APPROVED_MINTERS_OBJECT_ID || "";
const FACTORY_CONFIG_OBJECT_ID = process.env.FACTORY_CONFIG_OBJECT_ID || "";

/**
 * Get borrower's NFTs
 */
export const getBorrowerNfts = async (c: Context) => {
  try {
    const walletAddress = c.get("walletAddress");
    if (!walletAddress) {
      throw new UnauthorizedError("Missing wallet context");
    }

    // Get borrower profile
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.walletAddress, walletAddress));

    if (!user) {
      return c.json({ nfts: [] });
    }

    const [borrower] = await db
      .select()
      .from(borrowerProfiles)
      .where(eq(borrowerProfiles.userId, user.id))
      .orderBy(desc(borrowerProfiles.createdAt))
      .limit(1);

    if (!borrower) {
      return c.json({ nfts: [] });
    }

    const nfts = await db
      .select()
      .from(borrowerNfts)
      .where(eq(borrowerNfts.borrowerId, borrower.id))
      .orderBy(desc(borrowerNfts.createdAt));

    return c.json({
      nfts: nfts.map((nft) => ({
        id: nft.id,
        name: nft.nftName,
        description: nft.nftDescription,
        portfolioId: nft.portfolioId,
        principalAmount: nft.principalAmount,
        status: nft.mintStatus,
        objectId: nft.contractObjectId,
        mintedAt: nft.mintedAt,
        txHash: nft.mintTxHash,
        underwriting: {
          probOfDefault: nft.probOfDefault,
          lossGivenDefault: nft.lossGivenDefault,
          riskScore: nft.riskScore,
          exposureAtDefault: nft.exposureAtDefault,
          underwritten: nft.underwritten,
        },
      })),
    });
  } catch (error) {
    console.error("Error fetching borrower NFTs:", error);
    throw new InternalServerError("Failed to fetch NFTs");
  }
};

/**
 * Request mint approval for a borrower
 * This is called by the borrower to request approval to mint NFTs
 */
export const requestMintApproval = async (c: Context) => {
  try {
    const walletAddress = c.get("walletAddress");
    if (!walletAddress) {
      throw new UnauthorizedError("Missing wallet context");
    }

    // In a real implementation, this would call the contract's request_mint_approval function
    // For now, we just log it and return success
    console.log(`Mint approval requested for wallet: ${walletAddress}`);

    return c.json({
      success: true,
      message: "Mint approval request submitted",
      walletAddress,
    });
  } catch (error) {
    console.error("Error requesting mint approval:", error);
    throw new InternalServerError("Failed to request mint approval");
  }
};

/**
 * Mint NFT for borrower's collateral
 *
 * Flow:
 * 1. Validate submission is finalized and has approved report
 * 2. Get lending terms from report
 * 3. Call contract's mint_nft function
 * 4. Store NFT data in database
 */
export const mintBorrowerNft = async (c: Context) => {
  try {
    const body: MintNftRequest = await c.req.json();
    const walletAddress = c.get("walletAddress");

    if (!walletAddress) {
      throw new UnauthorizedError("Missing wallet context");
    }

    if (walletAddress !== body.walletAddress) {
      throw new UnauthorizedError("Wallet address mismatch");
    }

    // Get submission with report
    const [submission] = await db
      .select({
        submission: documentSubmissions,
        borrower: borrowerProfiles,
      })
      .from(documentSubmissions)
      .innerJoin(
        borrowerProfiles,
        eq(documentSubmissions.borrowerId, borrowerProfiles.id),
      )
      .where(eq(documentSubmissions.id, body.submissionId));

    if (!submission) {
      throw new NotFoundError("Submission not found");
    }

    if (submission.submission.status !== "completed") {
      throw new ValidationError(
        "Submission must be finalized before minting NFT",
      );
    }

    // Get approved report
    const [report] = await db
      .select()
      .from(underwritingReports)
      .where(
        and(
          eq(underwritingReports.submissionId, body.submissionId),
          eq(underwritingReports.status, "approved"),
        ),
      )
      .orderBy(desc(underwritingReports.generatedAt));

    if (!report) {
      throw new ValidationError("No approved underwriting report found");
    }

    // Check if NFT already minted for this submission
    const [existingNft] = await db
      .select()
      .from(borrowerNfts)
      .where(eq(borrowerNfts.submissionId, body.submissionId));

    if (existingNft && existingNft.mintStatus === "minted") {
      return c.json({
        nftId: existingNft.id,
        contractObjectId: existingNft.contractObjectId,
        mintTxHash: existingNft.mintTxHash,
        status: "already_minted",
        message: "NFT already minted for this submission",
      });
    }

    // Extract lending terms from report
    const reportData = report.reportData as Record<string, any>;
    const lendingTerms = reportData.lendingTerms || {};
    const riskAssessment = reportData.riskAssessment || {};

    const principalAmount = lendingTerms.maxLoanAmount || 0;
    const interestRate = lendingTerms.recommendedInterestRate || 10;
    const loanTermDays = lendingTerms.recommendedLoanTermDays || 365;

    // Calculate maturity date
    const maturityDate = new Date();
    maturityDate.setDate(maturityDate.getDate() + loanTermDays);

    // Create NFT record (pending mint)
    const [nftRecord] = await db
      .insert(borrowerNfts)
      .values({
        borrowerId: submission.borrower.id,
        submissionId: body.submissionId,
        nftName: `Collateral NFT - ${submission.borrower.fullName || "Borrower"}`,
        nftDescription: `Tokenized collateral for loan portfolio`,
        portfolioId: `PF-${submission.submission.submissionReference}`,
        principalAmount: principalAmount.toString(),
        noOfLoans: 1,
        averageInterestRate: interestRate.toString(),
        portfolioTerm: `${loanTermDays} days`,
        portfolioStatus: "active",
        maturityDate: maturityDate,
        ownerAddress: walletAddress,
        probOfDefault: (riskAssessment.defaultProbability || 0.05).toString(),
        lossGivenDefault: "0.40", // 40% default
        riskScore: Math.round(riskAssessment.combinedRiskScore || 50),
        exposureAtDefault: principalAmount.toString(),
        mintStatus: "pending",
      })
      .returning();

    if (!nftRecord) {
      throw new InternalServerError("Failed to create NFT record");
    }

    // TODO: Call actual contract mint_nft function
    // This would use the Sui SDK to build and execute the transaction
    // For now, we simulate a successful mint
    const mockTxHash = `0x${Buffer.from(Math.random().toString()).toString("hex").slice(0, 64)}`;
    const mockObjectId = `0x${Buffer.from(Math.random().toString()).toString("hex").slice(0, 64)}`;

    // Update NFT record with mint details
    await db
      .update(borrowerNfts)
      .set({
        mintStatus: "minted",
        contractObjectId: mockObjectId,
        mintTxHash: mockTxHash,
        mintedAt: new Date(),
      })
      .where(eq(borrowerNfts.id, nftRecord.id));

    return c.json({
      nftId: nftRecord.id,
      contractObjectId: mockObjectId,
      mintTxHash: mockTxHash,
      status: "minted",
      message: "NFT minted successfully",
    });
  } catch (error) {
    console.error("Error minting NFT:", error);
    if (
      error instanceof NotFoundError ||
      error instanceof ValidationError ||
      error instanceof UnauthorizedError
    ) {
      throw error;
    }
    throw new InternalServerError("Failed to mint NFT");
  }
};

/**
 * Register NFT minted on-chain (called by frontend after successful mint)
 *
 * This stores the NFT object ID and metadata from the contract
 */
export const registerMintedNft = async (c: Context) => {
  try {
    const body: RegisterNftRequest = await c.req.json();
    const walletAddress = c.get("walletAddress");

    if (!walletAddress) {
      throw new UnauthorizedError("Missing wallet context");
    }

    if (walletAddress !== body.walletAddress) {
      throw new UnauthorizedError("Wallet address mismatch");
    }

    // Get submission with report
    const [submission] = await db
      .select({
        submission: documentSubmissions,
        borrower: borrowerProfiles,
      })
      .from(documentSubmissions)
      .innerJoin(
        borrowerProfiles,
        eq(documentSubmissions.borrowerId, borrowerProfiles.id),
      )
      .where(eq(documentSubmissions.id, body.submissionId));

    if (!submission) {
      throw new NotFoundError("Submission not found");
    }

    // Check if NFT already exists for this object ID
    const [existingNft] = await db
      .select()
      .from(borrowerNfts)
      .where(eq(borrowerNfts.contractObjectId, body.contractObjectId));

    if (existingNft) {
      return c.json({
        nftId: existingNft.id,
        status: "already_registered",
        message: "NFT already registered",
      });
    }

    // Get approved report for underwriting data
    const [report] = await db
      .select()
      .from(underwritingReports)
      .where(
        and(
          eq(underwritingReports.submissionId, body.submissionId),
          eq(underwritingReports.status, "approved"),
        ),
      )
      .orderBy(desc(underwritingReports.generatedAt));

    // Extract risk data from report
    const reportData = report?.reportData as Record<string, any>;
    const riskAssessment = reportData?.riskAssessment || {};

    // Create NFT record with on-chain data
    const [nftRecord] = await db
      .insert(borrowerNfts)
      .values({
        borrowerId: submission.borrower.id,
        submissionId: body.submissionId,
        nftName: body.name,
        nftDescription: body.description,
        portfolioId: body.portfolioId,
        principalAmount: body.principalAmount,
        noOfLoans: body.noOfLoans,
        averageInterestRate: body.averageInterestRate,
        portfolioTerm: body.portfolioTerm,
        portfolioStatus: body.portfolioStatus,
        maturityDate: new Date(body.maturityDate),
        ownerAddress: walletAddress,
        contractObjectId: body.contractObjectId,
        mintTxHash: body.mintTxHash,
        mintStatus: "minted",
        mintedAt: new Date(),
        probOfDefault: (riskAssessment.defaultProbability || 0.05).toString(),
        lossGivenDefault: "0.40",
        riskScore: Math.round(riskAssessment.combinedRiskScore || 50),
        exposureAtDefault: body.principalAmount,
        underwritten: true,
      })
      .returning();

    if (!nftRecord) {
      throw new InternalServerError("Failed to register NFT");
    }

    return c.json({
      nftId: nftRecord.id,
      status: "registered",
      message: "NFT registered successfully",
    });
  } catch (error) {
    console.error("Error registering NFT:", error);
    if (
      error instanceof NotFoundError ||
      error instanceof ValidationError ||
      error instanceof UnauthorizedError
    ) {
      throw error;
    }
    throw new InternalServerError("Failed to register NFT");
  }
};

/**
 * Deploy pool on-chain
 *
 * This is called by admin to deploy the pool contract
 */
export const deployPoolOnChain = async (c: Context) => {
  try {
    const body: DeployPoolRequest = await c.req.json();

    // Get pool with borrower
    const [pool] = await db
      .select({
        pool: lendingPools,
        borrower: borrowerProfiles,
      })
      .from(lendingPools)
      .leftJoin(
        borrowerProfiles,
        eq(lendingPools.borrowerId, borrowerProfiles.id),
      )
      .where(eq(lendingPools.id, body.poolId));

    if (!pool) {
      throw new NotFoundError("Pool not found");
    }

    if (pool.pool.poolStatus !== "paused") {
      throw new ValidationError("Pool must be in paused status to deploy");
    }

    // Calculate tranche ceilings based on junior ratio
    const totalPrincipal =
      parseFloat(pool.pool.maxLoanSizeUsd?.toString() || "0") * 1000000; // Convert to base units
    const juniorCeiling = Math.floor(totalPrincipal * body.juniorRatio);
    const seniorCeiling = Math.floor(totalPrincipal * (1 - body.juniorRatio));

    // Generate contract pool ID (should come from factory contract in real implementation)
    const contractPoolId = Math.floor(Date.now() / 1000); // Temporary: use timestamp

    // TODO: Call actual contract create_pool function
    // This would:
    // 1. Get the next pool_id from FactoryConfig
    // 2. Build transaction with all parameters
    // 3. Execute and get object IDs
    // 4. Update database with results

    const mockTxHash = `0x${Buffer.from(Math.random().toString()).toString("hex").slice(0, 64)}`;
    const mockNftId = `0x${Buffer.from(Math.random().toString()).toString("hex").slice(0, 64)}`;
    const mockLoanId = `0x${Buffer.from(Math.random().toString()).toString("hex").slice(0, 64)}`;
    const mockJuniorPoolId = `0x${Buffer.from(Math.random().toString()).toString("hex").slice(0, 64)}`;
    const mockSeniorPoolId = `0x${Buffer.from(Math.random().toString()).toString("hex").slice(0, 64)}`;
    const mockOperatorId = `0x${Buffer.from(Math.random().toString()).toString("hex").slice(0, 64)}`;

    // Update pool with deployment info
    await db
      .update(lendingPools)
      .set({
        poolStatus: "active",
        contractPoolId: contractPoolId,
        contractAddress: CONTRACT_PACKAGE_ID,
        chainId: "sui-testnet",
        deploymentTxHash: mockTxHash,
        borrowerId: pool.borrower?.id,
        juniorCeiling: (juniorCeiling / 1000000).toString(),
        seniorCeiling: (seniorCeiling / 1000000).toString(),
        periodLengthSeconds: body.periodLengthSeconds,
        periodCount: body.periodCount,
        gracePeriodSeconds: body.gracePeriodSeconds,
        lateFeeInterestPerSecond: body.lateFeeInterestPerSecond,
        isBulletRepay: body.isBulletRepay,
        performanceFeeBps: body.performanceFeeBps,
        originatorFeeBps: body.originatorFeeBps,
        pStartFrom: body.pStartFrom,
        pRepayFrequency: body.pRepayFrequency,
        capitalFormationPeriod: body.capitalFormationPeriod,
        seniorInterestRate: body.seniorInterestRate.toString(),
        nftId: mockNftId,
        loanId: mockLoanId,
        juniorPoolId: mockJuniorPoolId,
        seniorPoolId: mockSeniorPoolId,
        operatorId: mockOperatorId,
      })
      .where(eq(lendingPools.id, body.poolId));

    return c.json({
      poolId: body.poolId,
      contractPoolId,
      contractAddress: CONTRACT_PACKAGE_ID,
      deploymentTxHash: mockTxHash,
      objectIds: {
        nftId: mockNftId,
        loanId: mockLoanId,
        juniorPoolId: mockJuniorPoolId,
        seniorPoolId: mockSeniorPoolId,
        operatorId: mockOperatorId,
      },
      status: "deployed",
    });
  } catch (error) {
    console.error("Error deploying pool:", error);
    if (error instanceof NotFoundError || error instanceof ValidationError) {
      throw error;
    }
    throw new InternalServerError("Failed to deploy pool");
  }
};
