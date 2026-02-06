"use client";

import { useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table";
import { StatCard } from "@/components/stat-card";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useWallet } from "@/contexts/wallet-context";
import borrowerRequestsData from "@/data/borrower-requests.json";
import financialProfileData from "@/data/financial-profile.json";
import {
    FileText,
    CheckCircle,
    XCircle,
    Clock,
    AlertTriangle,
    Wallet,
    Users,
    DollarSign,
    Building,
} from "lucide-react";

interface BorrowerRequest {
    id: string;
    borrowerId: string;
    borrowerName: string;
    country: string;
    industry: string;
    requestedAmount: number;
    purpose: string;
    tenure: string;
    status: string;
    submittedAt: string;
    documents: { id: string; name: string; type: string; status: string }[];
    underwritingScore: number;
    riskLevel: string;
}

const formatCurrency = (value: number) => {
    if (value >= 1000000) {
        return `$${(value / 1000000).toFixed(2)}M`;
    }
    if (value >= 1000) {
        return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toLocaleString()}`;
};

function RequestDetailDialog({ request }: { request: BorrowerRequest }) {
    const financialProfile = financialProfileData.input.financial_profile;

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    View Details
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Building className="h-5 w-5" />
                        {request.borrowerName}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Request Overview */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-sm text-muted-foreground">Requested Amount</p>
                            <p className="text-xl font-bold">{formatCurrency(request.requestedAmount)}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Tenure</p>
                            <p className="text-xl font-bold">{request.tenure}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Industry</p>
                            <p className="font-medium">{request.industry}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Country</p>
                            <p className="font-medium">{request.country}</p>
                        </div>
                    </div>

                    <Separator />

                    {/* Underwriting Score */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">Underwriting Score</span>
                            <Badge variant={request.riskLevel === "Low" ? "default" : request.riskLevel === "Medium" ? "secondary" : "destructive"}>
                                {request.riskLevel} Risk
                            </Badge>
                        </div>
                        <div className="flex items-center gap-3">
                            <Progress value={request.underwritingScore} className="flex-1" />
                            <span className="text-2xl font-bold text-primary">{request.underwritingScore}</span>
                        </div>
                    </div>

                    <Separator />

                    {/* Documents */}
                    <div>
                        <h4 className="text-sm font-medium mb-3">Submitted Documents</h4>
                        <div className="space-y-2">
                            {request.documents.map((doc) => (
                                <div
                                    key={doc.id}
                                    className="flex items-center justify-between p-2 bg-muted/50"
                                >
                                    <div className="flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm">{doc.name}</span>
                                    </div>
                                    <Badge variant={doc.status === "Approved" ? "default" : doc.status === "Reviewed" ? "secondary" : "outline"}>
                                        {doc.status}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </div>

                    <Separator />

                    {/* Financial Profile */}
                    <div>
                        <h4 className="text-sm font-medium mb-3">Financial Profile (LLM Extracted)</h4>
                        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                            {financialProfile.slice(0, 10).map((attr, index) => (
                                <div key={index} className="flex justify-between p-2 bg-muted/30 text-sm">
                                    <span className="text-muted-foreground truncate mr-2">{attr.Attribute}</span>
                                    <span className="font-medium shrink-0">{typeof attr.value === "number" ? attr.value.toFixed(2) : attr.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <Separator />

                    {/* Action Buttons */}
                    <div className="flex gap-4">
                        <Button className="flex-1 gap-2" disabled={request.status !== "Pending"}>
                            <CheckCircle className="h-4 w-4" />
                            Approve & Create Pool
                        </Button>
                        <Button variant="destructive" className="flex-1 gap-2" disabled={request.status !== "Pending"}>
                            <XCircle className="h-4 w-4" />
                            Reject Request
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default function AdminPage() {
    const { wallet, connect } = useWallet();
    const requests = borrowerRequestsData.borrowerRequests as BorrowerRequest[];

    const pendingRequests = requests.filter((r) => r.status === "Pending");
    const approvedRequests = requests.filter((r) => r.status === "Approved");
    const totalRequested = requests.reduce((acc, r) => acc + r.requestedAmount, 0);

    const columns: ColumnDef<BorrowerRequest>[] = [
        {
            accessorKey: "borrowerName",
            header: "Borrower",
            cell: ({ row }) => (
                <div>
                    <p className="font-medium">{row.getValue("borrowerName")}</p>
                    <p className="text-xs text-muted-foreground">
                        {row.original.industry} • {row.original.country}
                    </p>
                </div>
            ),
        },
        {
            accessorKey: "requestedAmount",
            header: "Amount",
            cell: ({ row }) => formatCurrency(row.getValue("requestedAmount")),
        },
        {
            accessorKey: "tenure",
            header: "Tenure",
        },
        {
            accessorKey: "underwritingScore",
            header: "Score",
            cell: ({ row }) => (
                <span className="font-medium text-primary">
                    {row.getValue("underwritingScore")}
                </span>
            ),
        },
        {
            accessorKey: "riskLevel",
            header: "Risk",
            cell: ({ row }) => {
                const risk = row.getValue("riskLevel") as string;
                return (
                    <Badge
                        variant={
                            risk === "Low" ? "default" : risk === "Medium" ? "secondary" : "destructive"
                        }
                    >
                        {risk}
                    </Badge>
                );
            },
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => {
                const status = row.getValue("status") as string;
                return (
                    <div className="flex items-center gap-1">
                        {status === "Pending" ? (
                            <Clock className="h-4 w-4 text-yellow-500" />
                        ) : status === "Approved" ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                        )}
                        <span>{status}</span>
                    </div>
                );
            },
        },
        {
            id: "actions",
            cell: ({ row }) => <RequestDetailDialog request={row.original} />,
        },
    ];

    if (!wallet.isConnected) {
        return (
            <div className="mx-auto max-w-7xl py-8 px-4 lg:px-8">
                <div className="max-w-2xl mx-auto">
                    <Card className="flex flex-col items-center justify-center py-16">
                        <Wallet className="h-16 w-16 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">Admin Access Required</h3>
                        <p className="text-muted-foreground text-center max-w-md mb-6">
                            Connect your wallet to access the admin panel.
                        </p>
                        <Button onClick={connect} className="gap-2">
                            <Wallet className="h-4 w-4" />
                            Connect Wallet
                        </Button>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-7xl py-8 px-4 lg:px-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Admin Panel</h1>
                <p className="text-muted-foreground">
                    Review borrower requests and manage pool creation
                </p>
            </div>

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-4 mb-8">
                <StatCard
                    title="Pending Requests"
                    value={pendingRequests.length}
                    icon={Clock}
                />
                <StatCard
                    title="Approved Requests"
                    value={approvedRequests.length}
                    icon={CheckCircle}
                />
                <StatCard
                    title="Total Requested"
                    value={formatCurrency(totalRequested)}
                    icon={DollarSign}
                />
                <StatCard
                    title="Active Borrowers"
                    value={requests.length}
                    icon={Users}
                />
            </div>

            {/* Requests Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Borrower Requests</CardTitle>
                </CardHeader>
                <CardContent>
                    <DataTable columns={columns} data={requests} pageSize={10} />
                </CardContent>
            </Card>
        </div>
    );
}
