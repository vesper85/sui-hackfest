"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import type { WalletState } from "@/types";

interface WalletContextType {
    wallet: WalletState;
    connect: () => void;
    disconnect: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
    const [wallet, setWallet] = useState<WalletState>({
        isConnected: false,
        address: null,
        balance: null,
    });

    const connect = () => {
        // Mock wallet connection
        setWallet({
            isConnected: true,
            address: "0x1234...5678abcd",
            balance: 15000.50,
        });
    };

    const disconnect = () => {
        setWallet({
            isConnected: false,
            address: null,
            balance: null,
        });
    };

    return (
        <WalletContext.Provider value={{ wallet, connect, disconnect }}>
            {children}
        </WalletContext.Provider>
    );
}

export function useWallet() {
    const context = useContext(WalletContext);
    if (context === undefined) {
        throw new Error("useWallet must be used within a WalletProvider");
    }
    return context;
}
