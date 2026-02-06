"use client";

import {
    LineChart as RechartsLineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface LineChartProps {
    data: { name: string; value: number }[];
    title?: string;
    dataKey?: string;
    color?: string;
    height?: number;
    showArea?: boolean;
}

export function LineChart({
    data,
    title,
    dataKey = "value",
    color = "var(--color-primary)",
    height = 200,
}: LineChartProps) {
    return (
        <Card>
            {title && (
                <CardHeader>
                    <CardTitle className="text-sm font-medium">{title}</CardTitle>
                </CardHeader>
            )}
            <CardContent className={title ? "" : "pt-6"}>
                <ResponsiveContainer width="100%" height={height}>
                    <RechartsLineChart data={data}>
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
                        <Line
                            type="monotone"
                            dataKey={dataKey}
                            stroke={color}
                            strokeWidth={2}
                            dot={{ fill: color, strokeWidth: 2 }}
                        />
                    </RechartsLineChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
