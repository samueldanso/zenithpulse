import { DashboardShell } from "@/components/dashboard-shell";
import { Providers } from "@/components/providers";
import { ThemeProvider } from "@/components/theme-provider";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "ZenithPulse — Autonomous Trade Governance",
	description:
		"Autonomous runtime that derives behavioral contracts from Bitget Playbook backtest output, monitors live execution for drift, and enforces reactively.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
				<ThemeProvider
					attribute="class"
					defaultTheme="dark"
					enableSystem={false}
					disableTransitionOnChange
				>
					<Providers>
						<Toaster />
						<DashboardShell>{children}</DashboardShell>
					</Providers>
				</ThemeProvider>
			</body>
		</html>
	);
}
