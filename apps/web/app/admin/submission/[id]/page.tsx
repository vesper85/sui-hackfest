"use client";

import { useEffect, useMemo, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  XCircle,
  FileText,
  Layers,
} from "lucide-react";

interface SubmissionDetail {
  submission: {
    submissionId: string;
    submissionReference: string;
    status: string;
    submittedAt: string;
    borrower: {
      id: string;
      fullName: string;
      email: string;
      borrowerType: string;
      businessName: string | null;
    } | null;
    documents: Array<{
      documentId: string;
      documentType: string;
      fileName: string;
      fileSizeBytes: number;
      mimeType: string;
      processingStatus: string;
      errorMessage: string | null;
      extraction: {
        structuredData: Record<string, any>;
        confidenceScore: string | null;
        tokensUsed: number | null;
        extractionCostUsd: string | null;
      } | null;
    }>;
    collateralAssets: Array<{
      assetType: string;
      description: string;
      estimatedValueUsd: string | null;
      liquidationValueUsd: string | null;
      verificationStatus: string;
    }>;
    reports: Array<{
      reportId: string;
      status: string;
      generatedAt: string;
      riskTier: string | null;
      combinedRiskScore: string | null;
      maxLoanAmountUsd: string | null;
      recommendedInterestRate: string | null;
      recommendedLoanTermDays: number | null;
      reportData: Record<string, any> | null;
      flags: string[] | null;
      pool: {
        poolId: string;
        poolName: string;
        poolStatus: string;
        contractAddress: string | null;
        chainId: string | null;
      } | null;
    }>;
  };
}

