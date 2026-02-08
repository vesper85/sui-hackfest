"use client";

import {
  WalletProvider,
  AllDefaultWallets,
  SuiDevnetChain,
  SuiTestnetChain,
  SuiMainnetChain,
} from "@suiet/wallet-kit";
import { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WalletProvider
      defaultWallets={AllDefaultWallets}
      chains={[SuiDevnetChain, SuiTestnetChain, SuiMainnetChain]}
    >
      {children}
    </WalletProvider>
  );
}
