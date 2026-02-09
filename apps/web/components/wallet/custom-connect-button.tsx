"use client";

import { useEffect, useRef, useState } from "react";
import { useWallet } from "@suiet/wallet-kit";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Wallet, ChevronDown, Copy, LogOut } from "lucide-react";
import { WalletSelectionModal } from "./wallet-selection-modal";
import { useUserStore, type UserState } from "@/store/user-store";

export function CustomConnectButton() {
  const {
    connected,
    address,
    account,
    disconnect,
    chain,
    signPersonalMessage,
  } = useWallet();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [authStatus, setAuthStatus] = useState<
    "idle" | "authenticating" | "authenticated" | "error"
  >("idle");
  const authInFlight = useRef(false);
  const manualConnect = useRef(false);
  const apiBase =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001/api";
  const resolvedAddress = address ?? account?.address;
  const setUser = useUserStore((state: UserState) => state.setUser);
  const clearUser = useUserStore((state: UserState) => state.clearUser);

  const formatAddress = (addr: string) => {
    if (!addr) return "";
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  };

  const copyAddress = () => {
    if (resolvedAddress) {
      navigator.clipboard.writeText(resolvedAddress);
      // Optional: Add toast notification here
    }
  };

  const handleDisconnect = () => {
    localStorage.removeItem("sui_auth_token");
    localStorage.removeItem("sui_auth_address");
    clearUser();
    disconnect();
  };

  useEffect(() => {
    if (!connected || !resolvedAddress) {
      if (authStatus !== "idle") {
        setAuthStatus("idle");
      }
      authInFlight.current = false;
      return;
    }

    if (!manualConnect.current) {
      return;
    }

    const storedToken = localStorage.getItem("sui_auth_token");
    const storedAddress = localStorage.getItem("sui_auth_address");
    if (storedToken && storedAddress === resolvedAddress) {
      setAuthStatus("authenticated");
      return;
    }

    if (authInFlight.current) {
      return;
    }

    authInFlight.current = true;
    manualConnect.current = false;
    setAuthStatus("authenticating");

    const authenticate = async () => {
      try {
        const nonceResponse = await fetch(`${apiBase}/auth/nonce`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ walletAddress: resolvedAddress }),
        });

        if (!nonceResponse.ok) {
          throw new Error("Failed to request nonce");
        }

        const noncePayload = await nonceResponse.json();
        const message = noncePayload.message as string;
        const nonce = noncePayload.nonce as string;
        const messageBytes = new TextEncoder().encode(message);

        const signed = await signPersonalMessage({ message: messageBytes });

        const verifyResponse = await fetch(`${apiBase}/auth/verify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            walletAddress: resolvedAddress,
            nonce,
            message,
            signature: signed.signature,
          }),
        });

        if (!verifyResponse.ok) {
          throw new Error("Failed to verify signature");
        }

        const verifyPayload = await verifyResponse.json();
        const token = verifyPayload.token as string;
        const user = verifyPayload.user as {
          id: number;
          walletAddress: string;
          userType: "borrower" | "lender" | "admin";
          onboardingStatus?: "pending" | "completed";
          onboardingData?: unknown;
        };

        localStorage.setItem("sui_auth_token", token);
        localStorage.setItem("sui_auth_address", resolvedAddress);
        setUser({
          userId: user.id,
          walletAddress: user.walletAddress,
          role: user.userType,
          onboardingStatus: user.onboardingStatus ?? null,
          onboardingData: (user.onboardingData ?? null) as any,
        });
        setAuthStatus("authenticated");
      } catch (error) {
        console.warn("Wallet auth failed", error);
        setAuthStatus("error");
      } finally {
        authInFlight.current = false;
      }
    };

    authenticate();
  }, [
    account?.address,
    apiBase,
    authStatus,
    connected,
    resolvedAddress,
    signPersonalMessage,
  ]);

  useEffect(() => {
    if (!connected || !resolvedAddress) {
      return;
    }

    const storedToken = localStorage.getItem("sui_auth_token");
    if (!storedToken) {
      return;
    }

    const syncUser = async () => {
      try {
        const response = await fetch(`${apiBase}/account/me`, {
          headers: {
            Authorization: `Bearer ${storedToken}`,
          },
        });

        if (!response.ok) {
          return;
        }

        const payload = await response.json();
        if (!payload.user) {
          return;
        }

        setUser({
          userId: payload.user.id as number,
          walletAddress: payload.user.walletAddress as string,
          role: payload.user.userType as "borrower" | "lender" | "admin",
          onboardingStatus:
            (payload.user.onboardingStatus as "pending" | "completed") ?? null,
          onboardingData: (payload.user.onboardingData ?? null) as any,
        });
      } catch (error) {
        console.warn("Failed to sync user", error);
      }
    };

    syncUser();
  }, [apiBase, connected, resolvedAddress, setUser]);

  if (connected && resolvedAddress) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2">
            <Wallet className="h-4 w-4" />
            <span className="hidden sm:inline">
              {formatAddress(resolvedAddress)}
            </span>
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="px-2 py-1 text-xs text-muted-foreground">
            {authStatus === "authenticated" && "Authenticated"}
            {authStatus === "authenticating" && "Authenticating..."}
            {authStatus === "error" && "Auth failed"}
          </div>
          <div className="flex items-center justify-between px-2 py-1.5 text-sm font-semibold">
            <span>Sui Network</span>
            <span className="text-xs text-muted-foreground">
              {chain?.name || "Unknown"}
            </span>
          </div>
          <DropdownMenuItem onClick={copyAddress} className="cursor-pointer">
            <Copy className="mr-2 h-4 w-4" />
            <span>Copy Address</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleDisconnect}
            className="text-red-500 cursor-pointer focus:text-red-500"
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span>Disconnect</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <>
      <Button
        onClick={() => {
          manualConnect.current = true;
          setIsModalOpen(true);
        }}
        className="gap-2"
      >
        <Wallet className="h-4 w-4" />
        Connect Wallet
      </Button>
      <WalletSelectionModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onWalletSelect={() => {
          manualConnect.current = true;
        }}
      />
    </>
  );
}
