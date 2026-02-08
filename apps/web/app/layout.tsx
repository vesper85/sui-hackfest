import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import "@suiet/wallet-kit/style.css";
import { Navigation } from "@/components/navigation";
import { OnboardingGate } from "@/components/onboarding/onboarding-gate";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vesper | Global Crypto Lending Platform",
  description:
    "Decentralized lending platform for global borrowers and investors",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${jetbrainsMono.variable} antialiased`}>
        <Providers>
          <Navigation />
          <OnboardingGate />
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
