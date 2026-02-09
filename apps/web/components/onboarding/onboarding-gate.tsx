"use client";

import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@suiet/wallet-kit";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUserStore, type UserState } from "@/store/user-store";

type RoleSelection = "investor" | "borrower" | null;
type BorrowerType = "individual" | "business" | null;

export function OnboardingGate() {
  const { connected } = useWallet();
  const userId = useUserStore((state: UserState) => state.userId);
  const role = useUserStore((state: UserState) => state.role);
  const onboardingStatus = useUserStore(
    (state: UserState) => state.onboardingStatus,
  );
  const setUser = useUserStore((state: UserState) => state.setUser);
  const apiBase =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001/api";

  const [selectedRole, setSelectedRole] = useState<RoleSelection>(null);
  const [borrowerType, setBorrowerType] = useState<BorrowerType>(null);
  const [assets, setAssets] = useState("");
  const [requestedAmount, setRequestedAmount] = useState("");
  const [tenureMonths, setTenureMonths] = useState("");
  const [purpose, setPurpose] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shouldShow = Boolean(
    connected && userId && onboardingStatus !== "completed",
  );

  const inferredRole = useMemo<RoleSelection>(() => {
    if (role === "lender") return "investor";
    if (role === "borrower") return "borrower";
    return null;
  }, [role]);

  useEffect(() => {
    if (!shouldShow) {
      return;
    }
    if (!selectedRole && inferredRole) {
      setSelectedRole(inferredRole);
    }
  }, [inferredRole, selectedRole, shouldShow]);

  const handleSubmit = async () => {
    if (!selectedRole) {
      setError("Select a role to continue");
      return;
    }

    if (selectedRole === "borrower") {
      if (!borrowerType) {
        setError("Select your borrower type");
        return;
      }
      if (!assets.trim()) {
        setError("Add at least one asset type");
        return;
      }
      if (!requestedAmount.trim()) {
        setError("Enter a requested amount");
        return;
      }
      if (!tenureMonths.trim()) {
        setError("Enter a loan tenure");
        return;
      }
      if (!purpose.trim()) {
        setError("Enter the loan purpose");
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      const token = localStorage.getItem("sui_auth_token");
      if (!token) {
        throw new Error("Missing auth token");
      }

      const assetList = assets
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);

      const payload =
        selectedRole === "investor"
          ? { role: "investor" as const }
          : {
              role: "borrower" as const,
              borrowerType,
              assets: assetList,
              requestedAmountUsd: Number(requestedAmount),
              tenureMonths: Number(tenureMonths),
              purpose,
            };

      const response = await fetch(`${apiBase}/account/onboarding`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to save onboarding");
      }

      const result = await response.json();
      setUser({
        userId: result.user.id as number,
        walletAddress: result.user.walletAddress as string,
        role: result.user.userType as UserState["role"],
        onboardingStatus: result.user
          .onboardingStatus as UserState["onboardingStatus"],
        onboardingData: result.user
          .onboardingData as UserState["onboardingData"],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onboarding failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (!shouldShow) {
    return null;
  }

  return (
    <Dialog open={shouldShow} onOpenChange={() => {}}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Complete Onboarding</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Choose your role</p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={selectedRole === "investor" ? "default" : "outline"}
                onClick={() => setSelectedRole("investor")}
              >
                Investor
              </Button>
              <Button
                type="button"
                variant={selectedRole === "borrower" ? "default" : "outline"}
                onClick={() => setSelectedRole("borrower")}
              >
                Borrower
              </Button>
            </div>
          </div>

          {selectedRole === "borrower" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Borrower type</p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={
                      borrowerType === "individual" ? "default" : "outline"
                    }
                    onClick={() => setBorrowerType("individual")}
                  >
                    Individual
                  </Button>
                  <Button
                    type="button"
                    variant={
                      borrowerType === "business" ? "default" : "outline"
                    }
                    onClick={() => setBorrowerType("business")}
                  >
                    Business
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">
                  Assets (comma-separated)
                </label>
                <Input
                  placeholder="Real estate, crypto, inventory"
                  value={assets}
                  onChange={(event) => setAssets(event.target.value)}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">
                    Requested Amount (USDC)
                  </label>
                  <Input
                    type="number"
                    placeholder="1,000,000"
                    value={requestedAmount}
                    onChange={(event) => setRequestedAmount(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">
                    Tenure (months)
                  </label>
                  <Input
                    type="number"
                    placeholder="12"
                    value={tenureMonths}
                    onChange={(event) => setTenureMonths(event.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">
                  Purpose of Loan
                </label>
                <Input
                  placeholder="Working capital for expansion"
                  value={purpose}
                  onChange={(event) => setPurpose(event.target.value)}
                />
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? "Saving..." : "Save Onboarding"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
