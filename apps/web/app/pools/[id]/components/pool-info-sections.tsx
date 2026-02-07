"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { Pool, Underwriter, Asset } from "@/types";
import { CheckCircle, Building, Globe, ExternalLink } from "lucide-react";

interface PoolInfoSectionsProps {
    pool: Pool;
}

export function PoolInfoSections({ pool }: PoolInfoSectionsProps) {
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
        <div className="space-y-6">
            {/* Overview */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Overview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">{pool.description}</p>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-muted-foreground">Pool Type</span>
                            <p className="font-medium">{pool.poolType}</p>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Tenure</span>
                            <p className="font-medium">{pool.tenure}</p>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Lockup Period</span>
                            <p className="font-medium">{pool.lockupPeriod}</p>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Repayment Frequency</span>
                            <p className="font-medium">{pool.repaymentFrequency}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Highlights */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Highlights</CardTitle>
                </CardHeader>
                <CardContent>
                    <ul className="space-y-3">
                        {pool.highlights?.map((highlight, index) => (
                            <li key={index} className="flex items-start gap-2 text-sm">
                                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                                <span>{highlight}</span>
                            </li>
                        ))}
                    </ul>
                </CardContent>
            </Card>

            {/* Underlying Assets */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Underlying Assets</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {pool.assets?.map((asset: Asset) => (
                            <div
                                key={asset.id}
                                className="flex items-center justify-between p-3 bg-muted/50"
                            >
                                <div>
                                    <p className="font-medium text-sm">{asset.name}</p>
                                    <p className="text-xs text-muted-foreground">{asset.type}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-medium text-sm">{formatCurrency(asset.value)}</p>
                                    <p className="text-xs text-muted-foreground">
                                        Maturity: {new Date(asset.maturity).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Structure */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Pool Structure</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <div
                                className="h-3 bg-primary"
                                style={{ width: `${pool.structure?.seniorTranche}%` }}
                            />
                            <div
                                className="h-3 bg-chart-2"
                                style={{ width: `${pool.structure?.juniorTranche}%` }}
                            />
                            <div
                                className="h-3 bg-chart-3"
                                style={{ width: `${pool.structure?.mezzanineTranche}%` }}
                            />
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                            <div className="flex items-center gap-2">
                                <div className="h-3 w-3 bg-primary" />
                                <div>
                                    <p className="text-muted-foreground">Senior</p>
                                    <p className="font-medium">{pool.structure?.seniorTranche}%</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="h-3 w-3 bg-chart-2" />
                                <div>
                                    <p className="text-muted-foreground">Junior</p>
                                    <p className="font-medium">{pool.structure?.juniorTranche}%</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="h-3 w-3 bg-chart-3" />
                                <div>
                                    <p className="text-muted-foreground">Mezzanine</p>
                                    <p className="font-medium">{pool.structure?.mezzanineTranche}%</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Underwriters */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Underwriters</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {pool.underwriters?.map((underwriter: Underwriter) => (
                            <div
                                key={underwriter.id}
                                className="flex items-center justify-between p-3 bg-muted/50"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                                        <span className="text-sm font-bold text-primary">
                                            {underwriter.name.charAt(0)}
                                        </span>
                                    </div>
                                    <span className="font-medium text-sm">{underwriter.name}</span>
                                </div>
                                <Badge variant="outline">{underwriter.rating}</Badge>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Borrower Info */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Borrower</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="h-12 w-12 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                                <Building className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <p className="font-medium">{pool.borrower?.name}</p>
                                <p className="text-sm text-muted-foreground">
                                    {pool.borrower?.industry} • {pool.borrower?.country}
                                </p>
                            </div>
                        </div>
                        {pool.borrower?.website && (
                            <a
                                href={pool.borrower.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-sm text-primary hover:underline"
                            >
                                <Globe className="h-4 w-4" />
                                Visit Website
                                <ExternalLink className="h-3 w-3" />
                            </a>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
