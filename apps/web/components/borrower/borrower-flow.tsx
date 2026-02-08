"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  RefreshCcw,
  Upload,
  Coins,
  Shield,
  FileCheck,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useUserStore } from "@/store/user-store";
import { useContract, type TransactionResult } from "@/hooks/useContract";

const documentTypes = [
  { id: "bank_statement", name: "Bank Statement", required: true },
  { id: "tax_return", name: "Tax Return", required: true },
  { id: "pay_stub", name: "Pay Stub", required: true },
  { id: "id_document", name: "ID Document", required: true },
  { id: "property_deed", name: "Property Deed", required: true },
  { id: "business_financials", name: "Business Financials", required: false },
  { id: "vehicle_title", name: "Vehicle Title", required: false },
  {
    id: "crypto_wallet_statement",
    name: "Crypto Wallet Statement",
    required: false,
  },
  { id: "investment_statement", name: "Investment Statement", required: false },
  { id: "other", name: "Other Supporting Docs", required: false },
];

type DocumentState = {
  status:
    | "idle"
    | "selected"
    | "uploading"
    | "uploaded"
    | "processing"
    | "completed"
    | "failed";
  fileName?: string;
  serverStatus?: string;
  error?: string;
};

type SubmissionState = {
  id: string;
  reference: string;
  status: string;
};

type SubmissionDetail = {
  status: string;
  progress: {
    totalDocuments: number;
    processedDocuments: number;
    percentage: number;
  };
  documents: Array<{
    documentType: string;
    fileName: string;
    processingStatus: string;
    errorMessage?: string | null;
  }>;
};

type UnderwritingReport = {
  reportId: string;
  status: string;
  lendingTerms: {
    maxLoanAmount: number;
    recommendedInterestRate: number;
    recommendedLoanTermDays: number;
    recommendedLTV: number;
  };
};

type BorrowerLoan = {
  loanId: string;
  status: string;
  principalUsd: number;
  interestRate: number;
  loanTermDays: number;
  totalRepaymentAmountUsd: number;
  outstandingBalanceUsd: number;
  maturityDate: string | null;
  pool: {
    poolId: string;
    poolName: string;
    poolStatus: string;
    riskTier: string | null;
    contractAddress: string | null;
    currentApy: number;
    availableLiquidityUsd: number;
  } | null;
  repaymentSchedule: Array<{
    dueDate: string;
    paymentAmount: number;
    principalAmount: number;
    interestAmount: number;
    status: string;
  }>;
  repayments: Array<{
    repaymentId: string;
    amountUsd: number;
    principalUsd: number;
    interestUsd: number;
    paymentDate: string;
    dueDate: string | null;
    txHash: string;
  }>;
};

type BorrowerNft = {
  id: string;
  name: string;
  description: string;
  portfolioId: string;
  principalAmount: string;
  status: string;
  objectId: string | null;
  mintedAt: string | null;
  txHash: string | null;
  underwriting: {
    probOfDefault: string;
    lossGivenDefault: string;
    riskScore: number;
    exposureAtDefault: string;
    underwritten: boolean;
  };
};

