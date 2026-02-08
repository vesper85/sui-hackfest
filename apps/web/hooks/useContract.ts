"use client";

import { useCallback } from "react";
import { useWallet } from "@suiet/wallet-kit";
import { useSuiClient, CONTRACT_ADDRESSES, ChainType } from "./useSuiClient";

// Transaction status
export type TxStatus = "idle" | "signing" | "pending" | "success" | "error";

// Contract module names
const MODULES = {
  NFT: "nft_nisarg",
  TRANCHE: "tranche_pool",
  LOAN: "loan",
  FACTORY: "pool_factory",
  OPERATOR: "whitelist_operator",
} as const;

export interface TransactionResult {
  status: TxStatus;
  digest?: string;
  error?: string;
  objectId?: string;
}

export interface NftMintParams {
  name: string;
  description: string;
  portfolioId: string;
  noOfLoans: number;
  totalPrincipalAmount: number; // in base units (6 decimals)
  averageInterestRate: number;
  portfolioTerm: string;
  portfolioStatus: string;
  maturityDate: string;
}

export interface InvestParams {
  poolId: string; // Junior or Senior pool object ID
  amount: number; // Amount in base units
}

export interface RedeemParams {
  poolId: string;
  amount: number;
}

export interface BorrowParams {
  loanId: string;
  amount: number;
}

export interface RepayParams {
  loanId: string;
  amount: number;
}

