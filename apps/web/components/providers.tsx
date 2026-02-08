"use client";

import { ReactNode } from "react";
import {
  WalletProvider,
  AllDefaultWallets,
  SuiDevnetChain,
  SuiTestnetChain,
  SuiMainnetChain,
} from "@suiet/wallet-kit";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <WalletProvider
      defaultWallets={AllDefaultWallets}
      chains={[SuiDevnetChain, SuiTestnetChain, SuiMainnetChain]}
    >
      {children}
    </WalletProvider>
  );
}
