import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { SuiClientProvider } from "@/hooks/useSuiClient";
import "@suiet/wallet-kit/style.css";
import { Navigation } from "@/components/navigation";
import { OnboardingGate } from "@/components/onboarding/onboarding-gate";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "currentZK | Global Crypto Lending Platform",
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
          <SuiClientProvider>
            <Navigation />
            <OnboardingGate />
            <main>{children}</main>
          </SuiClientProvider>
        </Providers>
      </body>
    </html>
  );
}
