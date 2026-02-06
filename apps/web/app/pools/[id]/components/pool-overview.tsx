"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { Pool } from "@/types";
import { TrendingUp, DollarSign, Target, Award } from "lucide-react";

interface PoolOverviewProps {
    pool: Pool;
}

export function PoolOverview({ pool }: PoolOverviewProps) {
    const formatCurrency = (value: number) => {
        if (value >= 1000000) {
            return `$${(value / 1000000).toFixed(2)}M`;
        }
        if (value >= 1000) {
            return `$${(value / 1000).toFixed(0)}K`;
        }
        return `$${value.toLocaleString()}`;
    };

    const fillPercentage = (pool.tvl / pool.poolSize) * 100;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="relative h-48 bg-gradient-to-br from-primary/20 via-primary/10 to-background overflow-hidden">
                <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-20" />
                <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background to-transparent">
                    <div className="flex items-center gap-4">
                        <div className="h-16 w-16 bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
                            <span className="text-2xl font-bold text-primary">
                                {pool.name.charAt(0)}
                            </span>
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold">{pool.name}</h1>
                            <p className="text-muted-foreground">{pool.borrower?.name}</p>
                        </div>
                        <Badge className="ml-auto" variant="outline">
                            {pool.status}
                        </Badge>
                    </div>
                </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="h-4 w-4 text-green-500" />
                            <span className="text-xs text-muted-foreground">APY</span>
                        </div>
                        <span className="text-2xl font-bold text-green-500">
                            {pool.apy}%
                        </span>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-2">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Min Investment</span>
                        </div>
                        <span className="text-2xl font-bold">
                            {formatCurrency(pool.minInvestment)}
                        </span>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Award className="h-4 w-4 text-primary" />
                            <span className="text-xs text-muted-foreground">Credit Score</span>
                        </div>
                        <span className="text-2xl font-bold text-primary">{pool.score}</span>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Target className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Pool Size</span>
                        </div>
                        <span className="text-2xl font-bold">{formatCurrency(pool.poolSize)}</span>
                    </CardContent>
                </Card>
            </div>

            {/* Pool Fill Progress */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Pool Utilization</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                                {formatCurrency(pool.tvl)} invested
                            </span>
                            <span className="font-medium">{fillPercentage.toFixed(1)}%</span>
                        </div>
                        <Progress value={fillPercentage} />
                        <p className="text-xs text-muted-foreground">
                            {formatCurrency(pool.poolSize - pool.tvl)} remaining capacity
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