export function BorrowerFlow() {
  const apiBase =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
  const { onboardingData, walletAddress } = useUserStore();
  const borrowerType = onboardingData?.borrowerType ?? "individual";
  const contract = useContract();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [submission, setSubmission] = useState<SubmissionState | null>(null);
  const [submissionDetail, setSubmissionDetail] =
    useState<SubmissionDetail | null>(null);
  const [documents, setDocuments] = useState<Record<string, DocumentState>>({});
  const [pendingFiles, setPendingFiles] = useState<Record<string, File | null>>(
    {},
  );
  const [report, setReport] = useState<UnderwritingReport | null>(null);
  const [loans, setLoans] = useState<BorrowerLoan[]>([]);
  const [loansLoading, setLoansLoading] = useState(false);
  const [nfts, setNfts] = useState<BorrowerNft[]>([]);
  const [nftsLoading, setNftsLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    submission: true,
    documents: true,
    report: true,
    nfts: true,
    loans: true,
  });
  const resumeAttempted = useRef(false);
  const lastWallet = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState({
    creating: false,
    refreshing: false,
    finalizing: false,
    fetchingReport: false,
    applying: false,
    uploadingDocs: false,
    loadingLoans: false,
    withdrawing: false,
    repaying: false,
    mintingNft: false,
    loadingNfts: false,
  });

  const requiredCount = documentTypes.filter((doc) => doc.required).length;
  const uploadedCount = documentTypes.filter((doc) => {
    const status = documents[doc.id]?.status;
    return (
      status &&
      status !== "idle" &&
      status !== "selected" &&
      status !== "uploading" &&
      status !== "failed"
    );
  }).length;

  const uploadProgress = useMemo(() => {
    if (documentTypes.length === 0) return 0;
    return (uploadedCount / documentTypes.length) * 100;
  }, [uploadedCount]);

  const pendingCount = useMemo(
    () => Object.values(pendingFiles).filter(Boolean).length,
    [pendingFiles],
  );

  const getAuthToken = () => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("sui_auth_token");
  };

  const authHeaders = (): HeadersInit | null => {
    const token = getAuthToken();
    if (!token) {
      setError("Missing auth token. Reconnect your wallet.");
      return null;
    }
    return { Authorization: `Bearer ${token}` };
  };

  useEffect(() => {
    if (walletAddress && walletAddress !== lastWallet.current) {
      resumeAttempted.current = false;
      lastWallet.current = walletAddress;
    }
  }, [walletAddress]);

  useEffect(() => {
    if (submission || resumeAttempted.current) {
      return;
    }

    if (!walletAddress) {
      return;
    }

    const token = getAuthToken();
    if (!token) {
      return;
    }

    resumeAttempted.current = true;

    const resume = async () => {
      try {
        const response = await fetch(`${apiBase}/borrower/submission/active`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.status === 404) {
          return;
        }

        if (!response.ok) {
          throw new Error("Failed to load active submission");
        }

        const payload = await response.json();
        setSubmission({
          id: payload.submissionId as string,
          reference: payload.submissionReference as string,
          status: payload.status as string,
        });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to resume submission",
        );
      }
    };

    resume();
  }, [apiBase, submission, walletAddress]);

  const updateDocument = (docType: string, patch: Partial<DocumentState>) => {
    setDocuments((prev) => ({
      ...prev,
      [docType]: {
        status: "idle",
        ...prev[docType],
        ...patch,
      },
    }));
  };

  const createSubmission = async () => {
    setError(null);
    setBusy((prev) => ({ ...prev, creating: true }));

    try {
      const headers = authHeaders();
      if (!headers) return;

      const response = await fetch(`${apiBase}/borrower/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify({
          borrowerType,
          fullName,
          businessName: borrowerType === "business" ? businessName : undefined,
          email,
          metadata: onboardingData ?? undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create submission");
      }

      const payload = await response.json();
      setSubmission({
        id: payload.submissionId as string,
        reference: payload.submissionReference as string,
        status: payload.status as string,
      });
      setSubmissionDetail(null);
      setReport(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to create submission",
      );
    } finally {
      setBusy((prev) => ({ ...prev, creating: false }));
    }
  };

  const uploadDocument = async (docType: string, file: File) => {
    if (!submission || !submission.id) {
      setError("Create a submission before uploading documents.");
      return false;
    }

    setError(null);
    updateDocument(docType, {
      status: "uploading",
      fileName: file.name,
      error: undefined,
    });

    try {
      const formData = new FormData();
      formData.append("submissionId", submission.id);
      formData.append("documentType", docType);
      formData.append("file", file);

      const headers = authHeaders();
      if (!headers) return false;

      const response = await fetch(`${apiBase}/borrower/upload-document`, {
        method: "POST",
        headers: {
          ...headers,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      updateDocument(docType, { status: "uploaded", serverStatus: "pending" });
      return true;
    } catch (err) {
      updateDocument(docType, {
        status: "failed",
        error: err instanceof Error ? err.message : "Upload failed",
      });
      return false;
    }
  };

  const submitDocuments = async () => {
    if (!submission || !submission.id) {
      setError("Create a submission before uploading documents.");
      return;
    }
    const entries = Object.entries(pendingFiles).filter(([, file]) => file);

    if (entries.length === 0) {
      setError("Select documents before submitting.");
      return;
    }

    setError(null);
    setBusy((prev) => ({ ...prev, uploadingDocs: true }));

    try {
      for (const [docType, file] of entries) {
        if (!file) continue;
        const success = await uploadDocument(docType, file);
        if (success) {
          setPendingFiles((prev) => ({ ...prev, [docType]: null }));
        }
      }
    } finally {
      setBusy((prev) => ({ ...prev, uploadingDocs: false }));
    }
  };

  const refreshSubmission = async () => {
    if (!submission) return;
    setError(null);
    setBusy((prev) => ({ ...prev, refreshing: true }));

    try {
      const headers = authHeaders();
      if (!headers) return;

      const response = await fetch(
        `${apiBase}/borrower/submission/${submission.id}`,
        {
          headers: {
            ...headers,
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to fetch submission status");
      }

      const payload = await response.json();
      setSubmissionDetail({
        status: payload.status as string,
        progress: payload.progress,
        documents: payload.documents,
      });
      setSubmission((prev) =>
        prev ? { ...prev, status: payload.status as string } : prev,
      );

      payload.documents.forEach(
        (doc: {
          documentType: string;
          fileName: string;
          processingStatus: string;
          errorMessage?: string | null;
        }) => {
          const mappedStatus =
            doc.processingStatus === "completed"
              ? "completed"
              : doc.processingStatus === "failed"
                ? "failed"
                : "processing";

          updateDocument(doc.documentType, {
            status: mappedStatus,
            fileName: doc.fileName,
            serverStatus: doc.processingStatus,
            error: doc.errorMessage ?? undefined,
          });
        },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to refresh status");
    } finally {
      setBusy((prev) => ({ ...prev, refreshing: false }));
    }
  };

  useEffect(() => {
    if (!submission) return;
    refreshSubmission();
  }, [submission?.id]);

  useEffect(() => {
    if (!walletAddress) return;
    fetchLoans();
    fetchNfts();
  }, [walletAddress]);

  const finalizeSubmission = async () => {
    if (!submission) return;
    setError(null);
    setBusy((prev) => ({ ...prev, finalizing: true }));

    try {
      const headers = authHeaders();
      if (!headers) return;

      const response = await fetch(`${apiBase}/borrower/finalize-submission`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify({ submissionId: submission.id }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message =
          payload?.error?.message ?? "Failed to finalize submission";
        throw new Error(message);
      }

      const payload = await response.json();
      setSubmission((prev) =>
        prev ? { ...prev, status: payload.status } : prev,
      );
      await fetchLoans();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to finalize submission",
      );
    } finally {
      setBusy((prev) => ({ ...prev, finalizing: false }));
    }
  };

  const fetchReport = async () => {
    if (!submission) return;
    setError(null);
    setBusy((prev) => ({ ...prev, fetchingReport: true }));

    try {
      const headers = authHeaders();
      if (!headers) return;

      const response = await fetch(
        `${apiBase}/borrower/report/${submission.id}`,
        {
          headers: {
            ...headers,
          },
        },
      );

      if (!response.ok) {
        throw new Error("Underwriting report not ready");
      }

      const payload = await response.json();
      setReport({
        reportId: payload.reportId,
        status: payload.status,
        lendingTerms: payload.lendingTerms,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load report");
    } finally {
      setBusy((prev) => ({ ...prev, fetchingReport: false }));
    }
  };

  const fetchLoans = async () => {
    setError(null);
    setLoansLoading(true);
    setBusy((prev) => ({ ...prev, loadingLoans: true }));

    try {
      const headers = authHeaders();
      if (!headers) return;

      const response = await fetch(`${apiBase}/borrower/loans`, {
        headers: {
          ...headers,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to load loans");
      }

      const payload = await response.json();
      setLoans(payload.loans ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load loans");
    } finally {
      setLoansLoading(false);
      setBusy((prev) => ({ ...prev, loadingLoans: false }));
    }
  };

  const fetchNfts = async () => {
    setError(null);
    setNftsLoading(true);
    setBusy((prev) => ({ ...prev, loadingNfts: true }));

    try {
      const headers = authHeaders();
      if (!headers) return;

      const response = await fetch(`${apiBase}/borrower/nfts`, {
        headers: {
          ...headers,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to load NFTs");
      }

      const payload = await response.json();
      setNfts(payload.nfts ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load NFTs");
    } finally {
      setNftsLoading(false);
      setBusy((prev) => ({ ...prev, loadingNfts: false }));
    }
  };

  const mintNft = async () => {
    if (!submission || !walletAddress || !report) {
      setError("Submission, wallet, and approved report required to mint NFT");
      return;
    }

    if (!contract.isConnected) {
      setError("Please connect your wallet first");
      return;
    }

    setError(null);
    setBusy((prev) => ({ ...prev, mintingNft: true }));

    try {
      // Prepare NFT mint parameters from report data
      const principalAmount = Math.round(
        report.lendingTerms.maxLoanAmount * 1000000,
      ); // Convert to base units
      const loanTermDays = report.lendingTerms.recommendedLoanTermDays;
      const maturityDate = new Date();
      maturityDate.setDate(maturityDate.getDate() + loanTermDays);

      const maturityDateStr = maturityDate.toISOString().split("T")[0];
      const mintParams = {
        name: `Collateral NFT - ${submission.reference}`,
        description: `Tokenized collateral for loan portfolio`,
        portfolioId: `PF-${submission.reference}`,
        noOfLoans: 1,
        totalPrincipalAmount: principalAmount,
        averageInterestRate: report.lendingTerms.recommendedInterestRate,
        portfolioTerm: `${loanTermDays} days`,
        portfolioStatus: "active",
        maturityDate:
          maturityDateStr || new Date().toISOString().split("T")[0]!,
      };

      // Call contract to mint NFT (client-side)
      const result = await contract.mintNft(mintParams);

      if (result.status === "error") {
        throw new Error(result.error || "Failed to mint NFT");
      }

      if (result.status === "success" && result.objectId && result.digest) {
        // Register the minted NFT with the backend
        const headers = authHeaders();
        if (!headers) return;

        const registerResponse = await fetch(
          `${apiBase}/borrower/nfts/register`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...headers,
            },
            body: JSON.stringify({
              submissionId: submission.id,
              walletAddress,
              contractObjectId: result.objectId,
              mintTxHash: result.digest,
              ...mintParams,
            }),
          },
        );

        if (!registerResponse.ok) {
          console.warn(
            "NFT minted on-chain but failed to register with backend",
          );
        }

        // Refresh NFTs list
        await fetchNfts();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to mint NFT");
    } finally {
      setBusy((prev) => ({ ...prev, mintingNft: false }));
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const withdrawFunds = async (loanId: string) => {
    setError(null);
    setBusy((prev) => ({ ...prev, withdrawing: true }));

    try {
      const headers = authHeaders();
      if (!headers) return;

      const response = await fetch(
        `${apiBase}/borrower/loan/${loanId}/withdraw`,
        {
          method: "POST",
          headers: {
            ...headers,
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to withdraw funds");
      }

      await fetchLoans();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to withdraw");
    } finally {
      setBusy((prev) => ({ ...prev, withdrawing: false }));
    }
  };

  const repayFullBalance = async (loan: BorrowerLoan) => {
    setError(null);
    setBusy((prev) => ({ ...prev, repaying: true }));

    try {
      const headers = authHeaders();
      if (!headers) return;

      const response = await fetch(
        `${apiBase}/borrower/loan/${loan.loanId}/repay`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...headers,
          },
          body: JSON.stringify({
            amount: loan.outstandingBalanceUsd,
            paymentMethod: "off_chain",
            txHash: `mock-${Date.now()}`,
          }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to repay loan");
      }

      await fetchLoans();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to repay loan");
    } finally {
      setBusy((prev) => ({ ...prev, repaying: false }));
    }
  };

  const applyLoan = async () => {
    if (!report) return;
    if (!walletAddress) {
      setError("Missing wallet address. Reconnect your wallet.");
      return;
    }
    setError(null);
    setBusy((prev) => ({ ...prev, applying: true }));

    try {
      const headers = authHeaders();
      if (!headers) return;

      const response = await fetch(`${apiBase}/borrower/apply-loan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify({
          reportId: report.reportId,
          requestedAmount: report.lendingTerms.maxLoanAmount,
          requestedTermDays: report.lendingTerms.recommendedLoanTermDays,
          collateralAssetIds: [],
          walletAddress,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message = payload?.error?.message ?? "Failed to apply for loan";
        throw new Error(message);
      }

      const payload = await response.json();
      setSubmission((prev) =>
        prev ? { ...prev, status: payload.status } : prev,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to apply for loan");
    } finally {
      setBusy((prev) => ({ ...prev, applying: false }));
    }
  };

  const statusIcon = (docType: string) => {
    const status = documents[docType]?.status ?? "idle";
    if (status === "completed") {
      return <CheckCircle2 className="h-5 w-5 text-emerald-400" />;
    }
    if (status === "failed") {
      return <AlertTriangle className="h-5 w-5 text-red-400" />;
    }
    if (status === "processing" || status === "uploaded") {
      return <Clock className="h-5 w-5 text-amber-400" />;
    }
    if (status === "uploading") {
      return <Upload className="h-5 w-5 text-primary" />;
    }
    if (status === "selected") {
      return <Upload className="h-5 w-5 text-primary" />;
    }
    return <Clock className="h-5 w-5 text-muted-foreground" />;
  };

  return (
    <div className="grid gap-8 md:grid-cols-3">
      <div className="md:col-span-2 space-y-6">
        {submission ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Borrower Submission</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline">Ref {submission.reference}</Badge>
                <Badge variant="secondary">Status: {submission.status}</Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                Your submission is active. Add documents below.
              </div>
              {error && <div className="text-sm text-red-400">{error}</div>}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Borrower Submission</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Full name</p>
                  <Input
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Jane Doe"
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Email</p>
                  <Input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="jane@company.com"
                  />
                </div>
                {borrowerType === "business" && (
                  <div className="space-y-2 md:col-span-2">
                    <p className="text-xs text-muted-foreground">
                      Business name
                    </p>
                    <Input
                      value={businessName}
                      onChange={(event) => setBusinessName(event.target.value)}
                      placeholder="Company LLC"
                    />
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-muted-foreground">
                  Borrower type:{" "}
                  <span className="text-foreground">{borrowerType}</span>
                </div>
                <Button
                  onClick={createSubmission}
                  disabled={!fullName || !email || busy.creating}
                >
                  {busy.creating ? "Creating..." : "Create Submission"}
                </Button>
              </div>
              {error && <div className="text-sm text-red-400">{error}</div>}
            </CardContent>
          </Card>
        )}

        {submission ? (
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
              <Progress value={uploadProgress} className="mt-2" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {documentTypes.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex flex-col gap-3 rounded-md border border-border/60 bg-muted/40 p-3 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="flex items-start gap-3">
                      {statusIcon(doc.id)}
                      <div>
                        <p className="text-sm font-medium">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {doc.required ? "Required" : "Optional"}
                        </p>
                        {documents[doc.id]?.fileName && (
                          <p className="text-xs text-muted-foreground">
                            {documents[doc.id]?.fileName}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      {pendingFiles[doc.id] && (
                        <Badge variant="secondary">Selected</Badge>
                      )}
                      {documents[doc.id]?.status === "failed" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            const file = pendingFiles[doc.id];
                            if (!file) {
                              setError("Select a file to retry upload.");
                              return;
                            }
                            const success = await uploadDocument(doc.id, file);
                            if (success) {
                              setPendingFiles((prev) => ({
                                ...prev,
                                [doc.id]: null,
                              }));
                            }
                          }}
                        >
                          Retry
                        </Button>
                      )}
                      {documents[doc.id]?.serverStatus && (
                        <Badge variant="outline">
                          {documents[doc.id]?.serverStatus}
                        </Badge>
                      )}
                      <Input
                        type="file"
                        accept=".pdf,image/*"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) {
                            setPendingFiles((prev) => ({
                              ...prev,
                              [doc.id]: file,
                            }));
                            updateDocument(doc.id, {
                              status: "selected",
                              fileName: file.name,
                              error: undefined,
                            });
                          }
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                Create a submission to upload borrower documents.
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col gap-3 md:flex-row">
          <Button
            variant="outline"
            onClick={refreshSubmission}
            disabled={!submission || busy.refreshing}
            className="gap-2"
          >
            <RefreshCcw className="h-4 w-4" />
            {busy.refreshing ? "Refreshing..." : "Refresh Status"}
          </Button>
          <Button
            className="flex-1"
            size="lg"
            onClick={submitDocuments}
            disabled={!submission || pendingCount === 0 || busy.uploadingDocs}
          >
            {busy.uploadingDocs ? "Uploading..." : "Submit Documents"}
          </Button>
        </div>

        <Button
          variant="secondary"
          size="lg"
          onClick={finalizeSubmission}
          disabled={
            !submission || uploadedCount < requiredCount || busy.finalizing
          }
        >
          {busy.finalizing ? "Finalizing..." : "Finalize Submission"}
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Underwriting Report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              variant="outline"
              onClick={fetchReport}
              disabled={!submission || busy.fetchingReport}
            >
              {busy.fetchingReport ? "Checking..." : "Fetch Report"}
            </Button>
            {report && (
              <div className="space-y-3 text-sm">
                <div>Report status: {report.status}</div>
                <div>
                  Max loan: $
                  {report.lendingTerms.maxLoanAmount.toLocaleString()}
                </div>
                <div>
                  Rate: {report.lendingTerms.recommendedInterestRate}% • Term:{" "}
                  {report.lendingTerms.recommendedLoanTermDays} days
                </div>
                {report.status === "approved" ? (
                  <Button onClick={applyLoan} disabled={busy.applying}>
                    {busy.applying ? "Applying..." : "Apply for Loan"}
                  </Button>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    Apply button appears after admin approval.
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* NFT Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Coins className="h-4 w-4" />
                Collateral NFTs
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchNfts}
                  disabled={busy.loadingNfts}
                >
                  {busy.loadingNfts ? "Loading..." : "Refresh"}
                </Button>
                {report?.status === "approved" && nfts.length === 0 && (
                  <Button
                    size="sm"
                    onClick={mintNft}
                    disabled={busy.mintingNft || !submission}
                  >
                    {busy.mintingNft ? "Minting..." : "Mint NFT"}
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {nftsLoading ? (
              <div className="text-sm text-muted-foreground">
                Loading NFTs...
              </div>
            ) : nfts.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No NFTs minted yet.
                {report?.status === "approved"
                  ? "Click 'Mint NFT' to tokenize your collateral after approval."
                  : "NFT minting available after underwriting approval."}
              </div>
            ) : (
              nfts.map((nft) => (
                <div
                  key={nft.id}
                  className="rounded-md border border-border/60 p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-primary" />
                      <div className="text-sm font-medium">{nft.name}</div>
                    </div>
                    <Badge
                      variant={
                        nft.status === "minted" ? "default" : "secondary"
                      }
                    >
                      {nft.status}
                    </Badge>
                  </div>

                  <div className="grid gap-2 text-sm md:grid-cols-2">
                    <div>Portfolio ID: {nft.portfolioId}</div>
                    <div>
                      Principal: $
                      {parseFloat(nft.principalAmount).toLocaleString()}
                    </div>
                    <div>Risk Score: {nft.underwriting.riskScore}/100</div>
                    <div>
                      Default Prob:{" "}
                      {(
                        parseFloat(nft.underwriting.probOfDefault) * 100
                      ).toFixed(1)}
                      %
                    </div>
                  </div>

                  {nft.objectId && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <span>Object ID:</span>
                      <a
                        href={`https://explorer.sui.io/object/${nft.objectId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        {nft.objectId.slice(0, 16)}...
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}

                  {nft.txHash && (
                    <div className="text-xs text-muted-foreground">
                      TX: {nft.txHash.slice(0, 20)}...
                    </div>
                  )}

                  {nft.mintedAt && (
                    <div className="text-xs text-muted-foreground">
                      Minted: {new Date(nft.mintedAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Loans & Pools Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Loans & Pools</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchLoans}
                disabled={busy.loadingLoans}
              >
                {busy.loadingLoans ? "Refreshing..." : "Refresh"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {loansLoading ? (
              <div className="text-sm text-muted-foreground">
                Loading loans...
              </div>
            ) : loans.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No loans yet. Apply after approval to generate a loan.
              </div>
            ) : (
              loans.map((loan) => (
                <div
                  key={loan.loanId}
                  className="rounded-md border border-border/60 p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-medium">
                      Loan {loan.loanId.slice(0, 8)}
                    </div>
                    <Badge variant="outline">{loan.status}</Badge>
                  </div>
                  <div className="grid gap-2 text-sm md:grid-cols-2">
                    <div>Principal: ${loan.principalUsd.toLocaleString()}</div>
                    <div>
                      Outstanding: $
                      {loan.outstandingBalanceUsd.toLocaleString()}
                    </div>
                    <div>Rate: {loan.interestRate}%</div>
                    <div>Term: {loan.loanTermDays} days</div>
                  </div>
                  {loan.pool && (
                    <div className="rounded-md bg-muted/40 p-3 text-sm">
                      <div className="font-medium">Pool</div>
                      <div>{loan.pool.poolName}</div>
                      <div className="text-xs text-muted-foreground">
                        Status: {loan.pool.poolStatus}
                      </div>
                      {loan.pool.contractAddress && (
                        <div className="text-xs text-muted-foreground">
                          Contract: {loan.pool.contractAddress}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        Available: $
                        {loan.pool.availableLiquidityUsd.toLocaleString()}
                      </div>
                    </div>
                  )}
                  {loan.repaymentSchedule.length > 0 && (
                    <div className="text-sm">
                      <div className="font-medium mb-2">Repayment Schedule</div>
                      {loan.repaymentSchedule.map((item, index) => (
                        <div
                          key={`${loan.loanId}-schedule-${index}`}
                          className="flex items-center justify-between text-xs border-b border-border/40 py-2"
                        >
                          <span>
                            Due {new Date(item.dueDate).toLocaleDateString()}
                          </span>
                          <span>${item.paymentAmount.toLocaleString()}</span>
                          <Badge variant="outline">{item.status}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                  {loan.repayments.length > 0 && (
                    <div className="text-sm">
                      <div className="font-medium mb-2">Repayments</div>
                      {loan.repayments.map((repayment) => (
                        <div
                          key={repayment.repaymentId}
                          className="flex items-center justify-between text-xs border-b border-border/40 py-2"
                        >
                          <span>
                            {new Date(
                              repayment.paymentDate,
                            ).toLocaleDateString()}
                          </span>
                          <span>${repayment.amountUsd.toLocaleString()}</span>
                          <span className="text-muted-foreground">
                            {repayment.txHash.slice(0, 10)}...
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {loan.pool?.poolStatus === "active" &&
                      (loan.status === "pending_approval" ||
                        loan.status === "approved") && (
                        <Button
                          size="sm"
                          onClick={() => withdrawFunds(loan.loanId)}
                          disabled={busy.withdrawing}
                        >
                          {busy.withdrawing
                            ? "Withdrawing..."
                            : "Withdraw Funds"}
                        </Button>
                      )}
                    {loan.status === "active" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => repayFullBalance(loan)}
                        disabled={busy.repaying}
                      >
                        {busy.repaying ? "Repaying..." : "Repay Full Balance"}
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Request Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 rounded-md border border-border/60 bg-muted/40 p-4">
              {submission ? (
                <CheckCircle2 className="h-8 w-8 text-primary" />
              ) : (
                <Clock className="h-8 w-8 text-muted-foreground" />
              )}
              <div>
                <p className="font-medium">
                  {submission ? "Submission Active" : "No Active Request"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {submission
                    ? `Current status: ${submission.status}`
                    : "Create a submission to begin"}
                </p>
              </div>
            </div>
            {submissionDetail && (
              <div className="mt-4 text-xs text-muted-foreground">
                Processing {submissionDetail.progress.processedDocuments}/
                {submissionDetail.progress.totalDocuments} documents
              </div>
            )}
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
  );
}
