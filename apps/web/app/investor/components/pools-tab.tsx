"use client";

import { StatCard } from "@/components/stat-card";
import { PoolCard } from "./pool-card";
import type { Pool, DashboardStats } from "@/types";
import { DollarSign, Activity, TrendingUp } from "lucide-react";

interface PoolsTabProps {
    pools: Pool[];
    stats: DashboardStats;
}

export function PoolsTab({ pools, stats }: PoolsTabProps) {
    const formatCurrency = (value: number) => {
        if (value >= 1000000) {
            return `$${(value / 1000000).toFixed(2)}M`;
        }
        if (value >= 1000) {
            return `$${(value / 1000).toFixed(0)}K`;
        }
        return `$${value.toLocaleString()}`;
    };

    return (
        <div className="space-y-8">
            {/* Stats Section */}
            <div className="grid gap-4 md:grid-cols-3">
                <StatCard
                    title="Total Loan Volume"
                    value={formatCurrency(stats.totalLoanVolume)}
                    icon={DollarSign}
                    trend={{ value: 12.5, isPositive: true }}
                    description="from last month"
                />
                <StatCard
                    title="Active Loans"
                    value={stats.activeLoans}
                    icon={Activity}
                    trend={{ value: 4, isPositive: true }}
                    description="new this week"
                />
                <StatCard
                    title="Total Interest Earned"
                    value={formatCurrency(stats.totalInterestEarned)}
                    icon={TrendingUp}
                    trend={{ value: 8.3, isPositive: true }}
                    description="from last month"
                />
            </div>

            {/* Pools Grid */}
            <div>
                <h2 className="text-lg font-semibold mb-4">Available Pools</h2>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {pools.map((pool) => (
                        <PoolCard key={pool.id} pool={pool} />
                    ))}
                </div>
            </div>
        </div>
    );
}
