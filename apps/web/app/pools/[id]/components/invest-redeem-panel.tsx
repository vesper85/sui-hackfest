"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useWallet } from "@suiet/wallet-kit";
import { CustomConnectButton } from "@/components/wallet/custom-connect-button";
import type { Pool } from "@/types";
import { Wallet, ArrowDownToLine, ArrowUpFromLine, Info } from "lucide-react";

interface InvestRedeemPanelProps {
  pool: Pool;
}

export function InvestRedeemPanel({ pool }: InvestRedeemPanelProps) {
  const { connected, address, account } = useWallet();
  const apiBase =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
  const walletAddress = address ?? account?.address ?? "";
  const balance = 0; // Placeholder as balance fetching requires additional logic/hooks
  const [investAmount, setInvestAmount] = useState("");
  const [redeemAmount, setRedeemAmount] = useState("");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toLocaleString()}`;
  };

  if (!connected) {
    return (
      <Card className="sticky top-24">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-8">
            <div className="h-16 w-16 bg-muted flex items-center justify-center mb-4">
              <Wallet className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Connect Wallet</h3>
            <p className="text-sm text-muted-foreground text-center mb-6">
              Connect your wallet to invest or redeem from this pool.
            </p>
            <CustomConnectButton />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="sticky top-24">
      <Tabs defaultValue="invest">
        <CardHeader className="pb-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="invest" className="gap-2">
              <ArrowDownToLine className="h-4 w-4" />
              Invest
            </TabsTrigger>
            <TabsTrigger value="redeem" className="gap-2">
              <ArrowUpFromLine className="h-4 w-4" />
              Redeem
            </TabsTrigger>
          </TabsList>
        </CardHeader>
        <CardContent className="space-y-4">
          <TabsContent value="invest" className="mt-0 space-y-4">
            {/* Amount Input */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount to Invest</span>
                <span className="text-muted-foreground">
                  Balance: ${balance.toLocaleString()} USDC
                </span>
              </div>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="0.00"
                  value={investAmount}
                  onChange={(e) => setInvestAmount(e.target.value)}
                  className="pr-16"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7"
                  onClick={() => setInvestAmount(balance.toString() || "")}
                >
                  MAX
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Min. investment: {formatCurrency(pool.minInvestment)}
              </p>
            </div>

            <Separator />

            {/* Investment Details */}
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  Lockup Period
                  <Info className="h-3 w-3" />
                </span>
                <span className="font-medium">{pool.lockupPeriod}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  Repayment Frequency
                  <Info className="h-3 w-3" />
                </span>
                <span className="font-medium">{pool.repaymentFrequency}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Expected APY</span>
                <span className="font-medium text-green-500">{pool.apy}%</span>
              </div>
              {investAmount && Number(investAmount) > 0 && (
                <div className="flex justify-between text-sm pt-2 border-t">
                  <span className="text-muted-foreground">
                    Est. Annual Return
                  </span>
                  <span className="font-medium text-primary">
                    +$
                    {((Number(investAmount) * pool.apy) / 100).toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            <Button
              className="w-full"
              size="lg"
              disabled={
                !investAmount ||
                Number(investAmount) < pool.minInvestment ||
                busy
              }
              onClick={async () => {
                setActionMessage(null);
                setBusy(true);
                try {
                  const response = await fetch(
                    `${apiBase}/pools/${pool.id}/deposit`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        amount: Number(investAmount),
                        walletAddress,
                      }),
                    },
                  );
                  if (!response.ok) {
                    throw new Error("Deposit failed");
                  }
                  setActionMessage("Deposit recorded.");
                } catch (error) {
                  setActionMessage("Deposit failed.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Invest Now
            </Button>
          </TabsContent>

          <TabsContent value="redeem" className="mt-0 space-y-4">
            {/* Redeem Amount Input */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount to Redeem</span>
                <span className="text-muted-foreground">
                  Available: $0 USDC
                </span>
              </div>
              <Input
                type="number"
                placeholder="0.00"
                value={redeemAmount}
                onChange={(e) => setRedeemAmount(e.target.value)}
              />
            </div>

            <Separator />

            {/* Redeem Details */}
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  Redeem Rate
                  <Info className="h-3 w-3" />
                </span>
                <span className="font-medium">
                  {(pool.redeemRate * 100).toFixed(0)}%
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  Performance Fee
                  <Info className="h-3 w-3" />
                </span>
                <span className="font-medium">{pool.performanceFee}%</span>
              </div>
              {redeemAmount && Number(redeemAmount) > 0 && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Fee Amount</span>
                    <span className="text-red-500">
                      -$
                      {(
                        (Number(redeemAmount) * pool.performanceFee) /
                        100
                      ).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t">
                    <span className="text-muted-foreground">
                      You&apos;ll Receive
                    </span>
                    <span className="font-medium text-primary">
                      $
                      {(
                        Number(redeemAmount) * pool.redeemRate -
                        (Number(redeemAmount) * pool.performanceFee) / 100
                      ).toLocaleString()}
                    </span>
                  </div>
                </>
              )}
            </div>

            <Button
              className="w-full"
              size="lg"
              variant="outline"
              disabled={!redeemAmount || busy}
              onClick={async () => {
                setActionMessage(null);
                setBusy(true);
                try {
                  const response = await fetch(
                    `${apiBase}/pools/${pool.id}/withdraw`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        lpTokens: Number(redeemAmount),
                        walletAddress,
                      }),
                    },
                  );
                  if (!response.ok) {
                    throw new Error("Withdraw failed");
                  }
                  setActionMessage("Withdrawal recorded.");
                } catch (error) {
                  setActionMessage("Withdrawal failed.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Redeem
            </Button>
          </TabsContent>
          {actionMessage && (
            <div className="text-xs text-muted-foreground">{actionMessage}</div>
          )}
        </CardContent>
      </Tabs>
    </Card>
  );
}
