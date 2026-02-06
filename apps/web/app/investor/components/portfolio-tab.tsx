"use client";

import { ColumnDef } from "@tanstack/react-table";
import { StatCard } from "@/components/stat-card";
import { DataTable } from "@/components/data-table";
import { LineChart } from "@/components/charts/line-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWallet } from "@/contexts/wallet-context";
import type { Portfolio, Investment, Transaction } from "@/types";
import { Wallet, TrendingUp, DollarSign, Percent } from "lucide-react";

interface PortfolioTabProps {
    portfolio: Portfolio;
    analytics: {
        investmentHistory: { month: string; value: number }[];
        returnsHistory: { month: string; value: number }[];
    };
}

const investmentColumns: ColumnDef<Investment>[] = [
    {
        accessorKey: "poolName",
        header: "Pool",
        cell: ({ row }) => (
            <span className="font-medium">{row.getValue("poolName")}</span>
        ),
    },
    {
        accessorKey: "amount",
        header: "Amount",
        cell: ({ row }) => `$${(row.getValue("amount") as number).toLocaleString()}`,
    },
    {
        accessorKey: "apy",
        header: "APY",
        cell: ({ row }) => (
            <span className="text-green-500">{row.getValue("apy")}%</span>
        ),
    },
    {
        accessorKey: "expectedReturn",
        header: "Expected Return",
        cell: ({ row }) => (
            <span className="text-primary">
                +${(row.getValue("expectedReturn") as number).toLocaleString()}
            </span>
        ),
    },
    {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
            <Badge
                variant={row.getValue("status") === "Active" ? "default" : "secondary"}
            >
                {row.getValue("status")}
            </Badge>
        ),
    },
];

const transactionColumns: ColumnDef<Transaction>[] = [
    {
        accessorKey: "date",
        header: "Date",
        cell: ({ row }) =>
            new Date(row.getValue("date")).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
            }),
    },
    {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => {
            const type = row.getValue("type") as string;
            return (
                <Badge
                    variant={
                        type === "Investment"
                            ? "default"
                            : type === "Interest"
                                ? "secondary"
                                : "outline"
                    }
                >
                    {type}
                </Badge>
            );
        },
    },
    {
        accessorKey: "poolName",
        header: "Pool",
    },
    {
        accessorKey: "amount",
        header: "Amount",
        cell: ({ row }) => {
            const type = row.original.type;
            const amount = row.getValue("amount") as number;
            const isPositive = type === "Interest" || type === "Redemption";
            return (
                <span className={isPositive ? "text-green-500" : ""}>
                    {isPositive ? "+" : "-"}${amount.toLocaleString()}
                </span>
            );
        },
    },
    {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
            <Badge
                variant={
                    row.getValue("status") === "Completed" ? "outline" : "secondary"
                }
            >
                {row.getValue("status")}
            </Badge>
        ),
    },
];

export function PortfolioTab({ portfolio, analytics }: PortfolioTabProps) {
    const { wallet } = useWallet();

    const formatCurrency = (value: number) => {
        if (value >= 1000000) {
            return `$${(value / 1000000).toFixed(2)}M`;
        }
        if (value >= 1000) {
            return `$${(value / 1000).toFixed(0)}K`;
        }
        return `$${value.toLocaleString()}`;
    };

    if (!wallet.isConnected) {
        return (
            <Card className="flex flex-col items-center justify-center py-16">
                <Wallet className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Connect Your Wallet</h3>
                <p className="text-muted-foreground text-center max-w-md">
                    Connect your wallet to view your portfolio, investments, and
                    transaction history.
                </p>
            </Card>
        );
    }

    return (
        <div className="space-y-8">
            {/* Portfolio Stats */}
            <div className="grid gap-4 md:grid-cols-4">
                <StatCard
                    title="Total Investments"
                    value={formatCurrency(portfolio.totalInvestments)}
                    icon={DollarSign}
                />
                <StatCard
                    title="Expected Returns"
                    value={formatCurrency(portfolio.expectedReturns)}
                    icon={TrendingUp}
                    trend={{ value: 15, isPositive: true }}
                />
                <StatCard
                    title="Available for Withdrawal"
                    value={formatCurrency(portfolio.availableForWithdrawal)}
                    icon={Wallet}
                />
                <StatCard
                    title="Average APY"
                    value={`${portfolio.averageApy}%`}
                    icon={Percent}
                />
            </div>

            {/* Analytics Charts */}
            <div className="grid gap-6 md:grid-cols-2">
                <LineChart
                    data={analytics.investmentHistory.map((item) => ({
                        name: item.month,
                        value: item.value,
                    }))}
                    title="Investment History"
                />
                <LineChart
                    data={analytics.returnsHistory.map((item) => ({
                        name: item.month,
                        value: item.value,
                    }))}
                    title="Returns History"
                    color="var(--color-chart-2)"
                />
            </div>

            {/* Investments Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">My Investments</CardTitle>
                </CardHeader>
                <CardContent>
                    <DataTable columns={investmentColumns} data={portfolio.investments} />
                </CardContent>
            </Card>

            {/* Transactions Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Transaction History</CardTitle>
                </CardHeader>
                <CardContent>
                    <DataTable
                        columns={transactionColumns}
                        data={portfolio.transactions}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
