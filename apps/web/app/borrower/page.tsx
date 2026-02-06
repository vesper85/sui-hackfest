"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useWallet } from "@/contexts/wallet-context";
import {
    Upload,
    FileText,
    CheckCircle,
    Clock,
    AlertCircle,
    Wallet,
    Building,
    DollarSign,
    Calendar,
} from "lucide-react";

const documentTypes = [
    { id: "financial", name: "Financial Statements", required: true },
    { id: "business-plan", name: "Business Plan", required: true },
    { id: "bank-statements", name: "Bank Statements", required: true },
    { id: "legal", name: "Legal Documents", required: true },
    { id: "registration", name: "Company Registration", required: true },
    { id: "projections", name: "Financial Projections", required: false },
];

export default function BorrowerPage() {
    const { wallet, connect } = useWallet();
    const [uploadedDocs, setUploadedDocs] = useState<Record<string, boolean>>({});
    const [requestAmount, setRequestAmount] = useState("");
    const [tenure, setTenure] = useState("12");
    const [purpose, setPurpose] = useState("");

    const uploadedCount = Object.values(uploadedDocs).filter(Boolean).length;
    const requiredCount = documentTypes.filter((d) => d.required).length;
    const progress = (uploadedCount / documentTypes.length) * 100;

    const handleUpload = (docId: string) => {
        setUploadedDocs((prev) => ({ ...prev, [docId]: true }));
    };

    if (!wallet.isConnected) {
        return (
            <div className="mx-auto max-w-7xl py-8 px-4 lg:px-8">
                <div className="max-w-2xl mx-auto">
                    <Card className="flex flex-col items-center justify-center py-16">
                        <Wallet className="h-16 w-16 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">Connect Your Wallet</h3>
                        <p className="text-muted-foreground text-center max-w-md mb-6">
                            Connect your wallet to submit a loan request and access the borrower dashboard.
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
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2">Borrower Dashboard</h1>
                    <p className="text-muted-foreground">
                        Submit your loan request and track the approval process
                    </p>
                </div>

                <div className="grid gap-8 md:grid-cols-3">
                    {/* Left Column - Loan Details */}
                    <div className="md:col-span-2 space-y-6">
                        {/* Loan Request Form */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <DollarSign className="h-4 w-4" />
                                    Loan Request Details
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <label className="text-sm text-muted-foreground">
                                            Requested Amount (USDC)
                                        </label>
                                        <Input
                                            type="number"
                                            placeholder="1,000,000"
                                            value={requestAmount}
                                            onChange={(e) => setRequestAmount(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm text-muted-foreground">
                                            Tenure (months)
                                        </label>
                                        <Input
                                            type="number"
                                            placeholder="12"
                                            value={tenure}
                                            onChange={(e) => setTenure(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm text-muted-foreground">
                                        Purpose of Loan
                                    </label>
                                    <Input
                                        placeholder="Working capital for business expansion..."
                                        value={purpose}
                                        onChange={(e) => setPurpose(e.target.value)}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Document Upload */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <FileText className="h-4 w-4" />
                                        Required Documents
                                    </CardTitle>
                                    <span className="text-sm text-muted-foreground">
                                        {uploadedCount}/{documentTypes.length} uploaded
                                    </span>
                                </div>
                                <Progress value={progress} className="mt-2" />
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {documentTypes.map((doc) => (
                                        <div
                                            key={doc.id}
                                            className="flex items-center justify-between p-3 bg-muted/50"
                                        >
                                            <div className="flex items-center gap-3">
                                                {uploadedDocs[doc.id] ? (
                                                    <CheckCircle className="h-5 w-5 text-green-500" />
                                                ) : (
                                                    <Clock className="h-5 w-5 text-muted-foreground" />
                                                )}
                                                <div>
                                                    <p className="text-sm font-medium">{doc.name}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {doc.required ? "Required" : "Optional"}
                                                    </p>
                                                </div>
                                            </div>
                                            <Button
                                                variant={uploadedDocs[doc.id] ? "outline" : "default"}
                                                size="sm"
                                                className="gap-2"
                                                onClick={() => handleUpload(doc.id)}
                                            >
                                                <Upload className="h-4 w-4" />
                                                {uploadedDocs[doc.id] ? "Replace" : "Upload"}
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Submit Button */}
                        <Button
                            className="w-full"
                            size="lg"
                            disabled={uploadedCount < requiredCount || !requestAmount || !purpose}
                        >
                            Submit Loan Request
                        </Button>
                    </div>

                    {/* Right Column - Status */}
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Request Status</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-3 p-4 bg-muted/50">
                                    <Clock className="h-8 w-8 text-muted-foreground" />
                                    <div>
                                        <p className="font-medium">No Active Request</p>
                                        <p className="text-sm text-muted-foreground">
                                            Submit your documents to start
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Process Timeline</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="flex items-start gap-3">
                                        <div className="h-6 w-6 bg-primary/20 flex items-center justify-center text-xs font-medium text-primary">
                                            1
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">Submit Documents</p>
                                            <p className="text-xs text-muted-foreground">
                                                Upload all required documents
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="h-6 w-6 bg-muted flex items-center justify-center text-xs font-medium">
                                            2
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">LLM Underwriting</p>
                                            <p className="text-xs text-muted-foreground">
                                                AI analyzes your documents
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="h-6 w-6 bg-muted flex items-center justify-center text-xs font-medium">
                                            3
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">Admin Review</p>
                                            <p className="text-xs text-muted-foreground">
                                                Admin approves or rejects
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="h-6 w-6 bg-muted flex items-center justify-center text-xs font-medium">
                                            4
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">Pool Creation</p>
                                            <p className="text-xs text-muted-foreground">
                                                Investors can fund your loan
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
