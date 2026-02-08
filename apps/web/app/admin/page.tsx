"use client";

import { useEffect, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table";
import { StatCard } from "@/components/stat-card";
import Link from "next/link";
import { CheckCircle, XCircle, Clock, Users, DollarSign } from "lucide-react";

interface AdminSubmission {
  submissionId: string;
  submissionReference: string;
  status: string;
  submittedAt: string;
  borrowerName: string;
  borrowerEmail: string;
  borrowerType: string;
  documentCount: number;
  processedDocuments: number;
  report: {
    reportId: string;
    status: string;
    riskTier: string | null;
    combinedRiskScore: number;
    maxLoanAmountUsd: number;
  } | null;
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

export default function AdminPage() {
  const apiBase =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
  const [submissions, setSubmissions] = useState<AdminSubmission[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshSubmissions = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${apiBase}/admin/submissions`);
      if (!response.ok) {
        throw new Error("Failed to load submissions");
      }
      const payload = await response.json();
      setSubmissions(payload.submissions ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshSubmissions();
  }, []);

  const pendingReports = submissions.filter(
    (sub) => sub.report?.status === "pending_review",
  );
  const approvedReports = submissions.filter(
    (sub) => sub.report?.status === "approved",
  );
  const totalRecommended = submissions.reduce(
    (acc, sub) => acc + (sub.report?.maxLoanAmountUsd ?? 0),
    0,
  );

  const columns: ColumnDef<AdminSubmission>[] = [
    {
      accessorKey: "borrowerName",
      header: "Borrower",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.borrowerName}</p>
          <p className="text-xs text-muted-foreground">
            {row.original.borrowerEmail}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "submissionReference",
      header: "Reference",
    },
    {
      accessorKey: "documentCount",
      header: "Docs",
      cell: ({ row }) => (
        <span>
          {row.original.processedDocuments}/{row.original.documentCount}
        </span>
      ),
    },
    {
      accessorKey: "report",
      header: "Amount",
      cell: ({ row }) =>
        formatCurrency(row.original.report?.maxLoanAmountUsd ?? 0),
    },
    {
      accessorKey: "report",
      header: "Score",
      cell: ({ row }) => (
        <span className="font-medium text-primary">
          {row.original.report?.combinedRiskScore ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "report",
      header: "Risk",
      cell: ({ row }) => {
        const risk = row.original.report?.riskTier ?? "—";
        return (
          <Badge variant={risk === "AAA" ? "default" : "secondary"}>
            {risk}
          </Badge>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.report?.status ?? row.original.status;
        return (
          <div className="flex items-center gap-1">
            {status === "pending_review" ? (
              <Clock className="h-4 w-4 text-yellow-500" />
            ) : status === "approved" ? (
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
      cell: ({ row }) => (
        <Link href={`/admin/submission/${row.original.submissionId}`}>
          <Button variant="outline" size="sm">
            View Details
          </Button>
        </Link>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-7xl py-8 px-4 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Admin Panel</h1>
        <p className="text-muted-foreground">
          Review borrower submissions, reports, and AI outputs
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <StatCard
          title="Pending Reports"
          value={pendingReports.length}
          icon={Clock}
        />
        <StatCard
          title="Approved Reports"
          value={approvedReports.length}
          icon={CheckCircle}
        />
        <StatCard
          title="Total Recommended"
          value={formatCurrency(totalRecommended)}
          icon={DollarSign}
        />
        <StatCard
          title="Active Borrowers"
          value={submissions.length}
          icon={Users}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Submissions</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">
              Loading submissions...
            </div>
          ) : (
            <DataTable columns={columns} data={submissions} pageSize={10} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
