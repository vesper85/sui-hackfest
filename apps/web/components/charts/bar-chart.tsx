"use client";

import {
    BarChart as RechartsBarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface BarChartProps {
    data: { name: string; value: number; secondaryValue?: number }[];
    title?: string;
    dataKey?: string;
    secondaryDataKey?: string;
    color?: string;
    secondaryColor?: string;
    height?: number;
}

export function BarChart({
    data,
    title,
    dataKey = "value",
    secondaryDataKey,
    color = "var(--color-primary)",
    secondaryColor = "var(--color-chart-2)",
    height = 300,
}: BarChartProps) {
    return (
        <Card>
            {title && (
                <CardHeader>
                    <CardTitle className="text-sm font-medium">{title}</CardTitle>
                </CardHeader>
            )}
            <CardContent className={title ? "" : "pt-6"}>
                <ResponsiveContainer width="100%" height={height}>
                    <RechartsBarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                            dataKey="name"
                            tick={{ fontSize: 12 }}
                            className="fill-muted-foreground"
                        />
                        <YAxis
                            tick={{ fontSize: 12 }}
                            className="fill-muted-foreground"
                            tickFormatter={(value) =>
                                value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value
                            }
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: "var(--color-popover)",
                                border: "1px solid var(--color-border)",
                                borderRadius: "0px",
                            }}
                            labelStyle={{ color: "var(--color-foreground)" }}
                        />
                        <Bar dataKey={dataKey} fill={color} />
                        {secondaryDataKey && (
                            <Bar dataKey={secondaryDataKey} fill={secondaryColor} />
                        )}
                    </RechartsBarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