interface PageProps {
  params: Promise<{ id: string }>;
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

const formatBytes = (value: number) => {
  if (value >= 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (value >= 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${value} B`;
};

const formatFieldValue = (value: any) => {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
};

const flattenData = (
  data: any,
  prefix = "",
): Array<{ key: string; value: string }> => {
  if (data === null || data === undefined) return [];

  if (Array.isArray(data)) {
    return data.flatMap((item, index) =>
      flattenData(item, `${prefix}[${index}]`),
    );
  }

  if (typeof data === "object") {
    return Object.entries(data).flatMap(([key, value]) =>
      flattenData(value, prefix ? `${prefix}.${key}` : key),
    );
  }

  return [{ key: prefix || "value", value: formatFieldValue(data) }];
};

const formatStructuredRows = (data: Record<string, any>) =>
  flattenData(data).filter((row) => row.value !== "—");

export default function AdminSubmissionPage({ params }: PageProps) {
  const { id } = use(params);
  const apiBase =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001/api";
  const [detail, setDetail] = useState<SubmissionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const latestReport = useMemo(() => detail?.submission.reports?.[0], [detail]);

  const fetchDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${apiBase}/admin/submission/${id}`);
      if (!response.ok) {
        throw new Error("Failed to load submission details");
      }
      const payload = (await response.json()) as SubmissionDetail;
      setDetail(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const canApprove = latestReport?.status === "pending_review";
  const canCreatePool =
    latestReport?.status === "approved" && !latestReport?.pool;
  const canDeployPool =
    latestReport?.pool && latestReport.pool.poolStatus !== "active";

  return (
    <div className="mx-auto max-w-7xl py-8 px-4 lg:px-8">
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Admin
      </Link>

      <div className="mt-6">
        <h1 className="text-3xl font-bold">Submission Detail</h1>
        <p className="text-muted-foreground">
          Review document extractions, collateral, and underwriting output.
        </p>
      </div>

      {loading && (
        <div className="mt-6 text-sm text-muted-foreground">Loading...</div>
      )}
      {error && <div className="mt-6 text-sm text-red-400">{error}</div>}

      {detail && (
        <div className="mt-8 space-y-8">
          <div className="grid gap-4 lg:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Submission</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-semibold">
                  {detail.submission.submissionReference}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(detail.submission.submittedAt).toLocaleString()}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Borrower</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-semibold">
                  {detail.submission.borrower?.fullName || "Unknown"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {detail.submission.borrower?.email || ""}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Status</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant="outline">{detail.submission.status}</Badge>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-semibold">
                  {detail.submission.documents.length}
                </div>
                <div className="text-xs text-muted-foreground">
                  Processed{" "}
                  {
                    detail.submission.documents.filter(
                      (doc) => doc.processingStatus === "completed",
                    ).length
                  }
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Underwriting Report</CardTitle>
                <Badge
                  variant={
                    latestReport?.status === "approved"
                      ? "default"
                      : latestReport?.status === "rejected"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {latestReport?.status ?? "N/A"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {latestReport ? (
                <div className="grid gap-4 lg:grid-cols-4">
                  <div className="rounded-md border border-border/60 p-3">
                    <div className="text-xs text-muted-foreground">
                      Risk Tier
                    </div>
                    <div className="text-lg font-semibold">
                      {latestReport.riskTier ?? "—"}
                    </div>
                  </div>
                  <div className="rounded-md border border-border/60 p-3">
                    <div className="text-xs text-muted-foreground">Score</div>
                    <div className="text-lg font-semibold">
                      {latestReport.combinedRiskScore ?? "—"}
                    </div>
                    <Progress
                      className="mt-2"
                      value={Number(latestReport.combinedRiskScore ?? 0)}
                    />
                  </div>
                  <div className="rounded-md border border-border/60 p-3">
                    <div className="text-xs text-muted-foreground">
                      Max Loan
                    </div>
                    <div className="text-lg font-semibold">
                      {latestReport.maxLoanAmountUsd
                        ? formatCurrency(Number(latestReport.maxLoanAmountUsd))
                        : "—"}
                    </div>
                  </div>
                  <div className="rounded-md border border-border/60 p-3">
                    <div className="text-xs text-muted-foreground">
                      Interest Rate
                    </div>
                    <div className="text-lg font-semibold">
                      {latestReport.recommendedInterestRate ?? "—"}%
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  No report yet.
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  className="gap-2"
                  disabled={!canApprove}
                  onClick={async () => {
                    if (!latestReport) return;
                    await fetch(
                      `${apiBase}/admin/report/${latestReport.reportId}/approve`,
                      { method: "POST" },
                    );
                    fetchDetail();
                  }}
                >
                  <CheckCircle className="h-4 w-4" />
                  Approve Report
                </Button>
                <Button
                  variant="destructive"
                  className="gap-2"
                  disabled={!canApprove}
                  onClick={async () => {
                    if (!latestReport) return;
                    await fetch(
                      `${apiBase}/admin/report/${latestReport.reportId}/reject`,
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ reason: "Rejected by admin" }),
                      },
                    );
                    fetchDetail();
                  }}
                >
                  <XCircle className="h-4 w-4" />
                  Reject Report
                </Button>
                <Button
                  variant="outline"
                  disabled={!canCreatePool}
                  onClick={async () => {
                    if (!latestReport) return;
                    await fetch(
                      `${apiBase}/admin/report/${latestReport.reportId}/create-pool`,
                      { method: "POST" },
                    );
                    fetchDetail();
                  }}
                >
                  Create Pool
                </Button>
                <Button
                  disabled={!canDeployPool}
                  onClick={async () => {
                    if (!latestReport?.pool) return;
                    await fetch(
                      `${apiBase}/admin/pool/${latestReport.pool.poolId}/deploy`,
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          contractAddress: latestReport.pool.contractAddress,
                          chainId: latestReport.pool.chainId,
                        }),
                      },
                    );
                    fetchDetail();
                  }}
                >
                  Deploy Pool
                </Button>
              </div>

              {latestReport?.pool && (
                <div className="rounded-md border border-border/60 p-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    <span className="font-medium">Pool</span>
                  </div>
                  <div className="mt-2">{latestReport.pool.poolName}</div>
                  <div className="text-xs text-muted-foreground">
                    Status: {latestReport.pool.poolStatus}
                  </div>
                  {latestReport.pool.contractAddress && (
                    <div className="text-xs text-muted-foreground">
                      Contract: {latestReport.pool.contractAddress}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Documents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3">
                {detail.submission.documents.map((doc) => (
                  <Card key={doc.documentId}>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <CardTitle className="text-sm">
                            {doc.fileName}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground">
                            {doc.documentType}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline">{doc.processingStatus}</Badge>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="text-xs text-muted-foreground">
                        {formatBytes(doc.fileSizeBytes)} • {doc.mimeType}
                      </div>
                      {doc.errorMessage && (
                        <div className="text-xs text-red-400">
                          {doc.errorMessage}
                        </div>
                      )}
                      {doc.extraction?.structuredData && (
                        <div className="grid gap-3 md:grid-cols-2">
                          {formatStructuredRows(
                            doc.extraction.structuredData,
                          ).map((row) => (
                            <div
                              key={row.key}
                              className="rounded-md border border-border/60 p-3"
                            >
                              <div className="text-xs text-muted-foreground">
                                {row.key}
                              </div>
                              <div className="text-sm font-medium">
                                {row.value}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Collateral Assets</CardTitle>
            </CardHeader>
            <CardContent>
              {detail.submission.collateralAssets.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No collateral assets yet.
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {detail.submission.collateralAssets.map((asset, index) => (
                    <Card key={`${asset.assetType}-${index}`}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">
                          {asset.assetType}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div className="text-xs text-muted-foreground">
                          {asset.description}
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Est.</span>
                          <span>{asset.estimatedValueUsd ?? "—"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Liquidation</span>
                          <span>{asset.liquidationValueUsd ?? "—"}</span>
                        </div>
                        <Badge variant="outline">
                          {asset.verificationStatus}
                        </Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Reports</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {detail.submission.reports.length === 0 ? (
                <div className="text-sm text-muted-foreground">No reports.</div>
              ) : (
                detail.submission.reports.map((report) => (
                  <div
                    key={report.reportId}
                    className="rounded-md border border-border/60 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">
                        Report {report.reportId.slice(0, 8)}
                      </div>
                      <Badge variant="outline">{report.status}</Badge>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm lg:grid-cols-3">
                      <div>Tier: {report.riskTier ?? "—"}</div>
                      <div>Score: {report.combinedRiskScore ?? "—"}</div>
                      <div>
                        Max Loan:{" "}
                        {report.maxLoanAmountUsd
                          ? formatCurrency(Number(report.maxLoanAmountUsd))
                          : "—"}
                      </div>
                    </div>
                    {report.reportData && (
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        {formatStructuredRows(report.reportData).map((row) => (
                          <div
                            key={row.key}
                            className="rounded-md border border-border/60 p-3"
                          >
                            <div className="text-xs text-muted-foreground">
                              {row.key}
                            </div>
                            <div className="text-sm font-medium">
                              {row.value}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
