import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/contexts/wallet-context";
import { Navigation } from "@/components/navigation";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vesper | Global Crypto Lending Platform",
  description: "Decentralized lending platform for global borrowers and investors",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${jetbrainsMono.variable} antialiased`}>
        <WalletProvider>
          <Navigation />
          <main>{children}</main>
        </WalletProvider>
      </body>
    </html>
  );
}
