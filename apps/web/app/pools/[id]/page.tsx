"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { PoolOverview } from "./components/pool-overview";
import { PoolInfoSections } from "./components/pool-info-sections";
import { RepaymentsSection } from "./components/repayments-section";
import { PoolActivitySection } from "./components/pool-activity";
import { InvestRedeemPanel } from "./components/invest-redeem-panel";
import type { Pool } from "@/types";
import { ArrowLeft } from "lucide-react";

interface PoolDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function PoolDetailPage({ params }: PoolDetailPageProps) {
  const { id } = use(params);
  const apiBase =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
  const [pool, setPool] = useState<Pool | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchPool = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${apiBase}/pools/${id}`);
        if (!response.ok) {
          throw new Error("Failed to load pool");
        }
        const payload = await response.json();
        const apiPool = payload.pool;
        const mappedPool: Pool = {
          id: apiPool.poolId,
          name: apiPool.poolName,
          description: `Risk tier ${apiPool.riskTier ?? "N/A"} pool`,
          logo: "",
          headerImage: "",
          poolSize: apiPool.metrics?.tvl ?? 0,
          tvl: apiPool.metrics?.tvl ?? 0,
          apy: apiPool.metrics?.currentApy ?? 0,
          tenure: `${apiPool.riskTier ?? "N/A"} Tier`,
          poolType: "Senior",
          minInvestment: 1000,
          score: Math.round((apiPool.metrics?.utilizationRate ?? 0) * 100),
          lockupPeriod: "30 days",
          repaymentFrequency: "Bullet",
          redeemRate: 1,
          performanceFee: 2,
          status: "Active",
          borrower: {
            id: "pool",
            name: apiPool.poolName,
            logo: "",
            country: "Global",
            industry: "",
            website: "",
            documents: [],
            financialProfile: [],
            status: "Approved",
            requestDate: "",
          },
          highlights: [],
          structure: {
            seniorTranche: 100,
            juniorTranche: 0,
            mezzanineTranche: 0,
          },
          underwriters: [],
          assets: [],
          repayments:
            payload.recentLoans?.map((loan: any) => ({
              id: loan.loanId,
              date: loan.fundedDate ?? "",
              principal: loan.amount,
              interest: 0,
              status: "Scheduled",
            })) ?? [],
          activity:
            payload.performanceHistory?.map((entry: any, index: number) => ({
              id: `${apiPool.poolId}-${index}`,
              type: "Investment",
              amount: entry.tvl ?? 0,
              investor: "",
              date: entry.date,
              txHash: "",
            })) ?? [],
        };
        setPool(mappedPool);
      } catch (error) {
        setPool(undefined);
      } finally {
        setLoading(false);
      }
    };

    fetchPool();
  }, [apiBase, id]);

  if (!pool) {
    return (
      <div className="mx-auto max-w-7xl py-8 px-4 lg:px-8">
        <div className="flex flex-col items-center justify-center py-16">
          <h1 className="text-2xl font-bold mb-4">
            {loading ? "Loading Pool" : "Pool Not Found"}
          </h1>
          <p className="text-muted-foreground mb-6">
            {loading
              ? "Fetching pool details from the API."
              : "The pool you&apos;re looking for doesn&apos;t exist."}
          </p>
          <Link href="/investor">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Pools
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl py-8 px-4 lg:px-8">
      {/* Back Button */}
      <Link
        href="/investor"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Pools
      </Link>

      {/* Main Layout: Scrollable Left + Fixed Right */}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left Side - Scrollable Content */}
        <div className="flex-1 space-y-6 lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto lg:pr-4">
          <PoolOverview pool={pool} />
          <PoolInfoSections pool={pool} />
          <RepaymentsSection repayments={pool.repayments || []} />
          <PoolActivitySection activities={pool.activity || []} />
        </div>

        {/* Right Side - Fixed Invest/Redeem Panel */}
        <div className="lg:w-96 shrink-0">
          <InvestRedeemPanel pool={pool} />
        </div>
      </div>
    </div>
  );
}
