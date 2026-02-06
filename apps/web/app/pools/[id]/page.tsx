"use client";

import { use } from "react";
import Link from "next/link";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { PoolOverview } from "./components/pool-overview";
import { PoolInfoSections } from "./components/pool-info-sections";
import { RepaymentsSection } from "./components/repayments-section";
import { PoolActivitySection } from "./components/pool-activity";
import { InvestRedeemPanel } from "./components/invest-redeem-panel";
import poolsData from "@/data/pools.json";
import type { Pool } from "@/types";
import { ArrowLeft } from "lucide-react";

interface PoolDetailPageProps {
    params: Promise<{ id: string }>;
}

export default function PoolDetailPage({ params }: PoolDetailPageProps) {
    const { id } = use(params);
    const pool = poolsData.pools.find((p) => p.id === id) as Pool | undefined;

    if (!pool) {
        return (
            <div className="mx-auto max-w-7xl py-8 px-4 lg:px-8">
                <div className="flex flex-col items-center justify-center py-16">
                    <h1 className="text-2xl font-bold mb-4">Pool Not Found</h1>
                    <p className="text-muted-foreground mb-6">
                        The pool you&apos;re looking for doesn&apos;t exist.
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
            <Link href="/investor" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
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
