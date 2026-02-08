"use client";

import { useWallet } from "@suiet/wallet-kit";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import Image from "next/image";

interface WalletSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WalletSelectionModal({
  open,
  onOpenChange,
}: WalletSelectionModalProps) {
  const { configuredWallets, detectedWallets, select } = useWallet();

  // Deduplicate wallets based on name
  const wallets = [...configuredWallets, ...detectedWallets].filter(
    (wallet, index, self) =>
      index === self.findIndex((w) => w.name === wallet.name),
  );

  const handleSelect = async (walletName: string) => {
    const wallet = wallets.find((w) => w.name === walletName);
    console.log("Selected wallet:", wallet);

    if (!wallet?.installed) {
      console.log("Wallet not installed:", walletName);
      if (wallet?.downloadUrl?.browserExtension) {
        window.open(wallet.downloadUrl.browserExtension, "_blank");
      }
      return;
    }

    try {
      await select(walletName);
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to connect wallet:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect Wallet</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4 max-h-[300px] overflow-y-auto pr-2">
          {wallets.map((wallet) => (
            <Button
              key={wallet.name}
              variant="outline"
              className="flex items-center justify-between h-14 px-4"
              onClick={() => handleSelect(wallet.name)}
            >
              <div className="flex items-center gap-3">
                {wallet.iconUrl && (
                  <img
                    src={wallet.iconUrl}
                    alt={wallet.name}
                    className="h-8 w-8 rounded-full"
                  />
                )}
                <span className="font-semibold">{wallet.name}</span>
              </div>
              {!wallet.installed && (
                <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                  Install
                </span>
              )}
            </Button>
          ))}
        </div>
        <div className="text-center text-sm text-muted-foreground">
          <p>
            New to Sui?{" "}
            <a
              href="https://suiet.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Learn more about wallets
            </a>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
