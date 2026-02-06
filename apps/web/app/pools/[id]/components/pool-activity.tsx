"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { ColumnDef } from "@tanstack/react-table";
import type { PoolActivity } from "@/types";
import { ArrowUpRight, ArrowDownRight, RefreshCw } from "lucide-react";

interface PoolActivityProps {
    activities: PoolActivity[];
}

const activityColumns: ColumnDef<PoolActivity>[] = [
    {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => {
            const type = row.getValue("type") as string;
            const Icon =
                type === "Investment"
                    ? ArrowUpRight
                    : type === "Redemption"
                        ? ArrowDownRight
                        : RefreshCw;
            return (
                <div className="flex items-center gap-2">
                    <Icon
                        className={`h-4 w-4 ${type === "Investment"
                                ? "text-green-500"
                                : type === "Redemption"
                                    ? "text-red-500"
                                    : "text-primary"
                            }`}
                    />
                    <span>{type}</span>
                </div>
            );
        },
    },
    {
        accessorKey: "amount",
        header: "Amount",
        cell: ({ row }) => {
            const type = row.original.type;
            const amount = row.getValue("amount") as number;
            return (
                <span
                    className={
                        type === "Investment"
                            ? "text-green-500"
                            : type === "Redemption"
                                ? "text-red-500"
                                : ""
                    }
                >
                    {type === "Investment" ? "+" : type === "Redemption" ? "-" : ""}$
                    {amount.toLocaleString()}
                </span>
            );
        },
    },
    {
        accessorKey: "investor",
        header: "Investor",
        cell: ({ row }) => (
            <span className="font-mono text-xs">{row.getValue("investor")}</span>
        ),
    },
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
        accessorKey: "txHash",
        header: "Tx Hash",
        cell: ({ row }) => (
            <a
                href={`https://explorer.sui.io/tx/${row.getValue("txHash")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-primary hover:underline"
            >
                {(row.getValue("txHash") as string).slice(0, 10)}...
            </a>
        ),
    },
];

export function PoolActivitySection({ activities }: PoolActivityProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Pool Activity</CardTitle>
            </CardHeader>
            <CardContent>
                <DataTable
                    columns={activityColumns}
                    data={activities}
                    pageSize={5}
                />
            </CardContent>
        </Card>
    );
}
