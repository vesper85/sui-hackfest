"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useState } from "react";
import { PoolsTab } from "./components/pools-tab";
import { PortfolioTab } from "./components/portfolio-tab";
import portfolioData from "@/data/portfolio.json";
import type {
  Pool,
  DashboardStats,
  Portfolio,
  Investment,
  Transaction,
} from "@/types";
import { LayoutGrid, Briefcase } from "lucide-react";

export default function InvestorPage() {
  const apiBase =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
  const [pools, setPools] = useState<Pool[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalLoanVolume: 0,
    activeLoans: 0,
    totalInterestEarned: 0,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchPools = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${apiBase}/pools`);
        if (!response.ok) {
          throw new Error("Failed to fetch pools");
        }
        const payload = await response.json();
        const apiPools = payload.pools ?? [];
        const mappedPools: Pool[] = apiPools.map((pool: any) => ({
          id: pool.poolId,
          name: pool.poolName,
          description: `Risk tier ${pool.riskTier ?? "N/A"} pool`,
          logo: "",
          headerImage: "",
          poolSize: pool.metrics?.tvl ?? 0,
          tvl: pool.metrics?.tvl ?? 0,
          apy: pool.metrics?.currentApy ?? 0,
          tenure: `${pool.riskTier ?? "N/A"} Tier`,
          poolType: "Senior",
          minInvestment: 1000,
          score: Math.round((pool.metrics?.utilizationRate ?? 0) * 100),
          lockupPeriod: "30 days",
          repaymentFrequency: "Bullet",
          redeemRate: 1,
          performanceFee: Number(pool.parameters?.protocolFee ?? 2),
          status: "Active",
          borrower: {
            id: "pool",
            name: pool.poolName,
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
          repayments: [],
          activity: [],
        }));
        setPools(mappedPools);
        setStats({
          totalLoanVolume: apiPools.reduce(
            (sum: number, p: any) => sum + (p.metrics?.tvl ?? 0),
            0,
          ),
          activeLoans: apiPools.reduce(
            (sum: number, p: any) => sum + (p.metrics?.totalActiveLoans ?? 0),
            0,
          ),
          totalInterestEarned: 0,
        });
      } catch (error) {
        setPools([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPools();
  }, [apiBase]);
  const portfolio: Portfolio = {
    totalInvestments: portfolioData.portfolio.totalInvestments,
    expectedReturns: portfolioData.portfolio.expectedReturns,
    availableForWithdrawal: portfolioData.portfolio.availableForWithdrawal,
    averageApy: portfolioData.portfolio.averageApy,
    investments: portfolioData.investments as Investment[],
    transactions: portfolioData.transactions as Transaction[],
  };

  return (
    <div className="mx-auto max-w-7xl py-8 px-4 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Investor Dashboard</h1>
        <p className="text-muted-foreground">
          Discover lending opportunities and manage your investments
        </p>
      </div>

      <Tabs defaultValue="pools" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="pools" className="gap-2">
            <LayoutGrid className="h-4 w-4" />
            Pools
          </TabsTrigger>
          <TabsTrigger value="portfolio" className="gap-2">
            <Briefcase className="h-4 w-4" />
            Portfolio
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pools">
          {loading ? (
            <div className="text-sm text-muted-foreground">
              Loading pools...
            </div>
          ) : (
            <PoolsTab pools={pools} stats={stats} />
          )}
        </TabsContent>

        <TabsContent value="portfolio">
          <PortfolioTab
            portfolio={portfolio}
            analytics={portfolioData.analytics}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
