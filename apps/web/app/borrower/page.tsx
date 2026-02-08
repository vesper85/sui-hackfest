"use client";

import { Card } from "@/components/ui/card";
import { CustomConnectButton } from "@/components/wallet/custom-connect-button";
import { Wallet } from "lucide-react";
import { useWallet } from "@suiet/wallet-kit";
import { BorrowerFlow } from "@/components/borrower/borrower-flow";

export default function BorrowerPage() {
  const { connected } = useWallet();

  if (!connected) {
    return (
      <div className="mx-auto max-w-7xl py-8 px-4 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <Card className="flex flex-col items-center justify-center py-16">
            <Wallet className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Connect Your Wallet</h3>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              Connect your wallet to submit a loan request and access the
              borrower dashboard.
            </p>
            <CustomConnectButton />
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl py-8 px-4 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Borrower Dashboard</h1>
          <p className="text-muted-foreground">
            Upload required documents and track the approval process
          </p>
        </div>
        <BorrowerFlow />
      </div>
    </div>
  );
}
