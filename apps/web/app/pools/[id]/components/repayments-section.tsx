"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import { BarChart } from "@/components/charts/bar-chart";
import { Badge } from "@/components/ui/badge";
import { ColumnDef } from "@tanstack/react-table";
import type { Repayment } from "@/types";

interface RepaymentsSectionProps {
    repayments: Repayment[];
}

const repaymentColumns: ColumnDef<Repayment>[] = [
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
        accessorKey: "principal",
        header: "Principal",
        cell: ({ row }) => `$${(row.getValue("principal") as number).toLocaleString()}`,
    },
    {
        accessorKey: "interest",
        header: "Interest",
        cell: ({ row }) => (
            <span className="text-green-500">
                +${(row.getValue("interest") as number).toLocaleString()}
            </span>
        ),
    },
    {
        id: "total",
        header: "Total",
        cell: ({ row }) => {
            const principal = row.getValue("principal") as number;
            const interest = row.getValue("interest") as number;
            return (
                <span className="font-medium">
                    ${(principal + interest).toLocaleString()}
                </span>
            );
        },
    },
    {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
            const status = row.getValue("status") as string;
            return (
                <Badge
                    variant={
                        status === "Paid"
                            ? "default"
                            : status === "Scheduled"
                                ? "secondary"
                                : "destructive"
                    }
                >
                    {status}
                </Badge>
            );
        },
    },
];

export function RepaymentsSection({ repayments }: RepaymentsSectionProps) {
    // Prepare chart data
    const chartData = repayments.map((rep) => ({
        name: new Date(rep.date).toLocaleDateString("en-US", {
            month: "short",
        }),
        value: rep.principal,
        secondaryValue: rep.interest,
    }));

    return (
        <div className="space-y-6">
            {/* Repayments Chart */}
            <BarChart
                data={chartData}
                title="Repayment Schedule"
                dataKey="value"
                secondaryDataKey="secondaryValue"
                height={250}
            />

            {/* Repayments Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Repayment Details</CardTitle>
                </CardHeader>
                <CardContent>
                    <DataTable
                        columns={repaymentColumns}
                        data={repayments}
                        showPagination={false}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
