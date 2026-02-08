"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CustomConnectButton } from "@/components/wallet/custom-connect-button";
import { LayoutDashboard, Users, Shield } from "lucide-react";

const navItems = [
    { href: "/investor", label: "Investor", icon: LayoutDashboard },
    { href: "/borrower", label: "Borrower", icon: Users },
    { href: "/admin", label: "Admin", icon: Shield },
];

export function Navigation() {
    const pathname = usePathname();


    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="mx-auto max-w-7xl flex h-16 items-center justify-between px-4 lg:px-8">
                <div className="flex items-center gap-8">
                    <Link href="/" className="flex items-center gap-2">
                        <div className="h-8 w-8 bg-primary flex items-center justify-center">
                            <span className="text-primary-foreground font-bold text-lg">V</span>
                        </div>
                        <span className="font-bold text-xl">Vesper</span>
                    </Link>
                    <nav className="hidden md:flex items-center gap-1">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={cn(
                                        "flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors hover:text-primary",
                                        pathname.startsWith(item.href)
                                            ? "text-primary"
                                            : "text-muted-foreground"
                                    )}
                                >
                                    <Icon className="h-4 w-4" />
                                    {item.label}
                                </Link>
                            );
                        })}
                    </nav>
                </div>
                <div className="flex items-center gap-4">
                    <CustomConnectButton />
                </div>
            </div>
        </header>
    );
}
