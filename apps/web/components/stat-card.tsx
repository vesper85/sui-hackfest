"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
    title: string;
    value: string | number;
    description?: string;
    icon?: LucideIcon;
    trend?: {
        value: number;
        isPositive: boolean;
    };
    className?: string;
}

export function StatCard({
    title,
    value,
    description,
    icon: Icon,
    trend,
    className,
}: StatCardProps) {
    return (
        <Card className={cn("relative overflow-hidden", className)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                    {title}
                </CardTitle>
                {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                {(description || trend) && (
                    <div className="flex items-center gap-2 mt-1">
                        {trend && (
                            <span
                                className={cn(
                                    "text-xs font-medium",
                                    trend.isPositive ? "text-green-500" : "text-red-500"
                                )}
                            >
                                {trend.isPositive ? "+" : "-"}{Math.abs(trend.value)}%
                            </span>
                        )}
                        {description && (
                            <p className="text-xs text-muted-foreground">{description}</p>
                        )}
                    </div>
                )}
            </CardContent>
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
        </Card>
    );
}
