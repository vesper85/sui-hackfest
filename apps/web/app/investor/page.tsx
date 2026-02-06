"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PoolsTab } from "./components/pools-tab";
import { PortfolioTab } from "./components/portfolio-tab";
import poolsData from "@/data/pools.json";
import portfolioData from "@/data/portfolio.json";
import type { Pool, DashboardStats, Portfolio, Investment, Transaction } from "@/types";
import { LayoutGrid, Briefcase } from "lucide-react";

export default function InvestorPage() {
    const pools = poolsData.pools as Pool[];
    const stats = poolsData.stats as DashboardStats;
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
                    <PoolsTab pools={pools} stats={stats} />
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