export function useContract(): {
  wallet: ReturnType<typeof useWallet>;
  chain: ChainType;
  addresses: (typeof CONTRACT_ADDRESSES)["devnet"];
  rpcUrl: string;
  isConnected: boolean;
  account: ReturnType<typeof useWallet>["account"];
  mintNft: (params: NftMintParams) => Promise<TransactionResult>;
  invest: (params: InvestParams) => Promise<TransactionResult>;
  redeem: (params: RedeemParams) => Promise<TransactionResult>;
  borrow: (params: BorrowParams) => Promise<TransactionResult>;
  repay: (params: RepayParams) => Promise<TransactionResult>;
  requestMintApproval: () => Promise<TransactionResult>;
} {
  const wallet = useWallet();
  const { addresses, chain, rpcUrl } = useSuiClient();

  // Helper to build transaction
  const buildTx = useCallback(
    async (
      module: string,
      function_: string,
      typeArgs: string[],
      args: unknown[],
    ) => {
      if (!wallet.connected || !wallet.account) {
        throw new Error("Wallet not connected");
      }

      // Using the wallet's signAndExecuteTransactionBlock
      // This will open the wallet for user confirmation
      return {
        module,
        function: function_,
        typeArguments: typeArgs,
        arguments: args,
      };
    },
    [wallet],
  );

  // Mint NFT
  const mintNft = useCallback(
    async (params: NftMintParams): Promise<TransactionResult> => {
      try {
        if (!wallet.connected || !wallet.account) {
          return { status: "error", error: "Wallet not connected" };
        }

        // Build the mint_nft transaction
        // Note: This requires the ApprovedMinters object and Config object
        const txData = await buildTx(
          MODULES.NFT,
          "mint_nft",
          [],
          [
            addresses.configObjectId,
            addresses.approvedMintersObjectId,
            params.name,
            params.description,
            params.portfolioId,
            params.noOfLoans,
            params.totalPrincipalAmount,
            params.averageInterestRate,
            params.portfolioTerm,
            params.portfolioStatus,
            params.maturityDate,
          ],
        );

        // Execute transaction
        // Note: Actual implementation depends on @suiet/wallet-kit's API
        // This is a placeholder for the actual transaction execution
        console.log("Minting NFT with params:", params);
        console.log("Transaction data:", txData);

        // Return success with mock data for now
        // In production, this would be the actual transaction result
        return {
          status: "success",
          digest: `0x${Date.now().toString(16)}`,
          objectId: `0x${Math.random().toString(16).slice(2, 66)}`,
        };
      } catch (error) {
        console.error("Error minting NFT:", error);
        return {
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    [wallet, addresses, buildTx],
  );

  // Invest (Supply to pool)
  const invest = useCallback(
    async (params: InvestParams): Promise<TransactionResult> => {
      try {
        if (!wallet.connected || !wallet.account) {
          return { status: "error", error: "Wallet not connected" };
        }

        const txData = await buildTx(
          MODULES.TRANCHE,
          "supply",
          [],
          [
            params.poolId,
            // treasury cap object id would be passed here
            params.amount,
          ],
        );

        console.log("Investing with params:", params);
        console.log("Transaction data:", txData);

        return {
          status: "success",
          digest: `0x${Date.now().toString(16)}`,
        };
      } catch (error) {
        console.error("Error investing:", error);
        return {
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    [wallet, buildTx],
  );

  // Redeem (Withdraw from pool)
  const redeem = useCallback(
    async (params: RedeemParams): Promise<TransactionResult> => {
      try {
        if (!wallet.connected || !wallet.account) {
          return { status: "error", error: "Wallet not connected" };
        }

        const txData = await buildTx(
          MODULES.TRANCHE,
          "redeem",
          [],
          [
            params.poolId,
            // treasury cap
            // tranche token coin
            params.amount,
          ],
        );

        console.log("Redeeming with params:", params);
        console.log("Transaction data:", txData);

        return {
          status: "success",
          digest: `0x${Date.now().toString(16)}`,
        };
      } catch (error) {
        console.error("Error redeeming:", error);
        return {
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    [wallet, buildTx],
  );

  // Borrow (Withdraw from loan)
  const borrow = useCallback(
    async (params: BorrowParams): Promise<TransactionResult> => {
      try {
        if (!wallet.connected || !wallet.account) {
          return { status: "error", error: "Wallet not connected" };
        }

        const txData = await buildTx(
          MODULES.LOAN,
          "withdraw",
          [],
          [
            params.loanId,
            addresses.loanConfigObjectId,
            params.amount,
            // clock object
          ],
        );

        console.log("Borrowing with params:", params);
        console.log("Transaction data:", txData);

        return {
          status: "success",
          digest: `0x${Date.now().toString(16)}`,
        };
      } catch (error) {
        console.error("Error borrowing:", error);
        return {
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    [wallet, addresses.loanConfigObjectId, buildTx],
  );

  // Repay
  const repay = useCallback(
    async (params: RepayParams): Promise<TransactionResult> => {
      try {
        if (!wallet.connected || !wallet.account) {
          return { status: "error", error: "Wallet not connected" };
        }

        const txData = await buildTx(
          MODULES.LOAN,
          "repay",
          [],
          [
            params.loanId,
            addresses.loanConfigObjectId,
            // payment coin
            // clock object
          ],
        );

        console.log("Repaying with params:", params);
        console.log("Transaction data:", txData);

        return {
          status: "success",
          digest: `0x${Date.now().toString(16)}`,
        };
      } catch (error) {
        console.error("Error repaying:", error);
        return {
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    [wallet, addresses.loanConfigObjectId, buildTx],
  );

  // Request mint approval
  const requestMintApproval =
    useCallback(async (): Promise<TransactionResult> => {
      try {
        if (!wallet.connected || !wallet.account) {
          return { status: "error", error: "Wallet not connected" };
        }

        const txData = await buildTx(
          MODULES.NFT,
          "request_mint_approval",
          [],
          [addresses.approvedMintersObjectId],
        );

        console.log("Requesting mint approval");
        console.log("Transaction data:", txData);

        return {
          status: "success",
          digest: `0x${Date.now().toString(16)}`,
        };
      } catch (error) {
        console.error("Error requesting mint approval:", error);
        return {
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }, [wallet, addresses.approvedMintersObjectId, buildTx]);

  return {
    wallet,
    chain,
    addresses,
    rpcUrl,
    isConnected: wallet.connected,
    account: wallet.account,
    mintNft,
    invest,
    redeem,
    borrow,
    repay,
    requestMintApproval,
  };
}

// Export addresses for use in other components
export { CONTRACT_ADDRESSES };
export type { ChainType };
