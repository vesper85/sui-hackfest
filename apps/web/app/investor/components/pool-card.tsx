"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Pool } from "@/types";
import { TrendingUp, Clock, DollarSign, Layers } from "lucide-react";

interface PoolCardProps {
    pool: Pool;
}

export function PoolCard({ pool }: PoolCardProps) {
    const formatCurrency = (value: number) => {
        if (value >= 1000000) {
            return `$${(value / 1000000).toFixed(1)}M`;
        }
        if (value >= 1000) {
            return `$${(value / 1000).toFixed(0)}K`;
        }
        return `$${value}`;
    };

    const getPoolTypeBadgeVariant = (type: Pool["poolType"]) => {
        switch (type) {
            case "Senior":
                return "default";
            case "Junior":
                return "secondary";
            case "Mezzanine":
                return "outline";
            default:
                return "default";
        }
    };

    return (
        <Link href={`/pools/${pool.id}`}>
            <Card className="group cursor-pointer transition-all duration-300 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 overflow-hidden">
                <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-12 w-12 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                                <span className="text-lg font-bold text-primary">
                                    {pool.name.charAt(0)}
                                </span>
                            </div>
                            <div>
                                <CardTitle className="text-base group-hover:text-primary transition-colors">
                                    {pool.name}
                                </CardTitle>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {pool.borrower?.country || "Global"}
                                </p>
                            </div>
                        </div>
                        <Badge variant={getPoolTypeBadgeVariant(pool.poolType)}>
                            {pool.poolType}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                        {pool.description}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            <div>
                                <p className="text-xs text-muted-foreground">Pool Size</p>
                                <p className="text-sm font-medium">{formatCurrency(pool.poolSize)}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Layers className="h-4 w-4 text-muted-foreground" />
                            <div>
                                <p className="text-xs text-muted-foreground">TVL</p>
                                <p className="text-sm font-medium">{formatCurrency(pool.tvl)}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-green-500" />
                            <div>
                                <p className="text-xs text-muted-foreground">APY</p>
                                <p className="text-sm font-medium text-green-500">{pool.apy}%</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <div>
                                <p className="text-xs text-muted-foreground">Tenure</p>
                                <p className="text-sm font-medium">{pool.tenure}</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t">
                        <span className="text-xs text-muted-foreground">
                            Min. Investment: {formatCurrency(pool.minInvestment)}
                        </span>
                        <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">Score:</span>
                            <span className="text-sm font-medium text-primary">{pool.score}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </Link>
    );
}
