"use client";

import { Activity, ListOrdered } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
	{ href: "/", label: "Overview", icon: Activity },
	{ href: "/traces", label: "Traces", icon: ListOrdered },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
	const pathname = usePathname();

	return (
		<div className="flex h-screen overflow-hidden">
			<aside className="hidden w-56 shrink-0 border-r border-border bg-sidebar md:flex md:flex-col">
				<div className="flex h-14 items-center border-b border-border px-4">
					<span className="font-mono text-lg font-bold text-foreground">ZenithPulse</span>
				</div>

				<nav className="flex flex-1 flex-col gap-1 p-3">
					{navItems.map((item) => {
						const isActive =
							pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
						return (
							<Link
								key={item.href}
								href={item.href}
								className={`flex items-center gap-2 px-3 py-2 text-xs uppercase tracking-wider transition-colors ${
									isActive
										? "border-b-2 text-foreground"
										: "text-muted-foreground hover:text-foreground"
								}`}
								style={
									isActive
										? {
												borderBottomColor: "var(--brand-accent)",
												backgroundColor: "oklch(0.65 0.13 57 / 0.08)",
											}
										: undefined
								}
							>
								<item.icon className="h-4 w-4" />
								{item.label}
							</Link>
						);
					})}
				</nav>

				<div className="border-t border-border p-4">
					<span className="text-[10px] uppercase tracking-wider text-muted-foreground">
						Bitget AI Base Camp S1
					</span>
				</div>
			</aside>

			<main className="flex-1 overflow-y-auto">{children}</main>
		</div>
	);
}
