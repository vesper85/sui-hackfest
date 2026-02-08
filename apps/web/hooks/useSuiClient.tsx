"use client";

import {
  WalletProvider,
  AllDefaultWallets,
  SuiDevnetChain,
  SuiTestnetChain,
  SuiMainnetChain,
} from "@suiet/wallet-kit";
import { ReactNode, createContext, useContext, useState } from "react";

// Contract addresses - Devnet deployment
export const CONTRACT_ADDRESSES = {
  devnet: {
    packageId: process.env.NEXT_PUBLIC_CONTRACT_PACKAGE_ID || "0x0",
    configObjectId: process.env.NEXT_PUBLIC_CONFIG_OBJECT_ID || "0x0",
    approvedMintersObjectId:
      process.env.NEXT_PUBLIC_APPROVED_MINTERS_OBJECT_ID || "0x0",
    factoryConfigObjectId:
      process.env.NEXT_PUBLIC_FACTORY_CONFIG_OBJECT_ID || "0x0",
    loanConfigObjectId: process.env.NEXT_PUBLIC_LOAN_CONFIG_OBJECT_ID || "0x0",
  },
  testnet: {
    packageId:
      "0xc99f9bad7408019819650e30c953f9c1a7d82fa9cbc14827e06e76d1019d9174",
    configObjectId: "0x0",
    approvedMintersObjectId: "0x0",
    factoryConfigObjectId: "0x0",
    loanConfigObjectId: "0x0",
  },
  mainnet: {
    packageId: "0x0",
    configObjectId: "0x0",
    approvedMintersObjectId: "0x0",
    factoryConfigObjectId: "0x0",
    loanConfigObjectId: "0x0",
  },
} as const;

export type ChainType = "devnet" | "testnet" | "mainnet";

interface SuiClientContextType {
  chain: ChainType;
  setChain: (chain: ChainType) => void;
  addresses: (typeof CONTRACT_ADDRESSES)["devnet"];
  rpcUrl: string;
}

const SuiClientContext = createContext<SuiClientContextType | null>(null);

export function useSuiClient() {
  const context = useContext(SuiClientContext);
  if (!context) {
    throw new Error("useSuiClient must be used within SuiClientProvider");
  }
  return context;
}

const RPC_URLS: Record<ChainType, string> = {
  devnet: "https://fullnode.devnet.sui.io:443",
  testnet: "https://fullnode.testnet.sui.io:443",
  mainnet: "https://fullnode.mainnet.sui.io:443",
};

export function SuiClientProvider({ children }: { children: ReactNode }) {
  const [chain, setChain] = useState<ChainType>("devnet");

  const addresses = CONTRACT_ADDRESSES[chain];
  const rpcUrl = RPC_URLS[chain];

  return (
    <SuiClientContext.Provider value={{ chain, setChain, addresses, rpcUrl }}>
      {children}
    </SuiClientContext.Provider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WalletProvider
      defaultWallets={AllDefaultWallets}
      chains={[SuiDevnetChain, SuiTestnetChain, SuiMainnetChain]}
    >
      <SuiClientProvider>{children}</SuiClientProvider>
    </WalletProvider>
  );
}
